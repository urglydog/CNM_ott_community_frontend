"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import dynamic from "next/dynamic";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./AuthContext";
import type { MessageItem } from "../types";
import apiClient from "../lib/axios";
import { useToast } from "./ToastContext";

const VideoCallRoom = dynamic(() => import("../components/chat/VideoCallRoom"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 bg-black flex items-center justify-center text-white z-10000">
      Dang ket noi cuoc goi...
    </div>
  ),
});

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
    attachments?: object | null
  ) => Promise<{ ok: boolean; message?: MessageItem; error?: string }>;
  emitTypingStart: (roomId: string) => void;
  emitTypingStop: (roomId: string) => void;
  emitCallUser: (payload: CallSignalPayload) => void;
  emitCallAccepted: (payload: CallSignalPayload) => void;
  emitCallDeclined: (payload: CallSignalPayload) => void;
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
}

interface GlobalCallState {
  roomId: string;
  token: string;
  appId: number;
  conversationId: string;
  remoteUserId: string;
  remoteUserName: string;
}

interface IncomingCallModalProps {
  callData: CallSignalPayload;
  onAccept: () => void;
  onDecline: () => void;
}

function IncomingCallModal({
  callData,
  onAccept,
  onDecline,
}: IncomingCallModalProps) {
  const callerName = callData.callerName || "Nguoi dung";

  return (
    <div className="fixed inset-0 z-10000 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 w-full max-w-80 flex flex-col items-center shadow-2xl">
        <div className="w-24 h-24 rounded-full bg-blue-100 flex items-center justify-center mb-4 ring-4 ring-blue-50">
          <span className="text-3xl font-bold text-blue-600">
            {callerName.charAt(0).toUpperCase()}
          </span>
        </div>
        <h3 className="text-xl font-bold text-gray-800 mb-1">{callerName}</h3>
        <p className="text-gray-500 mb-8 animate-pulse">Dang goi video...</p>

        <div className="flex gap-10">
          <button
            onClick={onDecline}
            className="w-14 h-14 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-transform hover:scale-110 shadow-lg text-white"
            aria-label="Tu choi cuoc goi"
          >
            T
          </button>
          <button
            onClick={onAccept}
            className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center hover:bg-green-600 transition-transform hover:scale-110 shadow-lg text-white"
            aria-label="Nhan cuoc goi"
          >
            N
          </button>
        </div>
      </div>
    </div>
  );
}

