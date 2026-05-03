"use client";

import React, { useMemo } from "react";
import dynamic from "next/dynamic";
import IncomingCallModal from "./IncomingCallModal";
import { useCallManager } from "../hooks/useCallManager";
import { useAuth } from "../../../contexts/AuthContext";

const VideoCallRoom = dynamic(() => import("./VideoCallRoom"), {
  ssr: false,
});

export default function CallManagerOverlay() {
  const { user } = useAuth();
  const { incomingCall, activeCall, outgoingCall, currentUser, acceptCall, rejectCall, endCall } =
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
  // Khi outgoingCall -> activeCall chuyển đổi, component cũ bị unmount trước khi VideoCallRoom xuất hiện
  const showVideoCall = callRoomProps && callRoomProps.token;

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

      {/* VideoCallRoom — chỉ mount khi có token */}
      {showVideoCall && (
        <div className="pointer-events-auto fixed inset-0 z-10001">
          <VideoCallRoom {...callRoomProps} />
        </div>
      )}
    </>
  );
}
