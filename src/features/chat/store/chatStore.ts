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

  // ── Current logged in user ID ──────────────────────────────────────────
  currentUserId: string | null;
  setCurrentUserId: (userId: string | null) => void;

  // ── Reset khi logout ───────────────────────────────────────────────────
  reset: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  // ── Current logged in user ID ──────────────────────────────────────────
  currentUserId: null,
  setCurrentUserId: (userId) => {
    if (!userId) {
      set({
        currentUserId: null,
        conversationPreview: {},
        groupConversationPreview: {},
        unreadCounts: {},
        groupUnreadCounts: {},
      });
      return;
    }

    let conversationPreview = {};
    let groupConversationPreview = {};
    let unreadCounts = {};
    let groupUnreadCounts = {};

    if (typeof window !== "undefined") {
      try {
        const prev = localStorage.getItem(`chat_preview_${userId}`);
        if (prev) conversationPreview = JSON.parse(prev);
      } catch (e) {
        console.error("Failed to parse conversationPreview from localStorage:", e);
      }

      try {
        const prev = localStorage.getItem(`group_preview_${userId}`);
        if (prev) groupConversationPreview = JSON.parse(prev);
      } catch (e) {
        console.error("Failed to parse groupConversationPreview from localStorage:", e);
      }

      try {
        const counts = localStorage.getItem(`unread_counts_${userId}`);
        if (counts) unreadCounts = JSON.parse(counts);
      } catch (e) {
        console.error("Failed to parse unreadCounts from localStorage:", e);
      }

      try {
        const counts = localStorage.getItem(`group_unread_counts_${userId}`);
        if (counts) groupUnreadCounts = JSON.parse(counts);
      } catch (e) {
        console.error("Failed to parse groupUnreadCounts from localStorage:", e);
      }
    }

    set({
      currentUserId: userId,
      conversationPreview,
      groupConversationPreview,
      unreadCounts,
      groupUnreadCounts,
    });
  },

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
    set((state) => {
      const nextPreviews = {
        ...state.conversationPreview,
        [friendId]: preview,
      };
      if (state.currentUserId && typeof window !== "undefined") {
        try {
          localStorage.setItem(
            `chat_preview_${state.currentUserId}`,
            JSON.stringify(nextPreviews),
          );
        } catch (e) {
          console.error(e);
        }
      }
      return { conversationPreview: nextPreviews };
    }),

  // ── Group conversation preview ──────────────────────────────────────────
  groupConversationPreview: {},
  setGroupConversationPreview: (groupId, preview) =>
    set((state) => {
      const nextPreviews = {
        ...state.groupConversationPreview,
        [groupId]: preview,
      };
      if (state.currentUserId && typeof window !== "undefined") {
        try {
          localStorage.setItem(
            `group_preview_${state.currentUserId}`,
            JSON.stringify(nextPreviews),
          );
        } catch (e) {
          console.error(e);
        }
      }
      return { groupConversationPreview: nextPreviews };
    }),

  // ── Unread counts ──────────────────────────────────────────────────────
  unreadCounts: {},
  incrementUnread: (friendId) =>
    set((state) => {
      const nextCounts = {
        ...state.unreadCounts,
        [friendId]: (state.unreadCounts[friendId] || 0) + 1,
      };
      if (state.currentUserId && typeof window !== "undefined") {
        try {
          localStorage.setItem(
            `unread_counts_${state.currentUserId}`,
            JSON.stringify(nextCounts),
          );
        } catch (e) {
          console.error(e);
        }
      }
      return { unreadCounts: nextCounts };
    }),
  clearUnread: (friendId) =>
    set((state) => {
      const nextCounts = {
        ...state.unreadCounts,
        [friendId]: 0,
      };
      if (state.currentUserId && typeof window !== "undefined") {
        try {
          localStorage.setItem(
            `unread_counts_${state.currentUserId}`,
            JSON.stringify(nextCounts),
          );
        } catch (e) {
          console.error(e);
        }
      }
      return { unreadCounts: nextCounts };
    }),
  resetUnread: () =>
    set((state) => {
      if (state.currentUserId && typeof window !== "undefined") {
        try {
          localStorage.setItem(
            `unread_counts_${state.currentUserId}`,
            JSON.stringify({}),
          );
        } catch (e) {
          console.error(e);
        }
      }
      return { unreadCounts: {} };
    }),

  // ── Group unread counts ──────────────────────────────────────────────
  groupUnreadCounts: {},
  incrementGroupUnread: (groupId) =>
    set((state) => {
      const nextCounts = {
        ...state.groupUnreadCounts,
        [groupId]: (state.groupUnreadCounts[groupId] || 0) + 1,
      };
      if (state.currentUserId && typeof window !== "undefined") {
        try {
          localStorage.setItem(
            `group_unread_counts_${state.currentUserId}`,
            JSON.stringify(nextCounts),
          );
        } catch (e) {
          console.error(e);
        }
      }
      return { groupUnreadCounts: nextCounts };
    }),
  clearGroupUnread: (groupId) =>
    set((state) => {
      const nextCounts = {
        ...state.groupUnreadCounts,
        [groupId]: 0,
      };
      if (state.currentUserId && typeof window !== "undefined") {
        try {
          localStorage.setItem(
            `group_unread_counts_${state.currentUserId}`,
            JSON.stringify(nextCounts),
          );
        } catch (e) {
          console.error(e);
        }
      }
      return { groupUnreadCounts: nextCounts };
    }),

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
      currentUserId: null,
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
