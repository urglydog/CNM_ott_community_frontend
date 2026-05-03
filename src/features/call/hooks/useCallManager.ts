"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useAuth } from "../../../contexts/AuthContext";
import { useSocket } from "../../../contexts/SocketContext";
import { useChatStore } from "../../chat/store/chatStore";
import { dmConversationId } from "../../chat/hooks/useChatHooks";
import { groupConversationId } from "../../chat/hooks/useGroupChat";
import {
  useCallStore,
  type IncomingCallState,
  type ActiveCallState,
} from "../store/callStore";
import apiClient from "../../../lib/axios";
import { useToast } from "../../../contexts/ToastContext";

const normalizeRoomId = (roomId: string) => String(roomId || "").replace(/:/g, "_");

export function useCallManager() {
  const incomingCall = useCallStore((state) => state.incomingCall);
  const activeCall = useCallStore((state) => state.activeCall);
  const outgoingCall = useCallStore((state) => state.outgoingCall);
  const setIncomingCall = useCallStore((state) => state.setIncomingCall);
  const setActiveCall = useCallStore((state) => state.setActiveCall);
  const setOutgoingCall = useCallStore((state) => state.setOutgoingCall);

  const { user } = useAuth();
  const { addToast } = useToast();
  const {
    socket,
    emitCallUser,
    emitCallAccepted,
    emitCallDeclined,
    emitEndCall,
    emitJoinGroupCall,
    emitLeaveGroupCall,
    onIncomingCall,
    onCallDeclined,
    onEndCall,
  } = useSocket();
  const { chatMode, selectedFriend, selectedGroup } = useChatStore();

  const currentUserId = String(
    (user as any)?.id ?? (user as any)?._id ?? (user as any)?.userId ?? "",
  ).trim();
  const currentUserName =
    (user as any)?.displayName || (user as any)?.username || "User";

  const currentUser = useMemo(() => {
    if (!currentUserId) return null;
    return { userId: currentUserId, userName: currentUserName };
  }, [currentUserId, currentUserName]);

  const friendName = selectedFriend?.friend_display_name ?? "";
  const groupName = selectedGroup?.name ?? "";

  const incomingCallRef = useRef<IncomingCallState | null>(null);
  const activeCallRef = useRef<ActiveCallState | null>(null);
  const currentUserIdRef = useRef(currentUserId);

  useEffect(() => {
    incomingCallRef.current = incomingCall;
  }, [incomingCall]);

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  useEffect(() => {
    const unsubscribeIncoming = onIncomingCall((data) => {
      const resolvedUserId = currentUserIdRef.current;
      const callerId = String((data as any)?.callerId ?? (data as any)?.from ?? "");
      const receiverId = String((data as any)?.receiverId ?? (data as any)?.to ?? "");

      if (callerId && callerId === resolvedUserId) return;
      if (receiverId && resolvedUserId && receiverId !== resolvedUserId) return;

      setIncomingCall({
        roomId: normalizeRoomId(String((data as any)?.roomId || "")),
        conversationId: (data as any)?.conversationId,
        callerId,
        callerName: (data as any)?.callerName || "Nguoi dung",
        receiverId: receiverId || resolvedUserId,
        isGroupCall: (data as any)?.isGroupCall,
        callType: (data as any)?.callType || "video",
      });
    });

    const unsubscribeDeclined = onCallDeclined((data) => {
      const current = incomingCallRef.current;
      if (!current) return;

      const currentRoomId = normalizeRoomId(String(current.roomId || ""));
      const canceledRoomId = normalizeRoomId(String((data as any)?.roomId || ""));
      if (currentRoomId === canceledRoomId) {
        setIncomingCall(null);
      }
    });

    const unsubscribeEnd = onEndCall((data) => {
      const current = activeCallRef.current;
      if (!current) return;

      const endedRoomId = normalizeRoomId(String((data as any)?.roomId || ""));
      const currentRoomId = normalizeRoomId(String(current.roomId || ""));

      if (currentRoomId === endedRoomId) {
        setActiveCall(null);
        setOutgoingCall(null);
        setIncomingCall(null);
      }
    });

    return () => {
      unsubscribeIncoming();
      unsubscribeDeclined();
      unsubscribeEnd();
    };
  }, [
    onIncomingCall,
    onCallDeclined,
    onEndCall,
    setIncomingCall,
    setActiveCall,
  ]);

  const startCall = useCallback(
    (callType: "video" | "audio" = "video") => {
      if (!currentUserId) return;

      const isGroupCall = chatMode === "GROUP";
      const hasTarget = isGroupCall ? selectedGroup != null : selectedFriend != null;
      if (!hasTarget) return;

      // Guard: Nhóm chỉ được phép gọi video, không hỗ trợ gọi thoại
      if (isGroupCall && callType === "audio") {
        console.warn("[startCall] Chức năng gọi thoại không được hỗ trợ trong Group Chat.");
        addToast("Gọi thoại không khả dụng trong nhóm. Vui lòng chọn gọi video.", "warning", 4000);
        return;
      }

      const directFriendId = String(
        (selectedFriend as any)?.friend_id ??
          (selectedFriend as any)?._id ??
          (selectedFriend as any)?.id ??
          "",
      );

      if (!isGroupCall && !directFriendId) return;

      const normalizedGroupId = isGroupCall
        ? String(selectedGroup!.groupId).replace("group_", "")
        : "";

      const rawRoomId = isGroupCall
        ? `group_call_${normalizedGroupId}`
        : `call_1vs1_${[currentUserId, directFriendId].sort().join("_")}`;
      const safeRoomId = normalizeRoomId(rawRoomId);
      const conversationId = isGroupCall
        ? groupConversationId(selectedGroup!.groupId)
        : dmConversationId(currentUserId, directFriendId);

      if (isGroupCall) {
        emitCallUser({
          roomId: safeRoomId,
          callerId: currentUserId,
          callerName: currentUserName,
          groupId: String(selectedGroup!.groupId),
          receiverId: String(selectedGroup!.groupId),
          conversationId,
          isGroupCall: true,
          callType,
        });

        // Lấy token ngay để initiator có thể tham gia phòng video ngay lập tức
        apiClient
          .get<{ appID: number; token: string }>("/api/calls/token", {
            params: { userID: currentUserId },
          })
          .then((response) => {
            setActiveCall({
              roomId: safeRoomId,
              token: String(response.data.token),
              appId: Number(response.data.appID),
              conversationId,
              remoteUserId: String(selectedGroup!.groupId),
              remoteUserName: groupName || "Nhom",
              isGroupCall: true,
              callType,
            });
          })
          .catch(() => {
            addToast("Khong the tao phong cuoc goi", "error");
          });
        return;
      }

      emitCallUser({
        roomId: safeRoomId,
        callerId: currentUserId,
        callerName: currentUserName,
        receiverId: directFriendId,
        to: directFriendId,
        conversationId,
        isGroupCall: false,
        callType,
      });

      // Báo cho CallManagerOverlay hiển thị giao diện đợi cho người gọi
      setOutgoingCall({
        roomId: safeRoomId,
        conversationId,
        receiverId: directFriendId,
        receiverName: friendName,
        isGroupCall: false,
        callType,
      });
      // KHÔNG setActiveCall ở đây — Caller phải ĐỢI sự kiện call-accepted
      // từ Socket trả về kèm Token mới được mở phòng.
    },
    [
      chatMode,
      currentUserId,
      currentUserName,
      selectedFriend,
      selectedGroup,
      emitCallUser,
      groupName,
      setOutgoingCall,
      friendName,
      addToast,
    ]
  );

  const acceptCall = useCallback(
    async (callData: IncomingCallState) => {
      if (!user || !socket) return;

      // Guard: Nhóm chỉ được phép gọi video, chặn chấp nhận group audio call
      if (callData.isGroupCall && callData.callType === "audio") {
        console.warn("[acceptCall] Không thể chấp nhận gọi thoại nhóm.");
        addToast("Gọi thoại không khả dụng trong nhóm.", "warning", 4000);
        setIncomingCall(null);
        return;
      }

      const resolvedUserId = String(
        (user as any).id || (user as any).userId,
      );

      emitCallAccepted({
        conversationId: callData.conversationId || callData.roomId,
        roomId: callData.roomId,
        callerId: String(callData.callerId),
        callerName: callData.callerName,
        receiverId: resolvedUserId,
        receiverName: currentUserName,
        isGroupCall: callData.isGroupCall,
        callType: callData.callType || "video",
      });

      const conversationId = callData.conversationId || callData.roomId;
      const roomId = String(callData.roomId || "").replace(/:/g, "_");

      // Guard: Nếu đã có activeCall cho cùng roomId → đã được khởi tạo rồi, bỏ qua
      if (activeCall && activeCall.roomId === roomId) {
        console.log("[acceptCall] Đã ở trong phòng này rồi, bỏ qua setActiveCall.");
        setIncomingCall(null);
        return;
      }

      try {
        const response = await apiClient.get("/api/calls/token", {
          params: { userID: resolvedUserId },
        });

        setActiveCall({
          roomId,
          token: String(response.data.token),
          appId: Number(response.data.appID),
          conversationId,
          remoteUserId: String(callData.callerId),
          remoteUserName: callData.callerName,
          isGroupCall: callData.isGroupCall,
          callType: callData.callType || "video",
        });

        setIncomingCall(null);

        if (callData.isGroupCall) {
          const convId = callData.conversationId || callData.roomId;
          emitJoinGroupCall(roomId, resolvedUserId, convId);
        }
      } catch (error) {
        console.error("Lỗi lấy token ZegoCloud:", error);
        addToast("Không thể tạo phòng cuộc gọi", "error");
      }
    },
    [user, socket, activeCall, emitCallAccepted, setActiveCall, setIncomingCall, emitJoinGroupCall, addToast, currentUserName],
  );

  const rejectCall = useCallback(() => {
    if (!incomingCall) return;

    if (incomingCall.isGroupCall) {
      setIncomingCall(null);
      return;
    }

    const conversationId = incomingCall.conversationId || incomingCall.roomId;
    emitCallDeclined({
      ...incomingCall,
      conversationId,
      receiverId: incomingCall.receiverId || currentUserId,
      to: String(incomingCall.callerId || ""),
      callerId: String(incomingCall.callerId || ""),
      from: currentUserId,
    });

    setIncomingCall(null);
  }, [incomingCall, currentUserId, emitCallDeclined, setIncomingCall]);

  const endCall = useCallback(() => {
    if (!activeCall || !currentUserId) return;

    if (activeCall.isGroupCall) {
      emitLeaveGroupCall(activeCall.roomId, currentUserId, activeCall.conversationId);
      setActiveCall(null);
      return;
    }

    emitEndCall({
      conversationId: activeCall.conversationId,
      roomId: activeCall.roomId,
      callerId: currentUserId,
      callerName: currentUserName,
      receiverId: activeCall.remoteUserId,
      to: activeCall.remoteUserId,
      from: currentUserId,
      isGroupCall: false,
    });

    setActiveCall(null);
  }, [
    activeCall,
    currentUserId,
    currentUserName,
    emitEndCall,
    emitLeaveGroupCall,
    setActiveCall,
  ]);

  const joinGroupCall = useCallback(
    (roomId: string, callType: string = "video") => {
      if (!currentUserId) return;

      const conversationId = selectedGroup
        ? groupConversationId(selectedGroup.groupId)
        : roomId;

      // Lấy token để tham gia phòng video
      apiClient
        .get<{ appID: number; token: string }>("/api/calls/token", {
          params: { userID: currentUserId },
        })
        .then((response) => {
          setActiveCall({
            roomId: normalizeRoomId(roomId),
            token: String(response.data.token),
            appId: Number(response.data.appID),
            conversationId,
            remoteUserId: selectedGroup ? String(selectedGroup.groupId) : "",
            remoteUserName: groupName || "Nhom",
            isGroupCall: true,
            callType: callType === "audio" ? "audio" : "video",
          });
          emitJoinGroupCall(normalizeRoomId(roomId), currentUserId, conversationId);
        })
        .catch(() => {
          addToast("Khong the tham gia cuoc goi", "error");
        });
    },
    [currentUserId, selectedGroup, groupName, emitJoinGroupCall, addToast]
  );

  return {
    currentUser,
    incomingCall,
    activeCall,
    outgoingCall,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    joinGroupCall,
  };
}
