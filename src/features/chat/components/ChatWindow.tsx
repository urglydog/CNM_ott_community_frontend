"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  Smile,
  Sparkles,
} from "lucide-react";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import { dmConversationId, useDirectMessage } from "../hooks/useChatHooks";
import {
  groupConversationId,
  useGroupChat,
  type GroupChatMessage,
} from "../hooks/useGroupChat";
import { getGroupMembers } from "../api";
import {
  getPresignedViewUrl,
  searchConversationMessages,
  searchGlobalMessages,
} from "../../../api/client";
import { useSocket } from "../../../contexts/SocketContext";
import { useChatStore } from "../store/chatStore";
import { useGroupsStore } from "../../groups/store/groupsStore";
import type { AuthUser, StickerData, ReplyToMessage } from "../../../types";
import { askBot } from "../api";
import CallOverlay from "@/features/chat/components/CallOverlay";
import { useToast } from "../../../contexts/ToastContext";
import type { GroupMember } from "../../groups/types";
import { getMessageDomId } from "../utils/messageSearch";

// Components
import { GroupAvatar } from "./Avatar";
import { ReadByAvatars } from "./ReadByAvatars";
import { ReplyPreview } from "./ReplyComponents";
import { MessageContextMenu } from "./MessageContextMenu";
import { GroupMessageBubble, SystemMessageBubble } from "./GroupMessageBubble";
import { PrivateMessageBubble } from "./PrivateMessageBubble";
import { ChatHeader } from "./ChatHeader";
import { MessageList } from "./MessageList";
import { ChatToolbar } from "./ChatToolbar";
import { ChatInput } from "./ChatInput";
import { AiChatMessages, type AiConversationTurn } from "./AiChatMessages";
import { MessageSearchPanel } from "./MessageSearchPanel";
import EmojiStickerPicker from "./EmojiStickerPicker";
import ForwardMessageModal from "./ForwardMessageModal";

interface ChatWindowProps {
  authUser: AuthUser;
}

type SearchScope = "conversation" | "global";

interface MessageSearchRow {
  id: string | number;
  senderId: string | number;
  senderDisplayName?: string;
  senderAvatarUrl?: string | null;
  content: string;
  contentType?: string;
  createdAt: string;
  conversationId: string;
}

const AI_HISTORY_STORAGE_PREFIX = "ott_ai_history_v1";

