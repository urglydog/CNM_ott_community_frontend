"use client";

import { formatSearchDateTime, highlightKeyword } from "../utils/messageSearch";
import type { Friend } from "../../../types";
import type { GroupInfo } from "../../groups/types";

interface MessageSearchRow {
  id: string | number;
  senderId: string | number;
  senderDisplayName?: string;
  senderAvatarUrl?: string | null;
  content: string;
  contentType?: string;
  createdAt: string;
  conversationId: string;
}

interface MessageSearchPanelProps {
  isOpen: boolean;
  searchScope: "conversation" | "global";
  searchKeyword: string;
  searchFromDate: string;
  searchToDate: string;
  searchResults: MessageSearchRow[];
  searchLoading: boolean;
  searchError: string;
  activeConversationId: string | null;
  currentUserId: string;
  friends: Friend[];
  myGroups: GroupInfo[];
  selectedGroup?: { groupId?: string | number; name?: string } | null;
  todayDateString: string;
  onClose: () => void;
  onSearch: (e?: React.FormEvent) => void;
  onScopeChange: (scope: "conversation" | "global") => void;
  onKeywordChange: (keyword: string) => void;
  onFromDateChange: (date: string) => void;
  onToDateChange: (date: string) => void;
  onClearFilters: () => void;
  onResultClick: (item: MessageSearchRow) => void;
}

export function MessageSearchPanel({
  isOpen,
  searchScope,
  searchKeyword,
  searchFromDate,
  searchToDate,
  searchResults,
  searchLoading,
  searchError,
  activeConversationId,
  currentUserId,
  friends,
  myGroups,
  selectedGroup,
  todayDateString,
  onClose,
  onSearch,
  onScopeChange,
  onKeywordChange,
  onFromDateChange,
  onToDateChange,
  onClearFilters,
  onResultClick,
}: MessageSearchPanelProps) {
  if (!isOpen) return null;

  function handleSearchFromDateChange(value: string) {
    onFromDateChange(value);
    if (!value) {
      onToDateChange("");
      return;
    }
    if (!searchToDate || searchToDate < value) {
      onToDateChange(value);
    }
  }

  function handleSearchToDateChange(value: string) {
    if (searchFromDate && value && value < searchFromDate) {
      onToDateChange(searchFromDate);
      return;
    }
    onToDateChange(value);
  }

  function getSearchResultContext(item: MessageSearchRow) {
    const senderName = item.senderDisplayName || `Người dùng ${item.senderId}`;
    const conversationId = String(item.conversationId || "");

    if (conversationId.startsWith("dm:")) {
      const ids = conversationId.slice(3).split(":");
      const friendId = ids.find((id) => String(id) !== String(currentUserId));
      const friend = friends.find(
        (entry) => String(entry.friend_id) === String(friendId || ""),
      );
      const dmName =
        friend?.friend_display_name ||
        friend?.friend_username ||
        friendId ||
        "cuộc trò chuyện cá nhân";
      return `Gửi bởi ${senderName} trong cuộc trò chuyện với ${dmName}`;
    }

    const group = myGroups.find(
      (entry) => String(entry.groupId) === conversationId,
    );
    const groupName =
      group?.name ||
      (selectedGroup && String(selectedGroup.groupId) === conversationId
        ? selectedGroup.name
        : conversationId);

    return `Gửi bởi ${senderName} trong nhóm ${groupName}`;
  }

  return (
    <div className="absolute right-4 top-20 z-20 w-[min(92vw,720px)] rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden">
      <form
        className="border-b border-gray-100 p-4 space-y-3"
        onSubmit={onSearch}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              Tìm kiếm tin nhắn
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Lọc theo từ khóa, khoảng thời gian và phạm vi tìm kiếm.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-medium text-gray-500 hover:text-gray-800"
          >
            Đóng
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-xs text-gray-600">
            <span>Từ khóa</span>
            <input
              value={searchKeyword}
              onChange={(e) => onKeywordChange(e.target.value)}
              placeholder="Ví dụ: họp, file, ảnh..."
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
            />
          </label>
          <label className="space-y-1 text-xs text-gray-600">
            <span>Từ ngày</span>
            <input
              type="date"
              value={searchFromDate}
              max={searchToDate || todayDateString}
              onChange={(e) => handleSearchFromDateChange(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
            />
          </label>
          <label className="space-y-1 text-xs text-gray-600">
            <span>Đến ngày</span>
            <input
              type="date"
              value={searchToDate}
              min={searchFromDate || undefined}
              max={todayDateString}
              onChange={(e) => handleSearchToDateChange(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
            />
          </label>
        </div>

        <div className="flex items-center gap-3 text-xs text-gray-600">
          <span className="font-medium">Phạm vi:</span>
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="search-scope"
              checked={searchScope === "conversation"}
              onChange={() => onScopeChange("conversation")}
            />
            Cuộc trò chuyện hiện tại
          </label>
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="search-scope"
              checked={searchScope === "global"}
              onChange={() => onScopeChange("global")}
            />
            Tin nhắn tổng
          </label>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={
              searchLoading ||
              (searchScope === "conversation" && !activeConversationId)
            }
            className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {searchLoading ? "Đang tìm..." : "Tìm ngay"}
          </button>
          <button
            type="button"
            onClick={onClearFilters}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Xóa bộ lọc
          </button>
        </div>

        {searchError && (
          <p className="text-sm text-red-600">{searchError}</p>
        )}
      </form>

      <div className="max-h-[42vh] overflow-y-auto">
        {searchResults.length === 0 ? (
          <div className="px-4 py-6 text-sm text-gray-500">
            {searchLoading
              ? "Đang tải kết quả..."
              : "Nhập điều kiện rồi bấm Tìm ngay để xem kết quả."}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {searchResults.map((item) => (
              <button
                key={`${item.conversationId}-${item.id}`}
                type="button"
                onClick={() => onResultClick(item)}
                className="w-full px-4 py-3 text-left hover:bg-blue-50/60 transition-colors"
              >
                <div className="flex items-center justify-between gap-3 text-xs text-gray-500">
                  <span className="font-medium text-gray-700">
                    {item.senderDisplayName || `Người gửi ${item.senderId}`}
                  </span>
                  <span>{formatSearchDateTime(item.createdAt)}</span>
                </div>
                <p className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">
                  {highlightKeyword(
                    item.content || "[Không có nội dung]",
                    searchKeyword,
                  )}
                </p>
                <p className="mt-1 text-[11px] text-gray-400">
                  {getSearchResultContext(item)}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
