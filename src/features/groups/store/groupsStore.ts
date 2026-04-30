import { create } from "zustand";
import type { Group, GroupMember, GroupRole } from "../types";
import * as groupsApi from "../api";

// We assume selectedGroup can have members array
export type SelectedGroupExt = Group & { members?: GroupMember[] };

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

  selectedGroup: SelectedGroupExt | null;
  setSelectedGroup: (group: SelectedGroupExt | null) => void;

  // Async Actions
  fetchMembers: (groupId: string | number) => Promise<void>;
  addMembers: (groupId: string | number, userIds: (string | number)[]) => Promise<void>;
  kickMember: (groupId: string | number, targetUserId: string | number) => Promise<void>;
  updateRole: (groupId: string | number, targetUserId: string | number, newRole: GroupRole) => Promise<void>;
  leaveGroupAction: (groupId: string | number, newOwnerId?: string | number) => Promise<void>;
  disbandGroupAction: (groupId: string | number) => Promise<void>;
  approveRequest: (groupId: string | number, targetUserId: string | number, action: "APPROVE" | "REJECT") => Promise<void>;

  // Socket Actions
  socketAddMember: (member: GroupMember) => void;
  socketRemoveMember: (userId: string | number) => void;
  socketUpdateRole: (userId: string | number, newRole: GroupRole) => void;

  reset: () => void;
}

export const useGroupsStore = create<GroupsState>((set) => ({
  myGroups: [],
  setMyGroups: (groups) => set({ myGroups: groups }),
  addGroup: (group) =>
    set((state) => ({ myGroups: [group, ...state.myGroups] })),
  removeGroup: (groupId) =>
    set((state) => {
      const isSelected = state.selectedGroup && String(state.selectedGroup.groupId) === String(groupId);
      return {
        myGroups: state.myGroups.filter((g) => String(g.groupId) !== String(groupId)),
        selectedGroup: isSelected ? null : state.selectedGroup,
      };
    }),
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

  fetchMembers: async (groupId) => {
    try {
      const members = await groupsApi.getGroupMembers(groupId);
      set((state) => {
        if (!state.selectedGroup || String(state.selectedGroup.groupId) !== String(groupId)) return state;
        return {
          selectedGroup: {
            ...state.selectedGroup,
            members
          }
        };
      });
    } catch (error) {
      console.error("Failed to fetch group members:", error);
    }
  },

  addMembers: async (groupId, userIds) => {
    try {
      const result = await groupsApi.addMembersToGroup(groupId, userIds);
      if (result.addedMembers) {
        const newMembers = result.addedMembers;
        set((state) => {
          if (!state.selectedGroup || String(state.selectedGroup.groupId) !== String(groupId)) return state;
          const currentMembers = state.selectedGroup.members || [];
          const uniqueNewMembers = newMembers.filter((nm: any) => !currentMembers.some(cm => String(cm.userId) === String(nm.userId)));
          return {
            selectedGroup: {
              ...state.selectedGroup,
              members: [...currentMembers, ...uniqueNewMembers]
            }
          };
        });
      }
    } catch (error) {
      console.error("Failed to add members", error);
      throw error;
    }
  },

  kickMember: async (groupId, targetUserId) => {
    try {
      await groupsApi.removeMemberFromGroup(groupId, targetUserId);
      set((state) => {
        if (!state.selectedGroup || String(state.selectedGroup.groupId) !== String(groupId)) return state;
        const currentMembers = state.selectedGroup.members || [];
        return {
          selectedGroup: {
            ...state.selectedGroup,
            members: currentMembers.filter(m => String(m.userId) !== String(targetUserId))
          }
        };
      });
    } catch (error) {
      console.error("Failed to kick member", error);
      throw error;
    }
  },

  updateRole: async (groupId, targetUserId, newRole) => {
    try {
      await groupsApi.updateMemberRole(groupId, targetUserId, newRole);
      set((state) => {
        if (!state.selectedGroup || String(state.selectedGroup.groupId) !== String(groupId)) return state;
        const currentMembers = state.selectedGroup.members || [];
        return {
          selectedGroup: {
            ...state.selectedGroup,
            members: currentMembers.map(m => 
              String(m.userId) === String(targetUserId) ? { ...m, role: newRole } : m
            )
          }
        };
      });
    } catch (error) {
      console.error("Failed to update role", error);
      throw error;
    }
  },

  leaveGroupAction: async (groupId, newOwnerId) => {
    try {
      await groupsApi.leaveGroup(groupId, newOwnerId);
      set((state) => ({
        myGroups: state.myGroups.filter(g => String(g.groupId) !== String(groupId)),
        selectedGroup: state.selectedGroup && String(state.selectedGroup.groupId) === String(groupId) ? null : state.selectedGroup
      }));
    } catch (error) {
      console.error("Failed to leave group", error);
      throw error;
    }
  },

  disbandGroupAction: async (groupId) => {
    try {
      await groupsApi.disbandGroup(groupId);
      set((state) => ({
        myGroups: state.myGroups.filter(g => String(g.groupId) !== String(groupId)),
        selectedGroup: state.selectedGroup && String(state.selectedGroup.groupId) === String(groupId) ? null : state.selectedGroup
      }));
    } catch (error) {
      console.error("Failed to disband group", error);
      throw error;
    }
  },

  approveRequest: async (groupId, targetUserId, action) => {
    try {
      await groupsApi.handleJoinRequest(groupId, targetUserId, action);
    } catch (error) {
      console.error(`Failed to ${action} request`, error);
      throw error;
    }
  },

  socketAddMember: (member) => {
    set((state) => {
      if (!state.selectedGroup) return state;
      const currentMembers = state.selectedGroup.members || [];
      // avoid duplicates
      if (currentMembers.some(m => String(m.userId) === String(member.userId))) return state;
      return {
        selectedGroup: {
          ...state.selectedGroup,
          members: [...currentMembers, member]
        }
      };
    });
  },

  socketRemoveMember: (userId) => {
    set((state) => {
      if (!state.selectedGroup) return state;
      const currentMembers = state.selectedGroup.members || [];
      return {
        selectedGroup: {
          ...state.selectedGroup,
          members: currentMembers.filter(m => String(m.userId) !== String(userId))
        }
      };
    });
  },

  socketUpdateRole: (userId, newRole) => {
    set((state) => {
      if (!state.selectedGroup) return state;
      const currentMembers = state.selectedGroup.members || [];
      return {
        selectedGroup: {
          ...state.selectedGroup,
          members: currentMembers.map(m => 
            String(m.userId) === String(userId) ? { ...m, role: newRole } : m
          )
        }
      };
    });
  },

  reset: () =>
    set({
      myGroups: [],
      isLoadingGroups: false,
      groupsError: null,
      selectedGroup: null,
    }),
}));