"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSocket } from "../../../contexts/SocketContext";

import { useAuth } from "../../../contexts/AuthContext";
import { getGroupMessages, sendGroupFileMessage, getReadStatusForMessages } from "../api";
import { getPresignedUploadUrl } from "../../../api/client";
import { useChatStore } from "../store/chatStore";
import { generateVideoThumbnail, handleUploadToS3 } from "../utils/videoUpload";
import type { Group, GroupMember } from "../../groups/types";
import type { DirectMessageItem, StickerData, ReadReceiptReader } from "../../../types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getPreviewContent(
  message: Pick<DirectMessageItem, "contentType" | "content" | "attachments">,
): string {
  if (message.contentType === "image") return "[Ảnh]";
  if (message.contentType === "video") return "[Video]";
  if (message.contentType === "file")
    return `[Tệp] ${message.content || "Đính kèm"}`;
  if (message.contentType === "sticker") return "[Sticker]";
  if (message.contentType === "emoji")
    return message.content || "[Biểu tượng cảm xúc]";
  if (message.contentType === "poll") return "[Bình chọn]";
  if (Array.isArray(message.attachments) && message.attachments.length > 0) {
    const hasImage = message.attachments.some((a) => a?.type === "image");
    const hasVideo = message.attachments.some((a) => a?.type === "video");
    if (hasImage) return "[Ảnh]";
    if (hasVideo) return "[Video]";
    return `[Tệp] ${message.content || "Đính kèm"}`;
  }
  return message.content;
}

export type MessageSendStatus = "sending" | "sent" | "delivered" | "received" | "read" | "failed";

export interface GroupChatMessage extends DirectMessageItem {
  sendStatus?: MessageSendStatus;
  isOwn?: boolean;
  /** Thông tin người gửi — điền từ members hoặc từ chat window pass qua */
  senderDisplayName?: string | null;
  senderAvatarUrl?: string | null;
  /** Danh sách người đã đọc tin nhắn (chỉ dùng cho tin nhắn của chính mình) */
  readBy?: ReadReceiptReader[];
  /** Hàm để trigger reply action - được set từ ChatWindow */
  onReplyClick?: (message: GroupChatMessage) => void;
  mentions?: string[];
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
  sendMessage: (content: string, replyTo?: string | number | null, mentions?: string[]) => Promise<void>;
  sendFileMessage: (file: File) => Promise<void>;
  sendStickerMessage: (stickerData: StickerData) => Promise<void>;
  sendEmojiMessage: (emoji: string) => Promise<void>;
  isSending: boolean;
  isUploadingFile: boolean;
  uploadProgress: number;
  setMessages: React.Dispatch<React.SetStateAction<GroupChatMessage[]>>;
  deleteMessage: (messageId: string) => void;
  bottomSentinelRef: React.RefObject<HTMLDivElement | null>;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  handleScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  typingUsers: string[];
  onTypingChange: (isTyping: boolean) => void;
}

const DEBOUNCE_MS_DEFAULT = 100;
const MAX_VIDEO_FILE_SIZE = 50 * 1024 * 1024;

