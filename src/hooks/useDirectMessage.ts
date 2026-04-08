"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSocket } from "../contexts/SocketContext";
import { useAuth } from "../contexts/AuthContext";
import { getDirectMessages } from "../api/client";
import type { DirectMessageItem } from "../types";

export type MessageSendStatus = "sending" | "sent" | "failed";

export interface ChatMessage extends DirectMessageItem {
  sendStatus?: MessageSendStatus;
  isOwn?: boolean;
}

/**
 * Tạo conversationId cố định cho DM giữa 2 user.
 * Luôn dùng userId nhỏ hơn trước để sender và receiver
 * dùng cùng conversationId.
 */
export function dmConversationId(userId: string | number, friendId: string | number): string {
  const ids = [Number(userId), Number(friendId)].sort((a, b) => a - b);
  return `dm:${ids[0]}:${ids[1]}`;
}

/**
 * Trích friendId từ conversationId cố định.
 * conversationId dạng "dm:A:B" → trả về friendId (số lớn hơn).
 * Dùng khi nhận tin nhắn realtime để cập nhật preview.
 */
export function friendIdFromConversationId(conversationId: string): string | null {
  if (!conversationId || !conversationId.startsWith('dm:')) return null;
  const parts = conversationId.slice(3).split(':');
  if (parts.length !== 2) return null;
  return parts[1]; // luôn là friendId (lớn hơn)
}

interface UseDirectMessageReturn {
  messages: ChatMessage[];
  isLoadingHistory: boolean;
  historyError: string | null;
  currentRoomId: string | null;
  sendMessage: (content: string) => Promise<void>;
  isSending: boolean;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  bottomSentinelRef: React.RefObject<HTMLDivElement | null>;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  typingUsers: string[];
  onTypingChange: (isTyping: boolean) => void;
}

const DEBOUNCE_MS_DEFAULT = 100;

/**
 * Hook quản lý cuộc trò chuyện trực tiếp (DM) với bạn bè.
 * Tương tự useChatRoom nhưng dùng cho DM.
 */
export type DmActivityPayload = {
  conversationId: string;
  content: string;
  createdAt: string;
};

