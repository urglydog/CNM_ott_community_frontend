"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, UserPlus, X } from "lucide-react";
import { listUsers, sendFriendRequest } from "../../api/client";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import type { SearchUser } from "../../types";

interface SearchUsersModalProps {
  onClose: () => void;
}

function getAvatarInitial(name: string): string {
  return name?.charAt(0)?.toUpperCase() ?? "?";
}

export default function SearchUsersModal({ onClose }: SearchUsersModalProps) {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingIds, setSendingIds] = useState<Set<string>>(new Set());
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const all = await listUsers();
      // Lọc bỏ chính mình (hỗ trợ cả id dạng số MySQL và userId dạng string DynamoDB)
      const currentId = user?.userId ?? user?.id;
      const currentIdStr = String(currentId ?? '');
      setUsers(all.filter((u) => {
        const uid = u.userId ?? u.id;
        return String(uid) !== currentIdStr;
      }));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Không tải được danh sách");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const filtered = users.filter(
    (u) =>
      u.username.toLowerCase().includes(query.toLowerCase()) ||
      (u.display_name || u.username).toLowerCase().includes(query.toLowerCase())
  );

  const resolveTargetId = (rawId: unknown): number | string => {
    if (typeof rawId === 'string' && rawId.trim() !== '') return rawId;
    const n = Number(rawId);
    return isNaN(n) ? '' : n;
  };

  const handleSendRequest = async (rawId: unknown) => {
    const targetId = resolveTargetId(rawId);
    if (String(targetId) === String(user?.userId ?? user?.id)) {
      addToast("Không thể gửi lời mời kết bạn cho chính mình", "error");
      return;
    }
    const idKey = typeof targetId === 'string' ? targetId : String(targetId);
    setSendingIds((prev) => new Set(prev).add(idKey));
    try {
      await sendFriendRequest({ receiverId: targetId });
      setSentIds((prev) => new Set(prev).add(idKey));
      addToast("Đã gửi lời mời kết bạn", "success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Không thể gửi lời mời";
      addToast(msg, "error");
    } finally {
      setSendingIds((prev) => {
        const next = new Set(prev);
        next.delete(idKey);
        return next;
      });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Tìm kiếm bạn bè"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-800">Tìm kiếm bạn bè</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
              aria-label="Đóng"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm theo username hoặc tên..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              autoFocus
            />
          </div>
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
              <button onClick={loadUsers} className="text-sm text-blue-500 hover:underline cursor-pointer">
                Thử lại
              </button>
            </div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-sm text-gray-500 font-medium">Không tìm thấy người dùng</p>
            </div>
          )}

          {!loading && !error && filtered.length > 0 && (
            <ul className="divide-y divide-gray-50">
              {filtered.map((u) => {
                const rawId = u.userId ?? u.id;
                const idKey = String(rawId);
                const isSending = sendingIds.has(idKey);
                const isSent = sentIds.has(idKey);
                return (
                  <li
                    key={String(u.id)}
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold text-sm shrink-0 overflow-hidden">
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt={u.display_name} className="w-full h-full object-cover" />
                      ) : (
                        getAvatarInitial(u.display_name || u.username)
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {u.display_name || u.username}
                      </p>
                      <p className="text-xs text-gray-400">@{u.username}</p>
                    </div>
                    <button
                      onClick={() => handleSendRequest(rawId)}
                      disabled={isSending || isSent}
                      className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors disabled:cursor-not-allowed cursor-pointer ${
                        isSent
                          ? "bg-green-100 text-green-500"
                          : "bg-blue-500 hover:bg-blue-600 text-white"
                      }`}
                      title={isSent ? "Đã gửi" : "Gửi lời mời"}
                    >
                      {isSending ? (
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : isSent ? (
                        <span className="text-xs font-bold">✓</span>
                      ) : (
                        <UserPlus className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
