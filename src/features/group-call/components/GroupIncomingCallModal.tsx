"use client";

import { Phone, PhoneOff, Video, PhoneCall, Users } from "lucide-react";
import { useGroupCallStore } from "../groupCallStore";
import { useGroupCallManager } from "../useGroupCallManager";

/**
 * Full-screen centered modal for incoming group calls.
 *
 * Matches the style of the direct 1-1 IncomingCallModal but is a separate
 * component. Does NOT join Agora — only shows caller info + Accept/Reject.
 *
 * On Accept: calls acceptGroupCall() which opens /group-call/window popup.
 * On Reject: calls rejectGroupCall() which resets the store.
 *
 * Renders when:
 *   groupCallStore.phase === "ringing"
 *   callSession exists
 *   No credentials (user hasn't accepted)
 *   popupOpened is false
 */
export function GroupIncomingCallModal() {
  const phase = useGroupCallStore((s) => s.phase);
  const callSession = useGroupCallStore((s) => s.callSession);
  const credentials = useGroupCallStore((s) => s.credentials);
  const popupOpened = useGroupCallStore((s) => s.popupOpened);
  const { acceptGroupCall, rejectGroupCall } = useGroupCallManager();

  // Only render when ringing AND no credentials AND popup not open
  if (phase !== "ringing" || !callSession || credentials || popupOpened) return null;

  const isVideo = callSession.callType === "video";
  const initiatorName =
    (callSession as any).initiatorName ||
    `User ${callSession.initiatorId}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-80 flex flex-col items-center gap-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Group avatar */}
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-green-500 flex items-center justify-center text-white shadow-lg">
            <Users className="w-10 h-10" />
          </div>
          {/* Pulse animation */}
          <div className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-20" />
        </div>

        {/* Caller info */}
        <div className="text-center">
          <h3 className="text-xl font-semibold text-gray-900">
            Cuộc gọi nhóm
          </h3>
          <p className="text-sm text-gray-500 mt-1 flex items-center justify-center gap-1.5">
            {isVideo ? (
              <>
                <Video className="w-4 h-4" />
                Video nhóm · {initiatorName}
              </>
            ) : (
              <>
                <PhoneCall className="w-4 h-4" />
                Thoại nhóm · {initiatorName}
              </>
            )}
          </p>
          {callSession.participants?.length > 0 && (
            <p className="text-xs text-gray-400 mt-1">
              {callSession.participants.length} người tham gia
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-8 mt-2">
          {/* Reject */}
          <button
            type="button"
            onClick={rejectGroupCall}
            className="w-16 h-16 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg cursor-pointer"
            title="Từ chối"
          >
            <PhoneOff className="w-7 h-7" />
          </button>

          {/* Accept */}
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
