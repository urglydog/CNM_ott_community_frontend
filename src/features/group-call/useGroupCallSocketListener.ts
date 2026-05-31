/**
 * Hook that bridges group-call socket events to the groupCallStore.
 *
 * ⚠️ SEPARATE FROM DIRECT CALL LISTENER (useCallSocketListener.ts).
 * Registers group-call:* and common call:* event listeners only.
 * Does NOT touch the direct-call socket or store.
 *
 * Event naming (from backend call.constants.js):
 *   Server → Client (group-specific):
 *     - group-call:incoming
 *     - group-call:accepted
 *     - group-call:rejected
 *     - group-call:ended
 *     - group-call:participant-joined
 *     - group-call:participant-left
 *     - group-call:state
 *     - group-call:error
 *   Server → Client (common — shared with direct call):
 *     - call:participant-disconnected
 *     - call:participant-reconnected
 *
 * No Agora SDK imports — pure transport → state bridge.
 *
 * Usage: Mount once inside SocketContext (or a sibling provider).
 */

"use client";

import { useEffect, useRef } from "react";
import type { Socket } from "socket.io-client";
import { useGroupCallStore } from "./groupCallStore";
import type {
  CallParticipantDisconnectedPayload,
  CallParticipantReconnectedPayload,
} from "./groupCallTypes";

// ── Socket event name constants ─────────────────────────────────────────────

/** Server → Client: group-specific events (matching backend groupCallSocketHandler.js) */
const GROUP_LISTEN_EVENTS = {
  INCOMING: "group-call:incoming",
  ACCEPTED: "group-call:accepted",
  REJECTED: "group-call:rejected",
  ENDED: "group-call:ended",
  PARTICIPANT_JOINED: "group-call:participant-joined",
  PARTICIPANT_LEFT: "group-call:participant-left",
  STATE: "group-call:state",
  ERROR: "group-call:error",
} as const;

/** Server → Client: common events (shared with direct call) */
const COMMON_LISTEN_EVENTS = {
  PARTICIPANT_DISCONNECTED: "call:participant-disconnected",
  PARTICIPANT_RECONNECTED: "call:participant-reconnected",
} as const;

// ── Guard helper ────────────────────────────────────────────────────────────

/**
 * Returns true when the incoming event should be processed.
 * Rejects events when the store is idle OR the callId doesn't match
 * the currently-tracked session.
 */
function shouldProcessEvent(payloadCallId?: string): boolean {
  const { phase, callSession } = useGroupCallStore.getState();
  if (phase === "idle") return false;
  if (payloadCallId && callSession && callSession.callId !== payloadCallId) return false;
  return true;
}

// ── Handler interface ───────────────────────────────────────────────────────

export interface GroupCallEventHandlers {
  // Group-specific
  onIncoming?: (payload: any) => void;
  onAccepted?: (payload: any) => void;
  onRejected?: (payload: any) => void;
  onEnded?: (payload: any) => void;
  onParticipantJoined?: (payload: any) => void;
  onParticipantLeft?: (payload: any) => void;
  onState?: (payload: any) => void;
  onError?: (payload: any) => void;
  // Common
  onParticipantDisconnected?: (payload: CallParticipantDisconnectedPayload) => void;
  onParticipantReconnected?: (payload: CallParticipantReconnectedPayload) => void;
}

/**
 * Register all group-call event listeners on the socket.
 * Returns a cleanup function that removes all listeners.
 */
export function registerGroupCallListeners(
  handlers: GroupCallEventHandlers,
  socket: Socket,
): () => void {
  const entries: Array<[string, ((...args: any[]) => void) | undefined]> = [
    [GROUP_LISTEN_EVENTS.INCOMING, handlers.onIncoming],
    [GROUP_LISTEN_EVENTS.ACCEPTED, handlers.onAccepted],
    [GROUP_LISTEN_EVENTS.REJECTED, handlers.onRejected],
    [GROUP_LISTEN_EVENTS.ENDED, handlers.onEnded],
    [GROUP_LISTEN_EVENTS.PARTICIPANT_JOINED, handlers.onParticipantJoined],
    [GROUP_LISTEN_EVENTS.PARTICIPANT_LEFT, handlers.onParticipantLeft],
    [GROUP_LISTEN_EVENTS.STATE, handlers.onState],
    [GROUP_LISTEN_EVENTS.ERROR, handlers.onError],
    [COMMON_LISTEN_EVENTS.PARTICIPANT_DISCONNECTED, handlers.onParticipantDisconnected],
    [COMMON_LISTEN_EVENTS.PARTICIPANT_RECONNECTED, handlers.onParticipantReconnected],
  ];

  for (const [event, handler] of entries) {
    if (handler) {
      socket.on(event, handler as (...args: any[]) => void);
    }
  }

  return () => {
    for (const [event, handler] of entries) {
      if (handler) {
        socket.off(event, handler as (...args: any[]) => void);
      }
    }
  };
}

// ── React hook ──────────────────────────────────────────────────────────────

/**
 * Register group-call socket event listeners and update the groupCallStore.
 *
 * @param currentUserId - The authenticated user's ID. When null, listeners are not registered.
 * @param socket - The Socket.IO socket instance. When null, listeners are deferred.
 */
