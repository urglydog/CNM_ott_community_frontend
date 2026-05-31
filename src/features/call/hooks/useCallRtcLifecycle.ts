/**
 * Call RTC lifecycle hook.
 * Wires the Agora RTC wrapper (agoraRtc.ts) with the callStore phase machine.
 *
 * Responsibilities:
 *  - Join Agora channel when tokenPayload is available (from startCall/acceptCall
 *    REST responses, getCallToken(), or active call recovery).
 *  - Leave Agora immediately on call:ended, call:cancelled, call:missed, or
 *    local end/cancel/reject.
 *  - Renew token on token-privilege-will-expire.
 *  - Handle reconnection (fetch fresh token when phase transitions from reconnecting).
 *  - Destroy RTC engine on logout.
 *
 * Token rules:
 *  - Tokens are NEVER stored in zustand — only in a module-level ref (memory-only).
 *  - consumeRtcToken() accepts a full TokenPayload (with appId from backend).
 *  - Socket acks (CallSocketAck) do NOT contain appId — use REST responses instead:
 *      startCall() → response.token (TokenPayload)
 *      acceptCall() → response.token (TokenPayload)
 *      getCallToken() → TokenPayload
 *      getActiveCall() → response.token (TokenPayload)
 *  - The lifecycle hook consumes the token when the phase is right.
 *
 * Usage:
 *  - Mount once in layout.tsx: useCallRtcLifecycle(isAuthenticated)
 *  - Call consumeRtcToken(response.token, enableVideo) from REST response handlers
 */

"use client";

import { useEffect, useRef } from "react";
import { useCallStore, type CallPhase } from "../callStore";
import * as callApi from "../callApi";
import * as rtc from "../rtc/agoraRtc";
import { sendMessage, onMessage, type CallWindowMessage } from "../callWindowChannel";
import type { TokenPayload, CallSession } from "../types";

// ── Module-level pending token (memory-only, never persisted) ──────────────

let _pendingToken: TokenPayload | null = null;
let _pendingVideo = false;

/**
 * Queue an Agora token for the lifecycle hook to consume on the next join
 * opportunity. Call this after receiving a full TokenPayload from:
 *  - startCall() REST response → response.token (contains appId from backend)
 *  - acceptCall() REST response → response.token (contains appId from backend)
 *  - getCallToken() REST → direct TokenPayload
 *  - getActiveCall() REST → response.token (contains appId from backend)
 *
 * IMPORTANT: Socket acks (CallSocketAck) do NOT contain appId — they only have
 * token string, uid, and channelName. Always use the REST API response's
 * TokenPayload which includes appId from the backend.
 *
 * The token stays in memory only — never written to localStorage/sessionStorage.
 */
export function consumeRtcToken(token: TokenPayload, enableVideo = false): void {
  _pendingToken = token;
  _pendingVideo = enableVideo;
  console.log("[call-lifecycle] Token queued for channel:", token.channelName);
}

// ── Lifecycle hook ──────────────────────────────────────────────────────────

/**
 * Observe callStore phase transitions and drive Agora RTC join/leave/renew.
 *
 * @param enabled – Whether the lifecycle is active (typically isAuthenticated).
 *                  When false, destroys the RTC engine and clears pending state.
 */