const SocketContext = createContext<SocketContextValue | null>(null);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const resolvedUserId = String(
    (user as any)?.id ?? (user as any)?._id ?? (user as any)?.userId ?? "",
  ).trim();
  const socketRef = useRef<Socket | null>(null);
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);
  const [status, setStatus] = useState<SocketStatus>("disconnected");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Dùng state thay vì ref để context nhận được giá trị mới khi socket thay đổi
  const [socketInstance, setSocketInstance] = useState<Socket | null>(null);
  const [incomingCall, setIncomingCall] = useState<CallSignalPayload | null>(null);
  const [activeCall, setActiveCall] = useState<GlobalCallState | null>(null);

  const stopRingtone = useCallback(() => {
    const ringtone = ringtoneRef.current;
    if (!ringtone) return;
    ringtone.pause();
    ringtone.currentTime = 0;
  }, []);

  useEffect(() => {
    ringtoneRef.current = new Audio("/sounds/ringtone.mp3");
    return () => {
      stopRingtone();
      ringtoneRef.current = null;
    };
  }, [stopRingtone]);

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
    };
  }, [user?.token]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !resolvedUserId) return;

    const handleIncomingCall = (payload: CallSignalPayload) => {
      if (String(payload.callerId) === resolvedUserId) return;
      if (String(payload.receiverId) !== resolvedUserId) return;

      setIncomingCall(payload);

      const ringtone = ringtoneRef.current;
      if (ringtone) {
        ringtone.loop = true;
        ringtone.play().catch(() => {
          // Browser may block autoplay before first user interaction.
        });
      }
    };

    const handleCancelCall = () => {
      setIncomingCall(null);
      stopRingtone();
    };

    const handleEndCall = (payload: CallSignalPayload) => {
      if (activeCall && payload.conversationId !== activeCall.conversationId) {
        return;
      }
      setIncomingCall(null);
      setActiveCall(null);
      stopRingtone();
      addToast("Cuoc goi da ket thuc", "info", 2500);
    };

    socket.on("incoming-call", handleIncomingCall);
    socket.on("call-request", handleIncomingCall);
    socket.on("cancel-call", handleCancelCall);
    socket.on("end-call", handleEndCall);

    return () => {
      socket.off("incoming-call", handleIncomingCall);
      socket.off("call-request", handleIncomingCall);
      socket.off("cancel-call", handleCancelCall);
      socket.off("end-call", handleEndCall);
    };
  }, [addToast, activeCall, resolvedUserId, stopRingtone]);

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
      attachments: object | null = null
    ): Promise<{ ok: boolean; message?: MessageItem; error?: string }> => {
      return new Promise((resolve) => {
        if (!socketRef.current) {
          resolve({ ok: false, error: "Socket chưa kết nối" });
          return;
        }
        socketRef.current.emit(
          "send_message",
          { roomId, content, contentType, attachments },
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
    // Keep requested event name while supporting current backend event name.
    socketRef.current?.emit("call-user", payload);
    socketRef.current?.emit("call-request", payload);
  }, []);

  const emitCallAccepted = useCallback((payload: CallSignalPayload) => {
    socketRef.current?.emit("call-accepted", payload);
  }, []);

  const emitCallDeclined = useCallback((payload: CallSignalPayload) => {
    socketRef.current?.emit("call-declined", payload);
    socketRef.current?.emit("call-rejected", payload);
  }, []);

  const emitEndCall = useCallback((payload: CallSignalPayload) => {
    socketRef.current?.emit("end-call", payload);
  }, []);

  const handleAcceptIncomingCall = useCallback(async () => {
    if (!incomingCall || !resolvedUserId) {
      addToast("Khong tim thay userID hop le de xin token", "error", 3500);
      return;
    }

    try {
      const response = await apiClient.get<{ appID: number; token: string }>(
        "/api/calls/token",
        {
          params: {
            userID: resolvedUserId,
          },
        },
      );

      const cleanRoomId = String(incomingCall.roomId || "").replace(/:/g, "_");

      setActiveCall({
        roomId: cleanRoomId,
        token: String(response.data.token),
        appId: Number(response.data.appID),
        conversationId: incomingCall.conversationId,
        remoteUserId: String(incomingCall.callerId),
        remoteUserName: incomingCall.callerName,
      });

      emitCallAccepted({
        conversationId: incomingCall.conversationId,
        roomId: incomingCall.roomId,
        callerId: String(incomingCall.callerId),
        callerName: incomingCall.callerName,
        receiverId: resolvedUserId,
        token: String(response.data.token),
        appId: Number(response.data.appID),
      });
    } catch {
      addToast("Khong the nhan cuoc goi luc nay", "error", 3000);
    } finally {
      stopRingtone();
      setIncomingCall(null);
    }
  }, [addToast, emitCallAccepted, incomingCall, resolvedUserId, stopRingtone]);

  const handleDeclineIncomingCall = useCallback(() => {
    if (!incomingCall) return;
    socketRef.current?.emit("decline-call", {
      to: incomingCall.callerId,
      conversationId: incomingCall.conversationId,
      roomId: incomingCall.roomId,
    });
    socketRef.current?.emit("call-rejected", incomingCall);
    stopRingtone();
    setIncomingCall(null);
  }, [incomingCall, stopRingtone]);

  const handleLeaveGlobalCall = useCallback(() => {
    setActiveCall(null);
  }, []);

  // ── Event listener helpers (trả về hàm hủy đăng ký) ───────────────────────

  const onReceiveMessage = useCallback(
    (handler: (message: MessageItem) => void) => {
      const socket = socketRef.current;
      if (!socket) return () => {};
      const listener = (message: MessageItem) => handler(message);
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

      return () => {
        socket.off("incoming-call", listener);
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
      const rejectedListener = (data: CallSignalPayload) => handler(data);

      socket.on("call-declined", declinedListener);
      socket.on("call-rejected", rejectedListener);

      return () => {
        socket.off("call-declined", declinedListener);
        socket.off("call-rejected", rejectedListener);
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

      return () => {
        socket.off("end-call", listener);
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
      }}
    >
      {children}

      {incomingCall && (
        <IncomingCallModal
          callData={incomingCall}
          onAccept={handleAcceptIncomingCall}
          onDecline={handleDeclineIncomingCall}
        />
      )}

      {activeCall && resolvedUserId && (
        <VideoCallRoom
          roomId={activeCall.roomId}
          token={activeCall.token}
          appId={activeCall.appId}
          userId={resolvedUserId}
          userName={user?.displayName || user?.username || "User"}
          remoteUserId={activeCall.remoteUserId}
          conversationId={activeCall.conversationId}
          onLeave={handleLeaveGlobalCall}
        />
      )}
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
