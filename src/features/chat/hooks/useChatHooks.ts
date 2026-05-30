"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSocket } from "../../../contexts/SocketContext";
import { useAuth } from "../../../contexts/AuthContext";
import { useChatStore } from "../store/chatStore";
import { getDirectMessages, sendDirectFileMessage, getReadStatusForMessages } from "../api";
import { getPresignedUploadUrl } from "../../../api/client";
import { generateVideoThumbnail, handleUploadToS3 } from "../utils/videoUpload";
import type { DirectMessageItem, StickerData, ReadReceiptReader } from "../../../types";

export type MessageSendStatus = "sending" | "sent" | "delivered" | "received" | "read" | "failed";

export interface ChatMessage extends DirectMessageItem {
  sendStatus?: MessageSendStatus;
  isOwn?: boolean;
  /** Danh sách người đã đọc tin nhắn (chỉ dùng cho tin nhắn của chính mình trong nhóm) */
  readBy?: ReadReceiptReader[];
}

export type DmActivityPayload = {
  conversationId: string;
  content: string;
  createdAt: string;
};

export function dmConversationId(
  userId: string | number,
  friendId: string | number,
): string {
  const ids = [Number(userId), Number(friendId)].sort((a, b) => a - b);
  return `dm:${ids[0]}:${ids[1]}`;
}

export function friendIdFromConversationId(
  conversationId: string,
  currentUserId?: string | number | null,
): string | null {
  if (!conversationId || !conversationId.startsWith("dm:")) return null;
  const parts = conversationId.slice(3).split(":");
  if (parts.length !== 2) return null;

  if (currentUserId != null) {
    return Number(parts[0]) === Number(currentUserId) ? parts[1] : parts[0];
  }

  return parts[1];
}

interface UseDirectMessageReturn {
  messages: ChatMessage[];
  isLoadingHistory: boolean;
  historyError: string | null;
  currentRoomId: string | null;
  sendMessage: (content: string, replyTo?: string | number | null) => Promise<void>;
  sendFileMessage: (file: File) => Promise<void>;
  sendStickerMessage: (stickerData: StickerData) => Promise<void>;
  sendEmojiMessage: (emoji: string) => Promise<void>;
  isSending: boolean;
  isUploadingFile: boolean;
  uploadProgress: number;
  bottomSentinelRef: React.RefObject<HTMLDivElement | null>;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  handleScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  typingUsers: string[];
  onTypingChange: (isTyping: boolean) => void;
  deleteMessage: (messageId: string) => void;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

const DEBOUNCE_MS_DEFAULT = 100;
const MAX_VIDEO_FILE_SIZE = 50 * 1024 * 1024;

function buildS3PublicUrl(bucket: string, key: string): string {
  return `https://${bucket}.s3.amazonaws.com/${key}`;
}

function getPreviewContent(
  message: Pick<DirectMessageItem, "contentType" | "content" | "attachments">,
): string {
  if (message.contentType === "image") {
    return "[Ảnh]";
  }
  if (message.contentType === "file") {
    return `[Tệp] ${message.content || "Đính kèm"}`;
  }
  if (message.contentType === "video") {
    return "[Video]";
  }
  if (message.contentType === "sticker") {
    return "[Sticker]";
  }
  if (message.contentType === "emoji") {
    return message.content || "[Biểu tượng cảm xúc]";
  }
  if (message.contentType === "poll") {
    return "[Bình chọn]";
  }
  if (message.contentType === "reminder") {
    return "[Nhắc hẹn]";
  }
  if (message.contentType === "reminder_due") {
    return "Đến giờ nhắc hẹn";
  }
  if (Array.isArray(message.attachments) && message.attachments.length > 0) {
    const hasImage = message.attachments.some((a) => a?.type === "image");
    const hasVideo = message.attachments.some((a) => a?.type === "video");
    if (hasImage) {
      return "[Ảnh]";
    }
    if (hasVideo) {
      return "[Video]";
    }
    return `[Tệp] ${message.content || "Đính kèm"}`;
  }
  return message.content;
}

function isSameDmConversation(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  if (!a.startsWith("dm:") || !b.startsWith("dm:")) return false;

  const aParts = a.slice(3).split(":");
  const bParts = b.slice(3).split(":");
  if (aParts.length !== 2 || bParts.length !== 2) return false;

  const [a1, a2] = aParts;
  const [b1, b2] = bParts;
  return (a1 === b1 && a2 === b2) || (a1 === b2 && a2 === b1);
}

export function useDirectMessage(
  friendId: string | null,
  options: {
    scrollDebounceMs?: number;
    onDmActivity?: (payload: DmActivityPayload) => void;
  } = {},
): UseDirectMessageReturn {
  const { scrollDebounceMs = DEBOUNCE_MS_DEFAULT, onDmActivity } = options;

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
  } = useSocket();
  const {
    setConversationPreview,
    incrementUnread,
    selectedFriend,
    clearUnread,
  } = useChatStore();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
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
  // Track if this hook's conversation is currently active (for view mode, not selected state)
  const isHookActiveRef = useRef(false);

  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevRoomIdRef = useRef<string | null>(null);
  const scrollDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const bottomSentinelRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const lastMarkedIdRef = useRef<string | null>(null);

