"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, UserRound, X } from "lucide-react";
import { listUsers, sendFriendRequest } from "../../api/client";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import type { SearchUser } from "../../types";

const RECENT_STORAGE_KEY = "ott_add_friend_recent";

interface RecentEntry {
  /** Dùng làm React key — ưu tiên DynamoDB string id */
  key: string;
  /** Dùng cho API call */
  numId: number;
  display_name: string;
  phone_display: string;
  avatar_url: string | null;
}

interface AddFriendModalProps {
  onClose: () => void;
}

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

/** Hiển thị dạng (+84) 0837 930 093 */
function formatVnPhoneDisplay(raw: string | null | undefined): string {
  if (!raw) return "";
  const d = digitsOnly(raw);
  if (!d) return "";
  let rest = d;
  if (rest.startsWith("84")) rest = "0" + rest.slice(2);
  if (rest.startsWith("0")) rest = rest.slice(1);
  const a = rest.slice(0, 4);
  const b = rest.slice(4, 7);
  const c = rest.slice(7, 10);
  const parts = [a, b, c].filter(Boolean);
  return `(+84) ${parts.join(" ")}`.trim();
}

function loadRecent(): RecentEntry[] {
  try {
    const s = localStorage.getItem(RECENT_STORAGE_KEY);
    if (!s) return [];
    const raw = JSON.parse(s);
    if (!Array.isArray(raw)) {
      localStorage.removeItem(RECENT_STORAGE_KEY);
      return [];
    }
    // Hỗ trợ cả format cũ (id) và format mới (key / numId)
    const result = raw.slice(0, 5).map((item: unknown) => {
      if (!item || typeof item !== 'object') return null;
      const obj = item as Record<string, unknown>;
      const rawId = obj.key ?? obj.numId ?? obj.id;
      const numId = Number(rawId);
      if (!rawId || isNaN(numId)) return null;
      return {
        key: String(rawId),
        numId,
        display_name: typeof obj.display_name === 'string' ? obj.display_name : '',
        phone_display: typeof obj.phone_display === 'string' ? obj.phone_display : '',
        avatar_url: typeof obj.avatar_url === 'string' || obj.avatar_url === null ? (obj.avatar_url as string | null) : null
      } as RecentEntry;
    }).filter(Boolean) as RecentEntry[];

    // Nếu có entry bị null (corrupt), ghi lại storage sạch
    if (result.length !== raw.length) {
      saveRecent(result);
    }
    return result;
  } catch {
    localStorage.removeItem(RECENT_STORAGE_KEY);
    return [];
  }
}

function saveRecent(entries: RecentEntry[]) {
  try {
    // Store key + numId để reload đúng shape
    const stripped = entries.map(({ key, numId, display_name, phone_display, avatar_url }) => ({
      key,
      numId,
      display_name,
      phone_display,
      avatar_url
    }));
    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(stripped));
  } catch {
    /* ignore */
  }
}

function getAvatarInitial(name: string): string {
  return name?.charAt(0)?.toUpperCase() ?? "?";
}

