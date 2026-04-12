import { create } from "zustand";
import type { FriendItem } from "../../../types";
import type { Group } from "../../groups/types";

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

  // ── Preview tin nhắn ───────────────────────────────────────────────────
  conversationPreview: Record<string, ConversationPreview>;
  setConversationPreview: (friendId: string, preview: ConversationPreview) => void;

  // Preview nhóm
  groupConversationPreview: Record<string, ConversationPreview>;
  setGroupConversationPreview: (groupId: string, preview: ConversationPreview) => void;

  // ── Số tin nhắn chưa đọc ───────────────────────────────────────────────
  unreadCounts: Record<string, number>;
  incrementUnread: (friendId: string) => void;
  clearUnread: (friendId: string) => void;
  resetUnread: () => void;

  // ── Reset khi logout ───────────────────────────────────────────────────
  reset: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  // ── Chat mode ──────────────────────────────────────────────────────────
  chatMode: "PRIVATE",
  setChatMode: (mode) => set({ chatMode: mode }),

  // ── Friends ─────────────────────────────────────────────────────────────
  friends: [],
  setFriends: (friends) => set({ friends }),
  isLoadingFriends: false,
  setIsLoadingFriends: (loading) => set({ isLoadingFriends: loading }),
  friendsError: null,
  setFriendsError: (error) => set({ friendsError: error }),

  // ── Selected friend ─────────────────────────────────────────────────────
  selectedFriend: null,
  setSelectedFriend: (friend) =>
    set({ selectedFriend: friend, chatMode: friend ? "PRIVATE" : "PRIVATE" }),

  // ── Selected group ─────────────────────────────────────────────────────
  selectedGroup: null,
  setSelectedGroup: (group) =>
    set({ selectedGroup: group, chatMode: group ? "GROUP" : "PRIVATE" }),

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

  // ── Reset ──────────────────────────────────────────────────────────────
  reset: () =>
    set({
      chatMode: "PRIVATE",
      friends: [],
      isLoadingFriends: false,
      friendsError: null,
      selectedFriend: null,
      selectedGroup: null,
      conversationPreview: {},
      groupConversationPreview: {},
      unreadCounts: {},
    }),
}));