"use client";

import { Phone, PhoneOff, Video, PhoneCall, ExternalLink } from "lucide-react";
import { useCallManager } from "../hooks/useCallManager";
import { useCallStore } from "../callStore";

/**
 * Modal overlay shown when a direct incoming call is received.
 * Displays caller info, call type, and accept/reject buttons.
 *
 * After accepting, if the popup was blocked, shows a manual "Open call window" button.
 *
 * Only renders when callStore.phase === "incoming".
 */
export function IncomingCallModal() {
  const { phase, callSession, acceptCall, rejectCall, openCallWindowManually } = useCallManager();
  const pendingCallWindowUrl = useCallStore((s) => s.pendingCallWindowUrl);
  const callWindowOpening = useCallStore((s) => s.callWindowOpening);
  const callWindowJoined = useCallStore((s) => s.callWindowJoined);

  if (phase !== "incoming" || !callSession) return null;

  // Don't show modal when call window popup is open — popup handles the ringing UI
  if (callWindowOpening || callWindowJoined) return null;

  const isVideo = callSession.callType === "video";

  // Find the initiator (caller) from participants
  const caller = callSession.participants.find(
    (p) => p.userId === callSession.initiatorId,
  );

  // The caller name is set by the socket listener into callSession metadata
  // For now, use a fallback — the socket incoming payload has initiatorName
  // which is stored in the callSession by useCallSocketListener
  const callerName =
    (callSession as any).initiatorName || "Người gọi";

  // Show manual open button when popup was blocked after accepting
  const showManualOpen = !!pendingCallWindowUrl && !callWindowOpening;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-80 flex flex-col items-center gap-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Caller avatar */}
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-blue-500 flex items-center justify-center text-white text-3xl font-bold shadow-lg">
            {callerName.charAt(0).toUpperCase()}
          </div>
          {/* Pulse animation */}
          <div className="absolute inset-0 rounded-full bg-blue-400 animate-ping opacity-20" />
        </div>

        {/* Caller info */}
        <div className="text-center">
          <h3 className="text-xl font-semibold text-gray-900">
            {callerName}
          </h3>
          <p className="text-sm text-gray-500 mt-1 flex items-center justify-center gap-1.5">
            {isVideo ? (
              <>
                <Video className="w-4 h-4" />
                Cuộc gọi video đến
              </>
            ) : (
              <>
                <PhoneCall className="w-4 h-4" />
                Cuộc gọi thoại đến
              </>
            )}
          </p>
        </div>

        {/* Manual open button — shown when popup was blocked after accept */}
        {showManualOpen && (
          <button
            type="button"
            onClick={openCallWindowManually}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors cursor-pointer text-sm font-medium shadow-md"
            title="Mở cửa sổ gọi"
          >
            <ExternalLink className="w-4 h-4" />
            Mở cửa sổ gọi
          </button>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-8 mt-2">
          {/* Reject */}
          <button
            type="button"
            onClick={rejectCall}
            className="w-16 h-16 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg cursor-pointer"
            title="Từ chối"
          >
            <PhoneOff className="w-7 h-7" />
          </button>

          {/* Accept */}
          <button
            type="button"
            onClick={acceptCall}
            className="w-16 h-16 rounded-full bg-green-500 text-white flex items-center justify-center hover:bg-green-600 transition-colors shadow-lg animate-pulse cursor-pointer"
            title="Chấp nhận"
          >
            <Phone className="w-7 h-7" />
          </button>
        </div>
      </div>
    </div>
  );
}
