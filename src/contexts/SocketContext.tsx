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
import { useCallSocketListener } from "../features/call";
import type {
  MessageItem,
  StickerData,
  LiveLocationStartedPayload,
  LiveLocationUpdatedPayload,
  LiveLocationStoppedPayload,
  PollData,
} from "../types";

export interface LiveLocationMessageStoppedPayload {
  conversationId: string;
  messageId: string;
  locationData: import("../types").LocationData;
}

import { useToast } from "./ToastContext";
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
  emitMarkRead: (conversationId: string, messageId: string) => void;
  emitPollVote: (
    roomId: string,
    messageId: string | number,
    optionId: string
  ) => Promise<{ ok: boolean; pollData?: PollData; error?: string }>;
  emitStartLiveLocation: (roomId: string) => void;
  emitUpdateLiveLocation: (roomId: string, lat: number, lng: number) => void;
  emitStopLiveLocation: (roomId: string) => void;
  // Event listeners
  onReceiveMessage: (handler: (message: MessageItem) => void) => () => void;
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
  onMessageRevoked: (handler: (data: MessageRevokedPayload) => void) => () => void;
  onMessageForwarded: (handler: (data: MessageForwardedPayload) => void) => () => void;
  onMessageRead: (handler: (data: ReadReceiptPayload) => void) => () => void;
  onLiveLocationStarted: (handler: (data: LiveLocationStartedPayload) => void) => () => void;
  onLiveLocationUpdated: (handler: (data: LiveLocationUpdatedPayload) => void) => () => void;
  onLiveLocationStopped: (handler: (data: LiveLocationStoppedPayload) => void) => () => void;
  onLiveLocationMessageStopped: (handler: (data: LiveLocationMessageStoppedPayload) => void) => () => void;
  onUpdateMessage: (handler: (message: MessageItem) => void) => () => void;
  onPollUpdated: (
    handler: (data: { roomId: string; messageId: string; pollData: PollData }) => void
  ) => () => void;
}

