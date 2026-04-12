import { create } from "zustand";
import type { Group } from "../types";

interface GroupsState {
  myGroups: Group[];
  setMyGroups: (groups: Group[]) => void;
  addGroup: (group: Group) => void;
  removeGroup: (groupId: string | number) => void;
  updateGroup: (groupId: string | number, updates: Partial<Group>) => void;

  isLoadingGroups: boolean;
  setIsLoadingGroups: (loading: boolean) => void;
  groupsError: string | null;
  setGroupsError: (error: string | null) => void;

  selectedGroup: Group | null;
  setSelectedGroup: (group: Group | null) => void;

  reset: () => void;
}

export const useGroupsStore = create<GroupsState>((set) => ({
  myGroups: [],
  setMyGroups: (groups) => set({ myGroups: groups }),
  addGroup: (group) =>
    set((state) => ({ myGroups: [group, ...state.myGroups] })),
  removeGroup: (groupId) =>
    set((state) => ({
      myGroups: state.myGroups.filter(
        (g) => String(g.groupId) !== String(groupId)
      ),
    })),
  updateGroup: (groupId, updates) =>
    set((state) => ({
      myGroups: state.myGroups.map((g) =>
        String(g.groupId) === String(groupId) ? { ...g, ...updates } : g
      ),
    })),

  isLoadingGroups: false,
  setIsLoadingGroups: (loading) => set({ isLoadingGroups: loading }),
  groupsError: null,
  setGroupsError: (error) => set({ groupsError: error }),

  selectedGroup: null,
  setSelectedGroup: (group) => set({ selectedGroup: group }),

  reset: () =>
    set({
      myGroups: [],
      isLoadingGroups: false,
      groupsError: null,
      selectedGroup: null,
    }),
}));