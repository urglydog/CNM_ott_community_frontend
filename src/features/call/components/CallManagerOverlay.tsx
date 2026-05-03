"use client";

import React, { useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import IncomingCallModal from "./IncomingCallModal";
import { useCallManager, videoCallRef } from "../hooks/useCallManager";
import { useAuth } from "../../../contexts/AuthContext";

const VideoCallRoom = dynamic(() => import("./VideoCallRoom"), {
  ssr: false,
  loading: () => null,
});

export default function CallManagerOverlay() {
  const { user } = useAuth();
  const { incomingCall, activeCall, outgoingCall, acceptCall, rejectCall, endCall } =
    useCallManager();

  const resolvedUserId = String(
    (user as any)?.id ?? (user as any)?._id ?? (user as any)?.userId ?? "",
  ).trim();
  const resolvedUserName =
    (user as any)?.displayName || (user as any)?.username || "User";

  const callRoomProps = useMemo(() => {
    if (!activeCall) return null;
    return {
      roomId: activeCall.roomId,
      isGroupCall: Boolean(activeCall.isGroupCall),
      token: activeCall.token ?? "",
      appId: activeCall.appId ?? 0,
      callType: activeCall.callType,
      currentUser: {
        userId: resolvedUserId,
        userName: resolvedUserName,
      },
      onLeave: endCall,
    };
  }, [activeCall, resolvedUserId, resolvedUserName, endCall]);

  // Chỉ render VideoCallRoom khi activeCall thực sự có token
  const showVideoCall = !!(callRoomProps && callRoomProps.token);

  // ============================================================
  // ✅ SAFETY-NET: Cleanup Zego nếu component unmount khi có activeCall
  // ============================================================
  // Lý do:
  // - SocketContext lắng nghe 'call-ended' từ Server và gọi gracefulLeave
  // - NHưng nếu Component unmount trước khi 'call-ended' tới (network delay)
  // - → VideoCallRoom cleanup không được gọi
  // - → Zego background process vẫn chạy, tìm DOM → crash "createSpan"
  //
  // Solution:
  // - Nếu CallManagerOverlay unmount khi có activeCall
  // - → Gọi gracefulLeave() ngay lập tức để cleanup Zego
  useEffect(() => {
    return () => {
      // Khi component unmount
      if (activeCall && videoCallRef.current) {
        console.log(
          "[CallManagerOverlay cleanup] activeCall still exists, force gracefulLeave"
        );
        videoCallRef.current.gracefulLeave().catch((err) => {
          console.warn("[CallManagerOverlay cleanup] gracefulLeave error:", err);
        });
      }
    };
  }, [activeCall]);

  return (
    <>
      {incomingCall && (
        <div className="pointer-events-auto">
          <IncomingCallModal
            callData={incomingCall}
            onAccept={acceptCall}
            onDecline={rejectCall}
          />
        </div>
      )}

      {/* Giao diện "Đang gọi..." — chỉ hiện khi có outgoingCall và chưa có activeCall */}
      {outgoingCall && !activeCall && (
        <div className="fixed inset-0 z-10000 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-4 min-w-72">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <span className="text-3xl">📞</span>
            </div>
            <p className="text-base font-semibold text-gray-800">
              Đang gọi cho {outgoingCall.receiverName || "người dùng"}...
            </p>
            <div className="flex gap-3 mt-2">
              <button
                onClick={endCall}
                className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-full font-medium transition-colors"
              >
                Hủy cuộc gọi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VideoCallRoom — mount khi có token, ref gắn vào module-level videoCallRef */}
      {showVideoCall && (
        <div className="pointer-events-auto fixed inset-0 z-10001">
          <VideoCallRoom ref={videoCallRef} {...callRoomProps!} />
        </div>
      )}
    </>
  );
}