const SocketContext = createContext<SocketContextValue | null>(null);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const { addGroup, removeGroup } = useGroupsStore();

  const resolvedUserId = String(
    (user as any)?.id ?? (user as any)?._id ?? (user as any)?.userId ?? "",
  ).trim();

  // ── Call signaling: register call socket event listeners ──────────────────
  useCallSocketListener(resolvedUserId || null);

  const socketRef = useRef<Socket | null>(null);
  const [status, setStatus] = useState<SocketStatus>("disconnected");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [socketInstance, setSocketInstance] = useState<Socket | null>(null);

  // ── Socket connection ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user?.token) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocketInstance(null);
      setStatus("disconnected");
      setErrorMessage(null);
      return;
    }

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
    socket.on("disconnect", () => setStatus("disconnected"));
    socket.on("connect_error", (err) => {
      setStatus("error");
      setErrorMessage(err.message || "Kết nối thất bại");
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setSocketInstance(null);
      setStatus("disconnected");
    };
  }, [user?.token]);

  // ── Group event listeners (call logic moved to useCallSocket) ─────────────────

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const handleNewConversation = (data: any) => {
      if (data?.conversationData) addGroup(data.conversationData);
    };
    const handleYouWereRemoved = (data: any) => {
      if (data?.groupId) {
        removeGroup(data.groupId);
        const chatState = useChatStore.getState();
        if (
          chatState.selectedGroup &&
          String(chatState.selectedGroup.groupId) === String(data.groupId)
        ) {
          chatState.setSelectedGroup(null);
        }
        addToast("Bạn đã bị xóa khỏi nhóm", "info", 3000);
      }
    };
    const handleGroupDeleted = (data: any) => {
      if (data?.groupId) {
        removeGroup(data.groupId);
        const chatState = useChatStore.getState();
        if (
          chatState.selectedGroup &&
          String(chatState.selectedGroup.groupId) === String(data.groupId)
        ) {
          chatState.setSelectedGroup(null);
        }
        addToast("Nhóm đã bị giải tán", "info", 3000);
      }
    };

    socket.on("chat:new_conversation", handleNewConversation);
    socket.on("group:you_were_removed", handleYouWereRemoved);
    socket.on("group:deleted", handleGroupDeleted);

    return () => {
      socket.off("chat:new_conversation", handleNewConversation);
      socket.off("group:you_were_removed", handleYouWereRemoved);
      socket.off("group:deleted", handleGroupDeleted);
    };
  }, [addToast, addGroup, removeGroup]);

  // ── Emit helpers ─────────────────────────────────────────────────────────────

  const emitJoinRoom = useCallback(
    (roomId: string) => {
      socketRef.current?.emit("join_room", { roomId }, (response?: any) => {
        if (response?.error) console.warn(`Lỗi khi join room ${roomId}:`, response.error);
      });
    },
    [],
  );

  const emitLeaveRoom = useCallback((roomId: string) => {
    socketRef.current?.emit("leave_room", { roomId });
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
    [],
  );

  const emitTypingStart = useCallback((roomId: string) => {
    socketRef.current?.emit("typing_start", { roomId });
  }, []);

  const emitTypingStop = useCallback((roomId: string) => {
    socketRef.current?.emit("typing_stop", { roomId });
  }, []);

  const emitMarkRead = useCallback((conversationId: string, messageId: string) => {
    socketRef.current?.emit("mark_read", { conversationId, messageId });
  }, []);

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
    [],
  );

  const emitStartLiveLocation = useCallback((roomId: string) => {
    socketRef.current?.emit("start_live_location", { roomId });
  }, []);

  const emitUpdateLiveLocation = useCallback((roomId: string, lat: number, lng: number) => {
    socketRef.current?.emit("update_live_location", { roomId, lat, lng });
  }, []);

  const emitStopLiveLocation = useCallback((roomId: string) => {
    socketRef.current?.emit("stop_live_location", { roomId });
  }, []);

  // ── Event listener helpers ────────────────────────────────────────────────────

  const onReceiveMessage = useCallback(
    (handler: (message: MessageItem) => void) => {
      const socket = socketRef.current;
      if (!socket) return () => {};
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
    [],
  );

  const onRoomJoined = useCallback(
    (handler: (data: { roomId: string }) => void) => {
      const socket = socketRef.current;
      if (!socket) return () => {};
      const listener = (data: { roomId: string }) => handler(data);
      socket.on("room_joined", listener);
      return () => socket.off("room_joined", listener);
    },
    [],
  );

  const onUserJoined = useCallback(
    (handler: (data: { userId: string | number; roomId: string }) => void) => {
      const socket = socketRef.current;
      if (!socket) return () => {};
      const listener = (data: { userId: string | number; roomId: string }) => handler(data);
      socket.on("user_joined", listener);
      return () => socket.off("user_joined", listener);
    },
    [],
  );

  const onUserLeft = useCallback(
    (handler: (data: { userId: string | number; roomId: string }) => void) => {
      const socket = socketRef.current;
      if (!socket) return () => {};
      const listener = (data: { userId: string | number; roomId: string }) => handler(data);
      socket.on("user_left", listener);
      return () => socket.off("user_left", listener);
    },
    [],
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
    [],
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
    [],
  );

  const onMessageRevoked = useCallback(
    (handler: (data: MessageRevokedPayload) => void) => {
      const socket = socketRef.current;
      if (!socket) return () => {};
      const listener = (data: MessageRevokedPayload) => handler(data);
      socket.on("message:revoked", listener);
      return () => socket.off("message:revoked", listener);
    },
    [],
  );

  const onMessageForwarded = useCallback(
    (handler: (data: MessageForwardedPayload) => void) => {
      const socket = socketRef.current;
      if (!socket) return () => {};
      const listener = (data: MessageForwardedPayload) => handler(data);
      socket.on("message:forwarded", listener);
      return () => socket.off("message:forwarded", listener);
    },
    [],
  );

  const onMessageRead = useCallback(
    (handler: (data: ReadReceiptPayload) => void) => {
      const socket = socketRef.current;
      if (!socket) return () => {};
      const listener = (data: ReadReceiptPayload) => handler(data);
      socket.on("message_read", listener);
      return () => socket.off("message_read", listener);
    },
    [],
  );

  const onLiveLocationStarted = useCallback(
    (handler: (data: LiveLocationStartedPayload) => void) => {
      const socket = socketRef.current;
      if (!socket) return () => {};
      const listener = (data: LiveLocationStartedPayload) => handler(data);
      socket.on("live_location_started", listener);
      return () => socket.off("live_location_started", listener);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [socketInstance],
  );

  const onLiveLocationUpdated = useCallback(
    (handler: (data: LiveLocationUpdatedPayload) => void) => {
      const socket = socketRef.current;
      if (!socket) return () => {};
      const listener = (data: LiveLocationUpdatedPayload) => handler(data);
      socket.on("live_location_updated", listener);
      return () => socket.off("live_location_updated", listener);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [socketInstance],
  );

  const onLiveLocationStopped = useCallback(
    (handler: (data: LiveLocationStoppedPayload) => void) => {
      const socket = socketRef.current;
      if (!socket) return () => {};
      const listener = (data: LiveLocationStoppedPayload) => handler(data);
      socket.on("live_location_stopped", listener);
      return () => socket.off("live_location_stopped", listener);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [socketInstance],
  );

  const onLiveLocationMessageStopped = useCallback(
    (handler: (data: LiveLocationMessageStoppedPayload) => void) => {
      const socket = socketRef.current;
      if (!socket) return () => {};
      const listener = (data: LiveLocationMessageStoppedPayload) => handler(data);
      socket.on("live_location_message_stopped", listener);
      return () => socket.off("live_location_message_stopped", listener);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [socketInstance],
  );

  const onUpdateMessage = useCallback(
    (handler: (message: MessageItem) => void) => {
      const socket = socketRef.current;
      if (!socket) return () => {};
      const listener = (msg: MessageItem) => handler(msg);
      socket.on("update_message", listener);
      return () => socket.off("update_message", listener);
    },
    [],
  );

  const onPollUpdated = useCallback(
    (handler: (data: { roomId: string; messageId: string; pollData: PollData }) => void) => {
      const socket = socketRef.current;
      if (!socket) return () => {};
      const listener = (data: { roomId: string; messageId: string; pollData: PollData }) =>
        handler(data);
      socket.on("poll_updated", listener);
      return () => socket.off("poll_updated", listener);
    },
    [],
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
        emitMarkRead,
        emitPollVote,
        emitStartLiveLocation,
        emitUpdateLiveLocation,
        emitStopLiveLocation,
        // Remaining
        onReceiveMessage,
        onRoomJoined,
        onUserJoined,
        onUserLeft,
        onUserTyping,
        onUserStoppedTyping,
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

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) {
    throw new Error("useSocket must be used inside <SocketProvider>");
  }
  return ctx;
}
