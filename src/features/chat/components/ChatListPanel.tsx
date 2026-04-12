"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, MessageCircle, Search, UserPlus, Users } from "lucide-react";
import { useChatStore } from "../store/chatStore";
import { useGroupsStore } from "../../groups/store/groupsStore";
import { fetchMyGroups } from "../../groups/api";
import { useAuth } from "../../../contexts/AuthContext";
import AddFriendModal from "../../contacts/components/AddFriendModal";
import type { AuthUser, FriendItem } from "../../../types";
import type { Group } from "../../groups/types";

interface ChatListPanelProps {
  authUser: AuthUser;
  onActiveViewChange: (open: boolean) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Union type cho mỗi item trong danh sách gộp ──────────────────────────────

interface PrivateChatItem extends FriendItem {
  type: "PRIVATE";
}

interface GroupChatItem extends Group {
  type: "GROUP";
}

type ChatItem = PrivateChatItem | GroupChatItem;

// ── Component ─────────────────────────────────────────────────────────────────

export default function ChatListPanel({
  authUser,
  onActiveViewChange,
}: ChatListPanelProps) {
  const {
    friends,
    isLoadingFriends,
    friendsError,
    selectedFriend,
    selectedGroup,
    setSelectedFriend,
    conversationPreview,
    groupConversationPreview,
    unreadCounts,
    groupUnreadCounts,
    clearUnread,
    clearGroupUnread,
    chatMode,
  } = useChatStore();

  const { myGroups, setMyGroups, isLoadingGroups, setIsLoadingGroups } =
    useGroupsStore();
  const { user } = useAuth();

  const [addFriendOpen, setAddFriendOpen] = useState(false);
  const [query, setQuery] = useState("");

  // ── Load nhóm khi mount ─────────────────────────────────────────────────
  useEffect(() => {
    async function loadGroups() {
      setIsLoadingGroups(true);
      try {
        const groups = await fetchMyGroups();
        setMyGroups(groups);
      } catch {
        // lỗi不影响 chat list — bỏ qua
      } finally {
        setIsLoadingGroups(false);
      }
    }
    loadGroups();
  }, [setMyGroups, setIsLoadingGroups]);

  // ── sortedChatItems: gộp friends + groups, tìm kiếm, sắp xếp ──────────────

  const sortedChatItems = useMemo<ChatItem[]>(() => {
    const q = query.trim().toLowerCase();

    // Map friends → PrivateChatItem
    const privateItems: PrivateChatItem[] = friends.map((f) => ({
      ...f,
      type: "PRIVATE",
    }));

    // Map groups → GroupChatItem
    const groupItems: GroupChatItem[] = myGroups.map((g) => ({
      ...g,
      type: "GROUP",
    }));

    // Gộp 2 mảng
    let merged: ChatItem[] = [...privateItems, ...groupItems];

    // Search
    if (q) {
      merged = merged.filter((item) => {
        if (item.type === "PRIVATE") {
          return (
            item.friend_display_name.toLowerCase().includes(q) ||
            item.friend_username.toLowerCase().includes(q)
          );
        }
        return item.name.toLowerCase().includes(q);
      });
    }

    // Sort giảm dần theo thời gian (mới nhất lên đầu)
    merged.sort((a, b) => {
      let timeA: string;
      let timeB: string;

      if (a.type === "PRIVATE") {
        timeA =
          conversationPreview[a.friend_id]?.createdAt ||
          (a as PrivateChatItem).updated_at;
      } else {
        timeA =
          groupConversationPreview[String(a.groupId)]?.createdAt ||
          (a as GroupChatItem).createdAt ||
          "";
      }

      if (b.type === "PRIVATE") {
        timeB =
          conversationPreview[b.friend_id]?.createdAt ||
          (b as PrivateChatItem).updated_at;
      } else {
        timeB =
          groupConversationPreview[String(b.groupId)]?.createdAt ||
          (b as GroupChatItem).createdAt ||
          "";
      }

      return new Date(timeB).getTime() - new Date(timeA).getTime();
    });

    return merged;
  }, [friends, myGroups, query, conversationPreview, groupConversationPreview, groupUnreadCounts]);

  // Tổng số cuộc trò chuyện
  const totalCount = friends.length + myGroups.length;

  return (
    <div className="w-[340px] bg-white border-r border-gray-200 flex flex-col z-10 relative shrink-0">
      {/* ── Header: avatar + search ─────────────────────────────────── */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between gap-2 mb-4">
          <button
            type="button"
            onClick={() => onActiveViewChange(true)}
            className="flex items-center gap-2 group"
          >
            <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold text-xs">
              {(authUser.displayName || authUser.username)
                .trim()
                .charAt(0)
                .toUpperCase()}
            </div>
            <div className="flex flex-col max-w-[160px] text-left">
              <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide group-hover:text-gray-700">
                Hồ sơ của tôi
              </span>
              <span className="font-semibold text-gray-800 text-sm truncate">
                {authUser.displayName}
              </span>
              <span className="text-[11px] text-gray-500 truncate">
                @{authUser.username}
              </span>
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
              placeholder="Tìm bạn bè, nhóm"
              className="w-full bg-gray-100 text-xs rounded-md pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-500"
            />
          </div>
        </div>
      </div>

      {/* ── Section label ──────────────────────────────────────────── */}
      <div className="px-4 py-2 border-b border-gray-200 flex items-center gap-2">
        <MessageCircle className="w-4 h-4 text-blue-600 shrink-0" />
        <span className="text-xs font-semibold text-gray-700">Tin nhắn</span>
        {totalCount > 0 && (
          <span className="text-[10px] text-gray-500 ml-auto">
            {totalCount} cuộc trò chuyện
          </span>
        )}
      </div>

      {/* ── List ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {(isLoadingFriends || isLoadingGroups) && (
          <div className="px-4 py-6 text-xs text-gray-500 flex items-center gap-2">
            <Loader2 className="w-3 h-3 animate-spin" />
            Đang tải danh sách...
          </div>
        )}

        {friendsError && !isLoadingFriends && (
          <div className="px-4 py-4 text-xs text-red-500">{friendsError}</div>
        )}

        {!isLoadingFriends && !isLoadingGroups && totalCount === 0 && (
          <div className="px-4 py-8 text-center text-xs text-gray-500">
            Chưa có cuộc trò chuyện nào.{" "}
            <span className="text-blue-600">Thêm bạn</span> hoặc tham gia nhóm
            để bắt đầu.
          </div>
        )}

        {!isLoadingFriends &&
          !isLoadingGroups &&
          !friendsError &&
          sortedChatItems.map((item) => {
            if (item.type === "PRIVATE") {
              return (
                <PrivateChatRow
                  key={item.friendshipId}
                  item={item}
                  isSelected={
                    selectedFriend?.friend_id === item.friend_id &&
                    chatMode === "PRIVATE"
                  }
                  preview={conversationPreview[item.friend_id]}
                  unread={unreadCounts[item.friend_id] || 0}
                  onClick={() => {
                    setSelectedFriend(item);
                    clearUnread(item.friend_id);
                    onActiveViewChange(false);
                  }}
                />
              );
            }

            // GROUP item
            return (
              <GroupChatRow
                key={String(item.groupId)}
                item={item}
                isSelected={
                  selectedGroup != null &&
                  String(selectedGroup.groupId) === String(item.groupId) &&
                  chatMode === "GROUP"
                }
                preview={groupConversationPreview[String(item.groupId)]}
                unread={groupUnreadCounts[String(item.groupId)] || 0}
                onClick={() => {
                  useChatStore.getState().setSelectedGroup(item);
                  clearGroupUnread(String(item.groupId));
                  onActiveViewChange(false);
                }}
              />
            );
          })}
      </div>

      {addFriendOpen && <AddFriendModal onClose={() => setAddFriendOpen(false)} />}
    </div>
  );
}

// ── Private Chat Row ────────────────────────────────────────────────────────────

interface PrivateChatRowProps {
  item: PrivateChatItem;
  isSelected: boolean;
  preview: { content: string; createdAt: string } | undefined;
  unread: number;
  onClick: () => void;
}

function PrivateChatRow({
  item,
  isSelected,
  preview,
  unread,
  onClick,
}: PrivateChatRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-50 transition-colors ${
        isSelected ? "bg-blue-50 hover:bg-blue-50" : ""
      }`}
    >
      {/* Avatar */}
      <div className="relative mr-3 shrink-0">
        <div className="w-11 h-11 rounded-full bg-purple-200 flex items-center justify-center text-purple-700 font-semibold text-sm overflow-hidden">
          {item.friend_avatar_url ? (
            <img
              src={item.friend_avatar_url}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            (item.friend_display_name || "?").charAt(0).toUpperCase()
          )}
        </div>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow-sm">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </div>

      {/* Name + preview */}
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline gap-2 mb-0.5">
          <span
            className={`font-medium truncate text-sm ${
              isSelected ? "text-blue-800" : "text-gray-900"
            }`}
          >
            {item.friend_display_name}
          </span>
          {preview?.createdAt && (
            <span className="text-[10px] text-gray-400 shrink-0">
              {formatListTime(preview.createdAt)}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 truncate text-left">
          {preview ? snippet(preview.content) : `@${item.friend_username}`}
        </p>
      </div>
    </button>
  );
}

// ── Group Chat Row ─────────────────────────────────────────────────────────────

interface GroupChatRowProps {
  item: GroupChatItem;
  isSelected: boolean;
  preview: { content: string; createdAt: string } | undefined;
  unread: number;
  onClick: () => void;
}

function GroupChatRow({ item, isSelected, preview, unread, onClick }: GroupChatRowProps) {

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-50 transition-colors ${
        isSelected ? "bg-blue-50 hover:bg-blue-50" : ""
      }`}
    >
      {/* Group avatar */}
      <div className="relative mr-3 shrink-0">
        <div className="w-11 h-11 rounded-full bg-blue-200 flex items-center justify-center text-blue-700 font-semibold text-sm overflow-hidden">
          {item.name.charAt(0).toUpperCase()}
        </div>
        <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
          <Users className="w-2.5 h-2.5 text-white" />
        </span>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow-sm">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </div>

      {/* Name + preview */}
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline gap-2 mb-0.5">
          <span
            className={`font-medium truncate text-sm ${
              isSelected ? "text-blue-800" : "text-gray-900"
            }`}
          >
            {item.name}
          </span>
          {preview?.createdAt && (
            <span className="text-[10px] text-gray-400 shrink-0">
              {formatListTime(preview.createdAt)}
            </span>
          )}
          {!preview?.createdAt && item.createdAt && (
            <span className="text-[10px] text-gray-400 shrink-0">
              {formatListTime(item.createdAt)}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 truncate text-left">
          {preview ? snippet(preview.content) : item.description || "Nhóm chat"}
        </p>
      </div>
    </button>
  );
}
