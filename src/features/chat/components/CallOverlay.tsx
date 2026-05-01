"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { PhoneOff } from "lucide-react";
import IncomingCallModal from "../../../components/chat/IncomingCallModal";
import VideoCall1vs1 from "../../../components/chat/VideoCall1vs1";
import VideoCallGroup from "../../../components/chat/VideoCallGroup";
import { useAuth } from "../../../contexts/AuthContext";
import { useSocket } from "../../../contexts/SocketContext";
import apiClient from "../../../lib/axios";
import { useToast } from "../../../contexts/ToastContext";
import { useChatStore } from "../store/chatStore";

export default function CallOverlay() {
  const { user } = useAuth();
  const resolvedUserId = String(
    (user as any)?.id ?? (user as any)?._id ?? (user as any)?.userId ?? "",
  ).trim();
  const resolvedUserName =
    (user as any)?.displayName || (user as any)?.username || "User";

  const {
    incomingCall,
    activeCall,
    outgoingCall,
    isCallEnding,
    setActiveCall,
    setIncomingCall,
    setIsCallEnding,
    clearCallState,
  } = useChatStore();
  const { addToast } = useToast();
  const { emitCallAccepted, emitCallDeclined, emitEndCall, emitCallCancel } = useSocket();

  const cleanupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);

  const scheduleCleanup = useCallback(() => {
    if (cleanupTimerRef.current) {
      clearTimeout(cleanupTimerRef.current);
    }
    setIsCallEnding(true);
    cleanupTimerRef.current = setTimeout(() => {
      clearCallState();
      cleanupTimerRef.current = null;
    }, 1500);
  }, [clearCallState, setIsCallEnding]);

  useEffect(() => {
    return () => {
      if (cleanupTimerRef.current) {
        clearTimeout(cleanupTimerRef.current);
        cleanupTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const isRinging = (incomingCall || outgoingCall) && !activeCall;

    if (isRinging) {
      const audioPath = incomingCall
        ? "/sounds/ringtone.mp3"
        : "/sounds/waiting.mp3";

      if (
        !ringtoneRef.current ||
        !ringtoneRef.current.src.includes(audioPath.replace("/", ""))
      ) {
        if (ringtoneRef.current) {
          ringtoneRef.current.pause();
        }
        ringtoneRef.current = new Audio(audioPath);
        ringtoneRef.current.loop = true;
      }

      ringtoneRef.current.play().catch((err) => {
        console.warn("Audio play blocked by browser:", err);
      });
    } else if (ringtoneRef.current) {
      ringtoneRef.current.pause();
      ringtoneRef.current.currentTime = 0;
      ringtoneRef.current = null;
    }

    return () => {
      if (ringtoneRef.current) {
        ringtoneRef.current.pause();
        ringtoneRef.current.currentTime = 0;
      }
    };
  }, [incomingCall, outgoingCall, activeCall]);

  const handleAcceptIncomingCall = useCallback(() => {
    if (!incomingCall || !resolvedUserId) return;

    emitCallAccepted({
      conversationId: incomingCall.conversationId || incomingCall.roomId,
      roomId: incomingCall.roomId,
      callerId: String(incomingCall.callerId),
      callerName: incomingCall.callerName,
      receiverId: resolvedUserId,
      isGroupCall: incomingCall.isGroupCall,
    });

    const conversationId = incomingCall.conversationId || incomingCall.roomId;
    const roomId = String(incomingCall.roomId || "").replace(/:/g, "_");
    apiClient
      .get<{ appID: number; token: string }>("/api/calls/token", {
        params: { userID: resolvedUserId },
      })
      .then((response) => {
        setActiveCall({
          roomId,
          token: String(response.data.token),
          appId: Number(response.data.appID),
          conversationId,
          remoteUserId: String(incomingCall.callerId),
          remoteUserName: incomingCall.callerName,
          isGroupCall: incomingCall.isGroupCall,
        });
        setIncomingCall(null);
      })
      .catch(() => {
        addToast("Khong the tao phong cuoc goi", "error", 3000);
      });
  }, [addToast, emitCallAccepted, incomingCall, resolvedUserId, setActiveCall, setIncomingCall]);

  const handleDeclineIncomingCall = useCallback(() => {
    if (!incomingCall) return;

    if (incomingCall.isGroupCall) {
      // Group call: chỉ đóng modal/chuông của mình, KHÔNG emit call-rejected
      // Nếu emit → backend nhận "call-reject" → clearActiveCall → văng toàn bộ
      clearCallState();
      return;
    }

    // 1-1 call: emit call-rejected bình thường
    const conversationId = incomingCall.conversationId || incomingCall.roomId;
    emitCallDeclined({
      ...incomingCall,
      conversationId,
      receiverId: incomingCall.receiverId || resolvedUserId,
      to: String(incomingCall.callerId || ""),
      callerId: String(incomingCall.callerId || ""),
      from: resolvedUserId,
    });
  }, [clearCallState, emitCallDeclined, incomingCall, resolvedUserId]);

  const handleHangUp = useCallback(() => {
    if (!activeCall) return;

    if (activeCall.isGroupCall) {
      // Group call: chỉ đóng UI của bản thân, KHÔNG emit end-call
      // Phòng ZegoCloud vẫn sống cho người khác. Webhook room_close sẽ lưu call log
      // khi người cuối cùng rời phòng.
      scheduleCleanup();
      return;
    }

    // 1-1 call: emit end-call bình thường
    emitEndCall({
      conversationId: activeCall.conversationId,
      roomId: activeCall.roomId,
      callerId: resolvedUserId,
      callerName: resolvedUserName,
      receiverId: activeCall.remoteUserId,
      to: activeCall.remoteUserId,
      from: resolvedUserId,
      isGroupCall: false,
    });
    scheduleCleanup();
  }, [activeCall, emitEndCall, resolvedUserId, resolvedUserName, scheduleCleanup]);

  const handleCancelOutgoing = useCallback(() => {
    if (!outgoingCall) return;
    emitCallCancel({
      roomId: outgoingCall.roomId,
      conversationId: outgoingCall.conversationId || outgoingCall.roomId,
      callerId: resolvedUserId,
      callerName: resolvedUserName,
      receiverId: outgoingCall.receiverId,
      to: outgoingCall.receiverId,
      isGroupCall: outgoingCall.isGroupCall,
    });
    scheduleCleanup();
  }, [emitCallCancel, outgoingCall, resolvedUserId, resolvedUserName, scheduleCleanup]);

  const callRoomProps = useMemo(() => {
    if (!activeCall) return null;
    return {
      roomId: activeCall.roomId,
      token: activeCall.token,
      userId: resolvedUserId,
      userName: resolvedUserName,
      appId: activeCall.appId,
      onLeave: handleHangUp,
    };
  }, [activeCall, handleHangUp, resolvedUserId, resolvedUserName]);

  if (!incomingCall && !activeCall && !outgoingCall) return null;

  return (
    <div className="fixed inset-0 z-10000 pointer-events-none">
      {incomingCall && !activeCall && !outgoingCall && (
        <div className="pointer-events-auto">
          <IncomingCallModal
            callData={{
              ...incomingCall,
              conversationId: incomingCall.conversationId || incomingCall.roomId,
              receiverId: incomingCall.receiverId || "",
            }}
            onAccept={handleAcceptIncomingCall}
            onDecline={handleDeclineIncomingCall}
          />
        </div>
      )}

      {outgoingCall && !activeCall && (
        <div className="pointer-events-auto fixed inset-0 z-10000 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 w-full max-w-sm flex flex-col items-center shadow-2xl">
            <h3 className="text-xl font-bold text-gray-800 mb-2">Dang goi...</h3>
            <p className="text-gray-500 mb-8 animate-pulse">
              Dang goi cho {outgoingCall.receiverName}...
            </p>
            <button
              onClick={handleCancelOutgoing}
              className="w-14 h-14 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-transform hover:scale-110 shadow-lg"
              aria-label="Huy cuoc goi"
            >
              <PhoneOff className="text-white w-6 h-6" />
            </button>
          </div>
        </div>
      )}

      {activeCall && callRoomProps && (
        <div className="pointer-events-auto">
          {activeCall.isGroupCall ? (
            <VideoCallGroup {...callRoomProps} />
          ) : (
            <VideoCall1vs1 {...callRoomProps} />
          )}
        </div>
      )}
      {isCallEnding && (
        <div className="absolute inset-0 z-9999 flex flex-col items-center justify-center bg-gray-900 text-white animate-in fade-in duration-200">
          <div className="w-24 h-24 mb-4 rounded-full bg-gray-800 flex items-center justify-center">
            <span className="text-3xl font-semibold">
              {activeCall?.remoteUserName?.charAt(0) ||
                outgoingCall?.receiverName?.charAt(0) ||
                incomingCall?.callerName?.charAt(0) ||
                "!"}
            </span>
          </div>
          <h2 className="text-xl font-medium mb-2">Cuoc goi ket thuc</h2>
        </div>
      )}
    </div>
  );
}
