import { create } from "zustand";
import type { FriendItem } from "../../../types";
import type { Group } from "../../groups/types";
import type { ReplyToMessage } from "../../../types";

export type ChatMode = "PRIVATE" | "GROUP";

export type ConversationPreview = {
  content: string;
  createdAt: string;
};

interface ChatState {
  // ── Chế độ chat (nhóm hoặc riêng tư) ──────────────────────────────────
  chatMode: ChatMode;
  setChatMode: (mode: ChatMode) => void;

  // ── Danh sách bạn bè ───────────────────────────────────────────────────
  friends: FriendItem[];
  setFriends: (friends: FriendItem[]) => void;
  isLoadingFriends: boolean;
  setIsLoadingFriends: (loading: boolean) => void;
  friendsError: string | null;
  setFriendsError: (error: string | null) => void;

  // ── Bạn đang chat riêng tư ──────────────────────────────────────────────
  selectedFriend: FriendItem | null;
  setSelectedFriend: (friend: FriendItem | null) => void;

  // ── Nhóm đang chat ─────────────────────────────────────────────────────
  selectedGroup: Group | null;
  setSelectedGroup: (group: Group | null) => void;

  // ── AI chat mode ───────────────────────────────────────────────────────
  isAiChatOpen: boolean;
  pendingAiPrompt: string;
  openAiChat: (prompt?: string) => void;
  closeAiChat: () => void;
  clearPendingAiPrompt: () => void;

  // ── Reply Message State ─────────────────────────────────────────────────
  /** Tin nhắn đang được chọn để trả lời */
  replyingMessage: ReplyToMessage | null;
  setReplyingMessage: (message: ReplyToMessage | null) => void;
  clearReplyingMessage: () => void;

  // ── Preview tin nhắn ───────────────────────────────────────────────────
  conversationPreview: Record<string, ConversationPreview>;
  setConversationPreview: (
    friendId: string,
    preview: ConversationPreview,
  ) => void;

  // Preview nhóm
  groupConversationPreview: Record<string, ConversationPreview>;
  setGroupConversationPreview: (
    groupId: string,
    preview: ConversationPreview,
  ) => void;

  // ── Số tin nhắn chưa đọc ───────────────────────────────────────────────
  unreadCounts: Record<string, number>;
  incrementUnread: (friendId: string) => void;
  clearUnread: (friendId: string) => void;
  resetUnread: () => void;

  // Group unread counts
  groupUnreadCounts: Record<string, number>;
  incrementGroupUnread: (groupId: string) => void;
  clearGroupUnread: (groupId: string) => void;

  // ── Revoked messages tracking ───────────────────────────────────────────
  /** Set of messageId strings that have been revoked (used for optimistic UI) */
  revokedMessageIds: Set<string>;
  markMessageRevoked: (messageId: string) => void;
  clearRevokedMessageId: (messageId: string) => void;

  // ── Reset khi logout ───────────────────────────────────────────────────
  reset: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  // ── Chat mode ──────────────────────────────────────────────────────────
  chatMode: "PRIVATE",
  setChatMode: (mode) => set({ chatMode: mode }),

  // ── Friends ─────────────────────────────────────────────────────────────
  friends: [],
  setFriends: (friends) => set({ friends: Array.isArray(friends) ? friends : [] }),
  isLoadingFriends: false,
  setIsLoadingFriends: (loading) => set({ isLoadingFriends: loading }),
  friendsError: null,
  setFriendsError: (error) => set({ friendsError: error }),

  // ── Selected friend ─────────────────────────────────────────────────────
  selectedFriend: null,
  setSelectedFriend: (friend) =>
    set({
      selectedFriend: friend,
      chatMode: "PRIVATE",
      isAiChatOpen: false,
      pendingAiPrompt: "",
    }),

  // ── Selected group ─────────────────────────────────────────────────────
  selectedGroup: null,
  setSelectedGroup: (group) =>
    set({
      selectedGroup: group,
      chatMode: group ? "GROUP" : "PRIVATE",
      isAiChatOpen: false,
      pendingAiPrompt: "",
    }),

  // ── AI chat state ──────────────────────────────────────────────────────
  isAiChatOpen: false,
  pendingAiPrompt: "",
  openAiChat: (prompt = "") =>
    set({
      isAiChatOpen: true,
      pendingAiPrompt: prompt,
      selectedFriend: null,
      selectedGroup: null,
      chatMode: "PRIVATE",
    }),
  closeAiChat: () => set({ isAiChatOpen: false }),
  clearPendingAiPrompt: () => set({ pendingAiPrompt: "" }),

  // ── Reply Message State ─────────────────────────────────────────────────
  replyingMessage: null,
  setReplyingMessage: (message) => set({ replyingMessage: message }),
  clearReplyingMessage: () => set({ replyingMessage: null }),

  // ── Conversation preview ────────────────────────────────────────────────
  conversationPreview: {},
  setConversationPreview: (friendId, preview) =>
    set((state) => ({
      conversationPreview: {
        ...state.conversationPreview,
        [friendId]: preview,
      },
    })),

  // ── Group conversation preview ──────────────────────────────────────────
  groupConversationPreview: {},
  setGroupConversationPreview: (groupId, preview) =>
    set((state) => ({
      groupConversationPreview: {
        ...state.groupConversationPreview,
        [groupId]: preview,
      },
    })),

  // ── Unread counts ──────────────────────────────────────────────────────
  unreadCounts: {},
  incrementUnread: (friendId) =>
    set((state) => ({
      unreadCounts: {
        ...state.unreadCounts,
        [friendId]: (state.unreadCounts[friendId] || 0) + 1,
      },
    })),
  clearUnread: (friendId) =>
    set((state) => ({
      unreadCounts: {
        ...state.unreadCounts,
        [friendId]: 0,
      },
    })),
  resetUnread: () => set({ unreadCounts: {} }),

  // ── Group unread counts ──────────────────────────────────────────────
  groupUnreadCounts: {},
  incrementGroupUnread: (groupId) =>
    set((state) => ({
      groupUnreadCounts: {
        ...state.groupUnreadCounts,
        [groupId]: (state.groupUnreadCounts[groupId] || 0) + 1,
      },
    })),
  clearGroupUnread: (groupId) =>
    set((state) => ({
      groupUnreadCounts: {
        ...state.groupUnreadCounts,
        [groupId]: 0,
      },
    })),

  // ── Revoked messages tracking ─────────────────────────────────────────
  revokedMessageIds: new Set<string>(),
  markMessageRevoked: (messageId) =>
    set((state) => {
      const next = new Set(state.revokedMessageIds);
      next.add(String(messageId));
      return { revokedMessageIds: next };
    }),
  clearRevokedMessageId: (messageId) =>
    set((state) => {
      const next = new Set(state.revokedMessageIds);
      next.delete(String(messageId));
      return { revokedMessageIds: next };
    }),

  // ── Reset ──────────────────────────────────────────────────────────────
  reset: () =>
    set({
      chatMode: "PRIVATE",
      friends: [],
      isLoadingFriends: false,
      friendsError: null,
      selectedFriend: null,
      selectedGroup: null,
      isAiChatOpen: false,
      pendingAiPrompt: "",
      replyingMessage: null,
      conversationPreview: {},
      groupConversationPreview: {},
      unreadCounts: {},
      groupUnreadCounts: {},
      revokedMessageIds: new Set<string>(),
    }),
}));
