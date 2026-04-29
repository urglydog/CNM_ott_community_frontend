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
import type { MessageItem, StickerData } from "../types";
import apiClient from "../lib/axios";
import { useToast } from "./ToastContext";
import { useChatStore } from "../features/chat/store/chatStore";

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
  conversationId: string;
  roomId: string;
  callerId: string;
  callerName: string;
  receiverId: string;
  to?: string;
  from?: string;
  token?: string;
  appId?: number;
  isGroupCall?: boolean;
  reason?: string;
  disconnectedUserId?: string;
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
    stickerData?: StickerData
  ) => Promise<{ ok: boolean; message?: MessageItem; error?: string }>;
  emitTypingStart: (roomId: string) => void;
  emitTypingStop: (roomId: string) => void;
  emitCallUser: (payload: CallSignalPayload) => void;
  emitCallAccepted: (payload: CallSignalPayload) => void;
  emitCallDeclined: (payload: CallSignalPayload) => void;
  emitCallCancel: (payload: CallSignalPayload) => void;
  emitEndCall: (payload: CallSignalPayload) => void;
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
  } = useChatStore();
  const resolvedUserId = String(
    (user as any)?.id ?? (user as any)?._id ?? (user as any)?.userId ?? "",
  ).trim();
  const socketRef = useRef<Socket | null>(null);
  const cleanupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<SocketStatus>("disconnected");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Dùng state thay vì ref để context nhận được giá trị mới khi socket thay đổi
  const [socketInstance, setSocketInstance] = useState<Socket | null>(null);

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
        receiverId: receiverId || resolvedUserId,
        isGroupCall: false,
      });

    };

    const handleCallAccepted = (payload: CallSignalPayload) => {
      const normalizedRoomId = String(payload.roomId || "");
      const outgoingMatches =
        outgoingCall && String(outgoingCall.roomId) === normalizedRoomId;
      const incomingMatches =
        incomingCall && String(incomingCall.roomId) === normalizedRoomId;

      if (!outgoingMatches && !incomingMatches) {
        return;
      }

      const callerId = String(payload.callerId || "");
      const receiverId = String(payload.receiverId || "");
      const remoteUserId =
        callerId === resolvedUserId ? receiverId : callerId || receiverId;

      const finalizeCall = (token: string, appId: number) => {
        setActiveCall({
          roomId: String(payload.roomId || "").replace(/:/g, "_"),
          token,
          appId,
          conversationId: String(payload.conversationId || payload.roomId || ""),
          remoteUserId: remoteUserId || "",
          remoteUserName: payload.callerName || "",
          isGroupCall: payload.isGroupCall,
        });

        setIncomingCall(null);
        setOutgoingCall(null);
      };

      if (payload.token && payload.appId != null) {
        finalizeCall(String(payload.token), Number(payload.appId));
        return;
      }

      if (!resolvedUserId) return;
      apiClient
        .get<{ appID: number; token: string }>("/api/calls/token", {
          params: { userID: resolvedUserId },
        })
        .then((response) => {
          finalizeCall(String(response.data.token), Number(response.data.appID));
        })
        .catch(() => {
          addToast("Khong the tao phong cuoc goi", "error", 3000);
        });
    };

    const handleGroupCallRequest = (data: CallSignalPayload) => {
      console.log("[SOCKET DEBUG] Group Call Signal Received:", data);

      const roomId = String(data?.roomId || "").trim();
      if (!roomId) {
        console.warn("[SOCKET DEBUG] Ignored group-call-request because roomId is missing");
        return;
      }

      const callerId = String(data.callerId || "");
      if (callerId && callerId === resolvedUserId) return;

      setIncomingCall({
        ...data,
        roomId,
        callerId,
        receiverId: String(data.receiverId || resolvedUserId),
        isGroupCall: true,
      });

    };

    const handleCallEnded = (payload: CallSignalPayload) => {
      if (activeCall && payload.conversationId !== activeCall.conversationId) {
        return;
      }
      scheduleCleanup();
      if (payload.reason) {
        addToast("Cuoc goi da ket thuc", "info", 2500);
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
    };
  }, [addToast, activeCall, incomingCall, outgoingCall, resolvedUserId, scheduleCleanup, setActiveCall, setIncomingCall, setOutgoingCall, setIsCallEnding]);

  // ── Emit helpers ────────────────────────────────────────────────────────────

  const emitJoinRoom = useCallback((roomId: string) => {
    socketRef.current?.emit("join_room", { roomId });
  }, []);

  const emitLeaveRoom = useCallback((roomId: string) => {
    socketRef.current?.emit("leave_room", { roomId });
  }, []);

  const emitSendMessage = useCallback(
    (
      roomId: string,
      content: string,
      contentType = "text",
      attachments: object | null = null,
      stickerData?: StickerData
    ): Promise<{ ok: boolean; message?: MessageItem; error?: string }> => {
      return new Promise((resolve) => {
        if (!socketRef.current) {
          resolve({ ok: false, error: "Socket chưa kết nối" });
          return;
        }
        socketRef.current.emit(
          "send_message",
          { roomId, content, contentType, attachments, stickerData },
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
