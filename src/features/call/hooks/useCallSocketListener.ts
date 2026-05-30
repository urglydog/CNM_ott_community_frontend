/**
 * Hook that bridges call socket events to the call store.
 * Registers all server→client call event listeners and dispatches
 * state updates to useCallStore.
 *
 * Usage: Mount this once inside SocketContext (or a sibling provider)
 * so it lives as long as the socket connection.
 *
 * No Agora SDK imports — pure transport → state bridge.
 *
 * NOTE: Group call events are temporarily excluded (1-1 only).
 */

"use client";

import { useEffect, useRef } from "react";
import type { Socket } from "socket.io-client";
import { useCallStore } from "../callStore";
import { registerCallListeners, type CallEventHandlers } from "../callSocket";
import type {
  CallIncomingPayload,
  CallAcceptedPayload,
  CallRejectedPayload,
  CallCancelledPayload,
  CallEndedPayload,
  CallMissedPayload,
  CallParticipantDisconnectedPayload,
  CallParticipantReconnectedPayload,
  CallStateUpdatedPayload,
  CallBusyPayload,
  CallErrorPayload,
} from "../types";

/**
 * Register call socket event listeners and update the call store.
 *
 * @param currentUserId - The authenticated user's ID. When null, listeners are not registered.
 * @param socket - The Socket.IO socket instance from SocketContext. When null, listeners are deferred.
 */
export function useCallSocketListener(
  currentUserId: string | null,
  socket: Socket | null,
): void {
  const cleanupRef = useRef<(() => void) | null>(null);

  // Get store actions (stable references)
  const setCurrentUserId = useCallStore((s) => s.setCurrentUserId);
  const setIncoming = useCallStore((s) => s.setIncoming);
  const setOutgoing = useCallStore((s) => s.setOutgoing);
  const setActive = useCallStore((s) => s.setActive);
  const updateSession = useCallStore((s) => s.updateSession);
  const setReconnecting = useCallStore((s) => s.setReconnecting);
  const setEnded = useCallStore((s) => s.setEnded);
  const setError = useCallStore((s) => s.setError);

  // Keep a ref to the latest actions to avoid stale closures in the listener
  const actionsRef = useRef({
    setIncoming,
    setOutgoing,
    setActive,
    updateSession,
    setReconnecting,
    setEnded,
    setError,
  });
  actionsRef.current = {
    setIncoming,
    setOutgoing,
    setActive,
    updateSession,
    setReconnecting,
    setEnded,
    setError,
  };

  useEffect(() => {
    if (!currentUserId || !socket) {
      // Cleanup any existing listeners when user logs out or socket is not ready
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      return;
    }

    // Set the current user ID in the store
    setCurrentUserId(currentUserId);

    const handlers: CallEventHandlers = {
      onIncoming: (payload: CallIncomingPayload) => {
        console.log("[call-socket] direct-call:incoming", payload.callId);
        actionsRef.current.setIncoming(payload.callSession);
      },

      onAccepted: (payload: CallAcceptedPayload) => {
        console.log("[call-socket] direct-call:accepted", payload.callId, "by", payload.userId);
        actionsRef.current.updateSession(payload.callSession);
      },

      onRejected: (payload: CallRejectedPayload) => {
        console.log("[call-socket] direct-call:rejected", payload.callId, "by", payload.userId);
        actionsRef.current.updateSession(payload.callSession);
      },

      onCancelled: (payload: CallCancelledPayload) => {
        console.log("[call-socket] direct-call:ended (cancelled)", payload.callId, "by", payload.cancelledBy);
        actionsRef.current.setEnded(payload.callSession);
      },

      onEnded: (payload: CallEndedPayload) => {
        console.log("[call-socket] direct-call:ended", payload.callId, "reason:", payload.reason);
        actionsRef.current.setEnded(payload.callSession);
      },

      onMissed: (payload: CallMissedPayload) => {
        console.log("[call-socket] call:missed", payload.callId, "user", payload.userId);
        const store = useCallStore.getState();
        if (String(payload.userId) === String(store.currentUserId)) {
          actionsRef.current.setEnded(payload.callSession);
        } else {
          actionsRef.current.updateSession(payload.callSession);
        }
      },

      onParticipantDisconnected: (payload: CallParticipantDisconnectedPayload) => {
        console.log(
          "[call-socket] call:participant-disconnected",
          payload.callId,
          "user",
          payload.userId,
          "grace",
          payload.graceMs,
        );
        const store = useCallStore.getState();
        if (String(payload.userId) === String(store.currentUserId)) {
          actionsRef.current.setReconnecting(payload.callSession);
        } else {
          actionsRef.current.updateSession(payload.callSession);
        }
      },

      onParticipantReconnected: (payload: CallParticipantReconnectedPayload) => {
        console.log("[call-socket] call:participant-reconnected", payload.callId, "user", payload.userId);
        actionsRef.current.updateSession(payload.callSession);
      },

      onStateUpdated: (payload: CallStateUpdatedPayload) => {
        console.log("[call-socket] call:state-updated", payload.callId);
        actionsRef.current.updateSession(payload.callSession);
      },

      onBusy: (payload: CallBusyPayload) => {
        console.log("[call-socket] call:busy", payload.callId, payload.message);
        actionsRef.current.setError(payload.message, "CALL_BUSY");
        setTimeout(() => {
          useCallStore.getState().reset();
        }, 2000);
      },

      onError: (payload: CallErrorPayload) => {
        // Guard: ignore errors when no direct call is active.
        // Backend group-call errors can leak via call:error when
        // callSocketHandler.js has duplicate group-call:* handlers.
        const directPhase = useCallStore.getState().phase;
        if (directPhase === "idle") return;
        console.error("[call-socket] call:error", payload.code, payload.message);
        actionsRef.current.setError(payload.message, payload.code);
        setTimeout(() => {
          useCallStore.getState().reset();
        }, 2000);
      },
    };

    // Register listeners on the shared socket from SocketContext
    cleanupRef.current = registerCallListeners(handlers, socket);

    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, [currentUserId, setCurrentUserId, socket]);
}