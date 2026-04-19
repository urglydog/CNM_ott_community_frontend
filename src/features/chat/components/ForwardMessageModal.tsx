"use client";

import { motion, AnimatePresence } from "motion/react";
import { X, Search, Send, Loader2, Users, MessageCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { forwardMessage } from "../api";
import { useChatStore } from "../store/chatStore";
import { useGroupsStore } from "../../groups/store/groupsStore";
import { getFriendsList } from "../../../api/client";
import { useToast } from "../../../contexts/ToastContext";
import type { FriendItem } from "../../../types";
import type { Group } from "../../groups/types";
import type { GroupChatMessage } from "../hooks/useGroupChat";
import { dmConversationId } from "../hooks/useChatHooks";
import { groupConversationId } from "../hooks/useGroupChat";

interface ForwardMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: GroupChatMessage;
  sourceConversationId: string;
  authUserId: string;
}

interface RecipientItem {
  id: string;
  type: "friend" | "group";
  displayName: string;
  avatarUrl: string | null;
  conversationId: string;
}

export default function ForwardMessageModal({
  isOpen,
  onClose,
  message,
  sourceConversationId,
  authUserId,
}: ForwardMessageModalProps) {
  const { addToast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSending, setIsSending] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Load friends and groups on mount
  useEffect(() => {
    if (!isOpen) return;

    async function load() {
      setIsLoadingData(true);
      try {
        const friendsData = await getFriendsList();

        // Pull groups from store; if empty, fetch directly from API.
        let groupsData = import("../../groups/store/groupsStore").then(
          (m) => m.useGroupsStore.getState().myGroups,
        );

        const [friendsResult, groupsResult] = await Promise.all([
          friendsData,
          groupsData,
        ]);

        setFriends(friendsResult);
        setGroups(Array.isArray(groupsResult) ? groupsResult : []);

        // If store was empty, force-fetch groups so the modal always shows options.
        if (!Array.isArray(groupsResult) || groupsResult.length === 0) {
          const { fetchGroups } = await import("../api");
          const fetched = await fetchGroups();
          setGroups(Array.isArray(fetched) ? fetched : []);
        }
      } catch {
        // non-critical – modal still renders with empty list
      } finally {
        setIsLoadingData(false);
      }
    }

    load();
  }, [isOpen]);

  // Build the full recipient list, converting to a flat array of RecipientItem.
  // Each entry carries its own `conversationId` derived from the conversation format.
  const allRecipients: RecipientItem[] = useMemo(() => {
    const friendItems: RecipientItem[] = friends.map((f) => ({
      id: `friend:${f.friend_id}`,
      type: "friend",
      displayName: f.friend_display_name,
      avatarUrl: f.friend_avatar_url,
      conversationId: dmConversationId(authUserId, f.friend_id),
    }));

    const groupItems: RecipientItem[] = groups
      .filter((g) => String(g.groupId) !== sourceConversationId)
      .map((g) => ({
        id: `group:${g.groupId}`,
        type: "group",
        displayName: g.name,
        avatarUrl: null,
        conversationId: groupConversationId(g.groupId),
      }));

    return [...friendItems, ...groupItems];
  }, [friends, groups, authUserId, sourceConversationId]);

  // Filter by search query
  const filteredRecipients = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return allRecipients;
    return allRecipients.filter((r) =>
      r.displayName.toLowerCase().includes(q),
    );
  }, [allRecipients, searchQuery]);

  // Toggle selection
  const toggleRecipient = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectedCount = selectedIds.size;

  // Send handler
  const handleSend = useCallback(async () => {
    if (selectedCount === 0) return;

    const targets = allRecipients
      .filter((r) => selectedIds.has(r.id))
      .map((r) => r.conversationId);

    setIsSending(true);
    try {
      const result = await forwardMessage({
        originalMessageId: String(message.id),
        sourceConversationId,
        targetConversationIds: targets,
      });

      if (result.success) {
        addToast(
          `Đã chuyển tiếp đến ${result.data.forwardedCount} cuộc trò chuyện`,
          "success",
        );
        onClose();
        setSelectedIds(new Set());
        setSearchQuery("");
      }
    } catch (err: unknown) {
      addToast(
        err instanceof Error ? err.message : "Không thể chuyển tiếp tin nhắn",
        "error",
      );
    } finally {
      setIsSending(false);
    }
  }, [
    selectedCount,
    allRecipients,
    selectedIds,
    message.id,
    sourceConversationId,
    addToast,
    onClose,
  ]);

  // Close and reset
  const handleClose = useCallback(() => {
    onClose();
    setSelectedIds(new Set());
    setSearchQuery("");
  }, [onClose]);

  // Clamp modal to viewport
  const [adjustedX, setAdjustedX] = useState(0);
  const [adjustedY, setAdjustedY] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const modalW = 420;
    const modalH = 540;
    setAdjustedX(Math.max(0, (vw - modalW) / 2));
    setAdjustedY(Math.max(0, (vh - modalH) / 2));
  }, [isOpen]);

  // Message preview snippet
  const previewContent =
    message.contentType === "revoked"
      ? "Tin nhắn đã được thu hồi"
      : message.content?.slice(0, 80) ?? "[Không có nội dung]";

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed z-50 bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            style={{
              top: adjustedY,
              left: adjustedX,
              width: 420,
              maxHeight: 540,
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Chuyển tiếp tin nhắn"
          >
            {/* ── Header ─────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
              <div>
                <h2 className="text-base font-semibold text-gray-800 leading-tight">
                  Chuyển tiếp tin nhắn
                </h2>
                <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[300px]">
                  {previewContent}
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Đóng"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* ── Search ─────────────────────────────────────────── */}
            <div className="px-4 pt-3 pb-2 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm bạn bè hoặc nhóm..."
                  className="w-full h-9 pl-9 pr-3 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 transition-all"
                />
              </div>
            </div>

            {/* ── Recipient list ─────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-4 pb-2">
              {isLoadingData ? (
                <div className="flex items-center justify-center py-12 gap-2 text-gray-400 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Đang tải...
                </div>
              ) : filteredRecipients.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-gray-400">
                  <MessageCircle className="w-8 h-8 opacity-40" />
                  <p className="text-sm">
                    {searchQuery ? "Không tìm thấy kết quả" : "Không có người nhận"}
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredRecipients.map((recipient) => {
                    const isSelected = selectedIds.has(recipient.id);
                    return (
                      <motion.button
                        key={recipient.id}
                        type="button"
                        onClick={() => toggleRecipient(recipient.id)}
                        whileTap={{ scale: 0.98 }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${
                          isSelected
                            ? "bg-blue-50 border border-blue-200"
                            : "hover:bg-gray-50 border border-transparent"
                        }`}
                      >
                        {/* Avatar */}
                        {recipient.type === "group" ? (
                          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                            <Users className="w-5 h-5 text-blue-500" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center text-gray-500 font-medium shrink-0">
                            {recipient.avatarUrl ? (
                              <img
                                src={recipient.avatarUrl}
                                alt={recipient.displayName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              recipient.displayName.charAt(0)?.toUpperCase() ?? "?"
                            )}
                          </div>
                        )}

                        {/* Name */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">
                            {recipient.displayName}
                          </p>
                          <p className="text-xs text-gray-400">
                            {recipient.type === "group" ? "Nhóm" : "Bạn bè"}
                          </p>
                        </div>

                        {/* Checkbox indicator */}
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                            isSelected
                              ? "bg-blue-500 border-blue-500"
                              : "border-gray-300"
                          }`}
                        >
                          {isSelected && (
                            <svg
                              viewBox="0 0 12 12"
                              className="w-3 h-3 text-white"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={2}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="2,6 5,9 10,3" />
                            </svg>
                          )}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Footer ─────────────────────────────────────────── */}
            <div className="px-4 py-3 border-t border-gray-100 shrink-0 bg-gray-50">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 h-10 rounded-xl border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-100 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={selectedCount === 0 || isSending}
                  className="flex-1 h-10 rounded-xl bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
                >
                  {isSending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Đang gửi...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Gửi{selectedCount > 0 ? ` (${selectedCount})` : ""}
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
