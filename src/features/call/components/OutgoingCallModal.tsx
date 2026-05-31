"use client";

import { PhoneOff, PhoneOutgoing, AlertCircle, ExternalLink } from "lucide-react";
import { useCallManager } from "../hooks/useCallManager";
import { useCallStore } from "../callStore";

/**
 * Modal overlay shown when an outgoing call is being placed.
 * Displays the callee info, "Đang gọi..." status, and a cancel button.
 * Also shows error state (e.g., "Người dùng đang bận").
 *
 * When the popup was blocked by the browser, shows a manual "Open call window" button.
 *
 * Renders when callStore.phase === "outgoing" (or when errorMessage is set).
 */
export function OutgoingCallModal() {
  const { phase, callSession, cancelCall, errorMessage, errorCode, clearError, openCallWindowManually } = useCallManager();
  const pendingCallWindowUrl = useCallStore((s) => s.pendingCallWindowUrl);
  const callWindowOpening = useCallStore((s) => s.callWindowOpening);
  const callWindowJoined = useCallStore((s) => s.callWindowJoined);

  // Show error overlay even if phase has already transitioned
  if (errorMessage && errorCode === "CALL_BUSY") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-80 flex flex-col items-center gap-6 animate-in fade-in zoom-in-95 duration-200">
          <div className="w-20 h-20 rounded-full bg-orange-100 flex items-center justify-center">
            <AlertCircle className="w-10 h-10 text-orange-500" />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-900">Không thể gọi</h3>
            <p className="text-sm text-gray-500 mt-1">{errorMessage}</p>
          </div>
          <button
            type="button"
            onClick={clearError}
            className="px-6 py-2 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors cursor-pointer text-sm font-medium"
          >
            Đã hiểu
          </button>
        </div>
      </div>
    );
  }

  if (phase !== "outgoing" || !callSession) return null;

  // Don't show modal when call window popup is open — popup handles the ringing UI
  if (callWindowOpening || callWindowJoined) return null;

  const isVideo = callSession.callType === "video";

  // For outgoing calls, the remote participant is the callee
  const remoteParticipant = callSession.participants.find(
    (p) => p.userId !== callSession.initiatorId,
  );

  // Callee name — may be stored in callSession metadata by the socket handler
  const calleeName =
    (callSession as any).recipientName || "Đang gọi...";

  // Show manual open button when popup was blocked
  const showManualOpen = !!pendingCallWindowUrl && !callWindowOpening;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-80 flex flex-col items-center gap-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Callee avatar */}
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-blue-500 flex items-center justify-center text-white text-3xl font-bold shadow-lg">
            {calleeName.charAt(0).toUpperCase()}
          </div>
          {/* Ringing animation */}
          <div className="absolute inset-0 rounded-full bg-blue-400 animate-ping opacity-20" />
        </div>

        {/* Callee info */}
        <div className="text-center">
          <h3 className="text-xl font-semibold text-gray-900">
            {calleeName}
          </h3>
          <p className="text-sm text-gray-500 mt-1 flex items-center justify-center gap-1.5">
            <PhoneOutgoing className="w-4 h-4 animate-pulse" />
            {isVideo ? "Đang gọi video..." : "Đang gọi..."}
          </p>
        </div>

        {/* Manual open button — shown when popup was blocked */}
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

        {/* Cancel button */}
        <div className="mt-2">
          <button
            type="button"
            onClick={cancelCall}
            className="w-16 h-16 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg cursor-pointer"
            title="Huỷ cuộc gọi"
          >
            <PhoneOff className="w-7 h-7" />
          </button>
        </div>
      </div>
    </div>
  );
}
