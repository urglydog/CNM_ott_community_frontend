"use client";

import { useEffect, useState } from "react";
import { X, Users, Link2, Copy, Check, Shield } from "lucide-react";
import QRCode from "qrcode";
import { useToast } from "../../../contexts/ToastContext";
import { useAuth } from "../../../contexts/AuthContext";
import { useSocket } from "../../../contexts/SocketContext";
import { useGroupsStore } from "../store/groupsStore";
import type { Group, InviteInfo, GroupJoinRequest } from "../types";
import { fetchPendingRequests, updateGroupSettings } from "../api";
import InviteMemberModal from "./InviteMemberModal";
import TransferOwnerModal from "./TransferOwnerModal";

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
  const { user } = useAuth();
  const { socket } = useSocket();
  const {
    selectedGroup,
    setSelectedGroup,
    updateGroup,
    fetchMembers,
    kickMember,
    updateRole,
    leaveGroupAction,
    disbandGroupAction,
    socketAddMember,
    socketRemoveMember,
    socketUpdateRole,
    approveRequest
  } = useGroupsStore();

  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [isLoadingInvite, setIsLoadingInvite] = useState(false);
  const [inviteQrDataUrl, setInviteQrDataUrl] = useState("");
  const [isLoadingInviteQr, setIsLoadingInviteQr] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isDisbanding, setIsDisbanding] = useState(false);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isTransferOwnerModalOpen, setIsTransferOwnerModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"members" | "requests" | "settings">("members");
  const [pendingRequests, setPendingRequests] = useState<GroupJoinRequest[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [requestBadgeCount, setRequestBadgeCount] = useState(0);
  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);

  const members = selectedGroup?.members || [];
  const currentUserId = String(user?.id || user?.userId || "");
  const currentUserRole = members.find((m) => String(m.userId) === currentUserId)?.role;
  const needsApproval = selectedGroup?.isApprovalRequired ?? group.isApprovalRequired ?? false;
  const allowSendLinks = selectedGroup?.allowSendLinks ?? group.allowSendLinks ?? 'ALL';
  const spamFilterLevel = selectedGroup?.spamFilterLevel ?? group.spamFilterLevel ?? 1;

  useEffect(() => {
    setIsLoadingMembers(true);
    fetchMembers(group.groupId).finally(() => {
      setIsLoadingMembers(false);
    });
  }, [group.groupId, fetchMembers]);

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

  useEffect(() => {
    if (!inviteInfo?.inviteLink) {
      setInviteQrDataUrl("");
      setIsLoadingInviteQr(false);
      return;
    }

    let mounted = true;
    setIsLoadingInviteQr(true);

    QRCode.toDataURL(inviteInfo.inviteLink, {
      width: 220,
      margin: 2,
      color: {
        dark: "#000000ff",
        light: "#ffffffff",
      },
      errorCorrectionLevel: "H",
    })
      .then((dataUrl) => {
        if (mounted) {
          setInviteQrDataUrl(dataUrl);
        }
      })
      .catch(() => {
        if (mounted) {
          setInviteQrDataUrl("");
        }
      })
      .finally(() => {
        if (mounted) {
          setIsLoadingInviteQr(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [inviteInfo?.inviteLink]);

  useEffect(() => {
    if (currentUserRole === 'OWNER' || currentUserRole === 'DEPUTY') {
      if (!needsApproval) {
        setPendingRequests([]);
        setRequestBadgeCount(0);
        return;
      }
      setIsLoadingRequests(true);
      fetchPendingRequests(group.groupId)
        .then((res) => {
          setPendingRequests(res);
          setRequestBadgeCount(res.length);
        })
        .finally(() => setIsLoadingRequests(false));
    }
  }, [group.groupId, currentUserRole, needsApproval]);

  useEffect(() => {
    if (!socket) return;
    
    const handleMemberAdded = (data: any) => {
      // Backend send: { groupId, newMembers: userIds, addedBy }
      // The modal doesn't have the user objects, so we need to fetch them
      fetchMembers(group.groupId);
      addToast("Thành viên mới đã tham gia nhóm", "info");
    };
    
    const handleMemberRemoved = (data: any) => {
      // Backend send: { groupId, removedMember, kickedBy }
      if (data.removedMember) socketRemoveMember(data.removedMember);
      addToast("Ai đó đã bị mời ra khỏi nhóm", "info");
    };
    
    const handleRoleUpdated = (data: any) => {
      if (data.userId && data.role) socketUpdateRole(data.userId, data.role);
    };
    
    const handleMemberLeft = (data: any) => {
      // Backend send: { groupId, leftMember }
      if (data.leftMember) socketRemoveMember(data.leftMember);
      addToast("Một người đã rời nhóm", "info");
    };
    
    const handleGroupDisbanded = () => {
      addToast("Nhóm đã bị giải tán", "error");
      onClose(); // Đóng modal và thoát ra
    };

    const handleNewJoinRequest = () => {
      if (currentUserRole === 'OWNER' || currentUserRole === 'DEPUTY') {
        setRequestBadgeCount(prev => prev + 1);
        fetchPendingRequests(group.groupId).then((res) => {
          setPendingRequests(res);
          setRequestBadgeCount(res.length);
        });
      }
    };

    socket.on("group:members_added", handleMemberAdded);
    socket.on("group:member_removed", handleMemberRemoved);
    socket.on("SERVER:ROLE_UPDATED", handleRoleUpdated); // Keep this if you have it
    socket.on("group:member_left", handleMemberLeft);
    socket.on("group:deleted", handleGroupDisbanded);
    socket.on("SERVER:NEW_JOIN_REQUEST", handleNewJoinRequest);

    return () => {
      socket.off("group:members_added", handleMemberAdded);
      socket.off("group:member_removed", handleMemberRemoved);
      socket.off("SERVER:ROLE_UPDATED", handleRoleUpdated);
      socket.off("group:member_left", handleMemberLeft);
      socket.off("group:deleted", handleGroupDisbanded);
      socket.off("SERVER:NEW_JOIN_REQUEST", handleNewJoinRequest);
    };
  }, [
    socket,
    fetchMembers,
    socketAddMember,
    socketRemoveMember,
    socketUpdateRole,
    addToast,
    onClose,
    currentUserRole,
    group.groupId
  ]);

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

  const handleLeaveGroup = async () => {
    try {
      setIsLeaving(true);
      await leaveGroupAction(group.groupId);
      addToast("Bạn đã rời nhóm", "success");
      onClose();
    } catch (err: any) {
      addToast("Lỗi rời nhóm: " + err.message, "error");
    } finally {
      setIsLeaving(false);
    }
  };

  const handleLeaveGroupClick = () => {
    if (currentUserRole === 'OWNER' && members.length > 1) {
      setIsTransferOwnerModalOpen(true);
    } else {
      handleLeaveGroup();
    }
  };

  const handleConfirmTransferLeave = async (newOwnerId: string) => {
    try {
      setIsLeaving(true);
      await leaveGroupAction(group.groupId, newOwnerId);
      addToast("Bạn đã rời nhóm và chuyển quyền Trưởng nhóm", "success");
      setIsTransferOwnerModalOpen(false);
      onClose();
    } catch (err: any) {
      addToast("Lỗi rời nhóm: " + err.message, "error");
      setIsLeaving(false);
    }
  };

  const handleDisbandGroup = async () => {
    if (!confirm("Bạn có chắc chắn muốn giải tán nhóm này?")) return;
    try {
      setIsDisbanding(true);
      await disbandGroupAction(group.groupId);
      addToast("Đã giải tán nhóm thành công", "success");
      onClose();
    } catch (err: any) {
      addToast("Lỗi giải tán nhóm: " + err.message, "error");
    } finally {
      setIsDisbanding(false);
    }
  };

  const handleRejectReq = async (userId: string) => {
    try {
      await approveRequest(group.groupId, userId, "REJECT");
      setPendingRequests(prev => prev.filter(r => String(r.userId) !== String(userId)));
      setRequestBadgeCount(prev => Math.max(0, prev - 1));
      addToast("Đã từ chối yêu cầu tham gia", "success");
    } catch (err: any) {
      addToast("Lỗi từ chối: " + err.message, "error");
    }
  };

  const handleApproveReq = async (userId: string) => {
    try {
      await approveRequest(group.groupId, userId, "APPROVE");
      setPendingRequests(prev => prev.filter(r => String(r.userId) !== String(userId)));
      setRequestBadgeCount(prev => Math.max(0, prev - 1));
      addToast("Đã duyệt yêu cầu tham gia", "success");
    } catch (err: any) {
      addToast("Lỗi duyệt yêu cầu: " + err.message, "error");
    }
  };

  const handleToggleApproval = async () => {
    const nextValue = !needsApproval;
    try {
      setIsUpdatingSettings(true);
      await updateGroupSettings(group.groupId, { isApprovalRequired: nextValue });
      updateGroup(group.groupId, { isApprovalRequired: nextValue });
      if (selectedGroup) {
        setSelectedGroup({ ...selectedGroup, isApprovalRequired: nextValue });
      }
      if (!nextValue) {
        setPendingRequests([]);
        setRequestBadgeCount(0);
        if (activeTab === "requests") setActiveTab("members");
      }
      addToast("Đã cập nhật cài đặt nhóm", "success");
    } catch (err: any) {
      addToast("Lỗi cập nhật cài đặt: " + err.message, "error");
    } finally {
      setIsUpdatingSettings(false);
    }
  };

  const handleToggleAllowSendLinks = async () => {
    const nextValue = allowSendLinks === 'ALL' ? 'ADMINS_ONLY' : 'ALL';
    try {
      setIsUpdatingSettings(true);
      await updateGroupSettings(group.groupId, { allowSendLinks: nextValue });
      updateGroup(group.groupId, { allowSendLinks: nextValue });
      if (selectedGroup) {
        setSelectedGroup({ ...selectedGroup, allowSendLinks: nextValue });
      }
      addToast("Đã cập nhật cài đặt nhóm", "success");
    } catch (err: any) {
      addToast("Lỗi cập nhật cài đặt: " + err.message, "error");
    } finally {
      setIsUpdatingSettings(false);
    }
  };

  const handleUpdateSpamFilter = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextValue = Number(e.target.value);
    try {
      setIsUpdatingSettings(true);
      await updateGroupSettings(group.groupId, { spamFilterLevel: nextValue });
      updateGroup(group.groupId, { spamFilterLevel: nextValue });
      if (selectedGroup) {
        setSelectedGroup({ ...selectedGroup, spamFilterLevel: nextValue });
      }
      addToast("Đã cập nhật mức độ lọc Spam", "success");
    } catch (err: any) {
      addToast("Lỗi cập nhật cài đặt: " + err.message, "error");
    } finally {
      setIsUpdatingSettings(false);
    }
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
          {/* Default Info (Mobile/Compact) */}
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

          {/* TABS HEADER */}
          <div className="flex flex-col mb-4">
            <div className="flex items-center gap-6 border-b border-gray-100">
              <button
                className={`pb-2 text-[13px] font-semibold transition-colors relative ${activeTab === 'members' ? 'text-[#005ae0]' : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => setActiveTab('members')}
              >
                Thành viên ({members.length})
                {activeTab === 'members' && (
                  <span className="absolute bottom-0 left-0 w-full h-[2px] bg-[#005ae0] rounded-t-full" />
                )}
              </button>
              
              {(currentUserRole === 'OWNER' || currentUserRole === 'DEPUTY') && (
                <button
                  className={`pb-2 text-[13px] font-semibold transition-colors flex items-center gap-1 relative ${activeTab === 'requests' ? 'text-[#005ae0]' : 'text-gray-500 hover:text-gray-700'}`}
                  onClick={() => setActiveTab('requests')}
                >
                  Yêu cầu duyệt
                  {requestBadgeCount > 0 && (
                    <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-1">{requestBadgeCount}</span>
                  )}
                  {activeTab === 'requests' && (
                    <span className="absolute bottom-0 left-0 w-full h-[2px] bg-[#005ae0] rounded-t-full" />
                  )}
                </button>
              )}
              {currentUserRole === 'OWNER' && (
                <button
                  className={`pb-2 text-[13px] font-semibold transition-colors relative ${activeTab === 'settings' ? 'text-[#005ae0]' : 'text-gray-500 hover:text-gray-700'}`}
                  onClick={() => setActiveTab('settings')}
                >
                  Cài đặt
                  {activeTab === 'settings' && (
                    <span className="absolute bottom-0 left-0 w-full h-[2px] bg-[#005ae0] rounded-t-full" />
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Members List Tab */}
          {activeTab === 'members' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide mb-0">
                Thành viên ({members.length})
              </h3>
              {currentUserRole && (
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(true)}
                  className="text-[12px] font-medium text-[#005ae0] hover:bg-[#005ae0]/10 px-2 py-1 rounded transition-colors"
                >
                  + Thêm thành viên
                </button>
              )}
            </div>
            {isLoadingMembers ? (
               <div className="flex justify-center py-4">
                 <div className="w-6 h-6 border-2 border-[#005ae0] border-t-transparent rounded-full animate-spin" />
               </div>
            ) : (
               <div className="space-y-2">
                 {members.map((member) => {
                   const isMe = String(member.userId) === currentUserId;
                   return (
                     <div key={member.userId} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg group text-sm">
                       
                       {/* ==========================================
                           PHẦN 1: AI CŨNG NHÌN THẤY (Avatar, Tên, Badge) 
                           ========================================== */}
                       <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center shrink-0 overflow-hidden text-gray-600 font-bold">
                           {member.avatarUrl ? (
                             <img src={member.avatarUrl} alt="" className="w-full h-full object-cover" />
                           ) : (
                             getAvatarInitial(member.displayName || member.username)
                           )}
                         </div>
                         <div className="flex flex-col">
                           <span className="font-medium text-gray-800">
                             {member.displayName || member.username} {isMe ? "(Bạn)" : ""}
                           </span>
                           
                           {/* HIỂN THỊ BADGE: Chỉ phụ thuộc vào member.role */}
                           <div className="flex gap-2 mt-0.5">
                             {member.role === 'OWNER' && (
                               <span className="text-[10px] bg-amber-100 text-amber-700 font-semibold px-1.5 py-0.5 rounded">Trưởng nhóm</span>
                             )}
                             {member.role === 'DEPUTY' && (
                               <span className="text-[10px] bg-blue-100 text-blue-700 font-semibold px-1.5 py-0.5 rounded">Phó nhóm</span>
                             )}
                           </div>
                         </div>
                       </div>

                       {/* ==========================================
                           PHẦN 2: NÚT THAO TÁC (Bị giới hạn quyền) 
                           ========================================== */}
                       {!isMe && (
                         <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                           {/* 1. Nếu người đang xem là OWNER -> Thấy mọi nút (Menu gán quyền, Xóa) */}
                           {currentUserRole === 'OWNER' && (
                             <>
                               <button
                                 onClick={() => updateRole(group.groupId, member.userId, member.role === 'DEPUTY' ? 'MEMBER' : 'DEPUTY')}
                                 className="text-[12px] text-[#005ae0] hover:underline"
                               >
                                 {member.role === 'DEPUTY' ? 'Gỡ Phó nhóm' : 'Gán Phó nhóm'}
                               </button>
                               <button
                                 onClick={() => kickMember(group.groupId, member.userId)}
                                 className="text-[12px] text-red-600 hover:underline"
                               >
                                 Xóa khỏi nhóm
                               </button>
                             </>
                           )}

                           {/* 2. Nếu người đang xem là DEPUTY -> Chỉ được xóa MEMBER */}
                           {currentUserRole === 'DEPUTY' && member.role === 'MEMBER' && (
                             <button
                               onClick={() => kickMember(group.groupId, member.userId)}
                               className="text-[12px] text-red-600 hover:underline"
                             >
                               Xóa khỏi nhóm
                             </button>
                           )}
                         </div>
                       )}
                       
                     </div>
                   );
                 })}
               </div>
            )}
          </div>
          )}

          {activeTab === 'settings' && currentUserRole === 'OWNER' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg border border-gray-100">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-gray-500" />
                  <div>
                    <div className="text-[13px] font-medium text-gray-800">Phê duyệt thành viên mới</div>
                    <div className="text-[12px] text-gray-500">Bật để yêu cầu duyệt trước khi vào nhóm</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleToggleApproval}
                  disabled={isUpdatingSettings}
                  aria-pressed={needsApproval}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${needsApproval ? 'bg-[#005ae0]' : 'bg-gray-200'} ${isUpdatingSettings ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${needsApproval ? 'translate-x-5' : 'translate-x-1'}`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border border-gray-100">
                <div className="flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-gray-500" />
                  <div>
                    <div className="text-[13px] font-medium text-gray-800">Chặn thành viên gửi liên kết (Link)</div>
                    <div className="text-[12px] text-gray-500">Chỉ cho phép Trưởng/Phó nhóm gửi link</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleToggleAllowSendLinks}
                  disabled={isUpdatingSettings}
                  aria-pressed={allowSendLinks === 'ADMINS_ONLY'}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${allowSendLinks === 'ADMINS_ONLY' ? 'bg-[#005ae0]' : 'bg-gray-200'} ${isUpdatingSettings ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${allowSendLinks === 'ADMINS_ONLY' ? 'translate-x-5' : 'translate-x-1'}`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border border-gray-100">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-gray-500" />
                  <div>
                    <div className="text-[13px] font-medium text-gray-800">Mức độ lọc Spam</div>
                    <div className="text-[12px] text-gray-500">Chọn mức độ kiểm duyệt nội dung tin nhắn</div>
                  </div>
                </div>
                <select
                  value={spamFilterLevel}
                  onChange={handleUpdateSpamFilter}
                  disabled={isUpdatingSettings}
                  className="text-[13px] bg-gray-50 border border-gray-200 rounded-md px-2 py-1 outline-none focus:border-[#005ae0]"
                >
                  <option value={0}>Tắt (Không lọc)</option>
                  <option value={1}>Vừa (Tiêu chuẩn)</option>
                  <option value={2}>Gắt gao (Chặn mạnh)</option>
                </select>
              </div>
            </div>
          )}

          {/* Requests Tab */}
          {activeTab === 'requests' && (currentUserRole === 'OWNER' || currentUserRole === 'DEPUTY') && (
            <div>
              <h3 className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Danh sách chờ duyệt
              </h3>
              {!needsApproval ? (
                <div className="text-[13px] text-gray-600 bg-gray-50 border border-gray-100 rounded-lg p-3">
                  Nhóm hiện đang ở chế độ công khai.
                </div>
              ) : isLoadingRequests ? (
                <div className="flex justify-center py-4">
                  <div className="w-6 h-6 border-2 border-[#005ae0] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : pendingRequests.length === 0 ? (
                <p className="text-center text-sm text-gray-500 py-6">Không có yêu cầu nào</p>
              ) : (
                <div className="space-y-2">
                  {pendingRequests.map((req) => (
                    <div key={req.userId} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg group text-sm border-b border-gray-50 last:border-0">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center shrink-0 overflow-hidden text-gray-600 font-bold">
                          {req.avatarUrl ? (
                            <img src={req.avatarUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            getAvatarInitial(req.displayName)
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-800">
                            {req.displayName}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            Xin vào lúc: {new Date(req.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleApproveReq(req.userId)}
                          className="px-2 py-1 text-[11px] font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors"
                        >
                          Chấp nhận
                        </button>
                        <button
                          onClick={() => handleRejectReq(req.userId)}
                          className="px-2 py-1 text-[11px] font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
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

                  <div>
                    <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-2">
                      Mã QR tham gia nhóm
                    </p>
                    <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-gray-50 p-4">
                      {isLoadingInviteQr ? (
                        <div className="flex h-[220px] w-[220px] items-center justify-center">
                          <div className="w-8 h-8 border-2 border-[#005ae0] border-t-transparent rounded-full animate-spin" />
                        </div>
                      ) : inviteQrDataUrl ? (
                        <img
                          src={inviteQrDataUrl}
                          alt="QR tham gia nhóm"
                          className="h-[220px] w-[220px] object-contain"
                        />
                      ) : (
                        <div className="flex h-[220px] w-[220px] items-center justify-center text-center text-[13px] text-gray-400">
                          Không thể tạo mã QR
                        </div>
                      )}
                    </div>
                  </div>

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
        <div className="flex justify-between items-center px-6 py-4 border-t border-gray-100 bg-gray-50/80 shrink-0">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleLeaveGroupClick}
              disabled={isLeaving}
              className="px-4 py-2 text-[13px] font-medium rounded-lg text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Rời nhóm
            </button>
            {currentUserRole === 'OWNER' && (
              <button
                type="button"
                onClick={handleDisbandGroup}
                disabled={isDisbanding}
                className="px-4 py-2 text-[13px] font-medium rounded-lg text-red-600 bg-white border border-red-200 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                Giải tán nhóm
              </button>
            )}
          </div>
          
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-[14px] font-medium rounded-xl bg-[#005ae0] text-white hover:bg-[#0047b3] transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>

      {/* Tích hợp Modal Mời bạn bè */}
      {isInviteModalOpen && (
        <InviteMemberModal
          group={group}
          currentMembers={members}
          onClose={() => setIsInviteModalOpen(false)}
        />
      )}

      {/* Modal Chuyển Quyền & Rời Nhóm */}
      {isTransferOwnerModalOpen && (
        <TransferOwnerModal
          group={group}
          currentMembers={members}
          currentUserId={currentUserId}
          onClose={() => setIsTransferOwnerModalOpen(false)}
          onConfirm={handleConfirmTransferLeave}
          isLoading={isLeaving}
        />
      )}
    </div>
  );
}