export default function AddFriendModal({ onClose }: AddFriendModalProps) {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [phoneInput, setPhoneInput] = useState("");
  const [allUsers, setAllUsers] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  const [sendingIds, setSendingIds] = useState<Set<string>>(new Set());
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  const others = useMemo(
    () =>
      allUsers.filter((u) => {
        const uid = u.userId ?? u.id;
        return String(uid) !== String(user?.userId ?? user?.id);
      }),
    [allUsers, user]
  );

  const suggestions = useMemo(() => {
    const shuffled = [...others].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 4);
  }, [others]);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const list = await listUsers();
      setAllUsers(list);
    } catch {
      addToast("Không tải được danh sách người dùng", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    setRecent(loadRecent());
    loadUsers();
  }, [loadUsers]);

  const handleSearch = () => {
    const q = digitsOnly(phoneInput);
    if (!q) {
      addToast("Nhập số điện thoại để tìm", "info");
      return;
    }

    const found = others.find((u) => {
      const p = digitsOnly(u.phone_number || "");
      if (!p) return false;
      return p.endsWith(q) || q.endsWith(p) || p.includes(q) || q.includes(p);
    });

    if (found) {
      const rawId = found.userId ?? found.id;
      const entry: RecentEntry = {
        key: String(rawId),
        numId: Number(rawId),
        display_name: found.display_name || found.username,
        phone_display: formatVnPhoneDisplay(found.phone_number || "") || "—",
        avatar_url: found.avatar_url,
      };
      const next = [entry, ...recent.filter((r) => r.key !== entry.key)].slice(0, 5);
      setRecent(next);
      saveRecent(next);
      addToast(`Đã tìm thấy ${entry.display_name}`, "success");
    } else {
      addToast("Không tìm thấy người dùng với số này", "info");
    }
  };

  /** Prefer userId (string DynamoDB key) when available, fall back to numeric id */
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
      addToast(err instanceof Error ? err.message : "Không thể gửi lời mời", "error");
    } finally {
      setSendingIds((prev) => {
        const n = new Set(prev);
        n.delete(idKey);
        return n;
      });
    }
  };

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-friend-title"
    >
      <div className="absolute inset-0 bg-black/35" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-[420px] max-h-[90vh] overflow-hidden rounded-lg bg-white shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <h2 id="add-friend-title" className="text-[17px] font-semibold text-gray-900">
            Thêm bạn
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4">
          {/* Số điện thoại + mã vùng */}
          <div className="flex gap-2 items-end border-b-2 border-blue-500 pb-1 mb-6">
            <div className="relative shrink-0">
              <select
                className="appearance-none pl-2 pr-7 py-2 text-sm font-medium text-gray-800 bg-transparent border-none cursor-pointer focus:outline-none focus:ring-0"
                defaultValue="+84"
                aria-label="Mã quốc gia"
              >
                <option value="+84">🇻🇳 (+84)</option>
              </select>
              <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            </div>
            <input
              type="tel"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Số điện thoại"
              className="flex-1 min-w-0 py-2 text-[15px] text-gray-900 placeholder-gray-400 bg-transparent border-none focus:outline-none focus:ring-0"
            />
          </div>

          {/* Kết quả gần nhất */}
          <p className="text-[13px] font-semibold text-gray-800 mb-3">Kết quả gần nhất</p>
          {recent.length === 0 ? (
            <p className="text-xs text-gray-400 mb-6">Chưa có kết quả tìm kiếm gần đây</p>
          ) : (
            <ul className="space-y-3 mb-6">
                  {recent.map((r) => {
                const key = r.key;
                const busy = sendingIds.has(key);
                const sent = sentIds.has(key);
                return (
                  <li key={`recent-${r.numId}`} className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-[#005ae0] text-white flex items-center justify-center text-sm font-semibold shrink-0 overflow-hidden">
                      {r.avatar_url ? (
                        <img src={r.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        getAvatarInitial(r.display_name)
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold text-[#0f3d91] truncate">
                        {r.display_name}
                      </p>
                      <p className="text-[13px] text-gray-500">{r.phone_display}</p>
                    </div>
                    <button
                      type="button"
                      disabled={busy || sent}
                      onClick={() => handleSendRequest(r.numId)}
                      className="shrink-0 px-3 py-1.5 text-[13px] font-medium rounded-md border border-[#005ae0] text-[#005ae0] hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {sent ? "Đã gửi" : busy ? "..." : "Kết bạn"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Có thể bạn quen */}
          <div className="flex items-center gap-2 mb-3 text-gray-600">
            <UserRound className="w-4 h-4" />
            <span className="text-[13px] font-medium">Có thể bạn quen</span>
          </div>

          {loading ? (
            <p className="text-xs text-gray-400 py-4">Đang tải gợi ý...</p>
          ) : (
            <ul className="space-y-2">
              {suggestions.map((u) => {
                const rawId = u.userId ?? u.id;
                const key = String(rawId);
                const busy = sendingIds.has(key);
                const sent = sentIds.has(key);
                return (
                  <li
                    key={key}
                    className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0"
                  >
                    <div className="w-11 h-11 rounded-full bg-[#005ae0] text-white flex items-center justify-center text-sm font-semibold shrink-0 overflow-hidden">
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        getAvatarInitial(u.display_name || u.username)
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold text-gray-900 truncate">
                        {u.display_name || u.username}
                      </p>
                      <p className="text-[12px] text-gray-500 truncate">Từ gợi ý kết bạn</p>
                    </div>
                    <button
                      type="button"
                      disabled={busy || sent}
                      onClick={() => handleSendRequest(rawId)}
                      className="shrink-0 px-3 py-1.5 text-[13px] font-medium rounded-md border border-[#005ae0] text-[#005ae0] hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {sent ? "Đã gửi" : busy ? "..." : "Kết bạn"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50/80 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-sm font-medium rounded-md bg-gray-200 text-gray-800 hover:bg-gray-300"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSearch}
            className="px-5 py-2 text-sm font-medium rounded-md bg-[#005ae0] text-white hover:bg-[#0047b3]"
          >
            Tìm kiếm
          </button>
        </div>
      </div>
    </div>
  );
}
