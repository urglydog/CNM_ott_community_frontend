"use client";

import { useState } from "react";
import { UserCheck, UserMinus, MessageCircle, Phone } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { useToast } from "../../../contexts/ToastContext";
import { useFriendsList, useFriendRequests } from "../../../features/contacts/hooks/useContactsHooks";
import type { FriendItem, FriendRequestItem } from "../../../types";

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

export default function ContactsPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const { friends, loadingFriends, friendsError, loadFriends } = useFriendsList();
  const { requests, pendingCount, handleAccept, handleReject } = useFriendRequests();

  const [activeTab, setActiveTab] = useState<"friends" | "requests">("friends");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredFriends = friends.filter(
    (f: FriendItem) =>
      f.friend_display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.friend_username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!user) {
    return null;
  }

  return (
    <div className="flex-1 bg-gray-50 flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">Danh bạ</h1>
        <p className="text-sm text-gray-500 mt-1">Quản lý bạn bè và lời mời kết bạn</p>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab("friends")}
            className={`py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "friends"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4" />
              Bạn bè ({friends.length})
            </div>
          </button>
          <button
            onClick={() => setActiveTab("requests")}
            className={`py-3 text-sm font-medium border-b-2 transition-colors relative ${
              activeTab === "requests"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <div className="flex items-center gap-2">
              <UserMinus className="w-4 h-4" />
              Lời mời ({requests.length})
            </div>
            {pendingCount > 0 && (
              <span className="absolute -top-1 -right-4 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {pendingCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "friends" ? (
          <div className="p-6">
            {/* Search */}
            <div className="mb-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm bạn bè..."
                className="w-full max-w-md px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              />
            </div>

            {/* Friends list */}
            {loadingFriends && (
              <div className="text-center py-8 text-gray-500">Đang tải...</div>
            )}

            {friendsError && (
              <div className="text-center py-8 text-red-500">{friendsError}</div>
            )}

            {!loadingFriends && !friendsError && filteredFriends.length === 0 && (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                  <UserCheck className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-500">Chưa có bạn bè nào</p>
              </div>
            )}

            {!loadingFriends && !friendsError && filteredFriends.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                {filteredFriends.map((friend: FriendItem) => (
                  <div
                    key={friend.friendshipId}
                    className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                  >
                    <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold text-lg overflow-hidden">
                      {friend.friend_avatar_url ? (
                        <img src={friend.friend_avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        getAvatarInitial(friend.friend_display_name)
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{friend.friend_display_name}</p>
                      <p className="text-sm text-gray-500">@{friend.friend_username}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => {
                          addToast("Tính năng đang phát triển", "info");
                        }}
                        className="w-9 h-9 rounded-full bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center transition-colors"
                        title="Nhắn tin"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          addToast("Tính năng đang phát triển", "info");
                        }}
                        className="w-9 h-9 rounded-full bg-green-500 hover:bg-green-600 text-white flex items-center justify-center transition-colors"
                        title="Gọi điện"
                      >
                        <Phone className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="p-6">
            {requests.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
                  <UserCheck className="w-8 h-8 text-blue-300" />
                </div>
                <p className="text-gray-500">Không có lời mời kết bạn nào</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                {requests.map((req: FriendRequestItem) => (
                  <div
                    key={req.id}
                    className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                  >
                    <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold text-lg overflow-hidden">
                      {req.sender_avatar_url ? (
                        <img src={req.sender_avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        getAvatarInitial(req.sender_display_name)
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{req.sender_display_name}</p>
                      <p className="text-sm text-gray-500">@{req.sender_username} · {formatTimeAgo(req.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleAccept(req.id)}
                        className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        Chấp nhận
                      </button>
                      <button
                        onClick={() => handleReject(req.id)}
                        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-sm font-medium transition-colors"
                      >
                        Từ chối
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}