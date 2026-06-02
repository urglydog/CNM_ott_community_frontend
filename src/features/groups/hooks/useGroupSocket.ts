"use client";

import { useEffect, useCallback } from "react";
import { useSocket } from "@/contexts/SocketContext";
import { useGroupsStore } from "@/features/groups/store/groupsStore";
import type { GroupRole } from "@/features/groups/types";

export function useGroupSocket() {
  const { socket, emitJoinRoom, emitLeaveRoom } = useSocket();
  const {
    myGroups,
    addGroup,
    removeGroup,
    fetchMembers,
    socketAddMember,
    socketRemoveMember,
    socketUpdateRole,
    updateGroup,
    setSelectedGroup,
    selectedGroup
  } = useGroupsStore();

  // ── BƯỚC 2: JOIN TẤT CẢ GROUP ROOMS KHI myGroups THAY ĐỔI ──────────────
  // Khi Web load xong danh sách nhóm, cần join tất cả các room để nhận sự kiện
  useEffect(() => {
    if (!socket || !myGroups?.length) return;

    console.log("🔌 [Web] Joining ALL group rooms:", myGroups.map(g => g.groupId));

    myGroups.forEach((group) => {
      emitJoinRoom(String(group.groupId));
    });

    // Cleanup: leave rooms khi unmount hoặc myGroups thay đổi
    return () => {
      if (socket?.connected) {
        myGroups.forEach((group) => {
          emitLeaveRoom(String(group.groupId));
        });
      }
    };
  }, [socket, myGroups, emitJoinRoom, emitLeaveRoom]);

  // Join room mới khi selectedGroup thay đổi
  useEffect(() => {
    if (!socket || !selectedGroup?.groupId) return;
    console.log("🔌 [Web] Joining selected group room:", selectedGroup.groupId);
    emitJoinRoom(String(selectedGroup.groupId));
  }, [socket, selectedGroup?.groupId, emitJoinRoom]);

  // ── 1. Báo cho NHỮNG NGƯỜI ĐANG Ở SẴN TRONG NHÓM ──────────────────────
  const handleMembersAdded = useCallback((data: {
    groupId: string;
    newMembersCount?: number;
    newMembers?: Array<{
      userId: string;
      username?: string;
      display_name?: string;
      displayName?: string;
      avatar_url?: string;
      avatarUrl?: string;
      role?: string;
    }>;
    addedBy: string;
  }) => {
    console.log("📥 [Web] Nhận socket: group:members_added", JSON.stringify(data));

    // Cập nhật memberCount trong myGroups
    if (data.newMembersCount !== undefined) {
      updateGroup(data.groupId, { memberCount: data.newMembersCount });
    }

    // Thêm từng thành viên mới vào selectedGroup
    if (data.newMembers && data.newMembers.length > 0) {
      data.newMembers.forEach((member) => {
        socketAddMember({
          userId: String(member.userId),
          displayName: member.displayName || member.display_name || member.username || member.userId,
          username: member.username || member.displayName || member.userId,
          avatarUrl: member.avatarUrl || member.avatar_url || null,
          role: member.role || 'MEMBER'
        } as any);
      });
    }

    // Re-fetch để đảm bảo dữ liệu đầy đủ
    fetchMembers(data.groupId);
  }, [socketAddMember, fetchMembers, updateGroup]);

  // ── 2. Báo cho CHÍNH NHỮNG NGƯỜI VỪA ĐƯỢC THÊM VÀO ───────────────────
  const handleAddedToGroup = useCallback((data: {
    groupDetails: {
      groupId: string;
      name: string;
      description?: string;
      avatarUrl?: string | null;
      memberCount?: number;
      createdBy?: string;
      createdAt?: string;
      isApprovalRequired?: boolean;
    };
    addedBy: string;
  }) => {
    console.log("📥 [Web] Nhận socket: group:added_to_group", JSON.stringify(data));

    if (data.groupDetails) {
      // Join room mới
      emitJoinRoom(String(data.groupDetails.groupId));

      // Thêm vào myGroups
      addGroup(data.groupDetails as any);
    }
  }, [addGroup, emitJoinRoom]);

  // ── 3. Thành viên bị kick ───────────────────────────────────────────────
  const handleMemberRemoved = useCallback((data: { groupId: string; removedMember: string; kickedBy?: string }) => {
    console.log("📥 [Web] Nhận socket: group:member_removed", JSON.stringify(data));

    // Xóa thành viên khỏi selectedGroup
    socketRemoveMember(data.removedMember);

    // Giảm memberCount trong myGroups
    const group = myGroups.find(g => String(g.groupId) === String(data.groupId));
    if (group && group.memberCount !== undefined) {
      updateGroup(data.groupId, { memberCount: Math.max(0, group.memberCount - 1) });
    }
  }, [socketRemoveMember, myGroups, updateGroup]);

  // ── 4. Thành viên tự rời ───────────────────────────────────────────────
  const handleMemberLeft = useCallback((data: { groupId: string; leftMember: string }) => {
    console.log("📥 [Web] Nhận socket: group:member_left", JSON.stringify(data));

    // Xóa thành viên khỏi selectedGroup
    socketRemoveMember(data.leftMember);

    // Giảm memberCount trong myGroups
    const group = myGroups.find(g => String(g.groupId) === String(data.groupId));
    if (group && group.memberCount !== undefined) {
      updateGroup(data.groupId, { memberCount: Math.max(0, group.memberCount - 1) });
    }
  }, [socketRemoveMember, myGroups, updateGroup]);

  // ── 5. Bị xóa khỏi nhóm ───────────────────────────────────────────────
  const handleYouWereRemoved = useCallback((data: { groupId: string }) => {
    console.log("📥 [Web] Nhận socket: group:you_were_removed", JSON.stringify(data));

    // Xóa khỏi myGroups
    removeGroup(data.groupId);

    // Xóa selectedGroup nếu đang xem nhóm bị xóa
    if (selectedGroup && String(selectedGroup.groupId) === String(data.groupId)) {
      setSelectedGroup(null);
    }

    // Leave room
    emitLeaveRoom(data.groupId);
  }, [removeGroup, selectedGroup, setSelectedGroup, emitLeaveRoom]);

  // ── 6. Được thêm vào nhóm (tương thích ngược với backend cũ) ─────────
  const handleYouWereAdded = useCallback((data: { groupData: any; addedBy: string }) => {
    console.log("📥 [Web] Nhận socket: group:you_were_added", JSON.stringify(data));

    if (data.groupData) {
      // Join room mới
      emitJoinRoom(String(data.groupData.groupId));

      // Thêm vào myGroups
      addGroup(data.groupData);
    }
  }, [addGroup, emitJoinRoom]);

  // ── 7. Nhóm bị giải tán ───────────────────────────────────────────────
  const handleGroupDeleted = useCallback((data: { groupId: string; disbandedBy: string }) => {
    console.log("📥 [Web] Nhận socket: group:deleted", JSON.stringify(data));

    // Xóa khỏi myGroups
    removeGroup(data.groupId);

    // Xóa selectedGroup nếu đang xem nhóm bị xóa
    if (selectedGroup && String(selectedGroup.groupId) === String(data.groupId)) {
      setSelectedGroup(null);
    }

    // Leave room
    emitLeaveRoom(data.groupId);
  }, [removeGroup, selectedGroup, setSelectedGroup, emitLeaveRoom]);

  const handleGroupSettingsUpdated = useCallback((data: {
    groupId: string;
    settings?: {
      name?: string;
      description?: string;
      avatarUrl?: string | null;
      avatar_url?: string | null;
      isApprovalRequired?: boolean;
      allowSendLinks?: "ALL" | "ADMINS_ONLY";
      spamFilterLevel?: number;
    };
    name?: string;
    description?: string;
    avatarUrl?: string | null;
    avatar_url?: string | null;
  }) => {
    console.log("📥 [Web] Nhận socket: SERVER:GROUP_SETTINGS_UPDATED", JSON.stringify(data));

    const settings = data.settings || {};
    updateGroup(data.groupId, {
      ...(settings.name !== undefined || data.name !== undefined ? { name: settings.name ?? data.name! } : {}),
      ...(settings.description !== undefined || data.description !== undefined ? { description: settings.description ?? data.description } : {}),
      ...(settings.avatarUrl !== undefined || settings.avatar_url !== undefined || data.avatarUrl !== undefined || data.avatar_url !== undefined
        ? { avatarUrl: settings.avatarUrl ?? settings.avatar_url ?? data.avatarUrl ?? data.avatar_url ?? null }
        : {}),
      ...(settings.isApprovalRequired !== undefined ? { isApprovalRequired: settings.isApprovalRequired } : {}),
      ...(settings.allowSendLinks !== undefined ? { allowSendLinks: settings.allowSendLinks } : {}),
      ...(settings.spamFilterLevel !== undefined ? { spamFilterLevel: settings.spamFilterLevel } : {}),
    });
  }, [updateGroup]);

  // ── SERVER:ROLE_UPDATED — realtime role change ──
  const handleRoleUpdated = useCallback((data: {
    groupId: string;
    targetUserId?: string;
    userId?: string;
    newRole?: string;
    role?: string;
  }) => {
    console.log("📥 [Web] SERVER:ROLE_UPDATED", JSON.stringify(data));
    if (!data.groupId) return;
    const uid = data.targetUserId || data.userId;
    const newRole = data.newRole || data.role;
    if (!uid || !newRole) return;
    socketUpdateRole(uid, newRole as GroupRole);
  }, [socketUpdateRole]);

  // ── group:owner_transferred — realtime owner transfer ──
  const handleOwnerTransferred = useCallback((data: {
    newOwnerId: string;
    oldOwnerId: string;
  }) => {
    console.log("📥 [Web] group:owner_transferred", JSON.stringify(data));
    // Update roles in store
    socketUpdateRole(data.oldOwnerId, "MEMBER");
    socketUpdateRole(data.newOwnerId, "OWNER");
  }, [socketUpdateRole]);

  // ── SERVER:NEW_JOIN_REQUEST — notification for admins ──
  const handleNewJoinRequest = useCallback((data: {
    groupId: string;
    userId: string;
  }) => {
    console.log("📥 [Web] SERVER:NEW_JOIN_REQUEST", JSON.stringify(data));
    // Log only — no global UI. GroupDetailModal handles this locally.
  }, []);

  // ── ĐĂNG KÝ SOCKET LISTENERS ──────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    socket.on("group:members_added", handleMembersAdded);
    socket.on("group:added_to_group", handleAddedToGroup);
    socket.on("group:member_removed", handleMemberRemoved);
    socket.on("group:member_left", handleMemberLeft);
    socket.on("group:you_were_removed", handleYouWereRemoved);
    socket.on("group:you_were_added", handleYouWereAdded);
    socket.on("group:deleted", handleGroupDeleted);
    socket.on("SERVER:GROUP_SETTINGS_UPDATED", handleGroupSettingsUpdated);
    socket.on("SERVER:ROLE_UPDATED", handleRoleUpdated);
    socket.on("group:owner_transferred", handleOwnerTransferred);
    socket.on("SERVER:NEW_JOIN_REQUEST", handleNewJoinRequest);

    return () => {
      socket.off("group:members_added", handleMembersAdded);
      socket.off("group:added_to_group", handleAddedToGroup);
      socket.off("group:member_removed", handleMemberRemoved);
      socket.off("group:member_left", handleMemberLeft);
      socket.off("group:you_were_removed", handleYouWereRemoved);
      socket.off("group:you_were_added", handleYouWereAdded);
      socket.off("group:deleted", handleGroupDeleted);
      socket.off("SERVER:GROUP_SETTINGS_UPDATED", handleGroupSettingsUpdated);
      socket.off("SERVER:ROLE_UPDATED", handleRoleUpdated);
      socket.off("group:owner_transferred", handleOwnerTransferred);
      socket.off("SERVER:NEW_JOIN_REQUEST", handleNewJoinRequest);
    };
  }, [
    socket,
    handleMembersAdded,
    handleAddedToGroup,
    handleMemberRemoved,
    handleMemberLeft,
    handleYouWereRemoved,
    handleYouWereAdded,
    handleGroupDeleted,
    handleGroupSettingsUpdated,
    handleRoleUpdated,
    handleOwnerTransferred,
    handleNewJoinRequest,
  ]);
}