export function useDirectMessage(
  friendId: string | null,
  options: {
    scrollDebounceMs?: number;
    onDmActivity?: (payload: DmActivityPayload) => void;
  } = {}
): UseDirectMessageReturn {
  const { scrollDebounceMs = DEBOUNCE_MS_DEFAULT, onDmActivity } = options;

  const { user } = useAuth();
  const {
    emitJoinRoom,
    emitLeaveRoom,
    emitSendMessage,
    emitTypingStart,
    emitTypingStop,
    onReceiveMessage,
    onUserTyping,
    onUserStoppedTyping,
  } = useSocket();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const prevRoomIdRef = useRef<string | null>(null);
  const scrollDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottomSentinelRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const currentRoomId = friendId != null ? dmConversationId(user?.id ?? 0, friendId) : null;

  // ── Load lịch sử tin nhắn DM ──────────────────────────────────────────
  useEffect(() => {
    if (!friendId) {
      setMessages([]);
      setHistoryError(null);
      prevRoomIdRef.current = null;
      return;
    }

    const roomId = dmConversationId(user?.id ?? 0, friendId);

    async function loadHistory() {
      setIsLoadingHistory(true);
      setHistoryError(null);
      try {
        const list = await getDirectMessages(roomId);
        const enriched: ChatMessage[] = list.map((msg) => ({
          ...msg,
          isOwn: Number(msg.senderId) === Number(user?.id),
        }));
        setMessages(enriched);
      } catch (err: unknown) {
        setHistoryError(
          err instanceof Error ? err.message : "Không tải được lịch sử tin nhắn"
        );
        setMessages([]);
      } finally {
        setIsLoadingHistory(false);
      }
    }

    loadHistory();

    if (prevRoomIdRef.current && prevRoomIdRef.current !== roomId) {
      emitLeaveRoom(prevRoomIdRef.current);
    }

    prevRoomIdRef.current = roomId;
  }, [friendId, user?.id, emitLeaveRoom]);

  // ── Join phòng DM + lắng nghe tin nhắn realtime ────────────────────
  useEffect(() => {
    if (!currentRoomId) return;

    emitJoinRoom(currentRoomId);

    const unsubReceive = onReceiveMessage((newMsg) => {
      // Bỏ qua nếu là tin nhắn của chính mình (đã có optimistic message)
      if (Number(newMsg.senderId) === Number(user?.id)) return;

      // Bỏ qua nếu tin nhắn không thuộc phòng hiện tại
      if (newMsg.conversationId !== currentRoomId) return;

      // Thay thế optimistic message bằng tin nhắn thực từ server
      setMessages((prev) => {
        const hasOptimistic = prev.some((m) => m.id !== undefined && String(m.id).startsWith('temp-'));
        const replaced = prev.map((m) =>
          String(m.id).startsWith('temp-')
            ? { ...newMsg, isOwn: false, sendStatus: 'received' }
            : m
        );
        // Nếu không có optimistic message nào, kiểm tra duplicate
        if (!hasOptimistic) {
          const exists = prev.some((m) => m.id === newMsg.id);
          if (exists) return prev;
          return [...prev, { ...newMsg, isOwn: false, sendStatus: 'received' }];
        }
        return replaced;
      });
    });

    const unsubTyping = onUserTyping(({ userId, userName }) => {
      setTypingUsers((prev) =>
        prev.includes(userName) ? prev : [...prev, userName]
      );
      // Tự động xóa sau 3 giây nếu không có typing_stop
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        setTypingUsers((prev) => prev.filter((n) => n !== userName));
      }, 3000);
    });

    const unsubStopTyping = onUserStoppedTyping(({ userName }) => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      setTypingUsers((prev) => prev.filter((n) => n !== userName));
    });

    return () => {
      unsubReceive();
      unsubTyping();
      unsubStopTyping();
      emitLeaveRoom(currentRoomId);
    };
  }, [currentRoomId, emitJoinRoom, emitLeaveRoom, onReceiveMessage, onUserTyping, onUserStoppedTyping, user?.id]);

  // ── onTypingChange: bật/tắt typing indicator ──────────────────────
  const onTypingChange = useCallback(
    (isTyping: boolean) => {
      if (!currentRoomId) return;
      if (isTyping) {
        emitTypingStart(currentRoomId);
      } else {
        emitTypingStop(currentRoomId);
      }
    },
    [currentRoomId, emitTypingStart, emitTypingStop]
  );

  // ── Auto-scroll khi có tin nhắn mới ──────────────────────────────────────
  useEffect(() => {
    if (messages.length === 0) return;

    if (scrollDebounceTimer.current) {
      clearTimeout(scrollDebounceTimer.current);
    }

    scrollDebounceTimer.current = setTimeout(() => {
      bottomSentinelRef.current?.scrollIntoView({ behavior: "smooth" });
    }, scrollDebounceMs);

    return () => {
      if (scrollDebounceTimer.current) {
        clearTimeout(scrollDebounceTimer.current);
      }
    };
  }, [messages, scrollDebounceMs]);

  // ── Gửi tin nhắn DM ─────────────────────────────────────────────────
  const sendMessage = useCallback(
    async (content: string) => {
      if (!currentRoomId || !content.trim()) return;

      const tempId = `temp-${Date.now()}`;
      const optimisticMsg: ChatMessage = {
        id: tempId,
        conversationId: currentRoomId,
        senderId: user?.id ?? 0,
        contentType: "text",
        content: content.trim(),
        createdAt: new Date().toISOString(),
        isOwn: true,
        sendStatus: "sending",
      };

      setMessages((prev) => [...prev, optimisticMsg]);

      setIsSending(true);
      try {
        const result = await emitSendMessage(
          currentRoomId,
          content.trim(),
          "text",
          null
        );

        if (result.ok && result.message) {
          const finalMsg = result.message;
          emitTypingStop(currentRoomId);
          onDmActivity?.({
            conversationId: finalMsg.conversationId,
            content: finalMsg.content,
            createdAt: finalMsg.createdAt,
          });
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempId
                ? { ...finalMsg, isOwn: true, sendStatus: "sent" }
                : m
            )
          );
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempId ? { ...m, sendStatus: "failed" } : m
            )
          );
        }
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId ? { ...m, sendStatus: "failed" } : m
          )
        );
      } finally {
        setIsSending(false);
      }
    },
    [currentRoomId, emitSendMessage, emitTypingStop, user?.id, onDmActivity]
  );

  return {
    messages,
    isLoadingHistory,
    historyError,
    currentRoomId,
    sendMessage,
    isSending,
    setMessages,
    bottomSentinelRef,
    scrollContainerRef,
    typingUsers,
    onTypingChange,
  };
}
