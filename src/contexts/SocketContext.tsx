"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./AuthContext";
import type { MessageItem, StickerData, LiveLocationStartedPayload, LiveLocationUpdatedPayload, LiveLocationStoppedPayload, PollData } from "../types";

// Payload khi tin nhắn live location được cập nhật (isLive=false) từ DB
export interface LiveLocationMessageStoppedPayload {
  conversationId: string;
  messageId: string;
  locationData: import("../types").LocationData;
}

// Payload khi tin nhắn live location được cập nhật (isLive=false) từ DB
export interface LiveLocationMessageStoppedPayload {
  conversationId: string;
  messageId: string;
  locationData: import("../types").LocationData;
}
import apiClient from "../lib/axios";
import { useToast } from "./ToastContext";
import { useCallStore } from "../features/call/store/callStore";
import { useChatStore } from "../features/chat/store/chatStore";
import { useGroupsStore } from "../features/groups/store/groupsStore";

const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:4000";

export type SocketStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

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

export interface MessageRevokedPayload {
  conversationId: string;
  messageId: string;
  revokedAt?: string;
  revokedBy?: string;
}

export interface MessageForwardedPayload {
  type: "forwarded";
  message: MessageItem & {
    isForwarded: boolean;
    originalSenderId: string | null;
    originalMessageId: string | null;
    originalConversationId: string | null;
  };
}

export interface ReadReceiptPayload {
  conversationId: string;
  messageId: string;
  readerId: string;
  readerName: string;
  readerAvatar: string | null;
  readAt: string;
}

interface SocketContextValue {
  socket: Socket | null;
  status: SocketStatus;
  errorMessage: string | null;
  // Emit helpers
  emitJoinRoom: (roomId: string) => void;
  emitLeaveRoom: (roomId: string) => void;
  emitSendMessage: (
    roomId: string,
    content: string,
    contentType?: string,
    attachments?: object | null,
    stickerData?: StickerData,
    replyTo?: string | number | null,
    mentions?: string[],
    pollData?: PollData
  ) => Promise<{ ok: boolean; message?: MessageItem; error?: string }>;
  emitTypingStart: (roomId: string) => void;
  emitTypingStop: (roomId: string) => void;
  emitCallUser: (payload: CallSignalPayload) => void;
  emitCallAccepted: (payload: CallSignalPayload) => void;
  emitCallDeclined: (payload: CallSignalPayload) => void;
  emitCallCancel: (payload: CallSignalPayload) => void;
  emitEndCall: (payload: CallSignalPayload) => void;
  emitJoinGroupCall: (roomId: string, userId: string, conversationId?: string) => void;
  emitLeaveGroupCall: (roomId: string, userId: string, conversationId?: string) => void;
  emitMarkRead: (conversationId: string, messageId: string) => void;
  // Poll voting emit helpers
  emitPollVote: (
    roomId: string,
    messageId: string | number,
    optionId: string
  ) => Promise<{ ok: boolean; pollData?: PollData; error?: string }>;
  // Live Location emit helpers
  emitStartLiveLocation: (roomId: string) => void;
  emitUpdateLiveLocation: (roomId: string, lat: number, lng: number) => void;
  emitStopLiveLocation: (roomId: string) => void;
  // Event listeners
  onReceiveMessage: (
    handler: (message: MessageItem) => void
  ) => () => void;
  onRoomJoined: (handler: (data: { roomId: string }) => void) => () => void;
  onUserJoined: (
    handler: (data: { userId: string | number; roomId: string }) => void
  ) => () => void;
  onUserLeft: (
    handler: (data: { userId: string | number; roomId: string }) => void
  ) => () => void;
  onUserTyping: (
    handler: (data: { roomId: string; userId: string | number; userName: string }) => void
  ) => () => void;
  onUserStoppedTyping: (
    handler: (data: { roomId: string; userId: string | number; userName?: string }) => void
  ) => () => void;
  onIncomingCall: (handler: (data: CallSignalPayload) => void) => () => void;
  onCallAccepted: (handler: (data: CallSignalPayload) => void) => () => void;
  onCallDeclined: (handler: (data: CallSignalPayload) => void) => () => void;
  onEndCall: (handler: (data: CallSignalPayload) => void) => () => void;
  onMessageRevoked: (handler: (data: MessageRevokedPayload) => void) => () => void;
  onMessageForwarded: (handler: (data: MessageForwardedPayload) => void) => () => void;
  onMessageRead: (handler: (data: ReadReceiptPayload) => void) => () => void;
  // Live Location event listeners
  onLiveLocationStarted: (handler: (data: LiveLocationStartedPayload) => void) => () => void;
  onLiveLocationUpdated: (handler: (data: LiveLocationUpdatedPayload) => void) => () => void;
  onLiveLocationStopped: (handler: (data: LiveLocationStoppedPayload) => void) => () => void;
  /** Cập nhật tin nhắn trong messages list khi server xác nhận dừng live location */
  onLiveLocationMessageStopped: (handler: (data: LiveLocationMessageStoppedPayload) => void) => () => void;
  /** update_message: Backend cập nhật message cũ (vd: group_call_started → call_log completed) */
  onUpdateMessage: (handler: (message: MessageItem) => void) => () => void;
  /** poll_updated: Backend broadcast khi có người vote */
  onPollUpdated: (handler: (data: { roomId: string; messageId: string; pollData: PollData }) => void) => () => void;
}


