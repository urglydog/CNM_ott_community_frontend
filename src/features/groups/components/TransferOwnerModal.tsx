import React, { useState } from "react";
import { X } from "lucide-react";
import type { Group, GroupMember } from "../types";

interface TransferOwnerModalProps {
  group: Group;
  currentMembers: GroupMember[];
  currentUserId: string;
  onClose: () => void;
  onConfirm: (newOwnerId: string) => void;
  isLoading?: boolean;
}

function getAvatarInitial(name: string): string {
  return name?.charAt(0)?.toUpperCase() ?? "?";
}

export default function TransferOwnerModal({
  group,
  currentMembers,
  currentUserId,
  onClose,
  onConfirm,
  isLoading = false
}: TransferOwnerModalProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  // Loại bỏ bản thân khỏi danh sách
  const eligibleMembers = currentMembers.filter(m => String(m.userId) !== String(currentUserId));

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col max-h-[85vh] animate-slideIn">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h3 className="text-[16px] font-bold text-gray-900">
            Chuyển quyền Trưởng nhóm
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          <p className="text-sm text-gray-600 mb-4">
            Bạn là Trưởng nhóm. Hãy chọn một người khác làm Trưởng nhóm trước khi rời khỏi nhóm <strong>{group.name}</strong>.
          </p>

          <div className="space-y-2">
            {eligibleMembers.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">Không có thành viên nào khác để chuyển quyền.</p>
            ) : (
              eligibleMembers.map(member => (
                <label
                  key={member.userId}
                  className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedUserId === String(member.userId) 
                      ? "border-[#005ae0] bg-[#005ae0]/5" 
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="newOwner"
                    className="w-4 h-4 text-[#005ae0] focus:ring-[#005ae0]"
                    checked={selectedUserId === String(member.userId)}
                    onChange={() => setSelectedUserId(String(member.userId))}
                  />
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-bold overflow-hidden shrink-0">
                    {member.avatarUrl ? (
                      <img src={member.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      getAvatarInitial(member.displayName || member.username)
                    )}
                  </div>
                  <div className="flex flex-col flex-1 truncate">
                    <span className="font-medium text-sm text-gray-800 truncate">
                      {member.displayName || member.username}
                    </span>
                    {member.role === 'DEPUTY' && (
                      <span className="text-[10px] text-[#005ae0] font-medium mt-0.5">Phó nhóm</span>
                    )}
                  </div>
                </label>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={() => onConfirm(selectedUserId)}
            disabled={!selectedUserId || isLoading}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Đang xử lý..." : "Xác nhận rời nhóm"}
          </button>
        </div>
      </div>
    </div>
  );
}
