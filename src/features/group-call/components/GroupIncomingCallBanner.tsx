"use client";

import { Phone, PhoneOff, Users } from "lucide-react";
import { useGroupCallStore } from "../groupCallStore";
import { useGroupCallManager } from "../useGroupCallManager";

/**
 * Lightweight incoming group call notification banner.
 *
 * Renders when:
 *  - groupCallStore.phase === "ringing"
 *  - callSession exists
 *  - No credentials yet (user hasn't accepted)
 *  - popupOpened is false
 *
 * Does NOT join Agora. Only shows caller info + Accept/Reject buttons.
 * On Accept: calls acceptGroupCall() which opens /group-call/window popup.
 * On Reject: calls rejectGroupCall() which resets store.
 */
export function GroupIncomingCallBanner() {
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
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 animate-slideUp">
      <div className="bg-gray-900 rounded-2xl shadow-2xl border border-white/10 overflow-hidden min-w-[340px] max-w-[420px]">
        {/* Warning-style banner at top */}
        <div className="bg-green-600/90 px-4 py-2 flex items-center gap-2">
          <Users className="w-4 h-4 text-white" />
          <span className="text-white text-sm font-medium">
            Cuộc gọi nhóm {isVideo ? "video" : "thoại"}
          </span>
        </div>

        <div className="flex items-center gap-3 px-4 py-3">
          {/* Avatar */}
          <div className="relative">
            <div className="w-11 h-11 rounded-full bg-green-500 flex items-center justify-center text-white shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-20" />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">
              {initiatorName}
            </p>
            <p className="text-gray-400 text-xs">
              đang gọi {isVideo ? "video" : "thoại"} cho nhóm
              {callSession.participants?.length > 0 && ` · ${callSession.participants.length} người`}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={rejectGroupCall}
              className="w-10 h-10 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors cursor-pointer"
              title="Từ chối"
            >
              <PhoneOff className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={acceptGroupCall}
              className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center hover:bg-green-600 transition-colors animate-pulse cursor-pointer"
              title="Tham gia"
            >
              <Phone className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
