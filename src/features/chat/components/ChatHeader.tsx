"use client";

import { MoreHorizontal, Phone, Search, Sparkles, Video, WifiOff } from "lucide-react";
import { GroupAvatar } from "./Avatar";
import type { ChatMode } from "../store/chatStore";
import type { GroupMember } from "../../groups/types";
import type { FriendItem } from "../../../types";
import { getAvatarInitial } from "../utils/messageUtils";

interface ChatHeaderProps {
  chatMode: ChatMode | null;
  isAiChatOpen?: boolean;
  isConnected: boolean;
  selectedFriend?: Friend | null;
  selectedGroup?: { name?: string; memberCount?: number; groupId?: string | number } | null;
  groupMembers?: GroupMember[];
  groupName?: string;
  friendName?: string;
  memberCount?: number;
  onStartVideoCall?: () => void;
  onToggleSearch?: () => void;
  onOpenSettings?: () => void;
  activeConversationId?: string | null;
  resolveDisplayAvatar?: (rawUrl: string | null | undefined) => string | null;
}


export function ChatHeader({
  chatMode,
  isAiChatOpen = false,
  isConnected,
  selectedFriend,
  selectedGroup,
  groupMembers = [],
  groupName = "",
  friendName = "",
  memberCount = 0,
  onStartVideoCall,
  onToggleSearch,
  onOpenSettings,
  activeConversationId,
  resolveDisplayAvatar,

}: ChatHeaderProps) {
  if (isAiChatOpen) {
    return (
      <div className="h-17 bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-linear-to-br from-cyan-500 via-blue-500 to-indigo-500 text-white flex items-center justify-center shadow-sm">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900 text-base leading-tight">
              AI Bot
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">Trợ lý thông minh</p>
          </div>
        </div>
      </div>
    );
  }

  const isGroup = chatMode === "GROUP";

  return (
    <div className="h-17 bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-3">
        {/* Avatar */}
        {isGroup ? (
          <GroupAvatar members={groupMembers} size={48} />
        ) : (
          <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold text-xl relative overflow-hidden shrink-0">
            {selectedFriend?.friend_avatar_url ? (
              <img
                src={
                  resolveDisplayAvatar?.(selectedFriend.friend_avatar_url) ||
                  selectedFriend.friend_avatar_url
                }
                alt={friendName}
                className="w-full h-full object-cover"
              />
            ) : (
              getAvatarInitial(friendName)
            )}
            {isConnected && (
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 border-2 border-white rounded-full" />
            )}
          </div>
        )}

        {/* Name + subtitle */}
        <div>
          <h2 className="font-semibold text-gray-900 text-base leading-tight">
            {isGroup ? groupName : friendName}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
            {isGroup ? (
              <>
                <span className="text-xs">👥</span>
                {memberCount > 0
                  ? `${memberCount} thành viên`
                  : isConnected
                    ? "Đang hoạt động"
                    : "Kết nối..."}
              </>
            ) : isConnected ? (
              <>
                <span className="inline-block w-1.5 h-1.5 bg-green-500 rounded-full" />
                Đang hoạt động
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3" />
                Đang kết nối lại...
              </>
            )}
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="p-2 hover:bg-gray-100 rounded-md cursor-pointer text-gray-600 transition-colors"
          title="Gọi thoại"
        >
          <Phone className="w-5 h-5" />
        </button>
        <button
          type="button"
          className="p-2 hover:bg-gray-100 rounded-md cursor-pointer text-gray-600 transition-colors"
          title="Gọi video"
          onClick={onStartVideoCall}
          disabled={!isConnected}
        >
          <Video className="w-5 h-5" />
        </button>
        <div className="w-px h-5 bg-gray-300 mx-1" />
        <button
          type="button"
          className="p-2 hover:bg-gray-100 rounded-md cursor-pointer text-gray-600 transition-colors"
          title="Tìm kiếm"
          onClick={onToggleSearch}
          disabled={!activeConversationId}
        >
          <Search className="w-5 h-5" />
        </button>
        <button
          type="button"
          className="p-2 hover:bg-gray-100 rounded-md cursor-pointer text-gray-600 transition-colors"
          title="Tuỳ chọn"
          onClick={onOpenSettings}
        >
          <MoreHorizontal className="w-5 h-5" />
        </button>

      </div>
    </div>
  );
}
