/**
 * Orchestration hook for group call flows.
 *
 * ⚠️ SEPARATE FROM DIRECT CALL MANAGER (useCallManager.ts).
 * Provides high-level actions that combine socket emission and
 * groupCallStore state transitions.
 *
 * Backend uses fire-and-forget pattern: client emits, server responds
 * with a SEPARATE event (not an ack callback).
 *
 * Socket events (Client → Server):
 *   - group-call:start
 *   - group-call:accept
 *   - group-call:reject
 *   - group-call:leave
 *   - group-call:end
 *
 * Socket events (Server → Client) are handled by useGroupCallSocketListener
 * EXCEPT for group-call:started and group-call:accepted which are handled
 * here as one-time response listeners.
 */

"use client";

import { useCallback } from "react";
import type { Socket } from "socket.io-client";
import { getSocket } from "../../lib/socket";
import { useGroupCallStore } from "./groupCallStore";
import type { GroupCallCredentials } from "./groupCallStore";
import { getActiveGroupCallForConversation } from "./groupCallApi";

// ── Socket event name constants (matching backend exactly) ───────────────────

const AGORA_APP_ID = process.env.NEXT_PUBLIC_AGORA_APP_ID || "";

const GROUP_EMIT_EVENTS = {
  START: "group-call:start",
  ACCEPT: "group-call:accept",
  REJECT: "group-call:reject",
  LEAVE: "group-call:leave",
  END: "group-call:end",
} as const;

const GROUP_RESPONSE_EVENTS = {
  STARTED: "group-call:started",
  ACCEPTED: "group-call:accepted",
  ERROR: "group-call:error",
} as const;

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildGroupCallWindowUrl(params: {
  callId: string;
  callType: string;
  conversationId: string;
  channelName: string;
  remoteName: string;
  mode: string;
  isHost?: boolean;
  appId?: string;
  token?: string;
  uid?: number;
}): string {
  const sp = new URLSearchParams({
    callId: params.callId,
    callType: params.callType,
    conversationId: params.conversationId,
    channelName: params.channelName,
    remoteName: params.remoteName,
    mode: params.mode,
    callKind: "group",
    isInitiator: params.isHost ? "true" : "false",
    isHost: params.isHost ? "true" : "false",
  });
  if (params.appId) sp.set("appId", params.appId);
  if (params.token) sp.set("token", params.token);
  if (params.uid != null) sp.set("uid", String(params.uid));
  return `/group-call/window?${sp.toString()}`;
}

function openGroupCallPopup(url: string): Window | null {
  try {
    return window.open(
      url,
      "ott-call-window",
      "width=420,height=640,menubar=no,toolbar=no,status=no,resizable=yes",
    );
  } catch {
    return null;
  }
}

function getActiveSocket(overrideSocket?: Socket): Socket {
  return overrideSocket ?? getSocket();
}

/**
 * Emit a fire-and-forget socket event (no ack expected from backend).
 * Returns a promise that resolves when the corresponding response event
 * fires, or rejects on timeout / error event.
 */
function emitAndWaitForResponse(
  emitEvent: string,
  data: Record<string, unknown>,
  responseEvent: string,
  errorEvent: string,
  socketOverride?: Socket,
  timeoutMs = 15000,
): Promise<Record<string, any>> {
  return new Promise((resolve, reject) => {
    const socket = getActiveSocket(socketOverride);
    let settled = false;

    const onResponse = (payload: Record<string, any>) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(payload);
    };

    const onError = (payload: Record<string, any>) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(payload?.message || `Socket event ${emitEvent} failed`));
    };

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        cleanup();
        reject(new Error(`Socket event ${emitEvent} timed out`));
      }
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timer);
      socket.off(responseEvent, onResponse);
      socket.off(errorEvent, onError);
    }

    // Register response listeners BEFORE emitting
    socket.once(responseEvent, onResponse);
    socket.once(errorEvent, onError);

    // Emit the event (fire-and-forget, no ack)
    socket.emit(emitEvent, data);
  });
}

