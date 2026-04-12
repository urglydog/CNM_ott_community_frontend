"use client";

import { useState } from "react";
import { LayoutGrid, MessageCircle, Newspaper, ScrollText, Settings, Search, Users } from "lucide-react";
import { useContactsStore } from "../../../features/contacts/store/contactsStore";
import { useChatStore } from "../../../features/chat/store/chatStore";
import { useAuth } from "../../../contexts/AuthContext";
import SearchUsersModal from "../../../features/contacts/components/AddFriendModal";
import FriendRequestsModal from "../../../features/contacts/components/FriendRequestsModal";
import type { FriendItem } from "../../../types";

interface MainSidebarProps {
  pendingFriendCount: number;
  onPendingCountChange: (delta: number) => void;
  onOpenDmChat: (friend: FriendItem) => void;
  onOpenProfile: () => void;
}

export default function MainSidebar({ pendingFriendCount, onPendingCountChange, onOpenDmChat, onOpenProfile }: MainSidebarProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isRequestsOpen, setIsRequestsOpen] = useState(false);
  const [isFriendsListOpen, setIsFriendsListOpen] = useState(false);
  const { setSelectedFriend } = useChatStore();

  const handleOpenChat = (friend: FriendItem) => {
    setSelectedFriend(friend);
    onOpenDmChat(friend);
  };

  return (
    <>
      <div className="w-[64px] bg-[#005ae0] flex flex-col items-center py-4 justify-between z-20">
        <div className="flex flex-col items-center gap-4 w-full relative">
          <button
            onClick={onOpenProfile}
            className="w-10 h-10 bg-white text-[#005ae0] rounded-2xl flex items-center justify-center font-bold text-2xl mb-2 shadow-sm cursor-pointer hover:opacity-90 transition-opacity z-50"
            title="Hồ sơ cá nhân"
            type="button"
          >
            Z
          </button>
          <div className="w-full flex justify-center py-3 bg-[#1a66e3] relative cursor-pointer">
            <MessageCircle className="text-white w-6 h-6" fill="currentColor" />
            <div className="absolute top-2 right-3 w-2.5 h-2.5 bg-red-500 border-2 border-[#1a66e3] rounded-full" />
          </div>
          <button
            onClick={() => setIsSearchOpen(true)}
            className="w-full flex justify-center py-3 hover:bg-[#1a66e3] cursor-pointer transition-colors"
            title="Tìm kiếm bạn bè"
            aria-label="Tìm kiếm bạn bè"
          >
            <Search className="text-white w-6 h-6" />
          </button>
          <button
            onClick={() => setIsRequestsOpen(true)}
            className="w-full flex justify-center py-3 hover:bg-[#1a66e3] cursor-pointer transition-colors relative"
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
          <div className="w-full flex justify-center py-3 hover:bg-[#1a66e3] cursor-pointer">
            <LayoutGrid className="text-white/90 w-6 h-6" />
          </div>
          <div className="w-full flex justify-center py-3 hover:bg-[#1a66e3] cursor-pointer">
            <Newspaper className="text-white/90 w-6 h-6" />
          </div>
          <div className="w-full flex justify-center py-3 hover:bg-[#1a66e3] cursor-pointer">
            <ScrollText className="text-white/90 w-6 h-6" />
          </div>
        </div>
        <div className="flex flex-col items-center gap-4 w-full">
          <div className="w-full flex justify-center py-3 hover:bg-[#1a66e3] cursor-pointer">
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
    </>
  );
}