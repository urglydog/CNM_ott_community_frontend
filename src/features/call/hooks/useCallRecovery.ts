/**
 * Call recovery hook.
 * Handles crash/background recovery by checking for active calls via REST API.
 *
 * Recovery flows:
 * 1. On mount (app startup / page refresh): call GET /api/calls/active
 * 2. On visibility change (tab foreground): call GET /api/calls/active
 *
 * If an active call is found, updates the call store so the UI can
 * prompt the user to rejoin.
 *
 * No Agora SDK imports — uses REST API only.
 */

"use client";

import { useEffect, useRef, useCallback } from "react";
import { useCallStore } from "../callStore";
import { getActiveCall } from "../callApi";
import { consumeRtcToken } from "./useCallRtcLifecycle";
import type { GetActiveCallResponse } from "../types";

/**
 * Hook that checks for active calls on startup and when the tab
 * comes back to the foreground.
 *
 * @param enabled - Whether recovery is enabled (e.g., only when user is authenticated)
 */
export function useCallRecovery(enabled: boolean): void {
  const hasCheckedOnMount = useRef(false);
  const isChecking = useRef(false);

  const updateSession = useCallStore((s) => s.updateSession);
  const setActive = useCallStore((s) => s.setActive);
  const setReconnecting = useCallStore((s) => s.setReconnecting);
  const phase = useCallStore((s) => s.phase);

  const performRecovery = useCallback(async () => {
    // Don't check if already in an active/reconnecting/outgoing/incoming call
    const currentPhase = useCallStore.getState().phase;
    if (currentPhase === "active" || currentPhase === "reconnecting" || currentPhase === "outgoing" || currentPhase === "incoming" || currentPhase === "connecting") {
      return;
    }

    // Prevent concurrent checks
    if (isChecking.current) return;
    isChecking.current = true;

    try {
      const response: GetActiveCallResponse = await getActiveCall();

      if (response.call) {
        console.log("[call-recovery] Found active call:", response.call.callId, "status:", response.call.status);

        // Skip group calls — they are recovered by group-call system separately
        if (response.call.callId?.startsWith("gc_") || response.call.callMode === "group") {
          console.log("[call-recovery] Skipping group call:", response.call.callId);
          return;
        }

        // Determine the current user's participant state
        const store = useCallStore.getState();
        const myId = store.currentUserId;
        const me = response.call.participants.find(
          (p) => String(p.userId) === String(myId),
        );

        if (!me) {
          // User is not a participant — nothing to recover
          return;
        }

        if (me.connectionState === "disconnected") {
          // User was disconnected — show reconnecting state
          setReconnecting(response.call);
        } else if (response.call.status === "active" && me.status === "accepted") {
          // User has an active call — restore active state
          // If backend returned a token, queue it for the RTC lifecycle hook
          if (response.token) {
            consumeRtcToken(response.token, response.call.callType === "video");
          }
          setActive(response.call);
        } else if (response.call.status === "ringing" && me.status === "invited") {
          // User has a pending incoming call — restore incoming state
          updateSession(response.call);
        }
      }
    } catch (err) {
      // Non-critical — log and continue
      console.warn("[call-recovery] Failed to check active call:", err);
    } finally {
      isChecking.current = false;
    }
  }, [updateSession, setActive, setReconnecting]);

  // ── Recovery on mount (startup / page refresh) ──────────────────────────

  useEffect(() => {
    if (!enabled) {
      // Reset so recovery fires again after re-login
      hasCheckedOnMount.current = false;
      return;
    }
    if (hasCheckedOnMount.current) return;
    hasCheckedOnMount.current = true;

    // Small delay to let the socket connect first
    const timer = setTimeout(() => {
      performRecovery();
    }, 1000);

    return () => clearTimeout(timer);
  }, [enabled, performRecovery]);

  // ── Recovery on visibility change (tab foreground) ──────────────────────

  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // Only check if we're in idle or ended phase
        const currentPhase = useCallStore.getState().phase;
        if (currentPhase === "idle" || currentPhase === "ended") {
          performRecovery();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, performRecovery]);

  // ── Recovery on socket reconnect ────────────────────────────────────────

  useEffect(() => {
    if (!enabled) return;

    // Listen for socket reconnection events
    // The socket library dispatches a custom event we can listen to
    const handleOnline = () => {
      const currentPhase = useCallStore.getState().phase;
      if (currentPhase === "idle" || currentPhase === "ended" || currentPhase === "reconnecting") {
        // Slight delay to let socket reconnect
        setTimeout(() => performRecovery(), 500);
      }
    };

    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, [enabled, performRecovery]);
}
