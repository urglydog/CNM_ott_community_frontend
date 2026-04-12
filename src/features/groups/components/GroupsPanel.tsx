"use client";

import { useEffect, useState } from "react";
import GroupListPanel from "./GroupListPanel";
import CreateGroupModal from "./CreateGroupModal";
import JoinGroupModal from "./JoinGroupModal";
import GroupDetailModal from "./GroupDetailModal";
import { useMyGroups } from "../hooks/useGroupsHooks";
import type { Group } from "../types";

export default function GroupsPanel() {
  const {
    myGroups,
    isLoadingGroups,
    selectedGroup,
    loadMyGroups,
    handleCreateGroup,
    handleJoinGroup,
    handleGetInvite,
    selectGroup,
  } = useMyGroups();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [detailGroup, setDetailGroup] = useState<Group | null>(null);

  useEffect(() => {
    loadMyGroups();
  }, [loadMyGroups]);

  const handleSelectGroup = (group: Group) => {
    selectGroup(group);
    setDetailGroup(group);
  };

  const handleCreateSuccess = (group: { groupId: string | number; name: string }) => {
    loadMyGroups();
  };

  const handleJoinSuccess = () => {
    loadMyGroups();
  };

  return (
    <>
      <div className="h-full w-[300px] shrink-0 border-r border-gray-200">
        <GroupListPanel
          groups={myGroups}
          isLoading={isLoadingGroups}
          selectedGroup={selectedGroup}
          onSelectGroup={handleSelectGroup}
          onOpenCreateGroup={() => setIsCreateOpen(true)}
          onOpenJoinGroup={() => setIsJoinOpen(true)}
        />
      </div>

      {isCreateOpen && (
        <CreateGroupModal
          onClose={() => setIsCreateOpen(false)}
          onSuccess={handleCreateSuccess}
          onCreateGroup={handleCreateGroup}
        />
      )}

      {isJoinOpen && (
        <JoinGroupModal
          onClose={() => setIsJoinOpen(false)}
          onSuccess={handleJoinSuccess}
          onJoinGroup={handleJoinGroup}
        />
      )}

      {detailGroup && (
        <GroupDetailModal
          group={detailGroup}
          onClose={() => setDetailGroup(null)}
          onGetInvite={handleGetInvite}
        />
      )}
    </>
  );
}