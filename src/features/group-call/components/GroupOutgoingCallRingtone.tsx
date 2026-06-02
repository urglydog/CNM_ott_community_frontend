"use client";

import { useEffect } from "react";
import { useGroupCallStore } from "../groupCallStore";
import { playOutgoingRingtone, stopRingtone } from "../../../utils/audioUtils";

import { useAuth } from "../../../contexts/AuthContext";

/**
 * Invisible component that plays the outgoing ringtone for the host.
 * This MUST run in the main window (not the popup) so that the browser's
 * autoplay policy allows the audio to play (since the user clicked "Call" here).
 */
export function GroupOutgoingCallRingtone() {
  const phase = useGroupCallStore((s) => s.phase);
  const credentials = useGroupCallStore((s) => s.credentials);
  const callSession = useGroupCallStore((s) => s.callSession);
  const { user } = useAuth();

  const isHost = callSession?.initiatorId === String(user?.id);
  // The host is waiting while the phase is "joining".
  // (Invitees who accept also go to "joining", so checking isHost is important).
  const isWaiting = phase === "joining" && isHost && !!credentials;

  useEffect(() => {
    if (isWaiting) {
      playOutgoingRingtone();
    } else {
      stopRingtone();
    }
    return () => {
      stopRingtone();
    };
  }, [isWaiting]);

  return null;
}
