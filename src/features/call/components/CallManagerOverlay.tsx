"use client";

import React, { useMemo, useEffect } from "react";
import IncomingCallModal from "./IncomingCallModal";
import OutgoingCallModal from "./OutgoingCallModal";
import VideoCallRoom from "./VideoCallRoom";
import { useCallManager, videoCallRef } from "../hooks/useCallManager";
import { useAuth } from "../../../contexts/AuthContext";

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

  // Chi render VideoCallRoom khi activeCall thuc su co token
  const showVideoCall = !!(callRoomProps && callRoomProps.token);

  // ============================================================
  // SAFETY-NET: Cleanup Zego neu component unmount khi co activeCall
  // ============================================================
  useEffect(() => {
    return () => {
      if (activeCall && videoCallRef.current) {
        console.log(
          "[CallManagerOverlay cleanup] activeCall still exists, force gracefulLeave"
        );
        videoCallRef.current.gracefulLeave().catch((err: unknown) => {
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
            autoDeclineAfterSec={30}
          />
        </div>
      )}

      {outgoingCall && !activeCall && (
        <OutgoingCallModal
          receiverName={outgoingCall.receiverName || "Nguoi dung"}
          callType={outgoingCall.callType}
          isGroupCall={outgoingCall.isGroupCall}
          onCancel={endCall}
          autoCancelAfterSec={35}
        />
      )}

      {/* VideoCallRoom - mount khi co token, ref gan vao module-level videoCallRef */}
      {showVideoCall && (
        <div className="pointer-events-auto fixed inset-0 z-10001">
          <VideoCallRoom ref={videoCallRef} {...callRoomProps!} />
        </div>
      )}
    </>
  );
}