export function useCallRtcLifecycle(enabled: boolean): void {
  const joiningRef = useRef(false);
  const joinedCallIdRef = useRef<string | null>(null);
  const currentCallIdRef = useRef<string | null>(null);
  const prevPhaseRef = useRef<CallPhase>("idle");
  const enableVideoRef = useRef(false);

  /** When true, any in-flight reconnect must abort immediately. */
  const abortReconnectRef = useRef(false);
  /** Handle for any pending reconnect timer (setTimeout). */
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Main phase subscription: join / leave / reconnect ─────────────────────

  useEffect(() => {
    if (!enabled) return;

    const unsub = useCallStore.subscribe((state) => {
      const { phase, callSession } = state;
      const prevPhase = prevPhaseRef.current;
      prevPhaseRef.current = phase;

      // Track current callId for token renewal
      const callId = callSession?.callId ?? null;
      if (callId) {
        currentCallIdRef.current = callId;
        enableVideoRef.current = callSession?.callType === "video";
      }

      // ── NOTIFY POPUP: call accepted — tell popup to join Agora ──
      if (
        phase === "active" &&
        prevPhase === "outgoing" &&
        (state.callWindowOpening || state.callWindowJoined)
      ) {
        console.log("[call-lifecycle] Call accepted — notifying popup to join Agora");
        sendMessage({
          type: "main:call-accepted",
          callId: callId || "",
        });
      }

      // ── LEAVE: call ended (ended/missed/rejected/cancelled) — ALWAYS process ──
      //    Must handle even when popup is open, so we can notify the popup via BroadcastChannel.
      if (phase === "ended") {
        console.log(`[call-lifecycle] Phase ended — cancelling reconnect, leaving Agora`);
        cancelReconnectTimer();
        abortReconnectRef.current = true;
        joinedCallIdRef.current = null;

        // Notify the call window (popup) if it's open
        if (state.callWindowOpening || state.callWindowJoined) {
          sendMessage({
            type: "main:call-ended",
            callId: callId || "",
            reason: callSession?.endedReason || "user_ended",
          });
        }

        performLeave();
        return;
      }

      // ── SKIP: call window (popup) is handling Agora — main page must not join/reconnect ──
      if (state.callWindowOpening || state.callWindowJoined) {
        return;
      }

      // ── JOIN: phase is connecting/active + pending token + not already joined ──
      if (
        (phase === "connecting" || phase === "active") &&
        _pendingToken &&
        !rtc.isJoined() &&
        !rtc.isLeaving() &&
        !joiningRef.current &&
        joinedCallIdRef.current !== callId // don't re-join the same call
      ) {
        const token = _pendingToken;
        const video = _pendingVideo;
        _pendingToken = null;
        _pendingVideo = false;
        performJoin(token, video, callId);
        return;
      }

      // ── RECONNECT JOIN: phase changed to active/connecting without a pending token ──
      //    Covers two scenarios:
      //    1. reconnecting → active: disconnected participant reconnected
      //    2. outgoing → active: caller page refreshed during outgoing (token lost),
      //       callee accepted → caller needs a fresh token to join Agora
      if (
        (phase === "active" || phase === "connecting") &&
        !rtc.isJoined() &&
        !rtc.isLeaving() &&
        !joiningRef.current &&
        !abortReconnectRef.current &&
        !_pendingToken &&
        callId &&
        joinedCallIdRef.current !== callId // don't re-join the same call
      ) {
        console.log(`[agora:reconnect:start] phase=${phase} callId=${callId}`);
        performReconnectJoin(callId, callSession);
        return;
      }

    });

    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // ── Token renewal + camera fallback subscription ─────────────────────────

  useEffect(() => {
    if (!enabled) return;

    const unsubscribe = rtc.subscribe({
      onTokenWillExpire: () => {
        handleTokenWillExpire();
      },
      onTokenDidExpire: () => {
        console.error("[call-lifecycle] Token expired — call may be dropped");
      },
      onCameraFallback: (reason: string) => {
        console.warn(
          `[call-lifecycle] Camera unavailable (${reason}), continuing without video`,
        );
        // Update store so UI reflects camera-off state
        const session = useCallStore.getState().callSession;
        if (session) {
          useCallStore.getState().updateSession(session);
        }
      },
      onMicFallback: (reason: string) => {
        console.warn(
          `[call-lifecycle] Microphone unavailable (${reason}), continuing without audio`,
        );
        // Update store so UI reflects mic-off state
        const session = useCallStore.getState().callSession;
        if (session) {
          useCallStore.getState().updateSession(session);
        }
      },
      onLocalMediaWarning: (message: string | null) => {
        if (message) {
          console.warn(`[call-lifecycle] Local media warning: ${message}`);
        }
      },
    });

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // ── Call window BroadcastChannel sync (main page side) ─────────────────────
  //  Listens for popup open/close events and coordinates Agora ownership.

  useEffect(() => {
    if (!enabled) return;

    const unsub = onMessage((msg: CallWindowMessage) => {
      if (msg.type === "call-window:opened") {
        console.log("[call-lifecycle] Call window opened — main page defers Agora to popup");
        // Cancel any pending reconnect — popup is taking over
        cancelReconnectTimer();
        useCallStore.getState().setCallWindowJoined(true);
        useCallStore.getState().setCallWindowOpening(false);
        useCallStore.getState().setPendingCallWindowUrl(null);

        // If main page already joined Agora (popup was blocked initially, then
        // user manually opened), leave so the popup can own the channel.
        if (rtc.isJoined()) {
          console.log("[call-lifecycle] Leaving main page Agora (popup took over)");
          rtc.leaveChannel().catch(() => {});
          _pendingToken = null;
          _pendingVideo = false;
        }
      }

      if (msg.type === "call-window:accepting") {
        console.log("[call-lifecycle] Call window accepting — transitioning to connecting");
        const currentPhase = useCallStore.getState().phase;
        if (currentPhase === "incoming") {
          useCallStore.getState().setConnecting(useCallStore.getState().callSession!);
        }
      }

      if (msg.type === "call-window:accepted") {
        console.log("[call-lifecycle] Call window accepted — transitioning to active");
        const currentSession = useCallStore.getState().callSession;
        if (currentSession) {
          useCallStore.getState().setActive(currentSession);
        }
      }

      if (msg.type === "call-window:rejected") {
        console.log("[call-lifecycle] Call window rejected — resetting");
        useCallStore.getState().reset();
      }

      if (msg.type === "call-window:closed") {
        console.log("[call-lifecycle] Call window closed — cancelling reconnect, ending call");
        // Cancel any pending reconnect immediately
        cancelReconnectTimer();
        useCallStore.getState().setCallWindowJoined(false);
        useCallStore.getState().setCallWindowOpening(false);

        // If popup closed during ringing (before accept), clean up the call
        const phaseAfterClose = useCallStore.getState().phase;
        if (phaseAfterClose === "incoming" || phaseAfterClose === "outgoing") {
          const closeCallId = useCallStore.getState().getCallId();
          if (closeCallId) {
            // Incoming = callee closing popup → reject; Outgoing = caller closing → cancel
            if (phaseAfterClose === "incoming") {
              callApi.rejectCall(closeCallId).catch(() => {});
            } else {
              callApi.cancelCall(closeCallId).catch(() => {});
            }
          }
          useCallStore.getState().reset();
          return;
        }

        // End the call if still active on the main page
        const currentPhase = useCallStore.getState().phase;
        if (currentPhase !== "idle" && currentPhase !== "ended") {
          const callId = useCallStore.getState().getCallId();
          if (callId) {
            callApi.endCall(callId).catch(() => {});
          }
          const session = useCallStore.getState().callSession;
          if (session) {
            useCallStore.getState().setEnded(session);
          } else {
            useCallStore.getState().reset();
          }
        }
      }
    });

    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // ── Cleanup on disable (logout) ───────────────────────────────────────────

  useEffect(() => {
    if (!enabled) {
      // Full teardown — destroy client, clear all state
      console.log("[call-lifecycle] Disabling lifecycle — destroying RTC engine");
      cancelReconnectTimer();
      rtc.destroy().catch((err) => {
        console.warn("[call-lifecycle] destroy() error:", err);
      });
      _pendingToken = null;
      _pendingVideo = false;
      currentCallIdRef.current = null;
      joinedCallIdRef.current = null;
      joiningRef.current = false;
      prevPhaseRef.current = "idle";
      enableVideoRef.current = false;
    }
  }, [enabled]);

  // ── Internal helpers (stable references via closure over refs) ─────────────

  /** Cancel any pending reconnect timer and set the abort flag. */
  function cancelReconnectTimer(): void {
    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    abortReconnectRef.current = true;
  }

  /**
   * Join Agora channel with a known token.
   * Leaves any existing channel first (safety for channel switch).
   */
  async function performJoin(
    token: TokenPayload,
    video: boolean,
    callId?: string | null,
  ): Promise<void> {
    // Reset abort flag for new join
    abortReconnectRef.current = false;
    joiningRef.current = true;
    try {
      // Safety: leave old channel before joining new
      if (rtc.isJoined() || rtc.isLeaving()) {
        console.log("[call-lifecycle] Leaving old channel before joining new");
        await rtc.leaveChannel();
      }

      // Abort check: call may have ended while we were waiting
      if (abortReconnectRef.current) {
        console.warn("[agora:reconnect:cancelled] Join aborted before start — call ended");
        return;
      }

      await rtc.joinChannel(
        token.appId,
        token.channelName,
        token.token,
        token.uid,
        video,
      );

      // Abort check: call may have ended during join
      if (abortReconnectRef.current) {
        console.warn("[agora:reconnect:cancelled] Join completed but call ended — leaving");
        await rtc.leaveChannel();
        return;
      }

      joinedCallIdRef.current = callId ?? null;
      console.log("[call-lifecycle] Joined Agora channel:", token.channelName);
    } catch (err) {
      console.error("[call-lifecycle] Join failed:", err);
    } finally {
      joiningRef.current = false;
    }
  }

  /**
   * Reconnect: fetch a fresh token from the backend and rejoin.
   * Used when the phase transitions from "reconnecting" → "active"
   * (i.e., call:participant-reconnected for the current user).
   *
   * **Race-condition safe**: checks abortReconnectRef at every async boundary.
   * Never reconnects if phase is ended/cancelled/rejected or client is leaving.
   */
  async function performReconnectJoin(
    callId: string,
    callSession: CallSession | null,
  ): Promise<void> {
    abortReconnectRef.current = false;
    joiningRef.current = true;
    try {
      // Safety: leave old channel if somehow still joined
      if (rtc.isJoined() || rtc.isLeaving()) {
        await rtc.leaveChannel();
      }

      // Abort check after leave
      if (abortReconnectRef.current) {
        console.warn("[agora:reconnect:cancelled] Aborted after leave — call ended");
        return;
      }

      // Additional safety: check callStore phase is still valid
      const currentPhase = useCallStore.getState().phase;
      if (currentPhase === "ended" || currentPhase === "idle") {
        console.warn(`[agora:reconnect:skip-ended] phase=${currentPhase} — not reconnecting`);
        return;
      }

      console.log("[agora:reconnect:start] Fetching fresh token for reconnect:", callId);
      const payload = await callApi.getCallToken(callId);
      const isVideo = callSession?.callType === "video";

      // Abort check after token fetch (async network call)
      if (abortReconnectRef.current) {
        console.warn("[agora:reconnect:cancelled] Aborted after token fetch — call ended");
        return;
      }

      // Re-check phase after async token fetch
      const phaseAfterToken = useCallStore.getState().phase;
      if (phaseAfterToken === "ended" || phaseAfterToken === "idle") {
        console.warn(`[agora:reconnect:skip-ended] phase=${phaseAfterToken} after token fetch — not reconnecting`);
        return;
      }

      await rtc.joinChannel(
        payload.appId,
        payload.channelName,
        payload.token,
        payload.uid,
        isVideo,
      );

      // Abort check after join
      if (abortReconnectRef.current) {
        console.warn("[agora:reconnect:cancelled] Join completed but call ended — leaving");
        await rtc.leaveChannel();
        return;
      }

      joinedCallIdRef.current = callId;
      console.log("[call-lifecycle] Rejoined Agora after reconnection:", payload.channelName);
    } catch (err) {
      console.error("[call-lifecycle] Reconnect join failed:", err);
    } finally {
      joiningRef.current = false;
    }
  }

  /**
   * Leave Agora channel and clear pending state.
   * Idempotent — safe to call even if not joined.
   *
   * **Race-condition safe**: sets abortReconnectRef immediately,
   * cancels any pending reconnect timer, then leaves.
   */
  async function performLeave(): Promise<void> {
    // ── Cancel reconnect IMMEDIATELY (synchronous) ──
    cancelReconnectTimer();

    // Clear pending token immediately
    _pendingToken = null;
    _pendingVideo = false;
    currentCallIdRef.current = null;
    joinedCallIdRef.current = null;
    enableVideoRef.current = false;
    joiningRef.current = false;

    console.log("[call-lifecycle] performLeave: clearing state, leaving Agora");

    if (rtc.isJoined() || rtc.isLeaving()) {
      try {
        await rtc.leaveChannel();
        console.log("[agora:leave:done] Left Agora channel (call ended)");
      } catch (err) {
        console.warn("[call-lifecycle] Leave error:", err);
      }
    }
  }

  /**
   * Handle Agora's token-privilege-will-expire event.
   * Fetches a fresh token from the backend and renews it.
   */
  async function handleTokenWillExpire(): Promise<void> {
    const callId = currentCallIdRef.current;
    if (!callId) {
      console.warn("[call-lifecycle] Token expiring but no callId — cannot renew");
      return;
    }

    // Don't renew if we're in the process of leaving
    if (rtc.isLeaving()) {
      console.warn("[call-lifecycle] Token expiring but client is leaving — skipping renewal");
      return;
    }

    try {
      console.log("[call-lifecycle] Renewing token for call:", callId);
      const payload = await callApi.getCallToken(callId);
      await rtc.renewToken(payload.token);
      console.log("[call-lifecycle] Token renewed successfully");
    } catch (err) {
      console.error("[call-lifecycle] Token renewal failed:", err);
    }
  }
}