  const currentRoomId =
    friendId != null ? dmConversationId(user?.id ?? 0, friendId) : null;

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

  // ── Load lịch sử tin nhắn DM ───────────────────────────────────────────
  // Track if initial history load is complete
  const [historyLoaded, setHistoryLoaded] = useState(false);

  useEffect(() => {
    if (!friendId) {
      setMessages([]);
      setHistoryError(null);
      setHistoryLoaded(false);
      prevRoomIdRef.current = null;
      // Reset message count khi không có conversation
      prevMessageCountRef.current = 0;
      return;
    }

    // Reset message count khi chuyển sang conversation mới
    // Đảm bảo mark_read được trigger khi history load xong
    prevMessageCountRef.current = 0;

    const roomId = dmConversationId(user?.id ?? 0, friendId);

    async function loadHistory() {
      setIsLoadingHistory(true);
      setHistoryError(null);
      try {
        const list = await getDirectMessages(roomId);

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
          console.warn("[Chat] Could not fetch read statuses:", readErr);
        }

        const enriched: ChatMessage[] = list.map((msg) => {
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
            isOwn: Number(msg.senderId) === Number(user?.id),
            sendStatus,
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
            : "Không tải được lịch sử tin nhắn",
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
  }, [friendId, user?.id, emitLeaveRoom]);

  // Join phòng DM + lắng nghe tin nhắn realtime
  useEffect(() => {
    if (!currentRoomId) return;

    emitJoinRoom(currentRoomId);

    const unsubReceive = onReceiveMessage((newMsg) => {
      // Chặn tin nhắn của chính mình, NGOẠI TRỪ call_log (cả 2 bên đều cần thấy)
      const isCallLog = (newMsg as any).contentType === "call_log" || (newMsg as any).messageType === "call_log";
      const isReminder = (newMsg as any).contentType === "reminder";
      if (!isCallLog && !isReminder && Number(newMsg.senderId) === Number(user?.id)) return;
      if (!isSameDmConversation(newMsg.conversationId, currentRoomId)) return;

      // Cập nhật preview trong store
      const friendId = friendIdFromConversationId(
        newMsg.conversationId,
        user?.id,
      );
      if (friendId) {
        setConversationPreview(friendId, {
          content: getPreviewContent(newMsg),
          createdAt: newMsg.createdAt,
        });
        // Tăng unread nếu không phải đang chat với người này
        if (selectedFriend?.friend_id !== friendId) {
          incrementUnread(friendId);
        }
      }

      // Thay thế optimistic message
      setMessages((prev) => {
        const hasOptimistic = prev.some(
          (m) => m.id !== undefined && String(m.id).startsWith("temp-"),
        );
        if (hasOptimistic) {
          return prev.map((m) =>
            String(m.id).startsWith("temp-")
              ? { ...newMsg, isOwn: false, sendStatus: "received" }
              : m,
          );
        }
        const exists = prev.some((m) => m.id === newMsg.id);
        if (exists) return prev;
        return [...prev, { ...newMsg, isOwn: false, sendStatus: "received" }];
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
              } as unknown as ChatMessage)
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

    const unsubTyping = onUserTyping(({ userId, userName }) => {
      setTypingUsers((prev) =>
        prev.includes(userName) ? prev : [...prev, userName],
      );
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        setTypingUsers((prev) => prev.filter((n) => n !== userName));
      }, 3000);
    });

    const unsubStopTyping = onUserStoppedTyping(({ userName }) => {
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

    return () => {
      unsubReceive();
      unsubRevoked();
      unsubRead();
      unsubTyping();
      unsubStopTyping();
      unsubLiveLocationStopped();
      emitLeaveRoom(currentRoomId);
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
    user?.id,
    selectedFriend,
    setConversationPreview,
    incrementUnread,
  ]);

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
      console.log("[Chat] Skipping mark_as_read: page is hidden");
      return;
    }

    // CRITICAL: Only mark as read for the currently active conversation
    // This prevents stale hooks from marking read for closed chat windows
    // Use getState() to get the LATEST state, not a stale closure
    const store = useChatStore.getState();
    const isCurrentlySelected =
      store.chatMode === "PRIVATE" &&
      store.selectedFriend?.friend_id === friendId;

    if (!isCurrentlySelected) {
      console.log("[Chat] Skipping mark_as_read: not the selected conversation", {
        chatMode: store.chatMode,
        selectedFriendId: store.selectedFriend?.friend_id,
        thisFriendId: friendId
      });
      return;
    }

    if (messages.length === 0) return;

    // Lấy tin nhắn cuối cùng từ người khác (không phải của mình)
    const lastReceivedMessage = [...messages]
      .reverse()
      .find((m) => !m.isOwn);

    if (lastReceivedMessage && currentRoomId) {
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
        console.log(`[Chat] Skipping duplicate mark_as_read for message ${messageId}`);
        return;
      }

      // Record this mark_read attempt
      lastMarkedReadRef.current = { messageId, timestamp: now };

      console.log(`[Chat] Marking message ${messageId} as read in conversation ${currentRoomId}`);

      // Debounce the actual emission to prevent rapid fire
      if (markReadDebounceRef.current) {
        clearTimeout(markReadDebounceRef.current);
      }
      markReadDebounceRef.current = setTimeout(() => {
        // Double-check active status before emitting (prevents race conditions)
        const currentStore = useChatStore.getState();
        const stillActive =
          currentStore.chatMode === "PRIVATE" &&
          currentStore.selectedFriend?.friend_id === friendId;

        if (!stillActive) {
          console.log("[Chat] Cancelling mark_read: conversation no longer active");
          return;
        }

        emitMarkRead(currentRoomId, messageId);
      }, 100); // 100ms debounce
    }
  }, [messages, currentRoomId, emitMarkRead, isPageVisible, friendId]);

  // Auto-mark as read khi:
  // 1. History vừa load xong (vào conversation có tin nhắn cũ chưa đọc)
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
    if (!friendId) return;

    const currentConvId = friendId;

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
  }, [friendId, messages.length]);

