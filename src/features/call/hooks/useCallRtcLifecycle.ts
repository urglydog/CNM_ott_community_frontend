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
  const currentCallIdRef = useRef<string | null>(null);
  const prevPhaseRef = useRef<CallPhase>("idle");
  const enableVideoRef = useRef(false);

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

      // ── JOIN: phase is connecting/active + pending token + not already joined ──
      if (
        (phase === "connecting" || phase === "active") &&
        _pendingToken &&
        !rtc.isJoined() &&
        !joiningRef.current
      ) {
        const token = _pendingToken;
        const video = _pendingVideo;
        _pendingToken = null;
        _pendingVideo = false;
        performJoin(token, video);
        return;
      }

      // ── RECONNECT JOIN: phase changed from reconnecting → active/connected ──
      //    No pending token available — fetch a fresh one via REST.
      if (
        prevPhase === "reconnecting" &&
        (phase === "active" || phase === "connecting") &&
        !rtc.isJoined() &&
        !joiningRef.current &&
        !_pendingToken &&
        callId
      ) {
        performReconnectJoin(callId, callSession);
        return;
      }

      // ── LEAVE: call ended (ended/missed/rejected/cancelled) ──
      if (phase === "ended") {
        performLeave();
        return;
      }
    });

    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // ── Token renewal on will-expire ──────────────────────────────────────────

  useEffect(() => {
    if (!enabled) return;

    const unsubscribe = rtc.subscribe({
      onTokenWillExpire: () => {
        handleTokenWillExpire();
      },
      onTokenDidExpire: () => {
        console.error("[call-lifecycle] Token expired — call may be dropped");
      },
    });

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // ── Cleanup on disable (logout) ───────────────────────────────────────────

  useEffect(() => {
    if (!enabled) {
      // Full teardown — destroy client, clear all state
      rtc.destroy().catch((err) => {
        console.warn("[call-lifecycle] destroy() error:", err);
      });
      _pendingToken = null;
      _pendingVideo = false;
      currentCallIdRef.current = null;
      joiningRef.current = false;
      prevPhaseRef.current = "idle";
      enableVideoRef.current = false;
    }
  }, [enabled]);

  // ── Internal helpers (stable references via closure over refs) ─────────────

  /**
   * Join Agora channel with a known token.
   * Leaves any existing channel first (safety for channel switch).
   */
  async function performJoin(token: TokenPayload, video: boolean): Promise<void> {
    joiningRef.current = true;
    try {
      // Safety: leave old channel before joining new
      if (rtc.isJoined()) {
        console.log("[call-lifecycle] Leaving old channel before joining new");
        await rtc.leaveChannel();
      }

      await rtc.joinChannel(
        token.appId,
        token.channelName,
        token.token,
        token.uid,
        video,
      );
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
   */
  async function performReconnectJoin(
    callId: string,
    callSession: CallSession | null,
  ): Promise<void> {
    joiningRef.current = true;
    try {
      // Safety: leave old channel
      if (rtc.isJoined()) {
        await rtc.leaveChannel();
      }

      console.log("[call-lifecycle] Fetching fresh token for reconnect:", callId);
      const payload = await callApi.getCallToken(callId);
      const isVideo = callSession?.callType === "video";

      await rtc.joinChannel(
        payload.appId,
        payload.channelName,
        payload.token,
        payload.uid,
        isVideo,
      );
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
   */
  async function performLeave(): Promise<void> {
    // Clear pending token immediately
    _pendingToken = null;
    _pendingVideo = false;
    currentCallIdRef.current = null;
    enableVideoRef.current = false;

    if (rtc.isJoined()) {
      try {
        await rtc.leaveChannel();
        console.log("[call-lifecycle] Left Agora channel (call ended)");
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