/**
 * Fire-and-forget emit. No response expected.
 */
function emitFireAndForget(
  event: string,
  data: Record<string, unknown>,
  socketOverride?: Socket,
): void {
  const socket = getActiveSocket(socketOverride);
  socket.emit(event, data);
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useGroupCallManager(socketOverride?: Socket) {
  // Store state
  const phase = useGroupCallStore((s) => s.phase);
  const callSession = useGroupCallStore((s) => s.callSession);
  const callId = useGroupCallStore((s) => s.callId);
  const callType = useGroupCallStore((s) => s.callType);
  const credentials = useGroupCallStore((s) => s.credentials);
  const lastError = useGroupCallStore((s) => s.lastError);

  // Store actions
  const setPhase = useGroupCallStore((s) => s.setPhase);
  const setCallSession = useGroupCallStore((s) => s.setCallSession);
  const setCredentials = useGroupCallStore((s) => s.setCredentials);
  const setUidMapping = useGroupCallStore((s) => s.setUidMapping);
  const setError = useGroupCallStore((s) => s.setError);
  const reset = useGroupCallStore((s) => s.reset);

  // ── Start group call (initiator) ──────────────────────────────────────

  const startGroupCall = useCallback(
    async (
      conversationId: string,
      callType: "audio" | "video",
      memberUserIds: string[],
    ): Promise<void> => {
      // Guard: don't start if already in a group call
      const currentPhase = useGroupCallStore.getState().phase;
      if (currentPhase !== "idle") {
        setError({ code: "ALREADY_IN_CALL", message: "Đang trong cuộc gọi nhóm khác" });
        return;
      }

      console.log("[group-call-manager] startGroupCall emitting", { conversationId, callType, memberUserIds });

      // Check if there's already an active group call in this conversation
      try {
        const existing = await getActiveGroupCallForConversation(conversationId);
        if (existing) {
          console.log("[group-call-manager] Found existing active group call, joining instead", existing.callId);
          await joinExistingGroupCall(existing.callId);
          return;
        }
      } catch {
        // Ignore check errors — proceed to start new call
      }

      try {
        // Emit group-call:start and wait for group-call:started response
        const payload = await emitAndWaitForResponse(
          GROUP_EMIT_EVENTS.START,
          { conversationId, callType, memberUserIds },
          GROUP_RESPONSE_EVENTS.STARTED,
          GROUP_RESPONSE_EVENTS.ERROR,
          socketOverride,
        );

        console.log("[group-call-manager] group-call:started received", payload);

        // Extract credentials from the started payload
        const token = payload.token as string | undefined;
        const uid = payload.uid as number | undefined;
        const channelName = payload.channelName as string | undefined;
        const sessionId = payload.sessionId as string | undefined;

        if (token && uid !== undefined && channelName) {
          // Backend doesn't send appId in group-call:started — use env fallback
          const appId = (payload.appId as string) || AGORA_APP_ID;
          const creds: GroupCallCredentials = { appId, token, uid, channelName };
          setCredentials(creds);
          setUidMapping(uid, "");
        }

        // Build a minimal callSession from the payload
        if (sessionId) {
          setCallSession({
            callId: sessionId,
            conversationId,
            initiatorId: "",
            callMode: "group",
            callType,
            provider: "agora",
            channelName: channelName || "",
            participants: (payload.participants as any[]) || [],
            status: "active",
            endedReason: null,
            endedBy: null,
            startedAt: new Date().toISOString(),
            endedAt: null,
            durationSeconds: null,
            callLogCreated: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }

        // Host has credentials — go to "joining" (not "ringing").
        setPhase("joining");
        console.log("[group-call-manager] startGroupCall → joining", sessionId);

        // Open /call/window popup for the group call
        const url = buildGroupCallWindowUrl({
          callId: sessionId || "",
          callType: callType || "video",
          conversationId,
          channelName: channelName || "",
          remoteName: "Cuộc gọi nhóm",
          mode: "host-ringing",
          isHost: true,
          appId: (payload.appId as string) || AGORA_APP_ID,
          token,
          uid,
        });

        const popup = openGroupCallPopup(url);
        if (popup) {
          console.log("[group-call] Opened group call popup as host");
          useGroupCallStore.getState().setPopupOpened(true);
        } else {
          console.warn("[group-call] Popup blocked — GroupCallWindow fallback");
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Không thể bắt đầu cuộc gọi nhóm";
        console.error("[group-call-manager] startGroupCall failed:", msg);
        setError({ code: "START_FAILED", message: msg });
        setTimeout(() => useGroupCallStore.getState().reset(), 2000);
      }
    },
    [socketOverride],
  );

  // ── Accept group call (invitee) ───────────────────────────────────────

  const acceptGroupCall = useCallback(async (): Promise<void> => {
    const id = useGroupCallStore.getState().callId;
    if (!id) {
      setError({ code: "NO_CALL_ID", message: "Không tìm thấy cuộc gọi" });
      return;
    }

    console.log("[group-call-manager] acceptGroupCall emitting", { callId: id });

    try {
      // Emit group-call:accept and wait for group-call:accepted response
      const payload = await emitAndWaitForResponse(
        GROUP_EMIT_EVENTS.ACCEPT,
        { callId: id },
        GROUP_RESPONSE_EVENTS.ACCEPTED,
        GROUP_RESPONSE_EVENTS.ERROR,
        socketOverride,
      );

      console.log("[group-call-manager] group-call:accepted received", payload);

      // Extract credentials
      const token = payload.token as string | undefined;
      const uid = payload.uid as number | undefined;
      const channelName = payload.channelName as string | undefined;
      const sessionId = (payload.sessionId as string) || id;

      if (token && uid !== undefined && channelName) {
        const appId = (payload.appId as string) || AGORA_APP_ID;
        const creds: GroupCallCredentials = { appId, token, uid, channelName };
        setCredentials(creds);
        setUidMapping(uid, "");
      }

      setPhase("joining");
      console.log("[group-call-manager] acceptGroupCall → joining", sessionId);

      // Open /call/window popup
      const url = buildGroupCallWindowUrl({
        callId: sessionId,
        callType: "video",
        conversationId: useGroupCallStore.getState().callSession?.conversationId || "",
        channelName: channelName || "",
        remoteName: "Cuộc gọi nhóm",
        mode: "accepted",
        appId: (payload.appId as string) || AGORA_APP_ID,
        token,
        uid,
      });

      const popup = openGroupCallPopup(url);
      if (popup) {
        console.log("[group-call] Opened group call popup after accept");
        useGroupCallStore.getState().setPopupOpened(true);
      } else {
        console.warn("[group-call] Popup blocked — GroupCallWindow fallback");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Không thể tham gia cuộc gọi";
      console.error("[group-call-manager] acceptGroupCall failed:", msg);
      setError({ code: "ACCEPT_FAILED", message: msg });
    }
  }, [socketOverride]);

  // ── Join existing group call (by callId) ──────────────────────────────
  // Uses "call:join" (not "group-call:accept") because:
  //   accept = trả lời chuông lần đầu (status must be RINGING/INVITED)
  //   join   = vào/rejoin phòng đang diễn ra (works for LEFT, ACCEPTED, etc.)

  const joinExistingGroupCall = useCallback(async (
    callId: string,
    activeCall?: { callId: string; channelName: string } | null,
  ): Promise<void> => {
    console.log("[group-call-manager] joinExistingGroupCall", { callId, channelName: activeCall?.channelName });

    // Set callId in store so acceptGroupCall can use it
    setCallSession({
      callId,
      conversationId: "",
      initiatorId: "",
      callMode: "group",
      callType: "video",
      provider: "agora",
      channelName: activeCall?.channelName || "",
      participants: [],
      status: "active",
      endedReason: null,
      endedBy: null,
      startedAt: null,
      endedAt: null,
      durationSeconds: null,
      callLogCreated: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any);

    try {
      const ack = await new Promise<Record<string, any>>((resolve, reject) => {
        const socket = getActiveSocket(socketOverride);
        let settled = false;

        const timer = setTimeout(() => {
          if (!settled) {
            settled = true;
            reject(new Error("call:join timed out"));
          }
        }, 15000);

        socket.emit("call:join", { callId }, (response: any) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          if (response?.ok) {
            resolve(response);
          } else {
            reject(new Error(response?.error?.message || response?.error || "call:join failed"));
          }
        });
      });

      console.log("[group-call-manager] joinExistingGroupCall ack", ack);

      const token = ack.token as string | undefined;
      const uid = ack.uid as number | undefined;
      const channelName = ack.channelName as string | undefined;

      if (ack.callSession) {
        setCallSession(ack.callSession);
      }

      if (token && uid !== undefined && channelName) {
        const appId = (ack.appId as string) || AGORA_APP_ID;
        const creds: GroupCallCredentials = { appId, token, uid, channelName };
        setCredentials(creds);
        setUidMapping(uid, "");
      }

      setPhase("joining");

      // Open /call/window popup
      const url = buildGroupCallWindowUrl({
        callId,
        callType: "video",
        conversationId: useGroupCallStore.getState().callSession?.conversationId || "",
        channelName: channelName || "",
        remoteName: "Cuộc gọi nhóm",
        mode: "rejoin",
        appId: (ack.appId as string) || AGORA_APP_ID,
        token,
        uid,
      });

      const popup = openGroupCallPopup(url);
      if (popup) {
        console.log("[group-call] Opened group call popup after join");
        useGroupCallStore.getState().setPopupOpened(true);
      } else {
        console.warn("[group-call] Popup blocked — GroupCallWindow fallback");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Không thể tham gia cuộc gọi";
      console.error("[group-call-manager] joinExistingGroupCall failed:", msg);
      setError({ code: "JOIN_FAILED", message: msg });
    }
  }, [socketOverride]);

  // ── Reject group call (invitee) ───────────────────────────────────────

  const rejectGroupCall = useCallback(async (): Promise<void> => {
    const id = useGroupCallStore.getState().callId;
    if (!id) {
      reset();
      return;
    }

    console.log("[group-call-manager] rejectGroupCall emitting", { callId: id });
    emitFireAndForget(GROUP_EMIT_EVENTS.REJECT, { callId: id }, socketOverride);
    reset();
  }, [socketOverride]);

  // ── Leave group call ──────────────────────────────────────────────────

  const leaveGroupCall = useCallback(async (): Promise<void> => {
    const id = useGroupCallStore.getState().callId;
    if (!id) {
      reset();
      return;
    }

    console.log("[group-call-manager] leaveGroupCall emitting", { callId: id });
    emitFireAndForget(GROUP_EMIT_EVENTS.LEAVE, { callId: id }, socketOverride);
    setPhase("ended");
  }, [socketOverride]);

  // ── End group call (host) ─────────────────────────────────────────────

  const endGroupCall = useCallback(async (): Promise<void> => {
    const id = useGroupCallStore.getState().callId;
    if (!id) {
      reset();
      return;
    }

    console.log("[group-call-manager] endGroupCall emitting", { callId: id });
    emitFireAndForget(GROUP_EMIT_EVENTS.END, { callId: id }, socketOverride);
    setPhase("ended");
  }, [socketOverride]);

  // ── Transition to active (called after Agora join succeeds) ───────────

  const setActive = useCallback((): void => {
    setPhase("active");
  }, []);

  // ── Dismiss ended state ───────────────────────────────────────────────

  const dismissEnded = useCallback((): void => {
    reset();
  }, []);

  // ── Clear error ───────────────────────────────────────────────────────

  const clearError = useCallback((): void => {
    setError(null);
  }, []);

  return {
    // State
    phase,
    callSession,
    callId,
    callType,
    credentials,
    lastError,

    // Actions
    startGroupCall,
    acceptGroupCall,
    joinExistingGroupCall,
    rejectGroupCall,
    leaveGroupCall,
    endGroupCall,
    setActive,
    dismissEnded,
    clearError,
  };
}