  // Cleanup khi unmount
  useEffect(() => {
    return () => {
      mountedConversationRef.current = null;
    };
  }, []);

  // Gửi tin nhắn DM
  const sendMessage = useCallback(
    async (content: string, replyTo?: string | number | null) => {
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
        replyTo: replyTo || null,
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
        );

        if (result.ok && result.message) {
          const finalMsg = result.message;
          emitTypingStop(currentRoomId);

          // Cập nhật preview
          const friendId = friendIdFromConversationId(finalMsg.conversationId);
          if (friendId) {
            setConversationPreview(friendId, {
              content: getPreviewContent(finalMsg),
              createdAt: finalMsg.createdAt,
            });
          }

          onDmActivity?.({
            conversationId: finalMsg.conversationId,
            content: finalMsg.content,
            createdAt: finalMsg.createdAt,
          });

          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempId
                ? { ...finalMsg, isOwn: true, sendStatus: "sent" }
                : m,
            ),
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
      onDmActivity,
      setConversationPreview,
    ],
  );

  const sendFileMessage = useCallback(
    async (file: File) => {
      if (!currentRoomId || !friendId || !user?.id) return;

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

      const optimisticMsg: ChatMessage = {
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
          finalMsg = await sendDirectFileMessage({
            file,
            senderId: user.id,
            receiverId: friendId,
          });
        }

        const previewFriendId = friendIdFromConversationId(
          finalMsg.conversationId,
          user.id,
        );
        if (previewFriendId) {
          setConversationPreview(previewFriendId, {
            content: getPreviewContent(finalMsg),
            createdAt: finalMsg.createdAt,
          });
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? { ...finalMsg, isOwn: true, sendStatus: "sent" }
              : m,
          ),
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
      friendId,
      user?.id,
      emitSendMessage,
      setConversationPreview,
    ],
  );

  const sendStickerMessage = useCallback(
    async (stickerData: StickerData) => {
      if (!currentRoomId || !user?.id) return;

      const tempId = `temp-sticker-${Date.now()}`;
      const optimisticMsg: ChatMessage = {
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
          const previewFriendId = friendIdFromConversationId(
            finalMsg.conversationId,
            user.id,
          );
          if (previewFriendId) {
            setConversationPreview(previewFriendId, {
              content: "[Sticker]",
              createdAt: finalMsg.createdAt,
            });
          }

          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempId
                ? { ...finalMsg, isOwn: true, sendStatus: "sent" }
                : m,
            ),
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
    [currentRoomId, user?.id, emitSendMessage, setConversationPreview],
  );

  const sendEmojiMessage = useCallback(
    async (emoji: string) => {
      if (!currentRoomId || !user?.id || !emoji.trim()) return;

      const tempId = `temp-emoji-${Date.now()}`;
      const optimisticMsg: ChatMessage = {
        id: tempId,
        conversationId: currentRoomId,
        senderId: user.id,
        contentType: "emoji",
        content: emoji.trim(),
        createdAt: new Date().toISOString(),
        isOwn: true,
        sendStatus: "sending",
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
          const previewFriendId = friendIdFromConversationId(
            finalMsg.conversationId,
            user.id,
          );
          if (previewFriendId) {
            setConversationPreview(previewFriendId, {
              content: emoji.trim(),
              createdAt: finalMsg.createdAt,
            });
          }

          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempId
                ? { ...finalMsg, isOwn: true, sendStatus: "sent" }
                : m,
            ),
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
    [currentRoomId, user?.id, emitSendMessage, setConversationPreview],
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
    bottomSentinelRef,
    scrollContainerRef,
    typingUsers,
    onTypingChange,
    setMessages,
    handleScroll,
    deleteMessage: (messageId: string) => {
      setMessages((prev) =>
        prev.filter((m) => String(m.id) !== String(messageId)),
      );
    },
  };
}

// Hook để join tất cả phòng DM của bạn bè
export function useJoinFriendDmRooms(
  friends: { friend_id: string }[] | null,
  authUserId?: string | number,
) {
  const { emitJoinRoom, emitLeaveRoom } = useSocket();

  useEffect(() => {
    if (!friends?.length || !authUserId) return;

    const roomIds = friends.map((f) =>
      dmConversationId(authUserId, f.friend_id),
    );
    roomIds.forEach((roomId) => emitJoinRoom(roomId));

    return () => {
      roomIds.forEach((roomId) => emitLeaveRoom(roomId));
    };
  }, [friends, authUserId, emitJoinRoom, emitLeaveRoom]);
}

// Hook để cập nhật preview khi nhận message
export function useMessagePreviewUpdater(currentUserId?: string | number) {
  const { socket, onReceiveMessage } = useSocket();
  const {
    selectedFriend,
    setConversationPreview,
    incrementUnread,
    selectedGroup,
    setGroupConversationPreview,
    incrementGroupUnread,
  } = useChatStore();

  useEffect(() => {
    if (!socket) return;

    const off = onReceiveMessage((msg) => {
      const cid = msg.conversationId;

      // 1. Nếu là tin nhắn cá nhân (có tiền tố dm:)
      if (cid && cid.startsWith("dm:")) {
        const friendId = friendIdFromConversationId(cid, currentUserId);
        if (!friendId) return;

        setConversationPreview(friendId, {
          content: getPreviewContent(msg),
          createdAt: msg.createdAt,
        });

        if (selectedFriend?.friend_id !== friendId) {
          incrementUnread(friendId);
        }
      }
      // 2. Nếu là tin nhắn nhóm
      else if (cid) {
        const groupId = cid;

        setGroupConversationPreview(groupId, {
          content: getPreviewContent(msg),
          createdAt: msg.createdAt,
        });

        if (String(selectedGroup?.groupId) !== String(groupId)) {
          incrementGroupUnread(groupId);
        }
      }
    });

    return off;
  }, [
    socket,
    onReceiveMessage,
    currentUserId,
    selectedFriend,
    setConversationPreview,
    incrementUnread,
    selectedGroup,
    setGroupConversationPreview,
    incrementGroupUnread,
  ]);
}
