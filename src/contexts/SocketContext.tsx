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
import type { MessageItem } from "../types";

const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:4000";

export type SocketStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

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
}

const SocketContext = createContext<SocketContextValue | null>(null);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [status, setStatus] = useState<SocketStatus>("disconnected");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Dùng state thay vì ref để context nhận được giá trị mới khi socket thay đổi
  const [socketInstance, setSocketInstance] = useState<Socket | null>(null);

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
        onReceiveMessage,
        onRoomJoined,
        onUserJoined,
        onUserLeft,
        onUserTyping,
        onUserStoppedTyping,
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
