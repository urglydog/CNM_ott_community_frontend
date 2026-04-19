"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSocket } from "../../../contexts/SocketContext";
import { useAuth } from "../../../contexts/AuthContext";
import { getGroupMessages, sendGroupFileMessage } from "../api";
import { useChatStore } from "../store/chatStore";
import type { Group, GroupMember } from "../../groups/types";
import type { DirectMessageItem, StickerData } from "../../../types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getPreviewContent(
  message: Pick<DirectMessageItem, "contentType" | "content" | "attachments">,
): string {
  if (message.contentType === "image") return "[Ảnh]";
  if (message.contentType === "file")
    return `[Tệp] ${message.content || "Đính kèm"}`;
  if (message.contentType === "sticker") return "[Sticker]";
  if (message.contentType === "emoji") return message.content || "[Biểu tượng cảm xúc]";
  if (Array.isArray(message.attachments) && message.attachments.length > 0) {
    const hasImage = message.attachments.some((a) => a?.type === "image");
    if (hasImage) return "[Ảnh]";
    return `[Tệp] ${message.content || "Đính kèm"}`;
  }
  return message.content;
}

export type MessageSendStatus = "sending" | "sent" | "failed" | "received";

export interface GroupChatMessage extends DirectMessageItem {
  sendStatus?: MessageSendStatus;
  isOwn?: boolean;
  /** Thông tin người gửi — điền từ members hoặc từ chat window pass qua */
  senderDisplayName?: string | null;
  senderAvatarUrl?: string | null;
}

/** Tạo conversationId cho nhóm — chính là groupId */
export function groupConversationId(groupId: string | number): string {
  return String(groupId);
}

/** Kiểm tra conversationId có phải nhóm hay không */
export function isGroupConversation(conversationId: string): boolean {
  return !!conversationId && !conversationId.startsWith("dm:");
}

/** Kiểm tra tin nhắn có phải system message hay không */
export function isSystemMessage(msg: GroupChatMessage): boolean {
  return msg.contentType === "system";
}

interface UseGroupChatReturn {
  messages: GroupChatMessage[];
  isLoadingHistory: boolean;
  historyError: string | null;
  currentRoomId: string | null;
  sendMessage: (content: string) => Promise<void>;
  sendFileMessage: (file: File) => Promise<void>;
  sendStickerMessage: (stickerData: StickerData) => Promise<void>;
  sendEmojiMessage: (emoji: string) => Promise<void>;
  isSending: boolean;
  isUploadingFile: boolean;
  setMessages: React.Dispatch<React.SetStateAction<GroupChatMessage[]>>;
  deleteMessage: (messageId: string) => void;
  bottomSentinelRef: React.RefObject<HTMLDivElement | null>;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  typingUsers: string[];
  onTypingChange: (isTyping: boolean) => void;
}

const DEBOUNCE_MS_DEFAULT = 100;

/**
 * Hook quản lý chat nhóm với real-time Socket.io.
 * - Join/leave room dựa trên groupId.
 * - Tải lịch sử tin nhắn nhóm.
 * - Optimistic update khi gửi tin nhắn.
 * - Auto-scroll tới tin nhắn mới nhất.
 * - Typing indicator.
 */