function buildS3PublicUrl(bucket: string, key: string): string {
  return `https://${bucket}.s3.amazonaws.com/${key}`;
}

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
    emitMarkRead,
    onReceiveMessage,
    onUserTyping,
    onUserStoppedTyping,
    onMessageRevoked,
    onMessageRead,
    onLiveLocationStopped,
    onUpdateMessage,
    onPollUpdated,
  } = useSocket();

  const { setGroupConversationPreview } = useChatStore();

  const [messages, setMessages] = useState<GroupChatMessage[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  // Track page visibility to prevent marking read when tab is hidden
  const [isPageVisible, setIsPageVisible] = useState(true);
  // Track previous message count to detect NEW messages vs history load
  const prevMessageCountRef = useRef(0);
  // Prevent duplicate mark_read for the same message within a time window
  const lastMarkedReadRef = useRef<{ messageId: string; timestamp: number } | null>(null);
  // Debounce timer for mark_read emissions
  const markReadDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevRoomIdRef = useRef<string | null>(null);
  const scrollDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const bottomSentinelRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const lastMarkedIdRef = useRef<string | null>(null);

  const currentRoomId =
    group != null ? groupConversationId(group.groupId) : null;

  // ── Track page visibility ────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleVisibilityChange = () => {
      setIsPageVisible(document.visibilityState === "visible");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // ── Helper: Lấy thông tin sender từ danh sách members ───────────────────
  const getSenderInfo = useCallback(
    (senderId: string | number) => {
      const member = members.find((m) => String(m.userId) === String(senderId));
      return member ?? null;
    },
    [members],
  );

  // ── Load lịch sử tin nhắn nhóm ───────────────────────────────────────────
  // Track if initial history load is complete
  const [historyLoaded, setHistoryLoaded] = useState(false);

  useEffect(() => {
    if (!group) {
      setMessages([]);
      setHistoryError(null);
      setHistoryLoaded(false);
      prevRoomIdRef.current = null;
      // Reset message count khi không có group
      prevMessageCountRef.current = 0;
      return;
    }

    // Reset message count khi chuyển sang group mới
    // Đảm bảo mark_read được trigger khi history load xong
    prevMessageCountRef.current = 0;

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

        // Get message IDs that are from the current user (for read status check)
        const myMessageIds = list
          .filter((m) => Number(m.senderId) === Number(user?.id))
          .map((m) => String(m.id || m.messageId));

        // Fetch read status for all messages from current user
        let readStatuses: Record<string, { isRead: boolean; readers: ReadReceiptReader[] }> = {};
        try {
          if (myMessageIds.length > 0 && user?.id) {
            const readStatusResult = await getReadStatusForMessages(roomId, myMessageIds);
            readStatuses = readStatusResult.statuses || {};
          }
        } catch (readErr) {
          console.warn("[GroupChat] Could not fetch read statuses:", readErr);
        }

        const seen = new Set<string>();
        const enriched: GroupChatMessage[] = list
          .filter((msg) => {
            const key = String(msg.id);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .map((msg) => {
            const msgId = String(msg.id || msg.messageId || "");
            const isMyMessage = Number(msg.senderId) === Number(user?.id);
            const readStatus = readStatuses[msgId];

            // Determine initial status based on read receipt
            let sendStatus: MessageSendStatus = "sent";
            if (isMyMessage && readStatus?.isRead) {
              sendStatus = "read";
            }

            return {
              ...msg,
              conversationId: roomId,
              isOwn: isMyMessage,
              sendStatus,
              senderDisplayName:
                msg.senderDisplayName ||
                (Number(msg.senderId) === Number(user?.id)
                  ? user?.displayName
                  : null),
              senderAvatarUrl: msg.senderAvatarUrl ?? null,
              // Include readers info only for own messages
              ...(isMyMessage && readStatus?.readers ? { readBy: readStatus.readers } : {}),
            };
          });
        setMessages(enriched);
        // Mark history as loaded so scroll effect can trigger
        setHistoryLoaded(true);
      } catch (err: unknown) {
        setHistoryError(
          err instanceof Error
            ? err.message
            : "Không tải được lịch sử tin nhắn nhóm",
        );
        setMessages([]);
        setHistoryLoaded(true);
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
    // emitJoinRoom(channelRoomId);

    const unsubReceive = onReceiveMessage((newMsg) => {
      // Bỏ qua tin nhắn không thuộc phòng hiện tại
      if (
        newMsg.conversationId !== currentRoomId &&
        newMsg.conversationId !== channelRoomId
      ) {
        return;
      }
      // Bỏ qua tin nhắn của chính mình, NGOẠI TRỪ call_log, group_call_started VÀ poll (cần hiển thị)
      const isCallLog = (newMsg as any).contentType === "call_log" || (newMsg as any).messageType === "call_log";
      const isGroupCallStarted = (newMsg as any).contentType === "group_call_started" || (newMsg as any).messageType === "group_call_started";
      const isPoll = (newMsg as any).contentType === "poll";
      if (!isCallLog && !isGroupCallStarted && !isPoll && Number(newMsg.senderId) === Number(user?.id)) return;

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
        sendStatus: "sent",
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

    // Listen for read receipt events
    const unsubRead = onMessageRead(({ conversationId, messageId, readerId, readerName, readerAvatar, readAt }) => {
      if (conversationId !== currentRoomId) return;

      setMessages((prev) =>
        prev.map((m) => {
          // Only update messages sent by the current user
          if (Number(m.senderId) !== Number(user?.id)) return m;
          // Only update the specific message
          if (String(m.id || m.messageId) !== String(messageId)) return m;

          // Add reader to readBy array
          const newReader: ReadReceiptReader = {
            userId: readerId,
            readerName,
            readerAvatar: readerAvatar ?? null,
            readAt,
          };

          const existingReaders = m.readBy || [];
          // Avoid duplicates
          if (existingReaders.some(r => r.userId === readerId)) {
            return { ...m, sendStatus: "read" as const };
          }

          return {
            ...m,
            sendStatus: "read" as const,
            readBy: [...existingReaders, newReader],
          };
        }),
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

    const unsubLiveLocationStopped = onLiveLocationStopped((payload) => {
      if (payload.roomId !== currentRoomId) return;
      const now = new Date(Date.now() - 1000).toISOString();
      setMessages((prev) => prev.map(m => 
        (m.contentType === "location" && String(m.senderId) === String(payload.senderId) && (m.locationData as any)?.isLive && (!m.locationData?.liveUntil || new Date(m.locationData.liveUntil).getTime() > Date.now())) 
          ? { ...m, locationData: { ...m.locationData, liveUntil: now } as any } 
          : m
      ));
    });

    const unsubUpdateMsg = onUpdateMessage((updatedMsg) => {
      if (updatedMsg.conversationId !== currentRoomId) return;
      setMessages((prev) =>
        prev.map((m) =>
          String(m.id) === String(updatedMsg.id) || String(m.messageId) === String((updatedMsg as any).messageId)
            ? { ...m, ...updatedMsg, isOwn: m.isOwn } as GroupChatMessage
            : m
        )
      );
    });

    // ── Poll vote update listener ────────────────────────────────────────
    const unsubPollUpdated = onPollUpdated(({ roomId, messageId, pollData }) => {
      if (roomId !== currentRoomId) return;
      setMessages((prev) =>
        prev.map((m) => {
          const msgId = String(m.id || m.messageId || "");
          if (msgId === String(messageId)) {
            // Create new object reference to trigger re-render
            return {
              ...m,
              pollData: { ...pollData },
            } as GroupChatMessage;
          }
          return m;
        })
      );
    });

    return () => {
      unsubReceive();
      unsubRevoked();
      unsubRead();
      unsubTyping();
      unsubStopTyping();
      unsubLiveLocationStopped();
      unsubUpdateMsg();
      unsubPollUpdated();
      emitLeaveRoom(currentRoomId);
      // emitLeaveRoom(channelRoomId);
    };
  }, [
    currentRoomId,
    emitJoinRoom,
    emitLeaveRoom,
    onReceiveMessage,
    onMessageRevoked,
    onMessageRead,
    onUserTyping,
    onUserStoppedTyping,
    onLiveLocationStopped,
    onUpdateMessage,
    onPollUpdated,
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

  // ─── Auto-mark messages as read ──────────────────────────────────────────
  /**
   * Mark messages as read ONLY when:
   * 1. The page is visible (not minimized/in background tab)
   * 2. The chat is the currently active conversation in the store
   * 3. A NEW message was received (not during history load)
   * 4. The message hasn't been marked as read recently (duplicate prevention)
   */
  const markMessagesAsRead = useCallback(() => {
    // CRITICAL: Only mark as read if the page is visible
    if (!isPageVisible) {
      console.log("[GroupChat] Skipping mark_as_read: page is hidden");
      return;
    }

    // CRITICAL: Only mark as read for the currently active conversation
    // This prevents stale hooks from marking read for closed chat windows
    // Use getState() to get the LATEST state, not a stale closure
    const store = useChatStore.getState();
    const isCurrentlySelected =
      store.chatMode === "GROUP" &&
      store.selectedGroup?.groupId === group?.groupId;

    if (!isCurrentlySelected) {
      console.log("[GroupChat] Skipping mark_as_read: not the selected conversation", {
        chatMode: store.chatMode,
        selectedGroupId: store.selectedGroup?.groupId,
        thisGroupId: group?.groupId
      });
      return;
    }

    if (messages.length === 0) return;

    // Lấy tin nhắn cuối cùng từ người khác (không phải của mình)
    const lastReceivedMessage = [...messages]
      .reverse()
      .find((m) => !m.isOwn);

    if (lastReceivedMessage) {
      const rawId = lastReceivedMessage.id || lastReceivedMessage.messageId;
      if (!rawId) return;
      const messageId = String(rawId);

      // Prevent duplicate mark_read for the same message within 3 seconds
      const now = Date.now();
      const THREE_SECONDS = 3000;
      if (
        lastMarkedReadRef.current &&
        lastMarkedReadRef.current.messageId === messageId &&
        now - lastMarkedReadRef.current.timestamp < THREE_SECONDS
      ) {
        console.log(`[GroupChat] Skipping duplicate mark_as_read for message ${messageId}`);
        return;
      }

      // Record this mark_read attempt
      lastMarkedReadRef.current = { messageId, timestamp: now };

      console.log(`[GroupChat] Marking message ${messageId} as read in conversation ${currentRoomId}`);

      // Debounce the actual emission to prevent rapid fire
      if (markReadDebounceRef.current) {
        clearTimeout(markReadDebounceRef.current);
      }
      markReadDebounceRef.current = setTimeout(() => {
        // Double-check active status before emitting (prevents race conditions)
        const currentStore = useChatStore.getState();
        const stillActive =
          currentStore.chatMode === "GROUP" &&
          currentStore.selectedGroup?.groupId === group?.groupId;

        if (!stillActive) {
          console.log("[GroupChat] Cancelling mark_read: conversation no longer active");
          return;
        }

        if (currentRoomId) {
          emitMarkRead(currentRoomId, messageId);
        }
      }, 100); // 100ms debounce
    }
  }, [messages, currentRoomId, emitMarkRead, isPageVisible, group?.groupId]);

  // Auto-mark as read khi:
  // 1. History vừa load xong (vào group có tin nhắn cũ chưa đọc)
  // 2. Có tin nhắn MỚI đến
  useEffect(() => {
    // Skip nếu đang loading
    if (isLoadingHistory) return;

    // Skip nếu không có tin nhắn
    if (messages.length === 0) return;

    // Detect NEW message (count tăng so với lần trước)
    const isNewMessage = messages.length > prevMessageCountRef.current;

    // Detect history vừa load xong: prevCount là 0 (vừa reset) và có messages
    const isHistoryJustLoaded = prevMessageCountRef.current === 0 && messages.length > 0;

    // Cập nhật ref
    prevMessageCountRef.current = messages.length;

    // Trigger mark_as_read khi có tin nhắn mới HOẶC khi vừa load history xong
    if (isNewMessage || isHistoryJustLoaded) {
      markMessagesAsRead();
    }

    // Cleanup
    return () => {
      if (markReadDebounceRef.current) {
        clearTimeout(markReadDebounceRef.current);
        markReadDebounceRef.current = null;
      }
    };
  }, [messages.length, isLoadingHistory, markMessagesAsRead]);

  // Cleanup on unmount - clear all pending timers
  useEffect(() => {
    return () => {
      if (markReadDebounceRef.current) {
        clearTimeout(markReadDebounceRef.current);
        markReadDebounceRef.current = null;
      }
      lastMarkedReadRef.current = null;
    };
  }, []);

  // ── Auto-scroll khi có tin nhắn mới ────────────────────────────────────
  // Ref để track conversation ID đã mount
  const mountedConversationRef = useRef<string | null>(null);

  // Update ref khi user scroll (placeholder - có thể dùng sau)
  const handleScroll = useCallback(() => {
    // Logic scroll chính nằm trong ChatWindow
  }, []);

  // Force scroll xuống bottom khi:
  // 1. Lần đầu mount conversation
  // 2. Có tin nhắn mới
  useEffect(() => {
    if (!group) return;

    const currentConvId = String(group.groupId);

    // Cập nhật ref
    mountedConversationRef.current = currentConvId;

    // Scroll xuống bottom khi có tin nhắn - dùng double-rAF để đảm bảo DOM đã render
    if (messages.length > 0) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
          }
        });
      });
    }
  }, [group?.groupId, messages.length]);

  // Cleanup khi unmount
  useEffect(() => {
    return () => {
      mountedConversationRef.current = null;
    };
  }, []);

  // ── Gửi tin nhắn nhóm ────────────────────────────────────────────────
  const sendMessage = useCallback(
    async (content: string, replyTo?: string | number | null, mentions?: string[]) => {
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
        replyTo: replyTo || null,
        mentions: mentions || [],
      };

      setMessages((prev) => [...prev, optimisticMsg]);

      setIsSending(true);
      try {
        const result = await emitSendMessage(
          currentRoomId,
          content.trim(),
          "text",
          null,
          undefined,
          replyTo || null,
          mentions || []
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
      const isVideo = file.type.startsWith("video/");
      const isVoice = file.type.startsWith("audio/");
      const attachmentType = isVideo
        ? "video"
        : file.type.startsWith("image/")
          ? "image"
          : isVoice
            ? "voice"
            : "file";

      if (isVideo && file.size > MAX_VIDEO_FILE_SIZE) {
        URL.revokeObjectURL(tempUrl);
        throw new Error("Video vượt quá giới hạn 50MB");
      }

      let tempThumbnailUrl: string | null = null;
      let thumbnailFile: File | null = null;

      if (isVideo) {
        thumbnailFile = await generateVideoThumbnail(file);
        tempThumbnailUrl = URL.createObjectURL(thumbnailFile);
      }

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
            ...(tempThumbnailUrl ? { thumbnailUrl: tempThumbnailUrl } : {}),
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
      setUploadProgress(isVideo ? 0 : 100);

      try {
        let finalMsg: DirectMessageItem;

        if (isVideo && thumbnailFile) {
          const [videoPresigned, thumbnailPresigned] = await Promise.all([
            getPresignedUploadUrl({
              keyPrefix: "messages/videos",
              contentType: file.type || "video/mp4",
            }),
            getPresignedUploadUrl({
              keyPrefix: "messages/thumbnails",
              contentType: thumbnailFile.type || "image/jpeg",
            }),
          ]);

          let videoPercent = 0;
          let thumbnailPercent = 0;
          const totalBytes = file.size + thumbnailFile.size;

          const updateTotalProgress = () => {
            const weightedPercent = Math.round(
              (videoPercent * file.size +
                thumbnailPercent * thumbnailFile.size) /
                Math.max(totalBytes, 1),
            );
            setUploadProgress(Math.min(100, weightedPercent));
          };

          await Promise.all([
            handleUploadToS3(file, videoPresigned.uploadUrl, (percent) => {
              videoPercent = percent;
              updateTotalProgress();
            }),
            handleUploadToS3(
              thumbnailFile,
              thumbnailPresigned.uploadUrl,
              (percent) => {
                thumbnailPercent = percent;
                updateTotalProgress();
              },
            ),
          ]);

          const videoUrl = buildS3PublicUrl(
            videoPresigned.bucket,
            videoPresigned.key,
          );
          const thumbnailUrl = buildS3PublicUrl(
            thumbnailPresigned.bucket,
            thumbnailPresigned.key,
          );

          const result = await emitSendMessage(
            currentRoomId,
            file.name,
            "video",
            [
              {
                url: videoUrl,
                thumbnailUrl,
                type: "video",
                size: file.size,
                mimeType: file.type,
                key: videoPresigned.key,
              },
            ],
          );

          if (!result.ok || !result.message) {
            throw new Error(result.error || "Không thể gửi video");
          }

          finalMsg = result.message;
        } else {
          finalMsg = await sendGroupFileMessage({
            file,
            senderId: user.id,
            groupId: currentRoomId,
          });
        }

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
        if (tempThumbnailUrl) {
          URL.revokeObjectURL(tempThumbnailUrl);
        }
        setIsUploadingFile(false);
        setUploadProgress(0);
      }
    },
    [
      currentRoomId,
      user?.id,
      user?.displayName,
      emitSendMessage,
      setGroupConversationPreview,
    ],
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
        content:
          stickerData.stickerName || stickerData.stickerId || "[Sticker]",
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
    [
      currentRoomId,
      user?.id,
      user?.displayName,
      emitSendMessage,
      setGroupConversationPreview,
    ],
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
    [
      currentRoomId,
      user?.id,
      user?.displayName,
      emitSendMessage,
      setGroupConversationPreview,
    ],
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
    uploadProgress,
    setMessages,
    deleteMessage: (messageId: string) => {
      setMessages((prev) =>
        prev.filter((m) => String(m.id) !== String(messageId)),
      );
    },
    bottomSentinelRef,
    scrollContainerRef,
    handleScroll,
    typingUsers,
    onTypingChange,
  };
}
