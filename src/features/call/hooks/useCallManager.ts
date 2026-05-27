"use client";

import { useCallback, useEffect } from "react";
import { useAuth } from "../../../contexts/AuthContext";
import { useToast } from "../../../contexts/ToastContext";
import { useCallStore } from "../callStore";
import * as callApi from "../callApi";
import { consumeRtcToken } from "./useCallRtcLifecycle";
import type { CallType, CallSession, TokenPayload } from "../types";

// ── Call window helpers ────────────────────────────────────────────────────

/**
 * Build the URL for the pop-out call window with all required params.
 */
function buildCallWindowUrl(
  token: TokenPayload,
  callSession: CallSession,
  remoteName: string,
  isInitiator: boolean,
): string {
  const params = new URLSearchParams({
    appId: token.appId,
    channelName: token.channelName,
    token: token.token,
    uid: String(token.uid),
    callType: callSession.callType,
    remoteName,
    callId: callSession.callId,
    isInitiator: String(isInitiator),
  });
  return `/call/window?${params.toString()}`;
}

/**
 * Attempt to open the call window as a browser popup.
 * Returns the Window object if successful, null if blocked.
 */
function openCallWindow(url: string): Window | null {
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

/**
 * Orchestration hook for direct 1-1 call flows.
 *
 * Provides high-level actions (startCall, acceptCall, rejectCall, cancelCall, endCall)
 * that combine REST API calls, token queuing, and callStore state transitions.
 *
 * Usage:
 *   const { startCall, acceptCall, rejectCall, cancelCall, endCall } = useCallManager();
 *   await startCall(conversationId, "video");
 */
export function useCallManager() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const phase = useCallStore((s) => s.phase);
  const callSession = useCallStore((s) => s.callSession);
  const isInitiator = useCallStore((s) => s.isInitiator);
  const errorMessage = useCallStore((s) => s.errorMessage);
  const errorCode = useCallStore((s) => s.errorCode);

  // Set currentUserId in callStore when user is available
  useEffect(() => {
    if (user?.id) {
      useCallStore.getState().setCurrentUserId(String(user.id));
    } else {
      useCallStore.getState().setCurrentUserId(null);
    }
  }, [user?.id]);

  /**
   * Start an outgoing direct call.
   * 1. POST /api/calls/start → { call, token }
   * 2. Queue token for RTC lifecycle join
   * 3. Transition callStore to "outgoing"
   */
  const startCall = useCallback(
    async (conversationId: string, callType: CallType): Promise<void> => {
      try {
        // Guard: don't start if already in a call
        const currentPhase = useCallStore.getState().phase;
        if (currentPhase !== "idle") {
          addToast("Bạn đang trong cuộc gọi khác", "error");
          return;
        }

        const response = await callApi.startCall(conversationId, callType);

        // Build call window URL with token + call info
        const remoteName =
          (response.call as any).recipientName || "Đối phương";
        const url = buildCallWindowUrl(
          response.token,
          response.call,
          remoteName,
          true,
        );

        // Try to open pop-out call window (from user gesture — should succeed)
        const popup = openCallWindow(url);

        if (popup) {
          // Popup opened — it will own the Agora lifecycle
          useCallStore.getState().setCallWindowOpening(true);
          // Do NOT consumeRtcToken — the popup joins Agora directly
        } else {
          // Popup blocked by browser — fall back to inline Agora (floating window)
          useCallStore.getState().setPendingCallWindowUrl(url);
          consumeRtcToken(response.token, callType === "video");
          addToast(
            "Cửa sổ bị chặn. Sử dụng cửa sổ nổi.",
            "info",
          );
        }

        // Transition to outgoing phase
        useCallStore.getState().setOutgoing(response.call);
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : "Không thể bắt đầu cuộc gọi";
        useCallStore.getState().setError(msg);
        addToast(msg, "error");
        // Reset to idle after a brief delay so error is visible
        setTimeout(() => useCallStore.getState().reset(), 2000);
      }
    },
    [addToast],
  );

  /**
   * Accept an incoming call.
   * 1. POST /api/calls/:callId/accept → { call, token }
   * 2. Queue token for RTC lifecycle join
   * 3. Transition callStore to "connecting"
   */
  const acceptCall = useCallback(async (): Promise<void> => {
    const callId = useCallStore.getState().getCallId();
    if (!callId) return;

    try {
      const response = await callApi.acceptCall(callId);

      const callType = response.call.callType;

      // Build call window URL with token + call info
      const remoteName =
        (response.call as any).initiatorName || "Đối phương";
      const url = buildCallWindowUrl(
        response.token,
        response.call,
        remoteName,
        false,
      );

      // Try to open pop-out call window (from user gesture)
      const popup = openCallWindow(url);

      if (popup) {
        useCallStore.getState().setCallWindowOpening(true);
      } else {
        useCallStore.getState().setPendingCallWindowUrl(url);
        consumeRtcToken(response.token, callType === "video");
        addToast(
          "Cửa sổ bị chặn. Sử dụng cửa sổ nổi.",
          "info",
        );
      }

      // Transition to connecting phase
      useCallStore.getState().setConnecting(response.call);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Không thể chấp nhận cuộc gọi";
      useCallStore.getState().setError(msg);
      addToast(msg, "error");
    }
  }, [addToast]);

  /**
   * Reject an incoming call.
   * 1. POST /api/calls/:callId/reject
   * 2. Reset callStore to idle
   */
  const rejectCall = useCallback(async (): Promise<void> => {
    const callId = useCallStore.getState().getCallId();
    if (!callId) return;

    try {
      await callApi.rejectCall(callId);
    } catch {
      // Ignore — the socket event will handle the ended state
    } finally {
      useCallStore.getState().reset();
    }
  }, []);

  /**
   * Cancel an outgoing call (before it's accepted).
   * 1. POST /api/calls/:callId/cancel
   * 2. Reset callStore to idle
   */
  const cancelCall = useCallback(async (): Promise<void> => {
    const callId = useCallStore.getState().getCallId();
    if (!callId) return;

    try {
      await callApi.cancelCall(callId);
    } catch {
      // Ignore — the socket event will handle the ended state
    } finally {
      useCallStore.getState().reset();
    }
  }, []);

  /**
   * End an active call.
   * 1. POST /api/calls/:callId/end
   * 2. Transition to "ended" briefly, then reset
   */
  const endCall = useCallback(async (): Promise<void> => {
    const callId = useCallStore.getState().getCallId();
    if (!callId) return;

    try {
      const response = await callApi.endCall(callId);
      useCallStore.getState().setEnded(response.call);
    } catch {
      // Still transition to ended even if API fails
      const session = useCallStore.getState().callSession;
      if (session) {
        useCallStore.getState().setEnded(session);
      } else {
        useCallStore.getState().reset();
      }
    }
  }, []);

  /**
   * Dismiss the ended state and reset to idle.
   */
  const dismissEnded = useCallback(() => {
    useCallStore.getState().reset();
  }, []);

  /**
   * Retry opening the call window popup (when initial open was blocked).
   * Only works during outgoing/incoming phase before Agora joins.
   */
  const openCallWindowManually = useCallback(() => {
    const url = useCallStore.getState().pendingCallWindowUrl;
    if (!url) return;

    const popup = openCallWindow(url);
    if (popup) {
      useCallStore.getState().setCallWindowOpening(true);
      useCallStore.getState().setPendingCallWindowUrl(null);
      // consumeRtcToken may have been called — useCallRtcLifecycle will
      // see callWindowOpening=true and skip the join
    } else {
      addToast("Không thể mở cửa sổ. Vui lòng cho phép popup.", "error");
    }
  }, [addToast]);

  /**
   * Clear the current error.
   */
  const clearError = useCallback(() => {
    useCallStore.getState().clearError();
  }, []);

  return {
    // State
    phase,
    callSession,
    isInitiator,
    errorMessage,
    errorCode,

    // Actions
    startCall,
    acceptCall,
    rejectCall,
    cancelCall,
    endCall,
    dismissEnded,
    clearError,
    openCallWindowManually,
  };
}
