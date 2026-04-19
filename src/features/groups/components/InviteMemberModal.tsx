"use client";

import { useEffect, useState } from "react";
import { X, Search } from "lucide-react";
import { useToast } from "../../../contexts/ToastContext";
import { useFriendsList } from "../../contacts/hooks/useContactsHooks";
import { addMembersToGroup } from "../api";
import type { Group, GroupMember } from "../types";
import { useGroupsStore } from "../store/groupsStore";

interface InviteMemberModalProps {
  group: Group;
  currentMembers: GroupMember[];
  onClose: () => void;
}

function getAvatarInitial(name: string): string {
  return name?.charAt(0)?.toUpperCase() ?? "?";
}

export default function InviteMemberModal({
  group,
  currentMembers,
  onClose,
}: InviteMemberModalProps) {
  const { addToast } = useToast();
  const { friends, loadFriends, loadingFriends } = useFriendsList();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadFriends();
  }, [loadFriends]);

  const memberIds = new Set(currentMembers.map((m) => String(m.userId)));
  
  // Lọc ra các bạn bè chưa nằm trong nhóm
  const availableFriends = friends.filter(
    (f) => !memberIds.has(String(f.friend_id))
  );

  const filteredFriends = availableFriends.filter((f) => {
    const name = f.friend_display_name || f.friend_username || "";
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleToggle = (userId: string) => {
    setSelectedIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleConfirm = async () => {
    if (selectedIds.length === 0) return;
    try {
      setIsSubmitting(true);
      const addMembers = useGroupsStore.getState().addMembers;
      await addMembers(group.groupId, selectedIds);
      addToast("Đã gửi lời mời thành công!", "success");
      onClose();
    } catch (error: any) {
      addToast(error.message || "Lỗi khi thêm thành viên", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-[400px] max-h-[85vh] bg-white rounded-xl shadow-2xl flex flex-col animate-slideIn">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-[16px] font-bold text-gray-900">Mời thêm bạn bè</h2>
          <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Tìm kiếm bạn bè..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#005ae0]/20 focus:border-[#005ae0]"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-3">
            {loadingFriends ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-[#005ae0] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredFriends.length === 0 ? (
              <p className="text-center text-sm text-gray-500 py-8">
                {searchQuery ? "Không tìm thấy bạn bè phù hợp" : "Tất cả bạn bè đã ở trong nhóm!"}
              </p>
            ) : (
              <div className="space-y-1">
                {filteredFriends.map((f) => {
                  const uid = String(f.friend_id);
                  const checked = selectedIds.includes(uid);
                  return (
                    <label
                      key={uid}
                      className="flex items-center justify-between py-2 px-2 hover:bg-gray-50 rounded-lg cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center shrink-0 overflow-hidden">
                          {f.friend_avatar_url ? (
                            <img src={f.friend_avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="font-bold text-gray-500">{getAvatarInitial(f.friend_display_name || f.friend_username || "")}</span>
                          )}
                        </div>
                        <span className="text-sm font-medium text-gray-800">
                          {f.friend_display_name || f.friend_username}
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleToggle(uid)}
                        className="w-4 h-4 text-[#005ae0] border-gray-300 rounded focus:ring-[#005ae0]"
                      />
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 bg-gray-50/50">
          <span className="text-sm text-gray-600">
            Đã chọn <strong className="text-[#005ae0]">{selectedIds.length}</strong>
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Hủy
            </button>
            <button
              onClick={handleConfirm}
              disabled={selectedIds.length === 0 || isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-[#005ae0] rounded-lg hover:bg-[#0047b3] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Đang thêm..." : "Xác nhận"}
            </button>
          </div>
        </div>
        
      </div>
    </div>
  );
}
