"use client";

import { Bell } from "lucide-react";
import { useState } from "react";
import FriendRequestsModal from "./FriendRequestsModal";

interface FriendNotificationIconProps {
  pendingCount: number;
  onCountChange: (delta: number) => void;
}

export default function FriendNotificationIcon({
  pendingCount,
  onCountChange,
}: FriendNotificationIconProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="w-full flex justify-center py-3 hover:bg-[#1a66e3] cursor-pointer relative transition-colors"
        title="Lời mời kết bạn"
        aria-label={`Lời mời kết bạn${pendingCount > 0 ? `, ${pendingCount} chưa xử lý` : ""}`}
      >
        <Bell className="text-white w-6 h-6" />

        {pendingCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-md animate-bounce-subtle"
            title={`${pendingCount} lời mời chưa xử lý`}
          >
            {pendingCount > 99 ? "99+" : pendingCount}
          </span>
        )}
      </button>

      {isModalOpen && (
        <FriendRequestsModal
          onClose={() => setIsModalOpen(false)}
          onCountChange={onCountChange}
        />
      )}
    </>
  );
}