export function useGroupChat(
  group: Group | null,
  members: GroupMember[],
  options: {
    scrollDebounceMs?: number;
    onGroupActivity?: (payload: {
      groupId: string;
      content: string;
      createdAt: string;
    }) => void;
  } = {},
): UseGroupChatReturn {
  const { scrollDebounceMs = DEBOUNCE_MS_DEFAULT, onGroupActivity } = options;

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
    onMessageRevoked,
  } = useSocket();

  const { setGroupConversationPreview } = useChatStore();

  const [messages, setMessages] = useState<GroupChatMessage[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevRoomIdRef = useRef<string | null>(null);
  const scrollDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const bottomSentinelRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const currentRoomId =
    group != null ? groupConversationId(group.groupId) : null;

  // ── Helper: Lấy thông tin sender từ danh sách members ───────────────────
  const getSenderInfo = useCallback(
    (senderId: string | number) => {
      const member = members.find((m) => String(m.userId) === String(senderId));
      return member ?? null;
    },
    [members],
  );

  // ── Load lịch sử tin nhắn nhóm ───────────────────────────────────────────
  useEffect(() => {
    if (!group) {
      setMessages([]);
      setHistoryError(null);
      prevRoomIdRef.current = null;
      return;
    }

    const roomId = groupConversationId(group.groupId);
    const channelRoomId = `channel:${roomId}`;

    async function loadHistory() {
      setIsLoadingHistory(true);
      setHistoryError(null);
      try {
        const [primaryList, channelList] = await Promise.all([
          getGroupMessages(roomId),
          getGroupMessages(channelRoomId),
        ]);
        const list = [...primaryList, ...channelList].sort((a, b) =>
          String(a.createdAt || "").localeCompare(String(b.createdAt || "")),
        );

        const seen = new Set<string>();
        const enriched: GroupChatMessage[] = list
          .filter((msg) => {
            const key = String(msg.id);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .map((msg) => ({
            ...msg,
            conversationId: roomId,
            isOwn: Number(msg.senderId) === Number(user?.id),
            senderDisplayName:
              msg.senderDisplayName ||
              (Number(msg.senderId) === Number(user?.id)
                ? user?.displayName
                : null),
            senderAvatarUrl: msg.senderAvatarUrl ?? null,
          }));
        setMessages(enriched);
      } catch (err: unknown) {
        setHistoryError(
          err instanceof Error
            ? err.message
            : "Không tải được lịch sử tin nhắn nhóm",
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
  }, [group, user?.id, emitLeaveRoom, getSenderInfo]);

  // ── Join phòng nhóm + lắng nghe tin nhắn realtime ──────────────────────
  useEffect(() => {
    if (!currentRoomId) return;
    const channelRoomId = `channel:${currentRoomId}`;

    emitJoinRoom(currentRoomId);
    emitJoinRoom(channelRoomId);

    const unsubReceive = onReceiveMessage((newMsg) => {
      // Bỏ qua tin nhắn không thuộc phòng hiện tại
      if (
        newMsg.conversationId !== currentRoomId &&
        newMsg.conversationId !== channelRoomId
      ) {
        return;
      }
      // Bỏ qua tin nhắn của chính mình (đã có optimistic xử lý)
      if (Number(newMsg.senderId) === Number(user?.id)) return;

      // Cập nhật preview để nhóm trồi lên đầu trong ChatListPanel
      setGroupConversationPreview(currentRoomId, {
        content: getPreviewContent(newMsg),
        createdAt: newMsg.createdAt,
      });

      const member = getSenderInfo(newMsg.senderId);
      const enrichedMsg: GroupChatMessage = {
        ...newMsg,
        conversationId: currentRoomId,
        isOwn: false,
        sendStatus: "received",
        senderDisplayName:
          newMsg.senderDisplayName || member?.displayName || null,
        senderAvatarUrl: newMsg.senderAvatarUrl ?? member?.avatarUrl ?? null,
      };

      setMessages((prev) => {
        const exists = prev.some((m) => m.id === newMsg.id);
        if (exists) return prev;
        return [...prev, enrichedMsg];
      });
    });

    const unsubRevoked = onMessageRevoked(({ conversationId, messageId }) => {
      if (conversationId !== currentRoomId) return;
      setMessages((prev) =>
        prev.map((m) =>
          String(m.id) === String(messageId)
            ? ({
                ...m,
                contentType: "revoked" as const,
                content: null,
                attachments: null,
              } as unknown as GroupChatMessage)
            : m,
        ),
      );
    });

    const unsubTyping = onUserTyping(({ roomId, userName }) => {
      if (roomId !== currentRoomId) return;
      setTypingUsers((prev) =>
        prev.includes(userName) ? prev : [...prev, userName],
      );
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        setTypingUsers((prev) => prev.filter((n) => n !== userName));
      }, 3000);
    });

    const unsubStopTyping = onUserStoppedTyping(({ roomId, userName }) => {
      if (roomId !== currentRoomId) return;
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      setTypingUsers((prev) => prev.filter((n) => n !== userName));
    });

    return () => {
      unsubReceive();
      unsubRevoked();
      unsubTyping();
      unsubStopTyping();
      emitLeaveRoom(currentRoomId);
      emitLeaveRoom(channelRoomId);
    };
  }, [
    currentRoomId,
    emitJoinRoom,
    emitLeaveRoom,
    onReceiveMessage,
    onMessageRevoked,
    onUserTyping,
    onUserStoppedTyping,
    user?.id,
    getSenderInfo,
    setGroupConversationPreview,
  ]);

  // ── onTypingChange ────────────────────────────────────────────────────
  const onTypingChange = useCallback(
    (isTyping: boolean) => {
      if (!currentRoomId) return;
      if (isTyping) {
        emitTypingStart(currentRoomId);
      } else {
        emitTypingStop(currentRoomId);
      }
    },
    [currentRoomId, emitTypingStart, emitTypingStop],
  );

  // ── Auto-scroll khi có tin nhắn mới ────────────────────────────────────
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

  // ── Gửi tin nhắn nhóm ────────────────────────────────────────────────
  const sendMessage = useCallback(
    async (content: string) => {
      if (!currentRoomId || !content.trim()) return;

      const tempId = `temp-${Date.now()}`;
      const optimisticMsg: GroupChatMessage = {
        id: tempId,
        conversationId: currentRoomId,
        senderId: user?.id ?? 0,
        contentType: "text",
        content: content.trim(),
        createdAt: new Date().toISOString(),
        isOwn: true,
        sendStatus: "sending",
        senderDisplayName: user?.displayName ?? null,
        senderAvatarUrl: null,
      };

      setMessages((prev) => [...prev, optimisticMsg]);

      setIsSending(true);
      try {
        const result = await emitSendMessage(
          currentRoomId,
          content.trim(),
          "text",
          null,
        );

        if (result.ok && result.message) {
          const finalMsg = result.message;
          emitTypingStop(currentRoomId);

          const enrichedMsg: GroupChatMessage = {
            ...finalMsg,
            isOwn: true,
            sendStatus: "sent",
            senderDisplayName:
              finalMsg.senderDisplayName ?? user?.displayName ?? null,
            senderAvatarUrl: finalMsg.senderAvatarUrl ?? null,
          };

          onGroupActivity?.({
            groupId: currentRoomId,
            content: finalMsg.content,
            createdAt: finalMsg.createdAt,
          });

          // Cập nhật preview để nhóm trồi lên đầu trong ChatListPanel
          setGroupConversationPreview(currentRoomId, {
            content: getPreviewContent(finalMsg),
            createdAt: finalMsg.createdAt,
          });

          setMessages((prev) =>
            prev.map((m) => (m.id === tempId ? enrichedMsg : m)),
          );
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempId ? { ...m, sendStatus: "failed" } : m,
            ),
          );
        }
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId ? { ...m, sendStatus: "failed" } : m,
          ),
        );
      } finally {
        setIsSending(false);
      }
    },
    [
      currentRoomId,
      emitSendMessage,
      emitTypingStop,
      user?.id,
      user?.displayName,
      onGroupActivity,
      setGroupConversationPreview,
    ],
  );

  const sendFileMessage = useCallback(
    async (file: File) => {
      if (!currentRoomId || !user?.id) return;

      const tempId = `temp-file-${Date.now()}`;
      const tempUrl = URL.createObjectURL(file);
      const attachmentType = file.type.startsWith("image/") ? "image" : "file";

      const optimisticMsg: GroupChatMessage = {
        id: tempId,
        conversationId: currentRoomId,
        senderId: user.id,
        contentType: attachmentType,
        content: file.name,
        attachments: [
          {
            url: tempUrl,
            type: attachmentType,
            size: file.size,
          },
        ],
        createdAt: new Date().toISOString(),
        isOwn: true,
        sendStatus: "sending",
        senderDisplayName: user.displayName ?? null,
        senderAvatarUrl: null,
      };

      setMessages((prev) => [...prev, optimisticMsg]);
      setIsUploadingFile(true);

      try {
        const finalMsg = await sendGroupFileMessage({
          file,
          senderId: user.id,
          groupId: currentRoomId,
        });

        const normalizedFinalMsg: GroupChatMessage = {
          ...finalMsg,
          conversationId: currentRoomId,
          isOwn: true,
          sendStatus: "sent",
          senderDisplayName:
            finalMsg.senderDisplayName ?? user.displayName ?? null,
          senderAvatarUrl: finalMsg.senderAvatarUrl ?? null,
        };

        setGroupConversationPreview(currentRoomId, {
          content: getPreviewContent(normalizedFinalMsg),
          createdAt: normalizedFinalMsg.createdAt,
        });

        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? normalizedFinalMsg : m)),
        );
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId ? { ...m, sendStatus: "failed" } : m,
          ),
        );
      } finally {
        URL.revokeObjectURL(tempUrl);
        setIsUploadingFile(false);
      }
    },
    [currentRoomId, user?.id, user?.displayName, setGroupConversationPreview],
  );

  const sendStickerMessage = useCallback(
    async (stickerData: StickerData) => {
      if (!currentRoomId || !user?.id) return;

      const tempId = `temp-sticker-${Date.now()}`;
      const optimisticMsg: GroupChatMessage = {
        id: tempId,
        conversationId: currentRoomId,
        senderId: user.id,
        contentType: "sticker",
        content: stickerData.stickerName || stickerData.stickerId || "[Sticker]",
        stickerData,
        createdAt: new Date().toISOString(),
        isOwn: true,
        sendStatus: "sending",
        senderDisplayName: user.displayName ?? null,
        senderAvatarUrl: null,
      };

      setMessages((prev) => [...prev, optimisticMsg]);
      setIsSending(true);

      try {
        const result = await emitSendMessage(
          currentRoomId,
          stickerData.stickerName || stickerData.stickerId || "[Sticker]",
          "sticker",
          null,
          stickerData,
        );

        if (result.ok && result.message) {
          const finalMsg = result.message;
          const enrichedMsg: GroupChatMessage = {
            ...finalMsg,
            isOwn: true,
            sendStatus: "sent",
            senderDisplayName: user.displayName ?? null,
            senderAvatarUrl: null,
          };

          setGroupConversationPreview(currentRoomId, {
            content: "[Sticker]",
            createdAt: finalMsg.createdAt,
          });

          setMessages((prev) =>
            prev.map((m) => (m.id === tempId ? enrichedMsg : m)),
          );
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempId ? { ...m, sendStatus: "failed" } : m,
            ),
          );
        }
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId ? { ...m, sendStatus: "failed" } : m,
          ),
        );
      } finally {
        setIsSending(false);
      }
    },
    [currentRoomId, user?.id, user?.displayName, emitSendMessage, setGroupConversationPreview],
  );

  const sendEmojiMessage = useCallback(
    async (emoji: string) => {
      if (!currentRoomId || !user?.id || !emoji.trim()) return;

      const tempId = `temp-emoji-${Date.now()}`;
      const optimisticMsg: GroupChatMessage = {
        id: tempId,
        conversationId: currentRoomId,
        senderId: user.id,
        contentType: "emoji",
        content: emoji.trim(),
        createdAt: new Date().toISOString(),
        isOwn: true,
        sendStatus: "sending",
        senderDisplayName: user.displayName ?? null,
        senderAvatarUrl: null,
      };

      setMessages((prev) => [...prev, optimisticMsg]);
      setIsSending(true);

      try {
        const result = await emitSendMessage(
          currentRoomId,
          emoji.trim(),
          "emoji",
          null,
        );

        if (result.ok && result.message) {
          const finalMsg = result.message;
          const enrichedMsg: GroupChatMessage = {
            ...finalMsg,
            isOwn: true,
            sendStatus: "sent",
            senderDisplayName: user.displayName ?? null,
            senderAvatarUrl: null,
          };

          setGroupConversationPreview(currentRoomId, {
            content: emoji.trim(),
            createdAt: finalMsg.createdAt,
          });

          setMessages((prev) =>
            prev.map((m) => (m.id === tempId ? enrichedMsg : m)),
          );
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempId ? { ...m, sendStatus: "failed" } : m,
            ),
          );
        }
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId ? { ...m, sendStatus: "failed" } : m,
          ),
        );
      } finally {
        setIsSending(false);
      }
    },
    [currentRoomId, user?.id, user?.displayName, emitSendMessage, setGroupConversationPreview],
  );

  return {
    messages,
    isLoadingHistory,
    historyError,
    currentRoomId,
    sendMessage,
    sendFileMessage,
    sendStickerMessage,
    sendEmojiMessage,
    isSending,
    isUploadingFile,
    setMessages,
    deleteMessage: (messageId: string) => {
      setMessages((prev) => prev.filter((m) => String(m.id) !== String(messageId)));
    },
    bottomSentinelRef,
    scrollContainerRef,
    typingUsers,
    onTypingChange,
  };
}
