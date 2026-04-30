"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSocket } from "../../../contexts/SocketContext";
import { useAuth } from "../../../contexts/AuthContext";
import { useChatStore } from "../store/chatStore";
import { getDirectMessages, sendDirectFileMessage } from "../api";
import { getPresignedUploadUrl } from "../../../api/client";
import { generateVideoThumbnail, handleUploadToS3 } from "../utils/videoUpload";
import type { DirectMessageItem, StickerData } from "../../../types";

export type MessageSendStatus = "sending" | "sent" | "failed" | "received";

export interface ChatMessage extends DirectMessageItem {
  sendStatus?: MessageSendStatus;
  isOwn?: boolean;
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
  sendMessage: (content: string) => Promise<void>;
  sendFileMessage: (file: File) => Promise<void>;
  sendStickerMessage: (stickerData: StickerData) => Promise<void>;
  sendEmojiMessage: (emoji: string) => Promise<void>;
  isSending: boolean;
  isUploadingFile: boolean;
  uploadProgress: number;
  bottomSentinelRef: React.RefObject<HTMLDivElement | null>;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  typingUsers: string[];
  onTypingChange: (isTyping: boolean) => void;
  deleteMessage: (messageId: string) => void;
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
    onReceiveMessage,
    onUserTyping,
    onUserStoppedTyping,
    onMessageRevoked,
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

  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevRoomIdRef = useRef<string | null>(null);
  const scrollDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const bottomSentinelRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const currentRoomId =
    friendId != null ? dmConversationId(user?.id ?? 0, friendId) : null;

  // Load lịch sử tin nhắn DM
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
          err instanceof Error
            ? err.message
            : "Không tải được lịch sử tin nhắn",
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

  // Join phòng DM + lắng nghe tin nhắn realtime
  useEffect(() => {
    if (!currentRoomId) return;

    emitJoinRoom(currentRoomId);

    const unsubReceive = onReceiveMessage((newMsg) => {
      if (Number(newMsg.senderId) === Number(user?.id)) return;
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

    return () => {
      unsubReceive();
      unsubRevoked();
      unsubTyping();
      unsubStopTyping();
      emitLeaveRoom(currentRoomId);
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

  // Auto-scroll khi có tin nhắn mới
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

  // Gửi tin nhắn DM
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
          null,
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
