"use client";

import { useMemo, useState } from "react";
import { Loader2, MessageCircle, Search, UserPlus } from "lucide-react";
import { useChatStore } from "../store/chatStore";
import { useAuth } from "../../../contexts/AuthContext";
import AddFriendModal from "../../contacts/components/AddFriendModal";
import type { AuthUser, FriendItem } from "../../../types";

interface ChatListPanelProps {
  authUser: AuthUser;
  onActiveViewChange: (open: boolean) => void;
}

function formatListTime(isoString: string) {
  try {
    const d = new Date(isoString);
    const now = new Date();
    const sameDay =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();
    if (sameDay) {
      return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
  } catch {
    return "";
  }
}

function snippet(text: string, max = 52) {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

export default function ChatListPanel({
  authUser,
  onActiveViewChange,
}: ChatListPanelProps) {
  const {
    friends,
    isLoadingFriends,
    friendsError,
    selectedFriend,
    setSelectedFriend,
    conversationPreview,
    unreadCounts,
    clearUnread,
  } = useChatStore();
  const { user } = useAuth();

  const [addFriendOpen, setAddFriendOpen] = useState(false);
  const [query, setQuery] = useState("");

  const sortedFriends = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = friends.slice();
    if (q) {
      list = list.filter(
        (f) =>
          f.friend_display_name.toLowerCase().includes(q) ||
          f.friend_username.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      const ta = conversationPreview[a.friend_id]?.createdAt || a.updated_at;
      const tb = conversationPreview[b.friend_id]?.createdAt || b.updated_at;
      return new Date(tb).getTime() - new Date(ta).getTime();
    });
    return list;
  }, [friends, query, conversationPreview]);

  return (
    <div className="w-[340px] bg-white border-r border-gray-200 flex flex-col z-10 relative shrink-0">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between gap-2 mb-4">
          <button
            type="button"
            onClick={() => onActiveViewChange(true)}
            className="flex items-center gap-2 group"
          >
            <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold text-xs">
              {(authUser.displayName || authUser.username).trim().charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col max-w-[160px] text-left">
              <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide group-hover:text-gray-700">
                Hồ sơ của tôi
              </span>
              <span className="font-semibold text-gray-800 text-sm truncate">{authUser.displayName}</span>
              <span className="text-[11px] text-gray-500 truncate">@{authUser.username}</span>
            </div>
          </button>
          <div className="flex items-center gap-1">
            <button
              type="button"
              title="Thêm bạn"
              aria-label="Thêm bạn"
              onClick={() => setAddFriendOpen(true)}
              className="p-1.5 rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            >
              <UserPlus className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-2.5 top-2 text-gray-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm bạn bè"
              className="w-full bg-gray-100 text-xs rounded-md pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-500"
            />
          </div>
        </div>
      </div>

      <div className="px-4 py-2 border-b border-gray-200 flex items-center gap-2">
        <MessageCircle className="w-4 h-4 text-blue-600 shrink-0" />
        <span className="text-xs font-semibold text-gray-700">Tin nhắn</span>
        {friends.length > 0 && (
          <span className="text-[10px] text-gray-500 ml-auto">{friends.length} bạn</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoadingFriends && (
          <div className="px-4 py-6 text-xs text-gray-500 flex items-center gap-2">
            <Loader2 className="w-3 h-3 animate-spin" />
            Đang tải danh sách bạn bè...
          </div>
        )}

        {friendsError && !isLoadingFriends && (
          <div className="px-4 py-4 text-xs text-red-500">{friendsError}</div>
        )}

        {!isLoadingFriends && !friendsError && friends.length === 0 && (
          <div className="px-4 py-8 text-center text-xs text-gray-500">
            Chưa có bạn bè. Dùng icon tìm kiếm hoặc <span className="text-blue-600">Thêm bạn</span> để kết nối.
          </div>
        )}

        {!isLoadingFriends &&
          !friendsError &&
          sortedFriends.map((friend) => {
            const isSel = selectedFriend?.friend_id === friend.friend_id;
            const prev = conversationPreview[friend.friend_id];
            const unread = unreadCounts[friend.friend_id] || 0;
            return (
              <button
                key={friend.friendshipId}
                type="button"
                onClick={() => {
                  setSelectedFriend(friend);
                  clearUnread(friend.friend_id);
                  onActiveViewChange(false);
                }}
                className={`w-full flex items-center px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-50 transition-colors ${
                  isSel ? "bg-blue-50 hover:bg-blue-50" : ""
                }`}
              >
                <div className="relative mr-3 shrink-0">
                  <div className="w-11 h-11 rounded-full bg-purple-200 flex items-center justify-center text-purple-700 font-semibold text-sm overflow-hidden">
                    {friend.friend_avatar_url ? (
                      <img src={friend.friend_avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      (friend.friend_display_name || "?").charAt(0).toUpperCase()
                    )}
                  </div>
                  {unread > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow-sm">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline gap-2 mb-0.5">
                    <span className={`font-medium truncate text-sm ${isSel ? "text-blue-800" : "text-gray-900"}`}>
                      {friend.friend_display_name}
                    </span>
                    {prev?.createdAt && (
                      <span className="text-[10px] text-gray-400 shrink-0">{formatListTime(prev.createdAt)}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate text-left">
                    {prev ? snippet(prev.content) : `@${friend.friend_username}`}
                  </p>
                </div>
              </button>
            );
          })}
      </div>

      {addFriendOpen && <AddFriendModal onClose={() => setAddFriendOpen(false)} />}
    </div>
  );
}