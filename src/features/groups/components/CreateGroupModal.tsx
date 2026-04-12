"use client";

import { useState } from "react";
import { X, Users } from "lucide-react";
import { useToast } from "../../../contexts/ToastContext";
import type { CreateGroupPayload } from "../api";

interface CreateGroupModalProps {
  onClose: () => void;
  onSuccess: (group: { groupId: string | number; name: string }) => void;
  onCreateGroup: (payload: CreateGroupPayload) => Promise<{
    success: boolean;
    group?: { groupId: string | number; name: string };
    error?: string;
  }>;
}

export default function CreateGroupModal({
  onClose,
  onSuccess,
  onCreateGroup,
}: CreateGroupModalProps) {
  const { addToast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      addToast("Vui lòng nhập tên nhóm", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await onCreateGroup({
        name: name.trim(),
        description: description.trim() || undefined,
      });

      if (result.success && result.group) {
        addToast(`Đã tạo nhóm "${result.group.name}" thành công`, "success");
        onSuccess(result.group);
        onClose();
      } else {
        addToast(result.error || "Không thể tạo nhóm", "error");
      }
    } catch {
      addToast("Đã xảy ra lỗi khi tạo nhóm", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-group-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/35"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative w-full max-w-[440px] max-h-[90vh] overflow-hidden rounded-xl bg-white shadow-2xl flex flex-col animate-slideIn">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#005ae0]/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-[#005ae0]" />
            </div>
            <h2
              id="create-group-title"
              className="text-[16px] font-semibold text-gray-900"
            >
              Tạo nhóm mới
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
            {/* Group Name */}
            <div>
              <label
                htmlFor="group-name"
                className="block text-[13px] font-medium text-gray-700 mb-1.5"
              >
                Tên nhóm <span className="text-red-500">*</span>
              </label>
              <input
                id="group-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Nhóm bạn bè, Nhóm công việc..."
                className="w-full px-4 py-2.5 text-[14px] border-2 border-slate-200 rounded-xl focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all placeholder:text-gray-300"
                maxLength={100}
                autoFocus
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Tối đa 100 ký tự
              </p>
            </div>

            {/* Description */}
            <div>
              <label
                htmlFor="group-description"
                className="block text-[13px] font-medium text-gray-700 mb-1.5"
              >
                Mô tả{" "}
                <span className="text-gray-400 font-normal">(tùy chọn)</span>
              </label>
              <textarea
                id="group-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mô tả ngắn về nhóm (mục đích, chủ đề...)"
                className="w-full px-4 py-2.5 text-[14px] border-2 border-slate-200 rounded-xl focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all placeholder:text-gray-300 resize-none"
                rows={3}
                maxLength={500}
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Tối đa 500 ký tự
              </p>
            </div>

            {/* Info Box */}
            <div className="flex gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
              <div className="w-8 h-8 bg-[#005ae0] rounded-full flex items-center justify-center shrink-0">
                <svg
                  className="w-4 h-4 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-[12px] font-medium text-blue-800 mb-0.5">
                  Lưu ý
                </p>
                <p className="text-[12px] text-blue-600 leading-relaxed">
                  Sau khi tạo nhóm, bạn sẽ nhận được một mã mời để chia sẻ với
                  bạn bè.
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/80 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-[14px] font-medium rounded-xl bg-gray-200 text-gray-800 hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting}
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="px-5 py-2.5 text-[14px] font-medium rounded-xl bg-[#005ae0] text-white hover:bg-[#0047b3] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Đang tạo...
                </>
              ) : (
                <>
                  <Users className="w-4 h-4" />
                  Tạo nhóm
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}