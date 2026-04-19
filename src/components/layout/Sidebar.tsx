"use client";

import { useState } from "react";
import { MessageCircle, Newspaper, ScrollText, Settings, Search, Users } from "lucide-react";
import FriendNotificationIcon from "../friends/FriendNotificationIcon";
import SearchUsersModal from "../friends/SearchUsersModal";
import FriendsListModal from "../friends/FriendsListModal";
import type { FriendItem } from "../../types";

interface SidebarProps {
  pendingFriendCount: number;
  onPendingCountChange: (delta: number) => void;
  onOpenDmChat: (friend: FriendItem) => void;
}

export default function Sidebar({ pendingFriendCount, onPendingCountChange, onOpenDmChat }: SidebarProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isFriendsListOpen, setIsFriendsListOpen] = useState(false);

  return (
    <>
      <div className="w-[64px] bg-[#005ae0] flex flex-col items-center py-4 justify-between z-20">
        <div className="flex flex-col items-center gap-4 w-full">
          <div className="w-10 h-10 bg-white text-[#005ae0] rounded-2xl flex items-center justify-center font-bold text-2xl mb-2 shadow-sm">
            Z
          </div>
          <div className="w-full flex justify-center py-3 bg-[#1a66e3] relative cursor-pointer">
            <MessageCircle className="text-white w-6 h-6" fill="currentColor" />
            <div className="absolute top-2 right-3 w-2.5 h-2.5 bg-red-500 border-2 border-[#1a66e3] rounded-full" />
          </div>
          {/* Icon tìm kiếm bạn bè */}
          <button
            onClick={() => setIsSearchOpen(true)}
            className="w-full flex justify-center py-3 hover:bg-[#1a66e3] cursor-pointer transition-colors"
            title="Tìm kiếm bạn bè"
            aria-label="Tìm kiếm bạn bè"
          >
            <Search className="text-white w-6 h-6" />
          </button>
          {/* Icon thông báo kết bạn */}
          <FriendNotificationIcon
            pendingCount={pendingFriendCount}
            onCountChange={onPendingCountChange}
          />
          {/* Icon danh sách bạn bè */}
          <button
            onClick={() => setIsFriendsListOpen(true)}
            className="w-full flex justify-center py-3 hover:bg-[#1a66e3] cursor-pointer transition-colors"
            title="Danh sách bạn bè"
            aria-label="Danh sách bạn bè"
          >
            <Users className="text-white w-6 h-6" />
          </button>
          <div className="w-full flex justify-center py-3 hover:bg-[#1a66e3] cursor-pointer">
            <Users className="text-white/90 w-6 h-6" />
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
      {isFriendsListOpen && <FriendsListModal onClose={() => setIsFriendsListOpen(false)} onOpenChat={onOpenDmChat} />}
    </>
  );
}
