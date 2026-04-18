"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { User, MessageCircle, Search, Users, LayoutGrid, Settings } from "lucide-react";
import { useChatStore } from "../../../features/chat/store/chatStore";
import SearchUsersModal from "../../../features/contacts/components/AddFriendModal";
import FriendRequestsModal from "../../../features/contacts/components/FriendRequestsModal";
import GroupsPanel from "../../../features/groups/components/GroupsPanel";
import type { FriendItem } from "../../../types";

interface MainSidebarProps {
  pendingFriendCount: number;
  onPendingCountChange: (delta: number) => void;
  onOpenDmChat: (friend: FriendItem) => void;
}

export default function MainSidebar({ pendingFriendCount, onPendingCountChange, onOpenDmChat }: MainSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isRequestsOpen, setIsRequestsOpen] = useState(false);
  const [isGroupsOpen, setIsGroupsOpen] = useState(false);
  const { setSelectedFriend } = useChatStore();

  const handleOpenChat = (friend: FriendItem) => {
    setSelectedFriend(friend);
    onOpenDmChat(friend);
  };

  const handleOpenProfile = () => {
    router.push("/profile");
  };

  const isProfileActive = pathname === "/profile";
  const isChatActive = pathname === "/chat";

  const navButtonClass = (active: boolean) =>
    `w-full flex justify-center py-3 cursor-pointer transition-colors ${
      active ? "bg-[#1a66e3]" : "hover:bg-[#1a66e3]"
    }`;

  return (
    <>
      <div className="w-[64px] bg-[#005ae0] flex flex-col items-center py-4 justify-between z-20">
        <div className="flex flex-col items-center gap-4 w-full relative">
          <div className="w-10 h-10 bg-white text-[#005ae0] rounded-2xl flex items-center justify-center font-bold text-2xl mb-1 shadow-sm">
            Z
          </div>

          {/* Chat icon */}
          <button
            onClick={() => router.push("/chat")}
            className={navButtonClass(isChatActive)}
            title="Tin nhắn"
            aria-label="Tin nhắn"
          >
            <MessageCircle className="text-white w-6 h-6" fill="currentColor" />
          </button>

          {/* Search - tìm kiếm bạn bè */}
          <button
            onClick={() => setIsSearchOpen(true)}
            className={navButtonClass(false)}
            title="Tìm kiếm bạn bè"
            aria-label="Tìm kiếm bạn bè"
          >
            <Search className="text-white w-6 h-6" />
          </button>

          {/* Profile icon */}
          <button
            onClick={handleOpenProfile}
            className={navButtonClass(isProfileActive)}
            title="Hồ sơ cá nhân"
            aria-label="Hồ sơ cá nhân"
          >
            <User className="text-white w-6 h-6" />
          </button>

          {/* Friend requests */}
          <button
            onClick={() => setIsRequestsOpen(true)}
            className={`${navButtonClass(false)} relative`}
            title="Lời mời kết bạn"
            aria-label="Lời mời kết bạn"
          >
            <Users className="text-white w-6 h-6" />
            {pendingFriendCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {pendingFriendCount > 99 ? "99+" : pendingFriendCount}
              </span>
            )}
          </button>

          {/* Groups */}
          <button
            onClick={() => setIsGroupsOpen(true)}
            className={navButtonClass(false)}
            title="Nhóm chat"
            aria-label="Nhóm chat"
          >
            <LayoutGrid className="text-white w-6 h-6" />
          </button>
        </div>
        <div className="flex flex-col items-center gap-4 w-full">
          <div className={navButtonClass(false)}>
            <Settings className="text-white/90 w-6 h-6" />
          </div>
        </div>
      </div>

      {isSearchOpen && <SearchUsersModal onClose={() => setIsSearchOpen(false)} />}
      {isRequestsOpen && (
        <FriendRequestsModal
          onClose={() => setIsRequestsOpen(false)}
          onPendingCountChange={onPendingCountChange}
        />
      )}
      {isGroupsOpen && (
        <div className="fixed inset-0 z-30 flex" onClick={() => setIsGroupsOpen(false)}>
          <div
            className="h-full w-[300px] shrink-0 border-r border-gray-200"
            onClick={(e) => e.stopPropagation()}
          >
            <GroupsPanel />
          </div>
          <div className="flex-1 bg-black/20" />
        </div>
      )}
    </>
  );
}
