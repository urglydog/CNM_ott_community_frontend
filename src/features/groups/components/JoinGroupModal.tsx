"use client";

import { useState } from "react";
import { X, UserPlus } from "lucide-react";
import { useToast } from "../../../contexts/ToastContext";

interface JoinGroupModalProps {
  onClose: () => void;
  onSuccess: () => void;
  onJoinGroup: (inviteCode: string) => Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }>;
}

export default function JoinGroupModal({
  onClose,
  onSuccess,
  onJoinGroup,
}: JoinGroupModalProps) {
  const { addToast } = useToast();
  const [inviteCode, setInviteCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = inviteCode.trim();
    if (!code) {
      addToast("Vui lòng nhập mã mời", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await onJoinGroup(code);
      if (result.success) {
        addToast(result.message || "Tham gia nhóm thành công", "success");
        onSuccess();
        onClose();
      } else {
        addToast(result.error || "Không thể tham gia nhóm", "error");
      }
    } catch {
      addToast("Đã xảy ra lỗi khi tham gia nhóm", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="join-group-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/35"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative w-full max-w-[420px] max-h-[90vh] overflow-hidden rounded-xl bg-white shadow-2xl flex flex-col animate-slideIn">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#005ae0]/10 flex items-center justify-center">
              <UserPlus className="w-4 h-4 text-[#005ae0]" />
            </div>
            <h2
              id="join-group-title"
              className="text-[16px] font-semibold text-gray-900"
            >
              Tham gia nhóm
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
            {/* Invite Code Input */}
            <div>
              <label
                htmlFor="invite-code"
                className="block text-[13px] font-medium text-gray-700 mb-1.5"
              >
                Mã mời
              </label>
              <div className="relative">
                <input
                  id="invite-code"
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="Nhập mã mời (VD: ABC123XY)"
                  className="w-full px-4 py-3 pr-12 text-[15px] border-2 border-slate-200 rounded-xl focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all placeholder:text-gray-300 font-mono tracking-wider"
                  maxLength={20}
                  autoFocus
                  autoComplete="off"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <svg
                    className="w-5 h-5 text-gray-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                    />
                  </svg>
                </div>
              </div>
              <p className="text-[11px] text-gray-400 mt-1.5">
                Mã mời gồm chữ cái và số, không phân biệt hoa thường
              </p>
            </div>

            {/* Info */}
            <div className="flex gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
              <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center shrink-0">
                <svg
                  className="w-4 h-4 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-[12px] font-medium text-gray-700 mb-0.5">
                  Bạn chưa có mã mời?
                </p>
                <p className="text-[12px] text-gray-500 leading-relaxed">
                  Hãy nhờ bạn bè chia sẻ mã mời nhóm cho bạn. Mã mời thường có
                  dạng chữ và số.
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
              disabled={isSubmitting || !inviteCode.trim()}
              className="px-5 py-2.5 text-[14px] font-medium rounded-xl bg-[#005ae0] text-white hover:bg-[#0047b3] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Đang tham gia...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  Tham gia
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}