"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSocket } from "../contexts/SocketContext";
import { useAuth } from "../contexts/AuthContext";
import { fetchMessagesByChannel } from "../api/client";
import type { Channel, MessageItem } from "../types";

export type MessageSendStatus = "sending" | "sent" | "failed";

export interface ChatMessage extends MessageItem {
  /** Trạng thái gửi: chỉ áp dụng với tin nhắn do user hiện tại gửi */
  sendStatus?: MessageSendStatus;
  /** user hiện tại có phải là người gửi không */
  isOwn?: boolean;
}

interface UseChatRoomOptions {
  /** Khoảng thời gian (ms) để debounce auto-scroll, mặc định 100ms */
  scrollDebounceMs?: number;
}

interface UseChatRoomReturn {
  /** Danh sách tin nhắn trong phòng hiện tại */
  messages: ChatMessage[];
  /** Đang tải lịch sử tin nhắn từ API */
  isLoadingHistory: boolean;
  /** Lỗi khi tải lịch sử */
  historyError: string | null;
  /** roomId hiện tại (format: "channel:X") */
  currentRoomId: string | null;
  /** Gửi tin nhắn văn bản tới phòng hiện tại */
  sendMessage: (content: string) => Promise<void>;
  /** Tin nhắn đang được gửi (pending) */
  isSending: boolean;
  /** Ghi đè toàn bộ messages (dùng cho load lại lịch sử) */
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  /** Ref tới bottom sentinel (dùng cho auto-scroll) */
  bottomSentinelRef: React.RefObject<HTMLDivElement | null>;
  /** Ref tới container scroll */
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}

const DEBOUNCE_MS_DEFAULT = 100;

/**
 * Hook quản lý phòng chat realtime.
 *
 * - Tự động join/leave room khi selectedChannel thay đổi.
 * - Lắng nghe sự kiện receive_message từ server để cập nhật UI tức thì.
 * - Hỗ trợ auto-scroll tới tin nhắn mới nhất.
 * - Gửi tin nhắn qua socket với trạng thái optimistic.
 *
 * @param selectedChannel - Channel đang được chọn trong UI
 * @param options - Cấu hình thêm (debounce, etc.)
 */
export function useChatRoom(
  selectedChannel: Channel | null,
  options: UseChatRoomOptions = {}
): UseChatRoomReturn {
  const { scrollDebounceMs = DEBOUNCE_MS_DEFAULT } = options;

  const { user } = useAuth();
  const { emitJoinRoom, emitLeaveRoom, emitSendMessage, onReceiveMessage } =
    useSocket();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const prevRoomIdRef = useRef<string | null>(null);
  const scrollDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottomSentinelRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  /** Tính roomId từ channel (format: "channel:X") */
  const currentRoomId =
    selectedChannel != null ? `channel:${selectedChannel.id}` : null;

  // ── Load lịch sử tin nhắn khi đổi channel ──────────────────────────────────
  useEffect(() => {
    if (!selectedChannel) {
      setMessages([]);
      setHistoryError(null);
      prevRoomIdRef.current = null;
      return;
    }

    async function loadHistory(channelId: string | number) {
      setIsLoadingHistory(true);
      setHistoryError(null);
      try {
        const list = await fetchMessagesByChannel(channelId);
        // Gắn isOwn cho từng tin nhắn dựa trên senderId
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

    loadHistory(selectedChannel.id);

    // Rời phòng cũ nếu có
    if (prevRoomIdRef.current && prevRoomIdRef.current !== currentRoomId) {
      emitLeaveRoom(prevRoomIdRef.current);
    }

    // Ghi nhận room mới
    prevRoomIdRef.current = currentRoomId;
  }, [selectedChannel, user?.id, emitLeaveRoom, currentRoomId]);

  // ── Join phòng mới + lắng nghe tin nhắn realtime ──────────────────────────
  useEffect(() => {
    if (!currentRoomId) return;

    // Gửi join_room tới server
    emitJoinRoom(currentRoomId);

    // Lắng nghe receive_message: cập nhật UI tức thì khi có tin nhắn mới
    const unsubscribe = onReceiveMessage((newMsg) => {
      const isOwn = Number(newMsg.senderId) === Number(user?.id);
      const chatMsg: ChatMessage = { ...newMsg, isOwn, sendStatus: "sent" };

      setMessages((prev) => {
        // Tránh trùng lặp (server gửi lại cho chính người gửi)
        const exists = prev.some((m) => m.id === newMsg.id);
        if (exists) return prev;
        return [...prev, chatMsg];
      });
    });

    return () => {
      unsubscribe();
      emitLeaveRoom(currentRoomId);
    };
  }, [currentRoomId, emitJoinRoom, emitLeaveRoom, onReceiveMessage, user?.id]);

  // ── Auto-scroll khi có tin nhắn mới ──────────────────────────────────────
  useEffect(() => {
    if (messages.length === 0) return;

    // Debounce scroll để tránh lag khi nhiều tin nhắn đến cùng lúc
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

  // ── Gửi tin nhắn ─────────────────────────────────────────────────────────
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

      // Optimistic update: hiển thị ngay trong UI
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
          // Thay thế tin nhắn optimistic bằng bản ghi chính thức từ server
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempId
                ? { ...result.message!, isOwn: true, sendStatus: "sent" }
                : m
            )
          );
        } else {
          // Đánh dấu thất bại
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
    [currentRoomId, emitSendMessage, user?.id]
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
  };
}
