import { create } from "zustand";
import type { FriendItem } from "../../../types";

export type ConversationPreview = {
  content: string;
  createdAt: string;
};

interface ChatState {
  // Danh sách bạn bè
  friends: FriendItem[];
  setFriends: (friends: FriendItem[]) => void;
  isLoadingFriends: boolean;
  setIsLoadingFriends: (loading: boolean) => void;
  friendsError: string | null;
  setFriendsError: (error: string | null) => void;

  // Bạn đang chat
  selectedFriend: FriendItem | null;
  setSelectedFriend: (friend: FriendItem | null) => void;

  // Preview tin nhắn
  conversationPreview: Record<string, ConversationPreview>;
  setConversationPreview: (friendId: string, preview: ConversationPreview) => void;

  // Số tin nhắn chưa đọc
  unreadCounts: Record<string, number>;
  incrementUnread: (friendId: string) => void;
  clearUnread: (friendId: string) => void;
  resetUnread: () => void;

  // Reset khi logout
  reset: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  // Friends
  friends: [],
  setFriends: (friends) => set({ friends }),
  isLoadingFriends: false,
  setIsLoadingFriends: (loading) => set({ isLoadingFriends: loading }),
  friendsError: null,
  setFriendsError: (error) => set({ friendsError: error }),

  // Selected friend
  selectedFriend: null,
  setSelectedFriend: (friend) => set({ selectedFriend: friend }),

  // Conversation preview
  conversationPreview: {},
  setConversationPreview: (friendId, preview) =>
    set((state) => ({
      conversationPreview: {
        ...state.conversationPreview,
        [friendId]: preview,
      },
    })),

  // Unread counts
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

  // Reset
  reset: () =>
    set({
      friends: [],
      isLoadingFriends: false,
      friendsError: null,
      selectedFriend: null,
      conversationPreview: {},
      unreadCounts: {},
    }),
}));