export function useGroupCallSocketListener(
  currentUserId: string | null,
  socket: Socket | null,
): void {
  const cleanupRef = useRef<(() => void) | null>(null);

  // Store actions (stable references)
  const setPhase = useGroupCallStore((s) => s.setPhase);
  const setCallSession = useGroupCallStore((s) => s.setCallSession);
  const setCredentials = useGroupCallStore((s) => s.setCredentials);
  const setUidMapping = useGroupCallStore((s) => s.setUidMapping);
  const removeRemoteParticipant = useGroupCallStore((s) => s.removeRemoteParticipant);
  const markDisconnected = useGroupCallStore((s) => s.markDisconnected);
  const markReconnected = useGroupCallStore((s) => s.markReconnected);
  const setError = useGroupCallStore((s) => s.setError);

  // Ref to avoid stale closures
  const setParticipantProfiles = useGroupCallStore((s) => s.setParticipantProfiles);

  const actionsRef = useRef({
    setPhase,
    setCallSession,
    setCredentials,
    setUidMapping,
    removeRemoteParticipant,
    markDisconnected,
    markReconnected,
    setError,
    setParticipantProfiles,
  });
  actionsRef.current = {
    setPhase,
    setCallSession,
    setCredentials,
    setUidMapping,
    removeRemoteParticipant,
    markDisconnected,
    markReconnected,
    setError,
    setParticipantProfiles,
  };

  useEffect(() => {
    if (!currentUserId || !socket) {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      return;
    }

    const handlers: GroupCallEventHandlers = {
      onIncoming: (payload: any) => {
        const sessionId = payload.sessionId || payload.callId;
        console.log("[group-call-socket] group-call:incoming", sessionId);

        actionsRef.current.setCallSession({
          callId: sessionId,
          conversationId: payload.conversationId || "",
          initiatorId: payload.hostUserId || "",
          callMode: "group",
          callType: payload.callType === "video" ? "video" : "video",
          provider: "agora",
          channelName: payload.channelName || "",
          participants: payload.participants || [],
          status: "ringing",
          endedReason: null,
          endedBy: null,
          startedAt: null,
          endedAt: null,
          durationSeconds: null,
          callLogCreated: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as any);
        actionsRef.current.setPhase("ringing");
        // Store participant profiles from enriched payload
        if (Array.isArray(payload.participants)) {
          const profiles = new Map<number, { displayName: string; avatarUrl: string | null }>();
          for (const p of payload.participants) {
            if (p.agoraUid && p.displayName) {
              profiles.set(Number(p.agoraUid), {
                displayName: p.displayName,
                avatarUrl: p.avatarUrl || null,
              });
            }
          }
          if (profiles.size > 0) {
            actionsRef.current.setParticipantProfiles(profiles);
          }
        }

      },

      onAccepted: (payload: any) => {
        const callId = payload.sessionId || payload.callId;
        if (!shouldProcessEvent(callId)) return;
        console.log("[group-call-socket] group-call:accepted", callId);
      },

      onRejected: (payload: any) => {
        const callId = payload.sessionId || payload.callId;
        if (!shouldProcessEvent(callId)) return;
        console.log("[group-call-socket] group-call:rejected", callId);
      },

      onEnded: (payload: any) => {
        const callId = payload.sessionId || payload.callId;
        if (!shouldProcessEvent(callId)) return;
        console.log("[group-call-socket] group-call:ended", callId, "reason:", payload.reason);
        actionsRef.current.setPhase("ended");
      },

      onParticipantJoined: (payload: any) => {
        const callId = payload.sessionId || payload.callId;
        if (!shouldProcessEvent(callId)) return;
        const joinedUserId = payload.userId ?? payload.participantId ?? payload.acceptedBy ?? payload.joinedUserId;
        if (!joinedUserId) {
          console.warn("[group-call-socket] group-call:participant-joined — missing userId, full payload:", JSON.stringify(payload));
          return;
        }
        console.log("[group-call-socket] group-call:participant-joined", callId, "user", joinedUserId);
      },

      onParticipantLeft: (payload: any) => {
        const callId = payload.sessionId || payload.callId;
        if (!shouldProcessEvent(callId)) return;
        const leftUserId = payload.userId ?? payload.participantId ?? payload.leftUserId;
        if (!leftUserId) {
          console.warn("[group-call-socket] group-call:participant-left — missing userId, full payload:", JSON.stringify(payload));
          return;
        }
        console.log("[group-call-socket] group-call:participant-left", callId, "user", leftUserId);
      },

      onState: (payload: any) => {
        const callId = payload.sessionId || payload.callId;
        if (!shouldProcessEvent(callId)) return;
        console.log("[group-call-socket] group-call:state", callId, payload.status);
      },

      onError: (payload: any) => {
        const callId = payload.sessionId || payload.callId;
        if (!shouldProcessEvent(callId)) return;
        console.error(
          "[group-call-socket] group-call:error",
          payload.code,
          payload.message,
        );
        actionsRef.current.setError({ code: payload.code, message: payload.message });
      },

      onParticipantDisconnected: (payload: CallParticipantDisconnectedPayload) => {
        if (!shouldProcessEvent(payload.callId)) return;
        console.log(
          "[group-call-socket] call:participant-disconnected",
          payload.callId,
          "user",
          payload.userId,
        );
        actionsRef.current.markDisconnected(payload.userId);
      },

      onParticipantReconnected: (payload: CallParticipantReconnectedPayload) => {
        if (!shouldProcessEvent(payload.callId)) return;
        console.log(
          "[group-call-socket] call:participant-reconnected",
          payload.callId,
          "user",
          payload.userId,
        );
        actionsRef.current.markReconnected(payload.userId);
      },
    };

    cleanupRef.current = registerGroupCallListeners(handlers, socket);

    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, [currentUserId, socket]);
}