const SocketContext = createContext<SocketContextValue | null>(null);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const {
    incomingCall,
    activeCall,
    outgoingCall,
    setIncomingCall,
    setActiveCall,
    setOutgoingCall,
    setIsCallEnding,
    clearCallState,
    setLastEndedCallDuration,
  } = useCallStore();
  const { addGroup, removeGroup } = useGroupsStore();
  const resolvedUserId = String(
    (user as any)?.id ?? (user as any)?._id ?? (user as any)?.userId ?? "",
  ).trim();
  const socketRef = useRef<Socket | null>(null);
  const cleanupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<SocketStatus>("disconnected");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Dùng state thay vì ref để context nhận được giá trị mới khi socket thay đổi
  const [socketInstance, setSocketInstance] = useState<Socket | null>(null);

  /** Chuyển giây → chuỗi đọc được: "30 giây", "5 phút 30 giây", "01:05:30" */
  const formatDuration = (seconds: number): string => {
    if (!seconds || seconds <= 0) return "0 giây";
    if (seconds < 60) return `${seconds} giây`;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h} giờ ${m} phút ${s} giây`;
    }
    return `${m} phút ${s} giây`;
  };

  const scheduleCleanup = useCallback(() => {
    if (cleanupTimeoutRef.current) {
      clearTimeout(cleanupTimeoutRef.current);
    }
    setIsCallEnding(true);
    cleanupTimeoutRef.current = setTimeout(() => {
      clearCallState();
      cleanupTimeoutRef.current = null;
    }, 1500);
  }, [clearCallState, setIsCallEnding]);

  // Tạo / tái kết nối socket khi user thay đổi
  useEffect(() => {
    if (!user?.token) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocketInstance(null);
      setStatus("disconnected");
      setErrorMessage(null);
      return;
    }

    // Khởi tạo socket với JWT token trong auth handshake
    const socket = io(WS_URL, {
      auth: { token: user.token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;
    setSocketInstance(socket);

    socket.on("connect", () => {
      setStatus("connected");
      setErrorMessage(null);
    });

    socket.on("disconnect", () => {
      setStatus("disconnected");
    });

    socket.on("connect_error", (err) => {
      const msg = err.message || "Kết nối thất bại";
      setStatus("error");
      setErrorMessage(msg);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setSocketInstance(null);
      setStatus("disconnected");
      if (cleanupTimeoutRef.current) {
        clearTimeout(cleanupTimeoutRef.current);
        cleanupTimeoutRef.current = null;
      }
    };
  }, [user?.token]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !resolvedUserId) return;

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

    const handleCallAccepted = (payload: CallSignalPayload) => {
      console.log("=== CALLER SOCKET DEBUG ===");
      console.log("Event 'call-accepted' received at:", new Date().toLocaleTimeString());
      console.log("Payload from Backend:", payload);
      console.log("Current ResolvedUserId in SocketContext:", resolvedUserId);

      const callerId = String(payload.callerId || "");
      const receiverId = String(payload.receiverId || "");
      console.log("Comparison:", callerId, "===", resolvedUserId);

      const isCaller = callerId === resolvedUserId;

      // Xác định roomId để match với outgoingCall / incomingCall
      const normalizedRoomId = String(payload.roomId || "").replace(/:/g, "_");

      if (isCaller) {
        // Guard: Nếu đã có activeCall cho cùng roomId → đã được set bởi startCall,
        // bỏ qua để tránh unmount/remount VideoCallRoom gây crash Zego
        if (activeCall && activeCall.roomId === normalizedRoomId) {
          console.log("[handleCallAccepted] Tôi là caller và đã ở trong phòng này, bỏ qua setActiveCall.");
          setOutgoingCall(null);
          return;
        }
        console.log("I am the Caller. Setting activeCall now (ignoring outgoingCall state)...");

        if (payload.token && payload.appId != null) {
          console.log("Using token from backend payload. Calling setActiveCall...");
          setActiveCall({
            roomId: normalizedRoomId,
            token: payload.token,
            appId: Number(payload.appId),
            conversationId: payload.conversationId || String(payload.roomId),
            remoteUserId: String(payload.receiverId),
            remoteUserName: String(payload.receiverName || "Nguoi dung"),
            isGroupCall: payload.isGroupCall,
            callType: payload.callType || "video",
          });
        } else {
          console.log("No token in payload. Falling back to API call...");
          apiClient
            .get<{ appID: number; token: string }>("/api/calls/token", {
              params: { userID: resolvedUserId },
            })
            .then((response) => {
              setActiveCall({
                roomId: normalizedRoomId,
                token: String(response.data.token),
                appId: Number(response.data.appID),
                conversationId: payload.conversationId || String(payload.roomId),
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
        console.log("setOutgoingCall(null) called. Outgoing UI should disappear.");
        return;
      }

      // ── Mình là receiver ──────────────────────────────────────────────
      // Guard: Nếu đã có activeCall cho cùng roomId → bỏ qua để tránh
      // overwrite payload không có token (do acceptCall đã setActiveCall rồi)
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
      } else {
        // Payload không có token — receiver đã tự fetch token trong acceptCall, bỏ qua
        console.log("[handleCallAccepted] Payload không có token. Receiver đã tự khởi tạo phòng, bỏ qua.");
      }

      setIncomingCall(null);
    };

    const handleGroupCallRequest = (data: CallSignalPayload) => {
      const roomId = String(data?.roomId || "").trim();
      if (!roomId) return;

      const callerId = String(data.callerId || "");
      // Bỏ qua nếu chính mình là caller
      if (callerId && callerId === resolvedUserId) return;

      // Set incomingCall để hiện chuông + IncomingCallModal (như 1-1)
      // Khi Decline: chỉ đóng modal local, KHÔNG emit call-rejected
      setIncomingCall({
        ...data,
        roomId,
        callerId,
        callerName: data.callerName || "Nguoi dung",
        receiverId: String(data.receiverId || resolvedUserId),
        isGroupCall: true,
      });
    };

    const handleCallEnded = (payload: CallSignalPayload) => {
      const duration = payload.duration ?? 0;
      const durationText = duration > 0 ? ` — Thời lượng: ${formatDuration(duration)}` : "";

      // Nếu có activeCall → kiểm tra roomId khớp trước khi hủy
      if (activeCall) {
        const endedRoomId = String(payload.roomId || "").replace(/:/g, "_");
        const currentRoomId = String(activeCall.roomId || "").replace(/:/g, "_");

        if (currentRoomId === endedRoomId || endedRoomId === "") {
          console.log(`[handleCallEnded] Cuộc gọi kết thúc. Duration=${duration}s, reason=${payload.reason}`);
          addToast(`Cuộc gọi đã kết thúc${durationText}`, "info", 4000);

          // Lưu duration để useCallManager / ChatWindow có thể truy cập
          setLastEndedCallDuration(duration);

          // Hủy ngay activeCall → VideoCallRoom unmount → useEffect cleanup gọi zp.destroy()
          setActiveCall(null);
          setOutgoingCall(null);
          setIncomingCall(null);
        }
        return;
      }

      scheduleCleanup();
      if (payload.reason) {
        console.log(`[handleCallEnded] Cuộc gọi kết thúc (không có activeCall). Duration=${duration}s, reason=${payload.reason}`);
        addToast(`Cuộc gọi đã kết thúc${durationText}`, "info", 4000);
      }
    };

    const handleMessageRevoked = (_payload: MessageRevokedPayload) => {
      // The actual UI update is handled by the chat hooks that listen via onMessageRevoked.
      // Here we just ensure the socket is subscribed. No global action needed.
    };

    socket.on("incoming-call", handleIncomingCall);
    socket.on("call-request", handleIncomingCall);
    socket.on("group-call-request", handleGroupCallRequest);
    socket.on("call-accepted", handleCallAccepted);
    socket.on("call-timeout", handleCallEnded);
    socket.on("call-ended", handleCallEnded);
    socket.on("call-rejected", handleCallEnded);
    socket.on("call-canceled", handleCallEnded);
    socket.on("message:revoked", handleMessageRevoked);

    const handleNewConversation = (data: any) => {
      if (data?.conversationData) {
        addGroup(data.conversationData);
      }
    };
    const handleYouWereRemoved = (data: any) => {
      if (data?.groupId) {
        removeGroup(data.groupId);
        const chatState = useChatStore.getState();
        if (chatState.selectedGroup && String(chatState.selectedGroup.groupId) === String(data.groupId)) {
          chatState.setSelectedGroup(null);
        }
        addToast("Bạn đã bị xóa khỏi nhóm", "info", 3000);
      }
    };
    const handleGroupDeleted = (data: any) => {
      if (data?.groupId) {
        removeGroup(data.groupId);
        const chatState = useChatStore.getState();
        if (chatState.selectedGroup && String(chatState.selectedGroup.groupId) === String(data.groupId)) {
          chatState.setSelectedGroup(null);
        }
        addToast("Nhóm đã bị giải tán", "info", 3000);
      }
    };
    socket.on("chat:new_conversation", handleNewConversation);
    socket.on("group:you_were_removed", handleYouWereRemoved);
    socket.on("group:deleted", handleGroupDeleted);

    return () => {
      socket.off("incoming-call", handleIncomingCall);
      socket.off("call-request", handleIncomingCall);
      socket.off("group-call-request", handleGroupCallRequest);
      socket.off("call-accepted", handleCallAccepted);
      socket.off("call-timeout", handleCallEnded);
      socket.off("call-ended", handleCallEnded);
      socket.off("call-rejected", handleCallEnded);
      socket.off("call-canceled", handleCallEnded);
      socket.off("message:revoked", handleMessageRevoked);
      socket.off("chat:new_conversation", handleNewConversation);
      socket.off("group:you_were_removed", handleYouWereRemoved);
      socket.off("group:deleted", handleGroupDeleted);
    };
  }, [addToast, activeCall, incomingCall, outgoingCall, resolvedUserId, scheduleCleanup, setActiveCall, setIncomingCall, setOutgoingCall, setIsCallEnding, addGroup, removeGroup]);

  // ── Emit helpers ────────────────────────────────────────────────────────────

  const emitJoinRoom = useCallback((roomId: string) => {
    socketRef.current?.emit("join_room", { roomId }, (response?: any) => {
      if (response && response.error) {
        console.warn(`Lỗi khi join room ${roomId}:`, response.error);
      }
    });
  }, []);

  const emitLeaveRoom = useCallback((roomId: string) => {
    socketRef.current?.emit("leave_room", { roomId }, (response?: any) => {});
  }, []);

  const emitSendMessage = useCallback(
    (
      roomId: string,
      content: string,
      contentType = "text",
      attachments: object | null = null,
      stickerData?: StickerData,
      replyTo?: string | number | null,
      mentions?: string[],
      pollData?: PollData
    ): Promise<{ ok: boolean; message?: MessageItem; error?: string }> => {
      return new Promise((resolve) => {
        if (!socketRef.current) {
          resolve({ ok: false, error: "Socket chưa kết nối" });
          return;
        }
        socketRef.current.emit(
          "send_message",
          { roomId, content, contentType, attachments, stickerData, replyTo, mentions, pollData },
          (response: { ok: boolean; message?: MessageItem; error?: string }) => {
            resolve(response);
          }
        );
      });
    },
    []
  );

  const emitTypingStart = useCallback((roomId: string) => {
    socketRef.current?.emit("typing_start", { roomId });
  }, []);

  const emitTypingStop = useCallback((roomId: string) => {
    socketRef.current?.emit("typing_stop", { roomId });
  }, []);

  const emitCallUser = useCallback((payload: CallSignalPayload) => {
    if (payload.isGroupCall) {
      socketRef.current?.emit("group-call-request", payload);
    } else {
      socketRef.current?.emit("call-request", payload);
      socketRef.current?.emit("call-user", payload);
    }
  }, []);

  const emitCallAccepted = useCallback((payload: CallSignalPayload) => {
    socketRef.current?.emit("call-accept", payload);
  }, []);

  const emitCallDeclined = useCallback((payload: CallSignalPayload) => {
    const normalizedPayload: CallSignalPayload = {
      ...payload,
      to: String(payload.to || payload.callerId || ""),
      from: String(payload.from || resolvedUserId || ""),
    };
    socketRef.current?.emit("call-reject", normalizedPayload);
  }, [resolvedUserId]);

  const emitCallCancel = useCallback((payload: CallSignalPayload) => {
    socketRef.current?.emit("call-cancel", payload);
  }, []);

  const emitEndCall = useCallback((payload: CallSignalPayload) => {
    socketRef.current?.emit("end-call", payload);
  }, []);

  const emitJoinGroupCall = useCallback((roomId: string, userId: string, conversationId?: string) => {
    socketRef.current?.emit("join_group_call", { roomId, userId, conversationId });
    console.log(`[socket] join_group_call → roomId=${roomId}, userId=${userId}, conversationId=${conversationId}`);
  }, []);

  const emitLeaveGroupCall = useCallback((roomId: string, userId: string, conversationId?: string) => {
    socketRef.current?.emit("leave_group_call", { roomId, userId, conversationId });
    console.log(`[socket] leave_group_call → roomId=${roomId}, userId=${userId}, conversationId=${conversationId}`);
  }, []);

  const emitMarkRead = useCallback((conversationId: string, messageId: string) => {
    socketRef.current?.emit("mark_read", { conversationId, messageId });
  }, []);

  // ── Poll voting emit helpers ──────────────────────────────────────────────

  /**
   * Emit vote_poll: gửi vote cho một lựa chọn trong poll
   * Toggle behavior: nếu đã vote thì bỏ vote, nếu chưa vote thì thêm vote
   */
  const emitPollVote = useCallback(
    (
      roomId: string,
      messageId: string | number,
      optionId: string
    ): Promise<{ ok: boolean; pollData?: PollData; error?: string }> => {
      return new Promise((resolve) => {
        if (!socketRef.current) {
          resolve({ ok: false, error: "Socket chưa kết nối" });
          return;
        }
        socketRef.current.emit(
          "vote_poll",
          { roomId, messageId, optionId },
          (response: { ok: boolean; pollData?: PollData; error?: string }) => {
            resolve(response);
          }
        );
      });
    },
    []
  );

  // ── Live Location emit helpers ──────────────────────────────────────────────

  /**
   * Emit start_live_location: thông báo người dùng bắt đầu chia sẻ vị trí trực tiếp.
   * Backend sẽ broadcast live_location_started đến các thành viên khác trong room.
   */
  const emitStartLiveLocation = useCallback((roomId: string) => {
    socketRef.current?.emit("start_live_location", { roomId });
  }, []);

  /**
   * Emit update_live_location: gửi tọa độ mới mỗi khi navigator.geolocation.watchPosition
   * trả về vị trí cập nhật. Backend broadcast live_location_updated đến room.
   */
  const emitUpdateLiveLocation = useCallback((roomId: string, lat: number, lng: number) => {
    socketRef.current?.emit("update_live_location", { roomId, lat, lng });
  }, []);

  /**
   * Emit stop_live_location: thông báo dừng chia sẻ.
   * Nên gọi khi clearWatch() hoặc khi component unmount.
   */
  const emitStopLiveLocation = useCallback((roomId: string) => {
    socketRef.current?.emit("stop_live_location", { roomId });
  }, []);

  // UI handlers are implemented in CallOverlay.

  // ── Event listener helpers (trả về hàm hủy đăng ký) ───────────────────────

  const onReceiveMessage = useCallback(
    (handler: (message: MessageItem) => void) => {
      const socket = socketRef.current;
      if (!socket) return () => {};

      // Backend emits forwarded messages as { type: "forwarded", message: {...} }
      // Normal messages are emitted as a flat MessageItem object.
      // Unwrap the wrapper so consumers always receive a flat message.
      const listener = (payload: MessageItem | { type: string; message: MessageItem }) => {
        const msg =
          "type" in payload && "message" in payload
            ? (payload as { type: string; message: MessageItem }).message
            : (payload as MessageItem);
        handler(msg);
      };

      socket.on("receive_message", listener);
      return () => socket.off("receive_message", listener);
    },
    []
  );

  const onRoomJoined = useCallback(
    (handler: (data: { roomId: string }) => void) => {
      const socket = socketRef.current;
      if (!socket) return () => {};
      const listener = (data: { roomId: string }) => handler(data);
      socket.on("room_joined", listener);
      return () => socket.off("room_joined", listener);
    },
    []
  );

  const onUserJoined = useCallback(
    (handler: (data: { userId: string | number; roomId: string }) => void) => {
      const socket = socketRef.current;
      if (!socket) return () => {};
      const listener = (data: { userId: string | number; roomId: string }) =>
        handler(data);
      socket.on("user_joined", listener);
      return () => socket.off("user_joined", listener);
    },
    []
  );

  const onUserLeft = useCallback(
    (handler: (data: { userId: string | number; roomId: string }) => void) => {
      const socket = socketRef.current;
      if (!socket) return () => {};
      const listener = (data: { userId: string | number; roomId: string }) =>
        handler(data);
      socket.on("user_left", listener);
      return () => socket.off("user_left", listener);
    },
    []
  );

  const onUserTyping = useCallback(
    (handler: (data: { roomId: string; userId: string | number; userName: string }) => void) => {
      const socket = socketRef.current;
      if (!socket) return () => {};
      const listener = (data: { roomId: string; userId: string | number; userName: string }) =>
        handler(data);
      socket.on("user_typing", listener);
      return () => socket.off("user_typing", listener);
    },
    []
  );

  const onUserStoppedTyping = useCallback(
    (handler: (data: { roomId: string; userId: string | number; userName?: string }) => void) => {
      const socket = socketRef.current;
      if (!socket) return () => {};
      const listener = (data: { roomId: string; userId: string | number; userName?: string }) =>
        handler(data);
      socket.on("user_stopped_typing", listener);
      return () => socket.off("user_stopped_typing", listener);
    },
    []
  );

  const onIncomingCall = useCallback(
    (handler: (data: CallSignalPayload) => void) => {
      const socket = socketRef.current;
      if (!socket) return () => {};

      const listener = (data: CallSignalPayload) => handler(data);
      socket.on("incoming-call", listener);
      socket.on("call-request", listener);

      return () => {
        socket.off("incoming-call", listener);
        socket.off("call-request", listener);
      };
    },
    []
  );

  const onCallAccepted = useCallback(
    (handler: (data: CallSignalPayload) => void) => {
      const socket = socketRef.current;
      if (!socket) return () => {};

      const listener = (data: CallSignalPayload) => handler(data);
      socket.on("call-accepted", listener);

      return () => {
        socket.off("call-accepted", listener);
      };
    },
    []
  );

  const onCallDeclined = useCallback(
    (handler: (data: CallSignalPayload) => void) => {
      const socket = socketRef.current;
      if (!socket) return () => {};

      const declinedListener = (data: CallSignalPayload) => handler(data);

      socket.on("call-declined", declinedListener);
      socket.on("call-rejected", declinedListener);
      socket.on("call-canceled", declinedListener);
      socket.on("call-ended", declinedListener);

      return () => {
        socket.off("call-declined", declinedListener);
        socket.off("call-rejected", declinedListener);
        socket.off("call-canceled", declinedListener);
        socket.off("call-ended", declinedListener);
      };
    },
    []
  );

  const onEndCall = useCallback(
    (handler: (data: CallSignalPayload) => void) => {
      const socket = socketRef.current;
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
    []
  );

  const onMessageRevoked = useCallback(
    (handler: (data: MessageRevokedPayload) => void) => {
      const socket = socketRef.current;
      if (!socket) return () => {};

      const listener = (data: MessageRevokedPayload) => handler(data);
      socket.on("message:revoked", listener);

      return () => {
        socket.off("message:revoked", listener);
      };
    },
    []
  );

  const onMessageForwarded = useCallback(
    (handler: (data: MessageForwardedPayload) => void) => {
      const socket = socketRef.current;
      if (!socket) return () => {};

      const listener = (data: MessageForwardedPayload) => handler(data);
      socket.on("message:forwarded", listener);

      return () => {
        socket.off("message:forwarded", listener);
      };
    },
    []
  );

  const onMessageRead = useCallback(
    (handler: (data: ReadReceiptPayload) => void) => {
      const socket = socketRef.current;
      if (!socket) return () => {};

      const listener = (data: ReadReceiptPayload) => handler(data);
      socket.on("message_read", listener);

      return () => {
        socket.off("message_read", listener);
      };
    },
    []
  );

  // ── Live Location event listener helpers ───────────────────────────────────

  /**
   * Lắng nghe sự kiện live_location_started:
   * được emit khi người khác trong room bắt đầu chia sẻ vị trí.
   */
  const onLiveLocationStarted = useCallback(
    (handler: (data: LiveLocationStartedPayload) => void) => {
      const socket = socketRef.current;
      if (!socket) return () => {};
      const listener = (data: LiveLocationStartedPayload) => handler(data);
      socket.on("live_location_started", listener);
      return () => socket.off("live_location_started", listener);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [socketInstance]
  );

  /**
   * Lắng nghe sự kiện live_location_updated:
   * được emit mỗi khi tọa độ người chia sẻ thay đổi.
   * Dùng để cập nhật Marker trên bản đồ.
   */
  const onLiveLocationUpdated = useCallback(
    (handler: (data: LiveLocationUpdatedPayload) => void) => {
      const socket = socketRef.current;
      if (!socket) return () => {};
      const listener = (data: LiveLocationUpdatedPayload) => handler(data);
      socket.on("live_location_updated", listener);
      return () => socket.off("live_location_updated", listener);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [socketInstance]
  );

  /**
   * Lắng nghe sự kiện live_location_stopped:
   * được emit khi người chia sẻ dừng (clearWatch / unmount / stop button).
   */
  const onLiveLocationStopped = useCallback(
    (handler: (data: LiveLocationStoppedPayload) => void) => {
      const socket = socketRef.current;
      if (!socket) return () => {};
      const listener = (data: LiveLocationStoppedPayload) => handler(data);
      socket.on("live_location_stopped", listener);
      return () => socket.off("live_location_stopped", listener);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [socketInstance]
  );

  /**
   * Lắng nghe `live_location_message_stopped`:
   * Backend broadcast sau khi API PATCH dừng phiên live location,
   * mang locationData đã được cập nhật (isLive=false, liveUntil=timestamp).
   * Dùng để cập nhật message bubble mà không cần refresh.
   */
  const onLiveLocationMessageStopped = useCallback(
    (handler: (data: LiveLocationMessageStoppedPayload) => void) => {
      const socket = socketRef.current;
      if (!socket) return () => {};
      const listener = (data: LiveLocationMessageStoppedPayload) => handler(data);
      socket.on("live_location_message_stopped", listener);
      return () => socket.off("live_location_message_stopped", listener);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [socketInstance]
  );

  const onUpdateMessage = useCallback(
    (handler: (message: MessageItem) => void) => {
      const socket = socketRef.current;
      if (!socket) return () => {};
      const listener = (msg: MessageItem) => handler(msg);
      socket.on("update_message", listener);
      return () => socket.off("update_message", listener);
    },
    []
  );

  // ── Poll event listeners ────────────────────────────────────────────────────

  /**
   * Lắng nghe poll_updated: được emit khi có người vote trong poll
   */
  const onPollUpdated = useCallback(
    (handler: (data: { roomId: string; messageId: string; pollData: PollData }) => void) => {
      const socket = socketRef.current;
      if (!socket) return () => {};
      const listener = (data: { roomId: string; messageId: string; pollData: PollData }) => handler(data);
      socket.on("poll_updated", listener);
      return () => socket.off("poll_updated", listener);
    },
    []
  );

  return (
    <SocketContext.Provider
      value={{
        socket: socketInstance,
        status,
        errorMessage,
        emitJoinRoom,
        emitLeaveRoom,
        emitSendMessage,
        emitTypingStart,
        emitTypingStop,
        emitCallUser,
        emitCallAccepted,
        emitCallDeclined,
        emitCallCancel,
        emitEndCall,
        emitJoinGroupCall,
        emitLeaveGroupCall,
        emitMarkRead,
        emitPollVote,
        emitStartLiveLocation,
        emitUpdateLiveLocation,
        emitStopLiveLocation,
        onReceiveMessage,
        onRoomJoined,
        onUserJoined,
        onUserLeft,
        onUserTyping,
        onUserStoppedTyping,
        onIncomingCall,
        onCallAccepted,
        onCallDeclined,
        onEndCall,
        onMessageRevoked,
        onMessageForwarded,
        onMessageRead,
        onLiveLocationStarted,
        onLiveLocationUpdated,
        onLiveLocationStopped,
        onLiveLocationMessageStopped,
        onUpdateMessage,
        onPollUpdated,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

// Luôn render với socketInstance mới nhất
export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) {
    throw new Error("useSocket must be used inside <SocketProvider>");
  }
  return ctx;
}
