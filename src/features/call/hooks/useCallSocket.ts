"use client";

import { useCallback, useEffect, useRef } from "react";
import { Socket } from "socket.io-client";
import apiClient from "../../../lib/axios";
import { useToast } from "../../../contexts/ToastContext";
import { useCallStore } from "../store/callStore";

// ─── Shared type ────────────────────────────────────────────────────────────────

export interface CallSignalPayload {
  conversationId?: string;
  roomId: string;
  callerId: string;
  callerName?: string;
  receiverId: string;
  receiverName?: string;
  to?: string;
  from?: string;
  token?: string;
  appId?: number;
  isGroupCall?: boolean;
  callType?: "video" | "audio";
  reason?: string;
  disconnectedUserId?: string;
  /** Thời lượng cuộc gọi (giây) — gửi từ backend khi call-ended / group-call-ended */
  duration?: number;
}

// ─── Format duration ────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "0 giây";
  if (seconds < 60) return `${seconds} giây`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h} giờ ${m} phút ${s} giây`;
  return `${m} phút ${s} giây`;
}

// ─── Hook ───────────────────────────────────────────────────────────────────────

export function useCallSocket(
  socket: Socket | null,
  resolvedUserId: string,
) {
  const { addToast } = useToast();
  const {
    incomingCall,
    activeCall,
    setIncomingCall,
    setActiveCall,
    setOutgoingCall,
    setIsCallEnding,
    clearCallState,
    setLastEndedCallDuration,
  } = useCallStore();

  const cleanupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleCleanup = useCallback(() => {
    if (cleanupTimeoutRef.current) clearTimeout(cleanupTimeoutRef.current);
    setIsCallEnding(true);
    cleanupTimeoutRef.current = setTimeout(() => {
      clearCallState();
      cleanupTimeoutRef.current = null;
    }, 1500);
  }, [clearCallState, setIsCallEnding]);

  // ── Socket handlers ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!socket || !resolvedUserId) return;

    // ── incoming-call / call-request ──────────────────────────────────────────
    const handleIncomingCall = (payload: CallSignalPayload) => {
      const callerId = String(payload.callerId ?? payload.from ?? "");
      const receiverId = String(payload.receiverId ?? payload.to ?? "");

      if (callerId === resolvedUserId) return;
      if (receiverId && receiverId !== resolvedUserId) return;

      setIncomingCall({
        ...payload,
        callerId,
        callerName: payload.callerName || "Nguoi dung",
        receiverId: receiverId || resolvedUserId,
        isGroupCall: false,
      });
    };

    // ── call-accepted ────────────────────────────────────────────────────────
    const handleCallAccepted = (payload: CallSignalPayload) => {
      console.log("=== CALLER SOCKET DEBUG ===");
      console.log("Event 'call-accepted' received at:", new Date().toLocaleTimeString());
      console.log("Payload from Backend:", payload);
      console.log("Current ResolvedUserId in SocketContext:", resolvedUserId);

      const currentOutgoingCall = useCallStore.getState().outgoingCall;
      const callerId = String(payload.callerId || "");
      const receiverId = String(payload.receiverId || "");
      console.log("Comparison:", callerId, "===", resolvedUserId);

      const isCaller = callerId === resolvedUserId;
      const normalizedRoomId = String(payload.roomId || "").replace(/:/g, "_");

      if (isCaller) {
        if (activeCall && activeCall.roomId === normalizedRoomId) {
          console.log("[handleCallAccepted] Tôi là caller và đã ở trong phòng này, bỏ qua setActiveCall.");
          setOutgoingCall(null);
          return;
        }

        if (payload.token && payload.appId != null) {
          setActiveCall({
            roomId: normalizedRoomId,
            token: payload.token,
            appId: Number(payload.appId),
            conversationId: payload.conversationId || currentOutgoingCall?.conversationId || String(payload.roomId),
            remoteUserId: String(payload.receiverId),
            remoteUserName: String(payload.receiverName || "Nguoi dung"),
            isGroupCall: payload.isGroupCall,
            callType: payload.callType || "video",
          });
        } else {
          apiClient
            .get<{ appID: number; token: string }>("/api/calls/token", {
              params: { userID: resolvedUserId },
            })
            .then((response) => {
              setActiveCall({
                roomId: normalizedRoomId,
                token: String(response.data.token),
                appId: Number(response.data.appID),
                conversationId: payload.conversationId || currentOutgoingCall?.conversationId || String(payload.roomId),
                remoteUserId: String(payload.receiverId),
                remoteUserName: String(payload.receiverName || "Nguoi dung"),
                isGroupCall: payload.isGroupCall,
                callType: payload.callType || "video",
              });
            })
            .catch(() => {
              addToast("Khong the tao phong cuoc goi", "error", 3000);
            });
        }

        setOutgoingCall(null);
        return;
      }

      // ── Mình là receiver ────────────────────────────────────────────────────
      if (activeCall && activeCall.roomId === normalizedRoomId) {
        console.log("[handleCallAccepted] Receiver đã ở trong phòng này, bỏ qua setActiveCall để tránh crash Zego.");
        setIncomingCall(null);
        return;
      }

      const incomingMatches =
        incomingCall && String(incomingCall.roomId) === normalizedRoomId;

      if (!incomingMatches) {
        console.log("No matching incomingCall found. Skipping.");
        return;
      }

      if (payload.token && payload.appId != null) {
        setActiveCall({
          roomId: normalizedRoomId,
          token: String(payload.token),
          appId: Number(payload.appId),
          conversationId: payload.conversationId || String(payload.roomId),
          remoteUserId: callerId,
          remoteUserName: String(payload.callerName || "Nguoi dung"),
          isGroupCall: payload.isGroupCall,
          callType: payload.callType || "video",
        });
      }

      setIncomingCall(null);
    };

    // ── group-call-request ────────────────────────────────────────────────────
    const handleGroupCallRequest = (data: CallSignalPayload) => {
      const roomId = String(data?.roomId || "").trim();
      if (!roomId) return;
      const callerId = String(data.callerId || "");
      if (callerId && callerId === resolvedUserId) return;

      setIncomingCall({
        ...data,
        roomId,
        callerId,
        callerName: data.callerName || "Nguoi dung",
        receiverId: String(data.receiverId || resolvedUserId),
        isGroupCall: true,
      });
    };

    // ── call-ended / call-timeout / call-rejected / call-canceled ─────────────
    // ============================================================
    // ✅ SEPARATION OF CONCERNS: Socket chỉ quản lý UI lúc CHƯA vào phòng
    // Khi activeCall = true (đang trong phòng Zego):
    //   → CHỈ cập nhật duration + toast
    //   → TUYỆT ĐỐI KHÔNG gọi gracefulLeave / setActiveCall(null)
    //   → Zego nắm toàn quyền dọn dẹp
    // ============================================================
    const handleCallEnded = (payload: CallSignalPayload) => {
      const duration = payload.duration ?? 0;
      const durationText = duration > 0 ? ` — Thời lượng: ${formatDuration(duration)}` : "";

      const currentActiveCall = useCallStore.getState().activeCall;

      if (currentActiveCall) {
        // ============================================================
        // ✅ ĐANG TRONG PHÒNG (activeCall = true)
        // Chỉ cập nhật duration. TUYỆT ĐỐI KHÔNG setActiveCall(null).
        // Frontend VideoCallRoom sẽ tự dọn dẹp qua Flow 1/2.
        // ============================================================
        console.log(`[handleCallEnded] Đang trong phòng — chỉ cập nhật duration=${duration}s, reason=${payload.reason}`);
        addToast(`Cuộc gọi đã kết thúc${durationText}`, "info", 4000);
        setLastEndedCallDuration(duration);
        return;
      }

      // ============================================================
      // ✅ CHƯA VÀO PHÒNG (activeCall = false)
      // Gọi scheduleCleanup() để dọn giao diện đổ chuông / chờ nhấc máy.
      // Đây là phạm vi trách nhiệm của Socket.io.
      // ============================================================
      scheduleCleanup();
      if (payload.reason) {
        console.log(`[handleCallEnded] Chưa vào phòng — cuộc gọi kết thúc. Duration=${duration}s, reason=${payload.reason}`);
        addToast(`Cuộc gọi đã kết thúc${durationText}`, "info", 4000);
      }
    };

    socket.on("incoming-call", handleIncomingCall);
    socket.on("call-request", handleIncomingCall);
    socket.on("group-call-request", handleGroupCallRequest);
    socket.on("call-accepted", handleCallAccepted);
    socket.on("call-timeout", handleCallEnded);
    socket.on("call-ended", handleCallEnded);
    socket.on("call-rejected", handleCallEnded);
    socket.on("call-canceled", handleCallEnded);

    return () => {
      socket.off("incoming-call", handleIncomingCall);
      socket.off("call-request", handleIncomingCall);
      socket.off("group-call-request", handleGroupCallRequest);
      socket.off("call-accepted", handleCallAccepted);
      socket.off("call-timeout", handleCallEnded);
      socket.off("call-ended", handleCallEnded);
      socket.off("call-rejected", handleCallEnded);
      socket.off("call-canceled", handleCallEnded);

      if (cleanupTimeoutRef.current) {
        clearTimeout(cleanupTimeoutRef.current);
        cleanupTimeoutRef.current = null;
      }
    };
  }, [
    socket,
    resolvedUserId,
    activeCall,
    incomingCall,
    addToast,
    scheduleCleanup,
    setActiveCall,
    setIncomingCall,
    setOutgoingCall,
    setIsCallEnding,
    setLastEndedCallDuration,
  ]);

  // ── Emit helpers ─────────────────────────────────────────────────────────────

  const emitCallUser = useCallback(
    (payload: CallSignalPayload) => {
      if (!socket) return;
      if (payload.isGroupCall) {
        socket.emit("group-call-request", payload);
      } else {
        socket.emit("call-request", payload);
        socket.emit("call-user", payload);
      }
    },
    [socket],
  );

  const emitCallAccepted = useCallback(
    (payload: CallSignalPayload) => {
      socket?.emit("call-accept", payload);
    },
    [socket],
  );

  const emitCallDeclined = useCallback(
    (payload: CallSignalPayload) => {
      if (!socket) return;
      socket.emit("call-reject", {
        ...payload,
        to: String(payload.to || payload.callerId || ""),
        from: String(payload.from || resolvedUserId || ""),
      });
    },
    [socket, resolvedUserId],
  );

  const emitCallCancel = useCallback(
    (payload: CallSignalPayload) => {
      socket?.emit("call-cancel", payload);
    },
    [socket],
  );

  const emitEndCall = useCallback(
    (payload: CallSignalPayload) => {
      socket?.emit("end-call", payload);
    },
    [socket],
  );

  const emitJoinGroupCall = useCallback(
    (roomId: string, userId: string, conversationId?: string) => {
      socket?.emit("join_group_call", { roomId, userId, conversationId });
      console.log(`[socket] join_group_call → roomId=${roomId}, userId=${userId}, conversationId=${conversationId}`);
    },
    [socket],
  );

  const emitLeaveGroupCall = useCallback(
    (roomId: string, userId: string, conversationId?: string) => {
      socket?.emit("leave_group_call", { roomId, userId, conversationId });
      console.log(`[socket] leave_group_call → roomId=${roomId}, userId=${userId}, conversationId=${conversationId}`);
    },
    [socket],
  );

  // ── Listener helpers ─────────────────────────────────────────────────────────

  const onIncomingCall = useCallback(
    (handler: (data: CallSignalPayload) => void) => {
      if (!socket) return () => {};
      const listener = (data: CallSignalPayload) => handler(data);
      socket.on("incoming-call", listener);
      socket.on("call-request", listener);
      return () => {
        socket.off("incoming-call", listener);
        socket.off("call-request", listener);
      };
    },
    [socket],
  );

  const onCallAccepted = useCallback(
    (handler: (data: CallSignalPayload) => void) => {
      if (!socket) return () => {};
      const listener = (data: CallSignalPayload) => handler(data);
      socket.on("call-accepted", listener);
      return () => socket.off("call-accepted", listener);
    },
    [socket],
  );

  const onCallDeclined = useCallback(
    (handler: (data: CallSignalPayload) => void) => {
      if (!socket) return () => {};
      const listener = (data: CallSignalPayload) => handler(data);
      socket.on("call-declined", listener);
      socket.on("call-rejected", listener);
      socket.on("call-canceled", listener);
      socket.on("call-ended", listener);
      return () => {
        socket.off("call-declined", listener);
        socket.off("call-rejected", listener);
        socket.off("call-canceled", listener);
        socket.off("call-ended", listener);
      };
    },
    [socket],
  );

  const onEndCall = useCallback(
    (handler: (data: CallSignalPayload) => void) => {
      if (!socket) return () => {};
      const listener = (data: CallSignalPayload) => handler(data);
      socket.on("end-call", listener);
      socket.on("call-ended", listener);
      socket.on("call-timeout", listener);
      return () => {
        socket.off("end-call", listener);
        socket.off("call-ended", listener);
        socket.off("call-timeout", listener);
      };
    },
    [socket],
  );

  return {
    emitCallUser,
    emitCallAccepted,
    emitCallDeclined,
    emitCallCancel,
    emitEndCall,
    emitJoinGroupCall,
    emitLeaveGroupCall,
    onIncomingCall,
    onCallAccepted,
    onCallDeclined,
    onEndCall,
  };
}
