"use client";

import { useEffect } from "react";
import { useSocket } from "@/contexts/SocketContext";
import { useGroupsStore } from "@/features/groups/store/groupsStore";

export function useGroupSocket() {
  const { socket } = useSocket();
  const {
    addGroup,
    removeGroup,
    fetchMembers,
    socketAddMember,
    socketRemoveMember,
    socketUpdateRole
  } = useGroupsStore();

  useEffect(() => {
    if (!socket) return;

    const handleMembersAdded = (data: { groupId: string; newMembers: string[]; addedBy: string }) => {
      // Reload danh sách thành viên mới
      // Nếu store có socketAddMember hỗ trợ truyền mảng thì tốt, hiện tại store đang dùng fetchMembers
      fetchMembers(data.groupId);
    };

    const handleMemberRemoved = (data: { groupId: string; removedMember: string; kickedBy?: string }) => {
      socketRemoveMember(data.removedMember);
    };

    const handleMemberLeft = (data: { groupId: string; leftMember: string }) => {
      socketRemoveMember(data.leftMember);
    };

    const handleYouWereRemoved = (data: { groupId: string }) => {
      removeGroup(data.groupId);
    };

    const handleYouWereAdded = (data: { groupData: any; addedBy: string }) => {
      if (data.groupData) {
        addGroup(data.groupData);
      }
    };

    const handleGroupDeleted = (data: { groupId: string; disbandedBy: string }) => {
      removeGroup(data.groupId);
    };

    socket.on("group:members_added", handleMembersAdded);
    socket.on("group:member_removed", handleMemberRemoved);
    socket.on("group:member_left", handleMemberLeft);
    socket.on("group:you_were_removed", handleYouWereRemoved);
    socket.on("group:you_were_added", handleYouWereAdded);
    socket.on("group:deleted", handleGroupDeleted);

    return () => {
      socket.off("group:members_added", handleMembersAdded);
      socket.off("group:member_removed", handleMemberRemoved);
      socket.off("group:member_left", handleMemberLeft);
      socket.off("group:you_were_removed", handleYouWereRemoved);
      socket.off("group:you_were_added", handleYouWereAdded);
      socket.off("group:deleted", handleGroupDeleted);
    };
  }, [socket, addGroup, removeGroup, fetchMembers, socketRemoveMember]);
}
