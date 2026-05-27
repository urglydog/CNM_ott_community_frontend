"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  MessageCircle,
  Search,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";
import { useChatStore } from "../store/chatStore";
import { useGroupsStore } from "../../groups/store/groupsStore";
import { fetchMyGroups } from "../../groups/api";
import { getPresignedViewUrl } from "../../../api/client";
import AddFriendModal from "../../contacts/components/AddFriendModal";
import type { FriendItem } from "../../../types";
import type { Group } from "../../groups/types";

interface ChatListPanelProps {
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
      return d.toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
      });
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

function formatSnippetText(rawContent: string, friends: any[] = []) {
  if (!rawContent) return "";
  let txt = String(rawContent).replaceAll("<@all>", "@Tất cả");
  txt = txt.replace(/<@([^>]+)>/g, (match, userId) => {
    if (userId === "all") return "@Tất cả";
    const friend = friends.find((f) => String(f.friend_id || f.id || f.userId) === String(userId));
    if (friend?.nickname) return `@${friend.nickname}`;
    if (friend?.friend_display_name || friend?.displayName) {
      return `@${friend.friend_display_name || friend.displayName}`;
    }
    return "@Người dùng";
  });
  return snippet(txt);
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
  onActiveViewChange,
}: ChatListPanelProps) {
  const {
    friends,
    isLoadingFriends,
    friendsError,
    isAiChatOpen,
    selectedFriend,
    selectedGroup,
    setSelectedFriend,
    setSelectedGroup,
    openAiChat,
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

  const [addFriendOpen, setAddFriendOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [showSearchActions, setShowSearchActions] = useState(false);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const [resolvedFriendAvatars, setResolvedFriendAvatars] = useState<
    Record<string, string>
  >({});

  const trimmedQuery = query.trim();
  const safeFriends = Array.isArray(friends) ? friends : [];
  const safeMyGroups = Array.isArray(myGroups) ? myGroups : [];

  function openAiFromSearch(prompt = "") {
    openAiChat(prompt);
    setShowSearchActions(false);
    onActiveViewChange(false);
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && trimmedQuery) {
      e.preventDefault();
      openAiFromSearch(trimmedQuery);
    }
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!searchRef.current) return;
      if (!searchRef.current.contains(event.target as Node)) {
        setShowSearchActions(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

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

  useEffect(() => {
    let cancelled = false;

    async function resolveFriendAvatars() {
      const targets = safeFriends.filter((f) => Boolean(f.friend_avatar_url));
      if (targets.length === 0) return;

      const entries = await Promise.all(
        targets.map(async (friend) => {
          const rawUrl = String(friend.friend_avatar_url || "").trim();
          const friendId = String(friend.friend_id);

          if (!rawUrl) return [friendId, ""] as const;
          if (!/\.amazonaws\.com/i.test(rawUrl))
            return [friendId, rawUrl] as const;
          if (/X-Amz-Algorithm=/i.test(rawUrl))
            return [friendId, rawUrl] as const;

          try {
            const signed = await getPresignedViewUrl({ url: rawUrl });
            return [friendId, signed.viewUrl || rawUrl] as const;
          } catch {
            return [friendId, rawUrl] as const;
          }
        }),
      );

      if (cancelled) return;

      setResolvedFriendAvatars((prev) => {
        const next = { ...prev };
        let changed = false;

        for (const [friendId, url] of entries) {
          if (url && next[friendId] !== url) {
            next[friendId] = url;
            changed = true;
          }
        }

        return changed ? next : prev;
      });
    }

    resolveFriendAvatars();

    return () => {
      cancelled = true;
    };
  }, [safeFriends]);

  // ── sortedChatItems: gộp friends + groups, tìm kiếm, sắp xếp ──────────────

  const sortedChatItems = useMemo<ChatItem[]>(() => {
    const q = query.trim().toLowerCase();

    // Map friends → PrivateChatItem
    const privateItems: PrivateChatItem[] = safeFriends.map((f) => ({
      ...f,
      type: "PRIVATE",
    }));

    // Map groups → GroupChatItem
    const groupItems: GroupChatItem[] = safeMyGroups.map((g) => ({
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
  }, [
    safeFriends,
    safeMyGroups,
    query,
    conversationPreview,
    groupConversationPreview,
    groupUnreadCounts,
  ]);

  // Tổng số cuộc trò chuyện
  const totalCount = safeFriends.length + safeMyGroups.length;

  return (
    <div className="w-[340px] bg-white border-r border-gray-200 flex flex-col z-10 relative shrink-0">
      {/* ── Header: avatar + search ─────────────────────────────────── */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
            Tin nhắn gần đây
          </div>
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
          <div ref={searchRef} className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-2.5 top-2 text-gray-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowSearchActions(Boolean(e.target.value.trim()));
              }}
              onKeyDown={handleSearchKeyDown}
              onFocus={() => setShowSearchActions(Boolean(trimmedQuery))}
              placeholder="Hỏi AI hoặc tìm kiếm..."
              className="w-full bg-gray-100 text-xs rounded-md pl-8 pr-9 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-500"
            />

            <button
              type="button"
              title="Mở chat AI"
              aria-label="Mở chat AI"
              onClick={() => openAiFromSearch()}
              className="absolute right-2 top-1.5 h-5 w-5 rounded-full bg-linear-to-br from-cyan-500 via-blue-500 to-indigo-500 text-white flex items-center justify-center shadow-sm hover:brightness-105"
            >
              <Sparkles className="w-3 h-3" />
            </button>

            {showSearchActions && trimmedQuery && (
              <div className="absolute z-20 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg p-1">
                <button
                  type="button"
                  onClick={() => openAiFromSearch(trimmedQuery)}
                  className="w-full text-left px-2.5 py-2 rounded-md hover:bg-blue-50"
                >
                  <span className="text-xs font-semibold text-blue-700">
                    ✦ Hỏi AI: "{trimmedQuery}"
                  </span>
                </button>
              </div>
            )}
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
        <button
          type="button"
          onClick={() => openAiFromSearch()}
          className={`w-full flex items-center px-4 py-3 text-left border-b border-gray-50 transition-colors ${
            isAiChatOpen ? "bg-blue-50 hover:bg-blue-50" : "hover:bg-gray-50"
          }`}
        >
          <div className="relative mr-3 shrink-0">
            <div className="w-11 h-11 rounded-full bg-linear-to-br from-cyan-500 via-blue-500 to-indigo-500 text-white flex items-center justify-center shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-baseline gap-2 mb-0.5">
              <span
                className={`font-medium truncate text-sm ${
                  isAiChatOpen ? "text-blue-800" : "text-gray-900"
                }`}
              >
                AI Bot
              </span>
            </div>
            <p className="text-xs text-gray-500 truncate text-left">
              Trợ lý thông minh, trả lời nhanh cho bạn
            </p>
          </div>
        </button>

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
                  avatarUrl={
                    resolvedFriendAvatars[String(item.friend_id)] ||
                    item.friend_avatar_url
                  }
                  isSelected={
                    selectedFriend?.friend_id === item.friend_id &&
                    chatMode === "PRIVATE"
                  }
                  preview={conversationPreview[item.friend_id]}
                  unread={unreadCounts[item.friend_id] || 0}
                  onClick={() => {
                    setSelectedFriend(item);
                    clearUnread(item.friend_id);
                    setShowSearchActions(false);
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
                  setSelectedGroup(item);
                  clearGroupUnread(String(item.groupId));
                  setShowSearchActions(false);
                  onActiveViewChange(false);
                }}
              />
            );
          })}
      </div>

      {addFriendOpen && (
        <AddFriendModal onClose={() => setAddFriendOpen(false)} />
      )}
    </div>
  );
}

// ── Private Chat Row ────────────────────────────────────────────────────────────

interface PrivateChatRowProps {
  item: PrivateChatItem;
  avatarUrl?: string | null;
  isSelected: boolean;
  preview: { content: string; createdAt: string } | undefined;
  unread: number;
  onClick: () => void;
}

function PrivateChatRow({
  item,
  avatarUrl,
  isSelected,
  preview,
  unread,
  onClick,
}: PrivateChatRowProps) {
  const friends = useChatStore((state) => state.friends || []);
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
          {avatarUrl ? (
            <img
              src={avatarUrl}
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
          {preview ? formatSnippetText(preview.content, friends) : `@${item.friend_username}`}
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

function GroupChatRow({
  item,
  isSelected,
  preview,
  unread,
  onClick,
}: GroupChatRowProps) {
  const friends = useChatStore((state) => state.friends || []);
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
          {preview ? formatSnippetText(preview.content, friends) : item.description || "Nhóm chat"}
        </p>
      </div>
    </button>
  );
}
