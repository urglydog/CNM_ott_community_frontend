"use client";

import { useEffect, useState } from "react";
import { X, Users, Link2, Copy, Check, Shield } from "lucide-react";
import { useToast } from "../../../contexts/ToastContext";
import type { Group, InviteInfo } from "../types";
import type { InviteInfo as ApiInviteInfo } from "../api";

interface GroupDetailModalProps {
  group: Group;
  onClose: () => void;
  onGetInvite: (
    groupId: string | number
  ) => Promise<{ success: boolean; invite?: InviteInfo; error?: string }>;
}

function getAvatarInitial(name: string): string {
  return name?.charAt(0)?.toUpperCase() ?? "?";
}

export default function GroupDetailModal({
  group,
  onClose,
  onGetInvite,
}: GroupDetailModalProps) {
  const { addToast } = useToast();
  const [inviteInfo, setInviteInfo] = useState<ApiInviteInfo | null>(null);
  const [isLoadingInvite, setIsLoadingInvite] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    setIsLoadingInvite(true);
    onGetInvite(group.groupId)
      .then((result) => {
        if (result.success && result.invite) {
          setInviteInfo(result.invite);
        }
      })
      .finally(() => setIsLoadingInvite(false));
  }, [group.groupId, onGetInvite]);

  const handleCopyCode = () => {
    if (!inviteInfo?.inviteCode) return;
    navigator.clipboard.writeText(inviteInfo.inviteCode).then(() => {
      setCopied(true);
      addToast("Đã sao chép mã mời", "success");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleCopyLink = () => {
    if (!inviteInfo?.inviteLink) return;
    navigator.clipboard.writeText(inviteInfo.inviteLink).then(() => {
      addToast("Đã sao chép liên kết mời", "success");
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="group-detail-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/35"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative w-full max-w-[480px] max-h-[90vh] overflow-hidden rounded-xl bg-white shadow-2xl flex flex-col animate-slideIn">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[#005ae0] text-white flex items-center justify-center text-[18px] font-bold overflow-hidden shrink-0">
              {group.avatarUrl ? (
                <img
                  src={group.avatarUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                getAvatarInitial(group.name)
              )}
            </div>
            <div>
              <h2
                id="group-detail-title"
                className="text-[16px] font-bold text-gray-900"
              >
                {group.name}
              </h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Users className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-[12px] text-gray-500">
                  {group.memberCount ?? 0} thành viên
                </span>
              </div>
            </div>
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
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {/* Description */}
          {group.description && (
            <div>
              <h3 className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Mô tả
              </h3>
              <p className="text-[14px] text-gray-700 leading-relaxed">
                {group.description}
              </p>
            </div>
          )}

          {/* Owner Info */}
          {group.ownerId && (
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="w-9 h-9 rounded-full bg-[#005ae0] flex items-center justify-center text-white text-[13px] font-semibold shrink-0">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[12px] text-gray-500">Người tạo nhóm</p>
                <p className="text-[13px] font-medium text-gray-800">
                  {group.ownerId}
                </p>
              </div>
            </div>
          )}

          {/* Invite Section */}
          <div className="border border-gray-100 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
              <Link2 className="w-4 h-4 text-[#005ae0]" />
              <h3 className="text-[13px] font-semibold text-gray-800">
                Mời thành viên
              </h3>
            </div>

            <div className="p-4 space-y-3">
              {isLoadingInvite ? (
                <div className="flex items-center justify-center py-4">
                  <div className="w-6 h-6 border-2 border-[#005ae0] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : inviteInfo ? (
                <>
                  {/* Invite Code */}
                  <div>
                    <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-2">
                      Mã mời
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg font-mono text-[16px] font-bold text-[#005ae0] tracking-wider text-center select-all">
                        {inviteInfo.inviteCode}
                      </div>
                      <button
                        onClick={handleCopyCode}
                        className="p-2.5 rounded-lg bg-[#005ae0] text-white hover:bg-[#0047b3] transition-colors shrink-0"
                        title="Sao chép mã mời"
                        aria-label="Sao chép mã mời"
                      >
                        {copied ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Invite Link */}
                  {inviteInfo.inviteLink && (
                    <div>
                      <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-2">
                        Liên kết mời
                      </p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-[12px] text-gray-600 truncate select-all">
                          {inviteInfo.inviteLink}
                        </div>
                        <button
                          onClick={handleCopyLink}
                          className="p-2.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors shrink-0"
                          title="Sao chép liên kết"
                          aria-label="Sao chép liên kết"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  <p className="text-[11px] text-gray-400 text-center">
                    Chia sẻ mã hoặc liên kết trên để mời bạn bè tham gia nhóm
                  </p>
                </>
              ) : (
                <p className="text-[13px] text-gray-400 text-center py-2">
                  Không thể tải thông tin mời
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/80 shrink-0">
          <button
            type="button"
            onClick={() => {
              addToast("Tính năng rời nhóm đang phát triển", "info");
            }}
            disabled={isLeaving}
            className="px-4 py-2.5 text-[13px] font-medium rounded-xl text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            Rời nhóm
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-[14px] font-medium rounded-xl bg-[#005ae0] text-white hover:bg-[#0047b3] transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}