/**
 * Group call popup sync hook.
 *
 * Listens to the group-specific BroadcastChannel (ott-group-call-window)
 * and resets the group call store when the popup closes.
 *
 * This is the group equivalent of useCallRtcLifecycle's BroadcastChannel
 * section, but only handles state cleanup — no Agora management.
 *
 * Must be mounted in the main layout (not in the popup).
 */

"use client";

import { useEffect } from "react";
import { useGroupCallStore } from "./groupCallStore";
import { onGroupMessage } from "./groupCallWindowChannel";

export function useGroupCallPopupSync(): void {
  useEffect(() => {
    const unsub = onGroupMessage((msg) => {
      if (msg.type === "group-call-window:opened") {
        console.log("[group-popup-sync] Group call window opened:", msg.callId);
        useGroupCallStore.getState().setPopupOpened(true);
      }

      if (msg.type === "group-call-window:closed") {
        console.log("[group-popup-sync] Group call window closed:", msg.callId, "reason:", msg.reason);
        useGroupCallStore.getState().setPopupOpened(false);

        // Reset group call state so user can start/join a new call immediately
        const store = useGroupCallStore.getState();
        const currentPhase = store.phase;

        if (currentPhase === "ringing" || currentPhase === "ended" || msg.reason === "reject") {
          // Incoming was rejected/cancelled, or call already ended — full reset
          store.reset();
        } else if (currentPhase === "active" || currentPhase === "joining") {
          // Call was active — mark as ended, then reset after brief delay
          store.setPhase("ended");
          setTimeout(() => {
            useGroupCallStore.getState().reset();
          }, 2000);
        } else {
          // Idle or other — just reset
          store.reset();
        }
      }

      if (msg.type === "group-call-window:rejected") {
        console.log("[group-popup-sync] Group call rejected:", msg.callId);
        useGroupCallStore.getState().reset();
      }

      if (msg.type === "group-call-window:accepted") {
        console.log("[group-popup-sync] Group call accepted:", msg.callId);
        // Store that popup is open
        useGroupCallStore.getState().setPopupOpened(true);
      }
    });

    return unsub;
  }, []);
}
