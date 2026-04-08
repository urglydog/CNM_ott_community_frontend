"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageCircle, Phone, UserCheck, X } from "lucide-react";
import { getFriendsList } from "../../api/client";
import type { FriendItem } from "../../types";

interface FriendsListModalProps {
  onClose: () => void;
  onOpenChat: (friend: FriendItem) => void;
}

function getAvatarInitial(name: string): string {
  return name?.charAt(0)?.toUpperCase() ?? "?";
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffDay > 30) return new Date(dateString).toLocaleDateString("vi-VN");
  if (diffDay > 0) return `${diffDay} ngày trước`;
  if (diffHour > 0) return `${diffHour} giờ trước`;
  if (diffMin > 0) return `${diffMin} phút trước`;
  return "Vừa xong";
}

export default function FriendsListModal({ onClose, onOpenChat }: FriendsListModalProps) {
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFriends = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const list = await getFriendsList();
      setFriends(list);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Không tải được danh sách bạn bè");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFriends();
  }, [loadFriends]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Danh sách bạn bè"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-white shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Danh sách bạn bè</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {friends.length > 0 ? `${friends.length} người bạn` : "Không có bạn bè"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-sm">Đang tải...</p>
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-red-400 text-sm mb-3">{error}</p>
              <button
                onClick={loadFriends}
                className="text-sm text-blue-500 hover:underline cursor-pointer"
              >
                Thử lại
              </button>
            </div>
          )}

          {!loading && !error && friends.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mb-3">
                <UserCheck className="w-7 h-7 text-blue-300" />
              </div>
              <p className="text-sm text-gray-500 font-medium">Chưa có bạn bè</p>
              <p className="text-xs text-gray-400 mt-1">Kết bạn để bắt đầu trò chuyện</p>
            </div>
          )}

          {!loading && !error && friends.length > 0 && (
            <ul className="divide-y divide-gray-50">
              {friends.map((friend) => (
                <li
                  key={friend.friendshipId}
                  className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors"
                >
                  {/* Avatar */}
                  <div className="w-11 h-11 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold text-base shrink-0 overflow-hidden">
                    {friend.friend_avatar_url ? (
                      <img
                        src={friend.friend_avatar_url}
                        alt={friend.friend_display_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      getAvatarInitial(friend.friend_display_name)
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {friend.friend_display_name}
                    </p>
                    <p className="text-xs text-gray-400">
                      @{friend.friend_username} · Kết bạn {formatTimeAgo(friend.updated_at)}
                    </p>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => onOpenChat(friend)}
                      className="w-8 h-8 rounded-full bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center transition-colors cursor-pointer"
                      title={`Chat với ${friend.friend_display_name}`}
                      aria-label={`Chat với ${friend.friend_display_name}`}
                    >
                      <MessageCircle className="w-4 h-4" />
                    </button>
                    <button
                      className="w-8 h-8 rounded-full bg-green-500 hover:bg-green-600 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
                      title={`Gọi cho ${friend.friend_display_name}`}
                      aria-label={`Gọi cho ${friend.friend_display_name}`}
                    >
                      <Phone className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
