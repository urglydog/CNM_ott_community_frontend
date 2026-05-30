"use client";

import { Phone, PhoneOff, Users } from "lucide-react";
import { useGroupCallStore } from "../groupCallStore";
import { useGroupCallManager } from "../useGroupCallManager";

/**
 * Modal shown when a group call incoming event is received.
 *
 * Renders when:
 *  - groupCallStore.phase === "ringing"
 *  - No credentials yet (user hasn't accepted)
 *  - callSession exists
 *
 * Shows caller info, participants list, and accept/reject buttons.
 */
export function GroupIncomingCallModal() {
  const phase = useGroupCallStore((s) => s.phase);
  const callSession = useGroupCallStore((s) => s.callSession);
  const credentials = useGroupCallStore((s) => s.credentials);
  const { acceptGroupCall, rejectGroupCall } = useGroupCallManager();

  // Only render when ringing AND no credentials (invitee who hasn't accepted yet)
  if (phase !== "ringing" || !callSession || credentials) return null;

  const isVideo = callSession.callType === "video";
  const initiatorName =
    (callSession as any).initiatorName ||
    `User ${callSession.initiatorId}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-80 flex flex-col items-center gap-6">
        {/* Caller avatar with pulse */}
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-green-500 flex items-center justify-center text-white text-3xl font-bold shadow-lg">
            <Users className="w-10 h-10" />
          </div>
          <div className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-20" />
        </div>

        {/* Info */}
        <div className="text-center">
          <h3 className="text-xl font-semibold text-gray-900">
            Cuộc gọi nhóm
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {initiatorName} đang gọi{" "}
            {isVideo ? "video" : "thoại"} cho nhóm
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {callSession.participants.length} người tham gia
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-8 mt-2">
          <button
            type="button"
            onClick={rejectGroupCall}
            className="w-16 h-16 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg cursor-pointer"
            title="Từ chối"
          >
            <PhoneOff className="w-7 h-7" />
          </button>

          <button
            type="button"
            onClick={acceptGroupCall}
            className="w-16 h-16 rounded-full bg-green-500 text-white flex items-center justify-center hover:bg-green-600 transition-colors shadow-lg animate-pulse cursor-pointer"
            title="Tham gia"
          >
            <Phone className="w-7 h-7" />
          </button>
        </div>
      </div>
    </div>
  );
}
