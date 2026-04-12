import { create } from "zustand";

interface ContactsState {
  // Số lời mời kết bạn chờ xử lý
  pendingFriendCount: number;
  setPendingFriendCount: (count: number) => void;
  incrementPending: () => void;
  decrementPending: () => void;
  resetPending: () => void;
}

export const useContactsStore = create<ContactsState>((set) => ({
  pendingFriendCount: 0,
  setPendingFriendCount: (count) => set({ pendingFriendCount: count }),
  incrementPending: () =>
    set((state) => ({ pendingFriendCount: state.pendingFriendCount + 1 })),
  decrementPending: () =>
    set((state) => ({
      pendingFriendCount: Math.max(0, state.pendingFriendCount - 1),
    })),
  resetPending: () => set({ pendingFriendCount: 0 }),
}));