export default function ChatWindow({ authUser }: ChatWindowProps) {
  const {
    selectedFriend,
    selectedGroup,
    chatMode,
    isAiChatOpen,
    pendingAiPrompt,
    clearPendingAiPrompt,
    setOutgoingCall,
    friends,
    setSelectedFriend,
    setSelectedGroup,
    replyingMessage,
    setReplyingMessage,
    clearReplyingMessage,
  } = useChatStore();
  const { myGroups } = useGroupsStore();

  const {
    isRecording,
    audioBlob,
    recordingTime,
    startRecording,
    stopRecording,
    cancelRecording,
    setAudioBlob,
  } = useAudioRecorder();

  const currentUserId = String((authUser as any)._id || authUser.id || "");
  const currentUserName = authUser.displayName || authUser.username || "User";
  const aiHistoryStorageKey = `${AI_HISTORY_STORAGE_PREFIX}:${currentUserId}`;

  // ── Private mode ───────────────────────────────────────────────────────
  const friendId = selectedFriend?.friend_id ?? null;
  const {
    messages: dmMessages,
    isLoadingHistory: dmLoading,
    historyError: dmError,
    sendMessage: sendDmMessage,
    sendFileMessage: sendDmFileMessage,
    sendStickerMessage: sendDmStickerMessage,
    sendEmojiMessage: sendDmEmojiMessage,
    isSending: dmSending,
    isUploadingFile: dmUploadingFile,
    uploadProgress: dmUploadProgress,
    bottomSentinelRef: dmSentinelRef,
    scrollContainerRef: dmScrollRef,
    typingUsers: dmTypingUsers,
    onTypingChange: dmTypingChange,
    deleteMessage: deleteDmMessage,
  } = useDirectMessage(friendId);

  // ── Group mode ────────────────────────────────────────────────────────
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [resolvedAvatarUrls, setResolvedAvatarUrls] = useState<
    Record<string, string>
  >({});

  const {
    messages: groupMessages,
    isLoadingHistory: groupLoading,
    historyError: groupError,
    sendMessage: sendGroupMessage,
    sendFileMessage: sendGroupFileMessage,
    sendStickerMessage: sendGroupStickerMessage,
    sendEmojiMessage: sendGroupEmojiMessage,
    isSending: groupSending,
    isUploadingFile: groupUploadingFile,
    uploadProgress: groupUploadProgress,
    bottomSentinelRef: groupSentinelRef,
    scrollContainerRef: groupScrollRef,
    typingUsers: groupTypingUsers,
    onTypingChange: groupTypingChange,
    deleteMessage: deleteGroupMessage,
  } = useGroupChat(selectedGroup ?? null, groupMembers);

  // Load group members when selectedGroup changes
  useEffect(() => {
    if (!selectedGroup) {
      setGroupMembers([]);
      return;
    }
    const groupIdForMembers = selectedGroup.groupId;

    getGroupMembers(groupIdForMembers)
      .then((members) => {
        const normalized: GroupMember[] = members.map((m) => ({
          userId: String(m.userId),
          displayName: m.displayName || m.username || String(m.userId),
          username: m.username || "",
          avatarUrl: m.avatarUrl || null,
          role:
            String(m.role).toUpperCase() === "OWNER"
              ? "OWNER"
              : String(m.role).toUpperCase() === "DEPUTY" ||
                String(m.role).toUpperCase() === "ADMIN"
                ? "DEPUTY"
                : "MEMBER",
        }));
        setGroupMembers(normalized);
      })
      .catch(() => setGroupMembers([]));
  }, [selectedGroup]);

  const { status, emitCallUser } = useSocket();
  const { addToast } = useToast();
  const [inputValue, setInputValue] = useState("");
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiConversation, setAiConversation] = useState<AiConversationTurn[]>([]);
  const [isAskingAI, setIsAskingAI] = useState(false);
  const [aiError, setAiError] = useState("");

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchScope, setSearchScope] = useState<SearchScope>("conversation");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchFromDate, setSearchFromDate] = useState("");
  const [searchToDate, setSearchToDate] = useState("");
  const [searchResults, setSearchResults] = useState<MessageSearchRow[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [focusedMessageId, setFocusedMessageId] = useState<string | null>(null);
  const [pendingFocusMessageId, setPendingFocusMessageId] = useState<string | null>(null);
  const focusTimeoutRef = useRef<number | null>(null);

  const todayDateString = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }, []);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isConnected = status === "connected";

  const activeConversationId = useMemo(() => {
    if (chatMode === "GROUP") {
      return selectedGroup ? groupConversationId(selectedGroup.groupId) : null;
    }
    if (!selectedFriend?.friend_id) return null;
    return dmConversationId(currentUserId, selectedFriend.friend_id);
  }, [chatMode, currentUserId, selectedFriend?.friend_id, selectedGroup]);

  // ── Emoji / Sticker Picker state ─────────────────────────────────────────
  const [pickerOpen, setPickerOpen] = useState(false);

  // ── Context menu state ──────────────────────────────────────────────────
  const [ctxMenu, setCtxMenu] = useState<{
    x: number;
    y: number;
    msg: GroupChatMessage;
    conversationId: string;
    canRevoke: boolean;
  } | null>(null);

  // ── Forward modal state ────────────────────────────────────────────────
  const [forwardModal, setForwardModal] = useState<{
    message: GroupChatMessage;
    sourceConversationId: string;
  } | null>(null);

  function handleMessageContextMenu(
    e: React.MouseEvent,
    msg: GroupChatMessage,
    conversationId: string,
    isOwn: boolean,
  ) {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({
      x: e.clientX,
      y: e.clientY,
      msg,
      conversationId,
      canRevoke: isOwn,
    });
  }

  function closeCtxMenu() {
    setCtxMenu(null);
  }

  // ── Revoke handler ──────────────────────────────────────────────────────
  const [revokingMessageId, setRevokingMessageId] = useState<string | null>(null);

  async function handleRevokeMessage() {
    if (!ctxMenu) return;
    const { msg, conversationId } = ctxMenu;
    setRevokingMessageId(String(msg.id));

    try {
      const { revokeMessage: revokeApi } = await import("../api");
      await revokeApi({ conversationId, messageId: String(msg.id) });
      addToast("Tin nhắn đã được thu hồi", "success");
      closeCtxMenu();
    } catch (err: unknown) {
      const msg2 =
        err instanceof Error ? err.message : "Không thể thu hồi tin nhắn";
      addToast(msg2, "error");
    } finally {
      setRevokingMessageId(null);
    }
  }

  // ── Delete-for-me handler ───────────────────────────────────────────────
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);

  async function handleDeleteForMe() {
    if (!ctxMenu) return;
    const { msg, conversationId } = ctxMenu;
    const msgId = String(msg.id);
    setDeletingMessageId(msgId);

    // Optimistic: xóa ngay khỏi UI trước khi API trả về
    const targetDeleteFn =
      chatMode === "GROUP" ? deleteGroupMessage : deleteDmMessage;
    targetDeleteFn(msgId);

    try {
      const { deleteMessageForMe: deleteApi } = await import("../api");
      await deleteApi({ conversationId, messageId: msgId });
      addToast("Đã ẩn tin nhắn khỏi cuộc trò chuyện này", "success");
      closeCtxMenu();
    } catch (err: unknown) {
      addToast(
        err instanceof Error ? err.message : "Không thể ẩn tin nhắn",
        "error",
      );
    } finally {
      setDeletingMessageId(null);
    }
  }

  function handleForwardMessage(msg: GroupChatMessage, conversationId: string) {
    closeCtxMenu();
    setForwardModal({ message: msg, sourceConversationId: conversationId });
  }

  // Lấy ref đúng dựa trên mode
  const activeSentinelRef =
    chatMode === "GROUP" ? groupSentinelRef : dmSentinelRef;
  const activeScrollRef = chatMode === "GROUP" ? groupScrollRef : dmScrollRef;
  const activeTypingUsers =
    chatMode === "GROUP" ? groupTypingUsers : dmTypingUsers;
  const activeTypingChange =
    chatMode === "GROUP" ? groupTypingChange : dmTypingChange;

  const friendName = selectedFriend?.friend_display_name ?? "";
  const groupName = selectedGroup?.name ?? "";
  const memberCount = groupMembers.length || selectedGroup?.memberCount || 0;

  const resolveDisplayAvatar = useCallback(
    (rawUrl: string | null | undefined) => {
      const input = String(rawUrl || "").trim();
      if (!input) return null;
      if (!/\.amazonaws\.com/i.test(input)) return input;
      return resolvedAvatarUrls[input] || input;
    },
    [resolvedAvatarUrls],
  );

  const resolvedGroupMembers = useMemo(
    () =>
      groupMembers.map((m) => ({
        ...m,
        avatarUrl: resolveDisplayAvatar(m.avatarUrl),
      })),
    [groupMembers, resolveDisplayAvatar],
  );

  useEffect(() => {
    let cancelled = false;

    const rawUrls = new Set<string>();

    for (const member of groupMembers) {
      const raw = String(member.avatarUrl || "").trim();
      if (raw) rawUrls.add(raw);
    }

    for (const msg of groupMessages) {
      const raw = String(msg.senderAvatarUrl || "").trim();
      if (raw) rawUrls.add(raw);
    }

    for (const msg of dmMessages) {
      const raw = String(msg.senderAvatarUrl || "").trim();
      if (raw) rawUrls.add(raw);
    }

    const selectedFriendAvatar = String(
      selectedFriend?.friend_avatar_url || "",
    ).trim();
    if (selectedFriendAvatar) {
      rawUrls.add(selectedFriendAvatar);
    }

    const candidates = Array.from(rawUrls).filter((raw) => {
      if (!/\.amazonaws\.com/i.test(raw)) return false;
      if (/X-Amz-Algorithm=/i.test(raw)) return false;
      return !resolvedAvatarUrls[raw];
    });

    if (candidates.length === 0) return;

    Promise.all(
      candidates.map(async (raw) => {
        try {
          const signed = await getPresignedViewUrl({ url: raw });
          return [raw, signed.viewUrl || raw] as const;
        } catch {
          return [raw, raw] as const;
        }
      }),
    ).then((entries) => {
      if (cancelled) return;
      setResolvedAvatarUrls((prev) => {
        const next = { ...prev };
        let changed = false;

        for (const [raw, resolved] of entries) {
          if (resolved && next[raw] !== resolved) {
            next[raw] = resolved;
            changed = true;
          }
        }

        return changed ? next : prev;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [
    groupMembers,
    groupMessages,
    dmMessages,
    selectedFriend?.friend_avatar_url,
    resolvedAvatarUrls,
  ]);

  async function submitAiQuestion(rawQuestion: string) {
    const trimmed = rawQuestion.trim();
    if (!trimmed || isAskingAI) return;

    const turnId = `${Date.now()}`;
    setAiError("");
    setAiQuestion("");
    setAiConversation((prev) => {
      const next = [
        ...prev,
        { id: `${turnId}-u`, role: "user" as const, content: trimmed },
      ];
      return next.slice(-60);
    });

    try {
      setIsAskingAI(true);
      const response = await askBot(trimmed);
      setAiConversation((prev) => {
        const next = [
          ...prev,
          {
            id: `${turnId}-a`,
            role: "assistant" as const,
            content: response.content || "AI chưa có phản hồi.",
          },
        ];
        return next.slice(-60);
      });
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.message || "Không thể kết nối AI Bot.";
      setAiError(errorMessage);
    } finally {
      setIsAskingAI(false);
    }
  }

  useEffect(() => {
    if (!isAiChatOpen || !pendingAiPrompt.trim()) return;
    const prompt = pendingAiPrompt;
    clearPendingAiPrompt();
    void submitAiQuestion(prompt);
  }, [isAiChatOpen, pendingAiPrompt, clearPendingAiPrompt]);

  useEffect(() => {
    if (!currentUserId) return;
    try {
      const raw = window.localStorage.getItem(aiHistoryStorageKey);
      if (!raw) {
        setAiConversation([]);
        return;
      }
      const parsed = JSON.parse(raw) as AiConversationTurn[];
      if (!Array.isArray(parsed)) {
        setAiConversation([]);
        return;
      }

      const normalized = parsed
        .filter(
          (item) =>
            item &&
            (item.role === "user" || item.role === "assistant") &&
            typeof item.content === "string" &&
            item.content.trim().length > 0,
        )
        .map((item, index) => ({
          id: String(item.id || `${Date.now()}-${index}`),
          role: item.role,
          content: item.content,
        }))
        .slice(-60);

      setAiConversation(normalized);
    } catch {
      setAiConversation([]);
    }
  }, [currentUserId, aiHistoryStorageKey]);

  useEffect(() => {
    if (!currentUserId) return;
    try {
      window.localStorage.setItem(
        aiHistoryStorageKey,
        JSON.stringify(aiConversation.slice(-60)),
      );
    } catch {
      // ignore localStorage write errors in private mode/quota limits
    }
  }, [aiConversation, currentUserId, aiHistoryStorageKey]);

  async function handleStartVideoCall() {
    const isGroupCall = chatMode === "GROUP";
    const hasTarget = isGroupCall
      ? selectedGroup != null
      : selectedFriend != null;

    if (!hasTarget) return;
    try {
      const directFriendId = String(
        (selectedFriend as any)?.friend_id ??
        (selectedFriend as any)?._id ??
        (selectedFriend as any)?.id ??
        "",
      );

      if (!isGroupCall && !directFriendId) {
        throw new Error("Khong tim thay ID nguoi nhan de goi 1-1");
      }

      const normalizedGroupId = isGroupCall
        ? String(selectedGroup!.groupId).replace("group_", "")
        : "";

      const rawRoomId = isGroupCall
        ? `group_call_${normalizedGroupId}`
        : `call_1vs1_${[currentUserId, directFriendId].sort().join("_")}`;
      const safeRoomId = rawRoomId.replace(/:/g, "_");
      const conversationId = isGroupCall
        ? groupConversationId(selectedGroup!.groupId)
        : dmConversationId(currentUserId, directFriendId);

      if (isGroupCall) {
        const groupCallPayload = {
          groupId: String(selectedGroup!.groupId),
          roomId: safeRoomId,
          callerId: currentUserId,
          callerName: currentUserName,
        };
        console.debug(
          "[ChatWindow][emit group-call-request] payload:",
          groupCallPayload,
        );
        emitCallUser({
          ...groupCallPayload,
          receiverId: String(selectedGroup!.groupId),
          conversationId,
          isGroupCall: true,
        });
        setOutgoingCall({
          roomId: safeRoomId,
          conversationId,
          receiverId: String(selectedGroup!.groupId),
          receiverName: groupName || "Nhom",
          isGroupCall: true,
        });
      } else {
        const oneToOnePayload = {
          roomId: safeRoomId,
          callerId: currentUserId,
          callerName: currentUserName,
          receiverId: directFriendId,
          to: directFriendId,
          conversationId,
          isGroupCall: false,
        };
        console.debug("[ChatWindow][emit call-user] payload:", oneToOnePayload);
        emitCallUser(oneToOnePayload);
        setOutgoingCall({
          roomId: safeRoomId,
          conversationId,
          receiverId: directFriendId,
          receiverName: friendName || "Ban be",
          isGroupCall: false,
        });
      }
    } catch {
      addToast("Khong the bat dau cuoc goi", "error", 2500);
    }
  }

  // Khi chuyển đổi giữa nhóm và DM, clear input
  useEffect(() => {
    setInputValue("");
  }, [chatMode, selectedGroup?.groupId, selectedFriend?.friend_id]);

  const handleSend = useCallback(async () => {
    if (!inputValue.trim()) return;
    if (chatMode === "GROUP") {
      if (groupSending) return;
      await sendGroupMessage(inputValue, replyingMessage?.id || null);
    } else {
      if (dmSending) return;
      await sendDmMessage(inputValue, replyingMessage?.id || null);
    }

    setInputValue("");
    clearReplyingMessage();
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    textareaRef.current?.focus();
  }, [
    inputValue,
    chatMode,
    groupSending,
    dmSending,
    sendGroupMessage,
    sendDmMessage,
    replyingMessage,
    clearReplyingMessage,
  ]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handlePickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!isConnected) {
      addToast("Mất kết nối, chưa thể gửi tệp", "error");
      return;
    }

    try {
      if (chatMode === "GROUP") {
        if (groupUploadingFile) return;
        await sendGroupFileMessage(file);
        return;
      }

      if (!selectedFriend?.friend_id) {
        addToast("Vui lòng chọn một cuộc trò chuyện cá nhân", "error");
        return;
      }

      await sendDmFileMessage(file);
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Không thể gửi tệp, vui lòng thử lại";
      addToast(message, "error");
    }
  }

  const handleSendAudio = async () => {
    if (audioBlob) {
      const audioFile = new File([audioBlob], `voice_${Date.now()}.webm`, { type: "audio/webm" });
      try {
        if (chatMode === "GROUP") {
          if (groupUploadingFile) return;
          await sendGroupFileMessage(audioFile);
        } else {
          if (!selectedFriend?.friend_id) return;
          await sendDmFileMessage(audioFile);
        }
        setAudioBlob(null);
      } catch (error: any) {
        addToast("Không thể gửi tin nhắn thoại", "error");
      }
    }
  };

  // ── Reply Message Handlers ─────────────────────────────────────────────
  function handleReplyToMessage(msg: GroupChatMessage) {
    const replyInfo: ReplyToMessage = {
      id: msg.id,
      content: msg.content || "",
      contentType: msg.contentType,
      senderId: msg.senderId,
      senderDisplayName: msg.senderDisplayName || null,
      senderAvatarUrl: msg.senderAvatarUrl || null,
      attachments: msg.attachments || null,
    };
    setReplyingMessage(replyInfo);
  }

  function handleJumpToMessage(messageId: string | number) {
    const domId = getMessageDomId(messageId);
    const target = document.getElementById(domId);
    if (!target) {
      addToast("Tin nhắn gốc không còn trong cuộc trò chuyện này", "info");
      return;
    }
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    setFocusedMessageId(String(messageId));
    if (focusTimeoutRef.current != null) {
      window.clearTimeout(focusTimeoutRef.current);
    }
    focusTimeoutRef.current = window.setTimeout(() => {
      setFocusedMessageId(null);
      focusTimeoutRef.current = null;
    }, 2000);
  }

  function handleClearReply() {
    clearReplyingMessage();
  }

  async function handleAskAI() {
    await submitAiQuestion(aiQuestion);
  }

  function handleAiKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    void handleAskAI();
  }

  async function handleSearchMessages(e?: React.FormEvent) {
    e?.preventDefault();
    if (searchScope === "conversation" && !activeConversationId) {
      setSearchError("Vui lòng chọn một cuộc trò chuyện trước.");
      return;
    }

    setSearchLoading(true);
    setSearchError("");
    try {
      const response =
        searchScope === "conversation"
          ? await searchConversationMessages({
              conversationId: activeConversationId as string,
              keyword: searchKeyword.trim() || undefined,
              fromDate: searchFromDate || undefined,
              toDate: searchToDate || undefined,
              limit: 100,
            })
          : await searchGlobalMessages({
              keyword: searchKeyword.trim() || undefined,
              fromDate: searchFromDate || undefined,
              toDate: searchToDate || undefined,
              limit: 100,
            });
      setSearchResults((response.data || []) as MessageSearchRow[]);
    } catch (error: any) {
      setSearchResults([]);
      setSearchError(
        error?.message || "Không thể tìm kiếm tin nhắn, vui lòng thử lại",
      );
    } finally {
      setSearchLoading(false);
    }
  }

  useEffect(() => {
    setSearchOpen(false);
    setSearchScope("conversation");
    setSearchResults([]);
    setSearchError("");
    setSearchKeyword("");
    setSearchFromDate("");
    setSearchToDate("");
  }, [activeConversationId]);

  function triggerFocusMessage(messageId: string | number) {
    const domId = getMessageDomId(messageId);
    const target = document.getElementById(domId);
    if (!target) return;

    target.scrollIntoView({ behavior: "smooth", block: "center" });
    setFocusedMessageId(String(messageId));

    if (focusTimeoutRef.current != null) {
      window.clearTimeout(focusTimeoutRef.current);
    }
    focusTimeoutRef.current = window.setTimeout(() => {
      setFocusedMessageId(null);
      focusTimeoutRef.current = null;
    }, 1800);
  }

  useEffect(() => {
    return () => {
      if (focusTimeoutRef.current != null) {
        window.clearTimeout(focusTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!pendingFocusMessageId) return;
    const t = window.setTimeout(() => {
      triggerFocusMessage(pendingFocusMessageId);
      setPendingFocusMessageId(null);
    }, 120);
    return () => window.clearTimeout(t);
  }, [
    pendingFocusMessageId,
    activeConversationId,
    chatMode,
    groupMessages,
    dmMessages,
  ]);

  function handleSearchResultClick(item: MessageSearchRow) {
    const targetConversationId = String(item.conversationId || "");

    if (targetConversationId === activeConversationId) {
      triggerFocusMessage(item.id);
      return;
    }

    if (targetConversationId.startsWith("dm:")) {
      const ids = targetConversationId.slice(3).split(":");
      const friendId = ids.find((id) => String(id) !== String(currentUserId));
      const targetFriend = friends.find(
        (friend) => String(friend.friend_id) === String(friendId || ""),
      );
      if (!targetFriend) {
        addToast("Khong tim thay cuoc tro chuyen ca nhan tu ket qua nay", "error");
        return;
      }
      setSelectedFriend(targetFriend);
      setPendingFocusMessageId(String(item.id));
      setSearchOpen(false);
      return;
    }

    const targetGroup = myGroups.find(
      (group) => String(group.groupId) === targetConversationId,
    );
    if (!targetGroup) {
      addToast("Khong tim thay nhom tu ket qua nay", "error");
      return;
    }

    setSelectedGroup(targetGroup as any);
    setPendingFocusMessageId(String(item.id));
    setSearchOpen(false);
  }

  function handleSearchClearFilters() {
    setSearchKeyword("");
    setSearchFromDate("");
    setSearchToDate("");
    setSearchResults([]);
    setSearchError("");
  }

  // ── Emoji / Sticker picker handlers ────────────────────────────────────
  async function handleEmojiSelect(emoji: string) {
    setPickerOpen(false);
    if (!emoji.trim()) return;

    if (chatMode === "GROUP") {
      await sendGroupEmojiMessage(emoji);
    } else {
      await sendDmEmojiMessage(emoji);
    }
  }

  async function handleStickerSelect(stickerData: StickerData) {
    setPickerOpen(false);
    if (chatMode === "GROUP") {
      await sendGroupStickerMessage(stickerData);
    } else {
      await sendDmStickerMessage(stickerData);
    }
  }

  // ── Lấy danh sách tin nhắn & trạng thái đúng mode ───────────────────
  const activeMessages: GroupChatMessage[] =
    chatMode === "GROUP" ? groupMessages : dmMessages;
  const activeLoading = chatMode === "GROUP" ? groupLoading : dmLoading;
  const activeError = chatMode === "GROUP" ? groupError : dmError;
  const activeSending = chatMode === "GROUP" ? groupSending : dmSending;
  const activeUploading =
    chatMode === "GROUP" ? groupUploadingFile : dmUploadingFile;
  const activeUploadProgress =
    chatMode === "GROUP" ? groupUploadProgress : dmUploadProgress;

  const placeHolder =
    chatMode === "GROUP"
      ? `Nhắn tin trong ${groupName}`
      : `Nhắn tin cho ${friendName}`;

  // ── Empty state ────────────────────────────────────────────────────
  if (!selectedFriend && !selectedGroup && !isAiChatOpen) {
    return (
      <div className="flex-1 bg-[#f3f5f6] flex flex-col items-center justify-center min-w-0 text-gray-400 px-6">
        <div className="w-16 h-16 rounded-full bg-gray-200/80 flex items-center justify-center mb-4">
          <Smile className="w-8 h-8 text-gray-500" />
        </div>
        <p className="text-sm font-medium text-gray-600">
          Chọn một cuộc trò chuyện
        </p>
        <p className="text-xs text-gray-500 mt-1 text-center max-w-sm">
          Danh sách bạn bè hoặc nhóm ở cột bên trái. Tin nhắn mới sẽ cập nhật
          realtime.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-[#f3f5f6] flex flex-col relative min-w-0">
      <ChatHeader
        chatMode={chatMode}
        isAiChatOpen={isAiChatOpen}
        isConnected={isConnected}
        selectedFriend={selectedFriend}
        selectedGroup={selectedGroup}
        groupMembers={resolvedGroupMembers}
        groupName={groupName}
        friendName={friendName}
        memberCount={memberCount}
        onStartVideoCall={handleStartVideoCall}
        onToggleSearch={() => setSearchOpen((prev) => !prev)}
        activeConversationId={activeConversationId}
        resolveDisplayAvatar={resolveDisplayAvatar}
      />

      <MessageSearchPanel
        isOpen={searchOpen && !isAiChatOpen}
        searchScope={searchScope}
        searchKeyword={searchKeyword}
        searchFromDate={searchFromDate}
        searchToDate={searchToDate}
        searchResults={searchResults}
        searchLoading={searchLoading}
        searchError={searchError}
        activeConversationId={activeConversationId}
        currentUserId={currentUserId}
        friends={friends}
        myGroups={myGroups}
        selectedGroup={selectedGroup}
        todayDateString={todayDateString}
        onClose={() => setSearchOpen(false)}
        onSearch={handleSearchMessages}
        onScopeChange={setSearchScope}
        onKeywordChange={setSearchKeyword}
        onFromDateChange={setSearchFromDate}
        onToDateChange={setSearchToDate}
        onClearFilters={handleSearchClearFilters}
        onResultClick={handleSearchResultClick}
      />

      {isAiChatOpen ? (
        <AiChatMessages
          aiConversation={aiConversation}
          isAskingAI={isAskingAI}
          aiError={aiError}
        />
      ) : (
        <MessageList
          chatMode={chatMode}
          messages={activeMessages}
          isLoading={activeLoading}
          error={activeError}
          currentUserId={currentUserId}
          groupName={groupName}
          friendName={friendName}
          selectedFriend={selectedFriend}
          groupMembers={resolvedGroupMembers}
          focusedMessageId={focusedMessageId}
          activeScrollRef={activeScrollRef as React.RefObject<HTMLDivElement>}
          activeSentinelRef={activeSentinelRef as React.RefObject<HTMLDivElement>}
          onMessageContextMenu={handleMessageContextMenu}
          onReplyToMessage={handleReplyToMessage}
          onJumpToMessage={handleJumpToMessage}
          resolveDisplayAvatar={resolveDisplayAvatar}
        />
      )}

      {/* Typing indicator */}
      {!isAiChatOpen && activeTypingUsers.length > 0 && (
        <div className="px-4 py-1.5 bg-[#f3f5f6]">
          <p className="text-xs italic text-gray-500">
            {activeTypingUsers.length === 1
              ? `${activeTypingUsers[0]} đang soạn tin...`
              : `${activeTypingUsers.slice(0, -1).join(", ")} và ${activeTypingUsers[activeTypingUsers.length - 1]} đang soạn tin...`}
          </p>
        </div>
      )}

      {!isAiChatOpen && activeUploading && (
        <div className="px-4 py-2 bg-[#f3f5f6] border-t border-gray-200/70">
          <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
            <span>Đang tải tệp lên S3...</span>
            <span>{Math.max(0, Math.min(100, activeUploadProgress))}%</span>
          </div>
          <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-150"
              style={{
                width: `${Math.max(0, Math.min(100, activeUploadProgress))}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Context menu */}
      {ctxMenu && (
        <MessageContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          canRevoke={ctxMenu.canRevoke}
          isOwn={ctxMenu.canRevoke}
          onRevoke={handleRevokeMessage}
          onDeleteForMe={handleDeleteForMe}
          onForward={() =>
            handleForwardMessage(ctxMenu.msg, ctxMenu.conversationId)
          }
          isDeleting={deletingMessageId === String(ctxMenu.msg.id)}
          onClose={closeCtxMenu}
        />
      )}

      {forwardModal && (
        <ForwardMessageModal
          isOpen
          onClose={() => setForwardModal(null)}
          message={forwardModal.message}
          sourceConversationId={forwardModal.sourceConversationId}
          authUserId={currentUserId}
        />
      )}

      {/* Input area */}
      <div className="bg-white border-t border-gray-200 flex flex-col shrink-0">
        {isAiChatOpen ? (
          <div className="px-4 py-3 bg-gray-50">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={aiQuestion}
                  onChange={(e) => setAiQuestion(e.target.value)}
                  onKeyDown={handleAiKeyDown}
                  placeholder="Nhập câu hỏi cho AI..."
                  disabled={isAskingAI}
                  className="w-full h-11 rounded-lg border border-gray-300 pl-10 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 disabled:opacity-60"
                />
                <Sparkles className="w-4 h-4 text-blue-500 absolute left-3 top-3.5" />
              </div>

              <button
                type="button"
                onClick={handleAskAI}
                disabled={!aiQuestion.trim() || isAskingAI}
                className="h-11 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isAskingAI ? "Đang hỏi..." : "Hỏi AI"}
              </button>
            </div>

            {aiError && <p className="mt-2 text-xs text-red-500">{aiError}</p>}
          </div>
        ) : (
          <>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif"
              className="hidden"
              onChange={handlePickFile}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime,.pdf,.doc,.docx,.txt"
              className="hidden"
              onChange={handlePickFile}
            />

            <ChatToolbar
              isConnected={isConnected}
              isSending={activeSending}
              isUploading={activeUploading}
              isPickerOpen={pickerOpen}
              onTogglePicker={() => setPickerOpen((prev) => !prev)}
              onImageClick={() => imageInputRef.current?.click()}
              onFileClick={() => fileInputRef.current?.click()}
            >
              <EmojiStickerPicker
                isOpen={pickerOpen}
                onClose={() => setPickerOpen(false)}
                onEmojiSelect={handleEmojiSelect}
                onStickerSelect={handleStickerSelect}
              />
            </ChatToolbar>

            {replyingMessage && (
              <ReplyPreview
                replyingMessage={replyingMessage}
                onClear={handleClearReply}
                onJumpToMessage={handleJumpToMessage}
              />
            )}

            <ChatInput
              inputValue={inputValue}
              isConnected={isConnected}
              isSending={activeSending}
              isRecording={isRecording}
              audioBlob={audioBlob}
              recordingTime={recordingTime}
              placeholder={placeHolder}
              onInputChange={setInputValue}
              onKeyDown={handleKeyDown}
              onSend={handleSend}
              onStartRecording={startRecording}
              onStopRecording={stopRecording}
              onCancelRecording={cancelRecording}
              onSendAudio={handleSendAudio}
              onTypingChange={activeTypingChange}
              textareaRef={textareaRef}
            />
          </>
        )}
      </div>

      <CallOverlay />
    </div>
  );
}
