"use client";

import { UserCheck, UserMinus, X } from "lucide-react";
import { useFriendRequests } from "../hooks/useContactsHooks";
import type { FriendRequestItem } from "../../../types";

interface FriendRequestsModalProps {
  onClose: () => void;
  onPendingCountChange: (delta: number) => void;
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

  if (diffDay > 0) return `${diffDay} ngày trước`;
  if (diffHour > 0) return `${diffHour} giờ trước`;
  if (diffMin > 0) return `${diffMin} phút trước`;
  return "Vừa xong";
}

export default function FriendRequestsModal({ onClose, onPendingCountChange }: FriendRequestsModalProps) {
  const { requests, loading, error, handleAccept, handleReject } = useFriendRequests({ onPendingCountChange });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Quản lý lời mời kết bạn"
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-white">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Lời mời kết bạn</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {requests.length > 0 ? `${requests.length} người muốn kết bạn` : "Không có lời mời nào"}
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
            </div>
          )}

          {!loading && !error && requests.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mb-3">
                <UserCheck className="w-7 h-7 text-blue-300" />
              </div>
              <p className="text-sm text-gray-500 font-medium">Không có lời mời nào</p>
              <p className="text-xs text-gray-400 mt-1">Tìm kiếm bạn bè để kết nối</p>
            </div>
          )}

          {!loading && !error && requests.length > 0 && (
            <ul className="divide-y divide-gray-50">
              {requests.map((req: FriendRequestItem) => (
                <li
                  key={req.id}
                  className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors"
                >
                  <div className="w-11 h-11 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold text-base flex-shrink-0 overflow-hidden">
                    {req.sender_avatar_url ? (
                      <img
                        src={req.sender_avatar_url}
                        alt={req.sender_display_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      getAvatarInitial(req.sender_display_name)
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{req.sender_display_name}</p>
                    <p className="text-xs text-gray-400">
                      @{req.sender_username} · {formatTimeAgo(req.created_at)}
                    </p>
                  </div>

                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleAccept(req.id)}
                      className="w-8 h-8 rounded-full bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center transition-colors cursor-pointer"
                      title="Đồng ý"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleReject(req.id)}
                      className="w-8 h-8 rounded-full bg-gray-100 hover:bg-red-50 text-gray-400 hover:text-red-500 flex items-center justify-center transition-colors cursor-pointer"
                      title="Từ chối"
                    >
                      <UserMinus className="w-3.5 h-3.5" />
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