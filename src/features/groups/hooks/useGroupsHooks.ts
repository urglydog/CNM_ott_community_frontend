import { useCallback, useEffect, useState } from "react";
import { useGroupsStore } from "../store/groupsStore";
import {
  fetchMyGroups,
  createGroup,
  joinGroupByCode,
  fetchGroupInvite,
  type CreateGroupPayload,
} from "../api";

export function useMyGroups() {
  const {
    myGroups,
    setMyGroups,
    isLoadingGroups,
    setIsLoadingGroups,
    groupsError,
    setGroupsError,
    selectedGroup,
    setSelectedGroup,
    addGroup,
    removeGroup,
  } = useGroupsStore();

  const loadMyGroups = useCallback(async () => {
    try {
      setIsLoadingGroups(true);
      setGroupsError(null);
      const groups = await fetchMyGroups();
      setMyGroups(groups);
    } catch (err) {
      setGroupsError(err instanceof Error ? err.message : "Không tải được danh sách nhóm");
    } finally {
      setIsLoadingGroups(false);
    }
  }, [setMyGroups, setIsLoadingGroups, setGroupsError]);

  const handleCreateGroup = async (payload: CreateGroupPayload) => {
    try {
      const newGroup = await createGroup(payload);
      addGroup(newGroup);
      return { success: true, group: newGroup };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Không tạo được nhóm",
      };
    }
  };

  const handleJoinGroup = async (inviteCode: string) => {
    try {
      const result = await joinGroupByCode(inviteCode);
      if (result.group) {
        addGroup(result.group);
      }
      return { success: true, message: result.message };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Không thể tham gia nhóm",
      };
    }
  };

  const handleGetInvite = async (groupId: string | number) => {
    try {
      const invite = await fetchGroupInvite(groupId);
      return { success: true, invite };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Không lấy được mã mời",
      };
    }
  };

  const selectGroup = (group: typeof selectedGroup) => {
    setSelectedGroup(group);
  };

  return {
    myGroups,
    isLoadingGroups,
    groupsError,
    selectedGroup,
    loadMyGroups,
    handleCreateGroup,
    handleJoinGroup,
    handleGetInvite,
    selectGroup,
    removeGroup,
  };
}