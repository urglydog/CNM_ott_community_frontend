"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  X, Search, User, Image as ImageIcon, BellOff, Bell,
  Pencil, Star, BookOpen, Users, UserPlus, ArrowRight,
  Pin, EyeOff, Phone, Settings, Clock, AlertTriangle,
  Lock, Database, Trash2, ChevronRight, Loader2, Check, Upload, Camera, UserMinus,
} from "lucide-react";
import QRCode from "qrcode";
import { useRouter } from "next/navigation";
import { useChatStore } from "../store/chatStore";
import { useGroupsStore } from "../../groups/store/groupsStore";
import { useToast } from "../../../contexts/ToastContext";
import { useSocket } from "../../../contexts/SocketContext";
import { createGroup, addMemberToGroup, fetchGroupInvite } from "../../groups/api";
import type { GroupChatMessage } from "../hooks/useGroupChat";
import {
  unfriend,
  updateFriendNickname,
  updateChatBackground as apiUpdateChatBackground,
  getChatBackground as apiGetChatBackground,
  uploadFileDirect,
  getPresignedViewUrl,
} from "../../../api/client";
import type { AuthUser, FriendItem } from "../../../types";
import type { Group, GroupMember, InviteInfo } from "../../groups/types";
import { GroupAvatar } from "./Avatar";

// ── Preset backgrounds ──────────────────────────────────────────────────
const PRESET_BACKGROUNDS = [
  { label: "Mặc định", url: "" },
  { label: "Thiên nhiên 1", url: "/chat-backgrounds/hinh-nen-4k-thien-nhien-dep.jpg" },
  { label: "Chú chó", url: "/chat-backgrounds/Hinh-anh-hinh-nen-con-cho-1.jpg" },
  { label: "Phong cảnh", url: "/chat-backgrounds/bg_02.jpg" },
  { label: "Hoàng hôn", url: "/chat-backgrounds/bg_03.jpg" },
  { label: "Desktop", url: "/chat-backgrounds/hinh-nen-desktop-4k-scaled.jpg" },
  { label: "Tím", url: "/chat-backgrounds/bg-purple.svg" },
  { label: "Xanh hồng", url: "/chat-backgrounds/bg-teal-pink.svg" },
  { label: "Hồng xanh", url: "/chat-backgrounds/bg-pink-blue.svg" },
  { label: "Bầu trời", url: "/chat-backgrounds/bg-sky.svg" },
  { label: "Xanh lá", url: "/chat-backgrounds/bg-green.svg" },
  { label: "Tối", url: "/chat-backgrounds/bg-dark.svg" },
];

// ── localStorage helpers for non-persisted settings ─────────────────────
const SETTINGS_PREFIX = "ott_chat_settings_v1";
function getLocalKey(myId: string, friendId: string) {
  return `${SETTINGS_PREFIX}:${myId}:${friendId}`;
}
interface LocalSettings {
  isPinned?: boolean;
  isHidden?: boolean;
  isMuted?: boolean;
  callNotify?: boolean;
  isBestFriend?: boolean;
}
function loadLocal(myId: string, friendId: string): LocalSettings {
  try {
    const raw = localStorage.getItem(getLocalKey(myId, friendId));
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}
function saveLocal(myId: string, friendId: string, s: LocalSettings) {
  try { localStorage.setItem(getLocalKey(myId, friendId), JSON.stringify(s)); } catch {}
}

// ── Props ────────────────────────────────────────────────────────────────
interface ChatSettingsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  selectedFriend: FriendItem | null;
  selectedGroup?: Group | null;
  groupMembers?: GroupMember[];
  groupMessages?: GroupChatMessage[];
  isGroupMessagesLoading?: boolean;
  authUser: AuthUser;
  onSearchMessages?: () => void;
  onBackgroundChange?: (bgUrl: string | null) => void;
  resolveDisplayAvatar?: (rawUrl: string | null | undefined) => string | null;
  onOpenGroupSettings?: () => void;
  onJumpToMessage?: (messageId: string | number) => void;
}


// ── Main Component ──────────────────────────────────────────────────────
export default function ChatSettingsSidebar({
  isOpen,
  onClose,
  selectedFriend,
  selectedGroup,
  groupMembers = [],
  groupMessages = [],
  isGroupMessagesLoading = false,
  authUser,
  onSearchMessages,
  onBackgroundChange,
  resolveDisplayAvatar,
  onOpenGroupSettings,
  onJumpToMessage,
}: ChatSettingsSidebarProps) {

  const router = useRouter();
  const { addToast } = useToast();
  const socketCtx = useSocket();
  const socket = socketCtx?.socket;
  const emitSendMessage = socketCtx?.emitSendMessage;
  
  const { friends, setSelectedGroup, setSelectedFriend, setFriends } = useChatStore();
  const { myGroups } = useGroupsStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const myId = String((authUser as any)._id || authUser.id || "");
  const friendId = selectedFriend?.friend_id ?? "";
  const friendshipId = selectedFriend?.friendshipId ?? "";
  const friendName = selectedFriend?.friend_display_name || selectedFriend?.friend_username || "Người dùng";
  const originalName = (selectedFriend as any)?.friend_original_name || selectedFriend?.friend_username || friendName;
  const avatarUrl = selectedFriend?.friend_avatar_url;
  const isGroupChat = !!selectedGroup;
  const groupName = selectedGroup?.name || "Nhóm trò chuyện";
  const currentUserRole = groupMembers.find((member) => String(member.userId) === myId)?.role;
  const isGroupOwner = currentUserRole === "OWNER";
  const isGroupDeputy = currentUserRole === "DEPUTY";
  const canManageGroup = isGroupOwner || isGroupDeputy;
  const groupMemberCount = groupMembers.length || selectedGroup?.memberCount || 0;
  const groupMediaItems = groupMessages.filter((message) => {
    if (message.contentType === "image" || message.contentType === "video") {
      return true;
    }

    if (!Array.isArray(message.attachments) || message.attachments.length === 0) {
      return false;
    }

    return message.attachments.some((attachment) => attachment?.type === "image" || attachment?.type === "video");
  });

  const getGroupMediaPreview = (message: GroupChatMessage) => {
    const attachment = message.attachments?.find((item) => item?.type === "image" || item?.type === "video") ?? message.attachments?.[0];

    return {
      type: attachment?.type === "video" || message.contentType === "video" ? "video" : "image",
      previewUrl: attachment?.thumbnailUrl || attachment?.url || "",
      mediaUrl: attachment?.url || "",
      fileName: attachment?.name || message.content || "Đính kèm",
    };
  };

  const groupFileItems = groupMessages.filter((message) => {
    if (message.contentType === "file" || message.contentType === "document") {
      return true;
    }

    if (!Array.isArray(message.attachments) || message.attachments.length === 0) {
      return false;
    }

    return message.attachments.some((attachment) => attachment?.type === "file" || attachment?.type === "document");
  });

  const getGroupFileDetails = (message: GroupChatMessage) => {
    const attachment = message.attachments?.find((item) => item?.type === "file" || item?.type === "document") ?? message.attachments?.[0];
    return {
      name: attachment?.name || message.content || "Tệp đính kèm",
      url: attachment?.url || "",
      size: attachment?.size ? `${(attachment.size / 1024).toFixed(1)} KB` : "Chưa rõ dung lượng",
    };
  };

  // ── State ──────────────────────────────────────────────────────────
  const [localSettings, setLocalSettings] = useState<LocalSettings>({});
  const [nicknameEditing, setNicknameEditing] = useState(false);
  const [nicknameValue, setNicknameValue] = useState("");
  
  // ── Web Lightbox và Web Media Gallery Modal states ──────────────────
  const [webViewerImage, setWebViewerImage] = useState<any | null>(null);
  const [showWebGallery, setShowWebGallery] = useState(false);
  const [galleryTab, setGalleryTab] = useState<'Ảnh' | 'File' | 'Link'>('Ảnh');

  // Lọc link items cho Web giống mobile
  const groupLinkItems = groupMessages.filter((m) => {
    const type = m.contentType;
    if (type === "text" && m.content) {
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      return urlRegex.test(m.content);
    }
    return false;
  }).flatMap((m) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const match = m.content.match(urlRegex) || [];
    return match.map((url) => {
      let domain = "LINK";
      try {
        domain = new URL(url).hostname.toUpperCase();
      } catch {}
      return {
        id: `${m.id}-${url}`,
        url,
        name: m.content.length > 60 ? m.content.substring(0, 60) + "..." : m.content,
        senderName: m.senderDisplayName || "Thành viên",
        createdAt: m.createdAt,
        linkDomain: domain,
      };
    });
  });
  const [nicknameSaving, setNicknameSaving] = useState(false);
  const [showBgPicker, setShowBgPicker] = useState(false);
  const [currentBgUrl, setCurrentBgUrl] = useState<string | null>(null);
  const [pendingBgUrl, setPendingBgUrl] = useState<string | null>(null);
  const [originalBgUrl, setOriginalBgUrl] = useState<string | null>(null);
  const [resolvedBgUrls, setResolvedBgUrls] = useState<Record<string, string>>({});
  const [bgSaving, setBgSaving] = useState(false);
  const [bothSides, setBothSides] = useState(true);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showAddToGroup, setShowAddToGroup] = useState(false);
  const [showCommonGroups, setShowCommonGroups] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [addingToGroup, setAddingToGroup] = useState<string | null>(null);
  const [confirmClearHistory, setConfirmClearHistory] = useState(false);
  const [confirmUnfriend, setConfirmUnfriend] = useState(false);
  const [groupInviteInfo, setGroupInviteInfo] = useState<InviteInfo | null>(null);
  const [groupInviteLoading, setGroupInviteLoading] = useState(false);
  const [groupQrDataUrl, setGroupQrDataUrl] = useState<string>("");
  const [groupQrLoading, setGroupQrLoading] = useState(false);

  // Load settings when friend changes / sidebar opens
  useEffect(() => {
    if (!friendId || !myId || !isOpen) return;
    setLocalSettings(loadLocal(myId, friendId));
    setNicknameValue((selectedFriend as any)?.nickname || "");
    setNicknameEditing(false);
    setShowBgPicker(false);
    setShowCreateGroup(false);
    setShowAddToGroup(false);
    setShowCommonGroups(false);
    setConfirmClearHistory(false);
    setConfirmUnfriend(false);
    setBothSides(true);

    // Load chat background from API
    if (friendshipId) {
      apiGetChatBackground(friendshipId)
        .then(res => {
          setCurrentBgUrl(res.chatBgUrl);
          setPendingBgUrl(res.chatBgUrl);
        })
        .catch(() => {});
    }
  }, [friendId, myId, isOpen, friendshipId, selectedFriend]);

    useEffect(() => {
      if (!isOpen || !selectedGroup) {
        setGroupInviteInfo(null);
        setGroupInviteLoading(false);
        setGroupQrDataUrl("");
        setGroupQrLoading(false);
        return;
      }

      let mounted = true;
      setGroupInviteLoading(true);

      fetchGroupInvite(selectedGroup.groupId)
        .then((invite) => {
          if (mounted) {
            setGroupInviteInfo(invite);
          }
        })
        .catch(() => {
          if (mounted) {
            setGroupInviteInfo(null);
          }
        })
        .finally(() => {
          if (mounted) {
            setGroupInviteLoading(false);
          }
        });

      return () => {
        mounted = false;
      };
    }, [isOpen, selectedGroup]);

  useEffect(() => {
    if (!groupInviteInfo?.inviteLink) {
      setGroupQrDataUrl("");
      setGroupQrLoading(false);
      return;
    }

    let mounted = true;
    setGroupQrLoading(true);

    QRCode.toDataURL(groupInviteInfo.inviteLink, {
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
          setGroupQrDataUrl(dataUrl);
        }
      })
      .catch(() => {
        if (mounted) {
          setGroupQrDataUrl("");
        }
      })
      .finally(() => {
        if (mounted) {
          setGroupQrLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [groupInviteInfo?.inviteLink]);

  useEffect(() => {
    if (isOpen) {
      setOriginalBgUrl(currentBgUrl);
      setPendingBgUrl(currentBgUrl);
    }
  }, [isOpen, currentBgUrl]);

  // ── Handle presigned URLs for S3 backgrounds ──────────────────────
  useEffect(() => {
    const s3Urls = new Set<string>();
    if (currentBgUrl && currentBgUrl.includes(".amazonaws.com")) s3Urls.add(currentBgUrl);
    if (pendingBgUrl && pendingBgUrl.includes(".amazonaws.com")) s3Urls.add(pendingBgUrl);

    const candidates = Array.from(s3Urls).filter(url => !resolvedBgUrls[url]);
    if (candidates.length === 0) return;

    Promise.all(candidates.map(async url => {
      try {
        const res = await getPresignedViewUrl({ url });
        return { url, signed: res.viewUrl };
      } catch { return { url, signed: url }; }
    })).then(results => {
      const newMap = { ...resolvedBgUrls };
      results.forEach(r => { newMap[r.url] = r.signed || r.url; });
      setResolvedBgUrls(newMap);
    });
  }, [currentBgUrl, pendingBgUrl, resolvedBgUrls]);

  const resolveBg = (url: string | null) => {
    if (!url) return "";
    if (!url.includes(".amazonaws.com")) return url;
    return resolvedBgUrls[url] || url;
  };

  const updateLocal = useCallback((patch: Partial<LocalSettings>) => {
    setLocalSettings(prev => {
      const next = { ...prev, ...patch };
      saveLocal(myId, friendId, next);
      return next;
    });
  }, [myId, friendId]);

  // ── Nickname handlers ─────────────────────────────────────────────
  async function handleSaveNickname() {
    if (nicknameSaving || !friendshipId) return;
    setNicknameSaving(true);
    try {
      const nick = nicknameValue.trim() || null;
      await updateFriendNickname({ friendshipId, nickname: nick });

      // Update the friend in the store so the sidebar list shows the new name
      const updatedFriends = friends.map(f => {
        if (f.friendshipId === friendshipId) {
          return {
            ...f,
            friend_display_name: nick || (f as any).friend_original_name || f.friend_username,
            nickname: nick,
          };
        }
        return f;
      });
      setFriends(updatedFriends);

      // Also update the selectedFriend in the store
      if (selectedFriend && selectedFriend.friendshipId === friendshipId) {
        setSelectedFriend({
          ...selectedFriend,
          friend_display_name: nick || (selectedFriend as any).friend_original_name || selectedFriend.friend_username,
          nickname: nick,
        } as any);
      }

      setNicknameEditing(false);
      addToast(nick ? `Đã đặt tên gợi nhớ: ${nick}` : "Đã xóa tên gợi nhớ", "success");
    } catch (err: any) {
      addToast(err?.message || "Không thể cập nhật tên gợi nhớ", "error");
    } finally {
      setNicknameSaving(false);
    }
  }

  // ── Background handlers ───────────────────────────────────────────
  function handleSelectBackground(bgUrl: string) {
    const nextUrl = bgUrl || null;
    setPendingBgUrl(nextUrl);
    // Apply preview immediately for the sender
    onBackgroundChange?.(nextUrl);
  }

  const handleCancelBg = useCallback(() => {
    // Revert to original background
    onBackgroundChange?.(originalBgUrl);
    setPendingBgUrl(originalBgUrl);
    setShowBgPicker(false);
  }, [originalBgUrl, onBackgroundChange]);

  const handleClose = useCallback(() => {
    // If we were picking background but didn't save, revert
    if (showBgPicker && pendingBgUrl !== originalBgUrl) {
      onBackgroundChange?.(originalBgUrl);
    }
    onClose();
  }, [onClose, showBgPicker, pendingBgUrl, originalBgUrl, onBackgroundChange]);

  async function handleApplyBackground() {
    if (bgSaving || !friendshipId) return;
    setBgSaving(true);
    try {
      await apiUpdateChatBackground({ friendshipId, bgUrl: pendingBgUrl, bothSides });
      setCurrentBgUrl(pendingBgUrl);
      
      // Gửi system message qua socket để lưu vào DB & hiển thị ở list tin nhắn
      const roomId = `dm:${[Number(myId), Number(friendId)].sort((a, b) => a - b).join(":")}`;
      if (emitSendMessage) {
        await emitSendMessage(roomId, "Hình nền đã được thay đổi", "system");
      }



      // Phát sự kiện socket riêng để bên kia cập nhật background ngay lập tức mà không cần load lại
      if (bothSides) {
        socket?.emit("chat_background_updated", {
          friendshipId,
          bgUrl: pendingBgUrl,
          senderId: myId,
          receiverId: friendId
        });
      }

      setOriginalBgUrl(pendingBgUrl);
      setShowBgPicker(false);
      addToast("Đã cập nhật hình nền", "success");
    } catch (err: any) {
      addToast(err?.message || "Không thể lưu hình nền", "error");
    } finally {
      setBgSaving(false);
    }
  }

  function handleUploadBackground() {
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (bgSaving || !friendshipId) return;
    setBgSaving(true);
    try {
      // Upload lên S3 qua API có sẵn
      const result = await uploadFileDirect(file, "chat-backgrounds");
      const s3Url = result.url;
      
      setPendingBgUrl(s3Url);
      // Preview ngay
      onBackgroundChange?.(s3Url);
      
      addToast("Đã tải ảnh lên, nhấn Xong để lưu", "info");
    } catch (err: any) {
      addToast(err?.message || "Không thể tải ảnh nền lên", "error");
    } finally {
      setBgSaving(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // ── Group handlers ────────────────────────────────────────────────
  async function handleCreateGroupWithFriend() {
    if (creatingGroup) return;
    setCreatingGroup(true);
    try {
      const group = await createGroup({ name: `${authUser.displayName}, ${friendName}` });
      await addMemberToGroup(group.groupId, friendId);
      addToast(`Đã tạo nhóm với ${friendName}`, "success");
      setShowCreateGroup(false);
    } catch (err: any) {
      addToast(err?.message || "Không thể tạo nhóm", "error");
    } finally {
      setCreatingGroup(false);
    }
  }

  async function handleAddFriendToGroup(group: Group) {
    const gid = String(group.groupId);
    if (addingToGroup) return;
    setAddingToGroup(gid);
    try {
      await addMemberToGroup(group.groupId, friendId);
      addToast(`Đã thêm ${friendName} vào ${group.name}`, "success");
    } catch (err: any) {
      addToast(err?.message || "Không thể thêm vào nhóm", "error");
    } finally {
      setAddingToGroup(null);
    }
  }

  function handleClearHistory() {
    addToast("Đã xóa lịch sử trò chuyện phía bạn", "success");
    setConfirmClearHistory(false);
  }

  async function handleUnfriend() {
    if (!friendshipId) return;

    try {
      await unfriend(friendshipId);
      setFriends(friends.filter((friend) => friend.friendshipId !== friendshipId));
      setSelectedFriend(null);
      setConfirmUnfriend(false);
      onClose();
      addToast(`Đã hủy kết bạn với ${friendName}`, "success");
    } catch (err: any) {
      addToast(err?.message || "Không thể hủy kết bạn", "error");
    }
  }

  const handleCopyGroupInvite = useCallback(
    async (value: string | null | undefined, successMessage: string) => {
      if (!value) {
        addToast("Chưa có dữ liệu để sao chép", "error");
        return;
      }

      try {
        await navigator.clipboard.writeText(value);
        addToast(successMessage, "success");
      } catch {
        addToast("Không thể sao chép liên kết", "error");
      }
    },
    [addToast]
  );

  if (isGroupChat && selectedGroup) {
    return (
      <>
        {isOpen && (
          <div className="fixed inset-0 bg-black/10 z-55 transition-opacity" onClick={handleClose} />
        )}

        <div
          className={`fixed top-0 right-0 h-full w-95 bg-[#f4f5f7] shadow-2xl z-60 transform transition-transform duration-300 ease-in-out flex flex-col ${
            isOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="h-17 bg-white border-b border-gray-200 flex items-center px-4 shrink-0">
            <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors mr-2">
              <X className="w-5 h-5 text-gray-600" />
            </button>
            <h2 className="text-lg font-semibold text-gray-800">Thông tin nhóm</h2>
          </div>

          <div className="flex-1 overflow-y-auto pb-8">
            <div className="bg-white px-4 py-8 flex flex-col items-center border-b border-gray-200">
              <div className="w-20 h-20 rounded-full bg-blue-50 overflow-hidden shadow-sm ring-4 ring-blue-50 flex items-center justify-center">
                {groupMembers.length > 0 ? (
                  <GroupAvatar members={groupMembers.slice(0, 4)} size={80} />
                ) : (
                  <span className="text-3xl font-bold text-blue-600">
                    {(groupName || "N").charAt(0).toUpperCase()}
                  </span>
                )}
              </div>

              <h3 className="text-xl font-bold text-gray-900 mt-4 text-center">{groupName}</h3>
              <p className="text-sm text-gray-500 mt-1">{groupMemberCount} thành viên</p>

              <div className="grid grid-cols-4 gap-2 w-full max-w-75 mt-5">
                <QuickAction icon={<BellOff className="w-5 h-5" />} label="Tắt thông báo" onClick={() => addToast("Đã mở tuỳ chọn thông báo nhóm", "info")} />
                <QuickAction icon={<Pin className="w-5 h-5" />} label="Ghim hội thoại" onClick={() => addToast("Chức năng ghim hội thoại đang phát triển", "info")} />
                <QuickAction icon={<UserPlus className="w-5 h-5" />} label="Thêm thành viên" onClick={() => addToast("Chức năng mời thành viên đang phát triển", "info")} />
                <QuickAction icon={<Settings className="w-5 h-5" />} label="Quản lý nhóm" onClick={() => onOpenGroupSettings?.() ?? addToast("Chức năng quản lý nhóm đang phát triển", "info")} />
              </div>
            </div>

            <div className="mt-2 bg-white border-y border-gray-200">
              <ListItem
                icon={<Users className="w-5 h-5" />}
                label="Thành viên nhóm"
                subLabel={`${groupMemberCount} thành viên`}
                count={groupMemberCount}
                hasArrow
                onClick={() => addToast("Mở danh sách thành viên nhóm", "info")}
              />
              <div className="px-4 pb-3 pt-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {groupMembers.slice(0, 6).map((member) => (
                    <div key={String(member.userId)} className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 ring-2 ring-white flex items-center justify-center text-xs font-semibold text-gray-500 shrink-0">
                      {member.avatarUrl ? (
                        <img src={member.avatarUrl} alt={member.displayName} className="w-full h-full object-cover" />
                      ) : (
                        <span>{(member.displayName || member.username || member.userId).charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                  ))}
                  {groupMemberCount > 6 && (
                    <div className="w-10 h-10 rounded-full bg-gray-100 ring-2 ring-white flex items-center justify-center text-xs font-semibold text-gray-600">
                      +{groupMemberCount - 6}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-2 bg-white border-y border-gray-200">
              <div className="px-4 pt-4 pb-1">
                <p className="text-[13px] font-semibold text-gray-500 uppercase tracking-wide">Bảng tin nhóm</p>
              </div>
              <ListItem icon={<Clock className="w-5 h-5" />} label="Danh sách nhắc hẹn" hasArrow onClick={() => addToast("Chức năng nhắc hẹn đang phát triển", "info")} />
              <ListItem icon={<BookOpen className="w-5 h-5" />} label="Ghi chú ghim, bình chọn" hasArrow onClick={() => addToast("Chức năng ghi chú và bình chọn đang phát triển", "info")} />
            </div>

            <div className="mt-2 bg-white border-y border-gray-200">
              <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                <p className="text-[13px] font-semibold text-gray-500 uppercase tracking-wide">Ảnh/Video</p>
                <button type="button" onClick={() => { setShowWebGallery(true); setGalleryTab('Ảnh'); }} className="text-[12px] text-blue-600 font-medium hover:underline" disabled={isGroupMessagesLoading || groupMediaItems.length === 0}>Xem thêm</button>
              </div>
              <div className="px-4 pb-4">
                {isGroupMessagesLoading ? (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-500 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Đang tải Ảnh/Video...
                  </div>
                ) : groupMediaItems.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-center text-sm text-gray-500">
                    Không có Ảnh/Video trong đoạn chat
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {groupMediaItems.slice(0, 6).map((message) => {
                      const media = getGroupMediaPreview(message);

                      return (
                        <button
                          key={String(message.id)}
                          type="button"
                          onClick={() => {
                            const media = getGroupMediaPreview(message);
                            setWebViewerImage({
                              url: media.mediaUrl || media.previewUrl,
                              fileName: media.fileName,
                              id: message.id,
                              message,
                            });
                          }}
                          className="group relative aspect-square overflow-hidden rounded-xl border border-gray-200 bg-gray-100 cursor-pointer text-left w-full"
                        >
                          {media.previewUrl ? (
                            <img
                              src={media.previewUrl}
                              alt={media.fileName}
                              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-gray-200 text-gray-500 text-xs font-medium">
                              {media.type === "video" ? "Video" : "Ảnh"}
                            </div>
                          )}
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-2 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <p className="truncate text-[10px] font-medium text-white">{media.fileName}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-2 bg-white border-y border-gray-200">
              <div className="px-4 pt-4 pb-1">
                <p className="text-[13px] font-semibold text-gray-500 uppercase tracking-wide">File</p>
              </div>
              <div className="px-4 pb-4 space-y-3">
                {isGroupMessagesLoading ? (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-500 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Đang tải tệp...
                  </div>
                ) : groupFileItems.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-center text-sm text-gray-500">
                    Chưa có tệp gần đây
                  </div>
                ) : (
                  <div className="space-y-2">
                    {groupFileItems.slice(0, 5).map((message) => {
                      const file = getGroupFileDetails(message);
                      return (
                        <a
                          key={String(message.id)}
                          href={file.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-3 p-2.5 rounded-xl border border-gray-100 bg-gray-50 hover:bg-gray-100 transition-colors"
                        >
                          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 text-blue-600 font-bold text-xs uppercase">
                            DOC
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-gray-800 truncate">{file.name}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{file.size}</p>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-2 bg-white border-y border-gray-200">
              <div className="px-4 pt-4 pb-1">
                <p className="text-[13px] font-semibold text-gray-500 uppercase tracking-wide">Link</p>
              </div>
              <div className="px-4 pb-4 space-y-3">
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center shrink-0">
                      <ArrowRight className="w-5 h-5 text-gray-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {groupInviteLoading ? "Đang tải liên kết mời..." : groupInviteInfo?.inviteLink || "Chưa có liên kết mời"}
                      </p>
                      <p className="text-xs text-blue-600 mt-1 truncate">
                        {groupInviteInfo?.inviteCode || ""}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyGroupInvite(groupInviteInfo?.inviteLink, "Đã sao chép liên kết mời")}
                    className="flex-1 rounded-xl bg-blue-600 text-white py-2.5 text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                    disabled={groupInviteLoading || !groupInviteInfo?.inviteLink}
                  >
                    Sao chép link
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopyGroupInvite(groupInviteInfo?.inviteCode, "Đã sao chép mã mời")}
                    className="flex-1 rounded-xl bg-gray-100 text-gray-700 py-2.5 text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
                    disabled={groupInviteLoading || !groupInviteInfo?.inviteCode}
                  >
                    Sao chép mã
                  </button>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Mã QR nhóm</p>
                      <p className="text-xs text-gray-500">Quét QR để mở link tham gia nhóm</p>
                    </div>
                  </div>

                  <div className="mx-auto flex w-full max-w-48 items-center justify-center overflow-hidden rounded-2xl border border-white bg-white p-3 shadow-sm">
                    {groupQrLoading ? (
                      <div className="flex h-48 w-48 items-center justify-center text-gray-500">
                        <Loader2 className="w-5 h-5 animate-spin" />
                      </div>
                    ) : groupQrDataUrl ? (
                      <img src={groupQrDataUrl} alt="QR nhóm" className="h-48 w-48 object-contain" />
                    ) : (
                      <div className="flex h-48 w-48 items-center justify-center rounded-xl border border-dashed border-gray-300 text-center text-sm text-gray-500">
                        Chưa tạo được mã QR
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-2 bg-white border-y border-gray-200">
              <div className="px-4 pt-4 pb-1">
                <p className="text-[13px] font-semibold text-gray-500 uppercase tracking-wide">Thiết lập bảo mật</p>
              </div>
              <ListItem
                icon={<Clock className="w-5 h-5" />}
                label="Tin nhắn tự xóa"
                subLabel="Chỉ dành cho trưởng nhóm hoặc phó nhóm"
                hasArrow
                onClick={() => addToast("Chức năng tin nhắn tự xóa đang phát triển", "info")}
              />
              <ListItem
                icon={<EyeOff className="w-5 h-5" />}
                label="Ẩn trò chuyện"
                rightElement={<Toggle checked={!!localSettings.isHidden} onChange={(v) => { updateLocal({ isHidden: v }); addToast(v ? "Đã ẩn trò chuyện" : "Đã hiện trò chuyện", "success"); }} />}
              />
              <ListItem
                icon={<AlertTriangle className="w-5 h-5" />}
                label="Báo xấu"
                labelClassName="text-red-500"
                onClick={() => addToast("Chức năng báo xấu đang phát triển", "info")}
              />
            </div>

            <div className="mt-2 bg-white border-y border-gray-200 mb-8">
              <ListItem
                icon={<Trash2 className="w-5 h-5 text-red-500" />}
                label="Xóa lịch sử trò chuyện"
                labelClassName="text-red-500"
                onClick={() => setConfirmClearHistory(true)}
              />
              {confirmClearHistory && (
                <div className="px-4 pb-3 flex items-center gap-2">
                  <span className="text-xs text-red-500 flex-1">Xác nhận xóa toàn bộ?</span>
                  <button onClick={handleClearHistory} className="px-3 py-1.5 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600 transition-colors">Xóa</button>
                  <button onClick={() => setConfirmClearHistory(false)} className="px-3 py-1.5 bg-gray-200 text-gray-600 text-xs rounded-lg hover:bg-gray-300 transition-colors">Hủy</button>
                </div>
              )}
              <ListItem
                icon={<UserMinus className="w-5 h-5 text-red-500" />}
                label={canManageGroup ? "Giải tán nhóm" : "Rời nhóm"}
                labelClassName="text-red-500"
                onClick={() => addToast(canManageGroup ? "Mở luồng giải tán nhóm" : "Mở luồng rời nhóm", "info")}
              />
            </div>
          </div>
        </div>
      </>
    );
  }

  if (!selectedFriend) return null;

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/10 z-55 transition-opacity" onClick={handleClose} />
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelected}
      />

      <div
        className={`fixed top-0 right-0 h-full w-90 bg-[#f4f5f7] shadow-2xl z-60 transform transition-transform duration-300 ease-in-out flex flex-col ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="h-17 bg-white border-b border-gray-200 flex items-center px-4 shrink-0">
          <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors mr-2">
            <X className="w-5 h-5 text-gray-600" />
          </button>
          <h2 className="text-lg font-semibold text-gray-800">Tuỳ chọn</h2>
        </div>
        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Profile */}
          <div className="bg-white px-4 py-8 flex flex-col items-center border-b border-gray-200">
            <div className="w-20 h-20 rounded-full bg-blue-500 flex items-center justify-center text-white text-3xl font-bold mb-4 overflow-hidden shadow-sm">
              {avatarUrl ? (
                <img 
                  src={resolveDisplayAvatar ? resolveDisplayAvatar(avatarUrl) || avatarUrl : avatarUrl} 
                  alt={friendName} 
                  className="w-full h-full object-cover" 
                />
              ) : (
                (originalName || friendName).charAt(0).toUpperCase()
              )}
            </div>


            <h3 className="text-xl font-bold text-gray-900 mb-0.5">{friendName}</h3>
            {(selectedFriend as any).nickname && (
              <p className="text-sm text-gray-400 mb-0.5">Tên gốc: {originalName}</p>
            )}
            <div className="grid grid-cols-4 gap-2 w-full max-w-70 mt-4">
              <QuickAction icon={<Search className="w-5 h-5" />} label="Tìm tin nhắn" onClick={() => { onClose(); onSearchMessages?.(); }} />
              <QuickAction icon={<User className="w-5 h-5" />} label="Trang cá nhân" onClick={() => { onClose(); router.push("/profile"); }} />
              <QuickAction icon={<ImageIcon className="w-5 h-5" />} label="Đổi hình nền" onClick={() => setShowBgPicker(!showBgPicker)} />
              <QuickAction
                icon={localSettings.isMuted ? <BellOff className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
                label={localSettings.isMuted ? "Bật thông báo" : "Tắt thông báo"}
                onClick={() => { updateLocal({ isMuted: !localSettings.isMuted }); addToast(localSettings.isMuted ? "Đã bật thông báo" : "Đã tắt thông báo", "success"); }}
              />
            </div>
          </div>

          {/* Background picker */}
          {showBgPicker && (
            <div className="bg-white border-b border-gray-200 px-4 py-4 animate-in slide-in-from-top-2 duration-200 relative">
              <button 
                onClick={handleCancelBg}
                className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-bold text-gray-800">Đổi hình nền</p>
                <button 
                  onClick={handleApplyBackground} 
                  disabled={bgSaving}
                  className="text-blue-500 text-sm font-bold hover:underline flex items-center gap-1"
                >
                  {bgSaving && <Loader2 className="w-3 h-3 animate-spin" />}
                  XONG
                </button>
              </div>
              
              <div className="grid grid-cols-3 gap-2 mb-4">
                {/* Camera icon for upload */}
                <button
                  onClick={handleUploadBackground}
                  disabled={bgSaving}
                  className="h-24 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center bg-blue-50 hover:bg-blue-100 hover:border-blue-300 transition-all text-blue-500 group"
                >
                  <Camera className="w-8 h-8 mb-1 group-hover:scale-110 transition-transform" />
                </button>

                {PRESET_BACKGROUNDS.map(bg => (
                  <button
                    key={bg.url || "default"}
                    onClick={() => handleSelectBackground(bg.url)}
                    disabled={bgSaving}
                    className={`h-24 rounded-xl border-2 transition-all overflow-hidden relative group ${pendingBgUrl === bg.url ? "border-blue-500 ring-2 ring-blue-100" : "border-transparent hover:border-gray-300"}`}
                  >
                    {bg.url ? (
                      <img src={resolveBg(bg.url)} alt={bg.label} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                    ) : (
                      <div className="w-full h-full bg-[#f3f5f6] flex items-center justify-center text-[10px] text-gray-400 font-medium">Mặc định</div>
                    )}
                    {pendingBgUrl === bg.url && (
                      <div className="absolute top-1 right-1 bg-blue-500 rounded-full p-0.5">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {/* Both sides checkbox */}
              <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-gray-50 rounded-lg transition-colors border-t border-gray-100 mt-2 pt-4">
                <div 
                  className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${bothSides ? "bg-blue-500 border-blue-500" : "bg-white border-gray-300"}`}
                  onClick={(e) => {
                    e.preventDefault();
                    setBothSides(!bothSides);
                  }}
                >
                  <input type="checkbox" className="hidden" checked={bothSides} readOnly />
                  {bothSides && <Check className="w-3.5 h-3.5 text-white" />}
                </div>
                <span className="text-sm text-gray-700 font-medium" onClick={() => setBothSides(!bothSides)}>
                  Đổi hình nền cho cả hai bên
                </span>
              </label>

            </div>
          )}

          {/* Nickname */}
          <div className="mt-2 bg-white border-y border-gray-200">
            {nicknameEditing ? (
              <div className="px-4 py-3 flex items-center gap-2">
                <Pencil className="w-5 h-5 text-gray-500 shrink-0" />
                <input
                  value={nicknameValue}
                  onChange={e => setNicknameValue(e.target.value)}
                  placeholder="Nhập tên gợi nhớ..."
                  className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  autoFocus
                  onKeyDown={e => e.key === "Enter" && handleSaveNickname()}
                />
                <button onClick={handleSaveNickname} disabled={nicknameSaving} className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50">
                  {nicknameSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                </button>
                <button onClick={() => setNicknameEditing(false)} className="p-2 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <ListItem
                icon={<Pencil className="w-5 h-5" />}
                label={(selectedFriend as any).nickname ? `Gợi nhớ: ${(selectedFriend as any).nickname}` : "Đổi tên gợi nhớ"}
                onClick={() => { setNicknameEditing(true); setNicknameValue((selectedFriend as any).nickname || ""); }}
              />
            )}
            <ListItem
              icon={<Star className="w-5 h-5" />}
              label="Đánh dấu bạn thân"
              rightElement={<Toggle checked={!!localSettings.isBestFriend} onChange={v => { updateLocal({ isBestFriend: v }); addToast(v ? `Đã đánh dấu ${friendName} là bạn thân` : "Đã bỏ đánh dấu bạn thân", "success"); }} />}
            />
            <ListItem icon={<BookOpen className="w-5 h-5" />} label="Nhật ký chung" hasArrow onClick={() => addToast("Chức năng nhật ký chung đang phát triển", "info")} />
          </div>

          {/* Groups */}
          <div className="mt-2 bg-white border-y border-gray-200">
            <ListItem icon={<Users className="w-5 h-5" />} label={`Tạo nhóm với ${friendName}`} hasArrow onClick={() => setShowCreateGroup(!showCreateGroup)} />
            {showCreateGroup && (
              <div className="px-4 pb-3 flex items-center gap-2">
                <button onClick={handleCreateGroupWithFriend} disabled={creatingGroup} className="flex-1 bg-blue-500 text-white text-sm py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
                  {creatingGroup ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                  {creatingGroup ? "Đang tạo..." : "Xác nhận tạo nhóm"}
                </button>
              </div>
            )}
            <ListItem icon={<UserPlus className="w-5 h-5" />} label={`Thêm ${friendName} vào nhóm`} hasArrow onClick={() => setShowAddToGroup(!showAddToGroup)} />
            {showAddToGroup && (
              <div className="px-4 pb-3 max-h-40 overflow-y-auto space-y-1">
                {myGroups.length === 0 ? (
                  <p className="text-xs text-gray-400 py-2">Bạn chưa có nhóm nào</p>
                ) : myGroups.map(g => (
                  <button key={String(g.groupId)} onClick={() => handleAddFriendToGroup(g)} disabled={addingToGroup === String(g.groupId)} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-blue-50 text-sm text-gray-700 disabled:opacity-50 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold shrink-0">{g.name.charAt(0).toUpperCase()}</div>
                    <span className="truncate flex-1 text-left">{g.name}</span>
                    {addingToGroup === String(g.groupId) && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
                  </button>
                ))}
              </div>
            )}
            <ListItem icon={<Users className="w-5 h-5" />} label="Xem nhóm chung" count={myGroups.length} hasArrow onClick={() => setShowCommonGroups(!showCommonGroups)} />
            {showCommonGroups && (
              <div className="px-4 pb-3 max-h-40 overflow-y-auto space-y-1">
                {myGroups.length === 0 ? (
                  <p className="text-xs text-gray-400 py-2">Chưa có nhóm chung</p>
                ) : myGroups.map(g => (
                  <button key={String(g.groupId)} onClick={() => { setSelectedGroup(g as any); onClose(); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 text-sm text-gray-700 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-xs font-bold shrink-0">{g.name.charAt(0).toUpperCase()}</div>
                    <span className="truncate flex-1 text-left">{g.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-2 bg-white border-y border-gray-200">
            <div className="px-4 pt-4 pb-2 flex items-center justify-between">
              <p className="text-[13px] font-semibold text-gray-500 uppercase tracking-wide">Ảnh/Video</p>
              <button type="button" onClick={() => { setShowWebGallery(true); setGalleryTab('Ảnh'); }} className="text-[12px] text-blue-600 font-medium hover:underline" disabled={isGroupMessagesLoading || groupMediaItems.length === 0}>Xem thêm</button>
            </div>
            <div className="px-4 pb-4">
              {isGroupMessagesLoading ? (
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-500 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Đang tải Ảnh/Video...
                </div>
              ) : groupMediaItems.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-center text-sm text-gray-500">
                  Không có Ảnh/Video trong đoạn chat
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {groupMediaItems.slice(0, 6).map((message) => {
                    const media = getGroupMediaPreview(message);

                    return (
                      <button
                        key={String(message.id)}
                        type="button"
                        onClick={() => {
                          const media = getGroupMediaPreview(message);
                          setWebViewerImage({
                            url: media.mediaUrl || media.previewUrl,
                            fileName: media.fileName,
                            id: message.id,
                            message,
                          });
                        }}
                        className="group relative aspect-square overflow-hidden rounded-xl border border-gray-200 bg-gray-100 cursor-pointer text-left w-full"
                      >
                        {media.previewUrl ? (
                          <img
                            src={media.previewUrl}
                            alt={media.fileName}
                            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-gray-200 text-gray-500 text-xs font-medium">
                            {media.type === "video" ? "Video" : "Ảnh"}
                          </div>
                        )}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-2 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <p className="truncate text-[10px] font-medium text-white">{media.fileName}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="mt-2 bg-white border-y border-gray-200">
            <div className="px-4 pt-4 pb-1">
              <p className="text-[13px] font-semibold text-gray-500 uppercase tracking-wide">File</p>
            </div>
            <div className="px-4 pb-4 space-y-3">
              {isGroupMessagesLoading ? (
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-500 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Đang tải tệp...
                </div>
              ) : groupFileItems.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-center text-sm text-gray-500">
                  Chưa có tệp gần đây
                </div>
              ) : (
                <div className="space-y-2">
                  {groupFileItems.slice(0, 5).map((message) => {
                    const file = getGroupFileDetails(message);
                    return (
                      <a
                        key={String(message.id)}
                        href={file.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-3 p-2.5 rounded-xl border border-gray-100 bg-gray-50 hover:bg-gray-100 transition-colors"
                      >
                        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 text-blue-600 font-bold text-xs uppercase">
                          DOC
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-800 truncate">{file.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{file.size}</p>
                        </div>
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Settings */}
          <div className="mt-2 bg-white border-y border-gray-200">
            <ListItem icon={<Pin className="w-5 h-5" />} label="Ghim trò chuyện" rightElement={<Toggle checked={!!localSettings.isPinned} onChange={v => { updateLocal({ isPinned: v }); addToast(v ? "Đã ghim trò chuyện" : "Đã bỏ ghim", "success"); }} />} />
            <ListItem icon={<EyeOff className="w-5 h-5" />} label="Ẩn trò chuyện" rightElement={<Toggle checked={!!localSettings.isHidden} onChange={v => { updateLocal({ isHidden: v }); addToast(v ? "Đã ẩn trò chuyện" : "Đã hiện trò chuyện", "success"); }} />} />
            <ListItem icon={<Phone className="w-5 h-5" />} label="Báo cuộc gọi đến" rightElement={<Toggle checked={localSettings.callNotify !== false} onChange={v => { updateLocal({ callNotify: v }); addToast(v ? "Đã bật báo cuộc gọi" : "Đã tắt báo cuộc gọi", "success"); }} />} />
            <ListItem icon={<Settings className="w-5 h-5" />} label="Cài đặt cá nhân" hasArrow onClick={() => { onClose(); router.push("/profile"); }} />
          </div>

          {/* Danger zone */}
          <div className="mt-2 bg-white border-y border-gray-200 mb-8">
            <ListItem icon={<AlertTriangle className="w-5 h-5 text-red-500" />} label="Báo xấu" labelClassName="text-red-500" onClick={() => addToast("Chức năng báo xấu đang phát triển", "info")} />
            <ListItem icon={<Lock className="w-5 h-5" />} label="Quản lý chặn" hasArrow onClick={() => addToast("Chức năng quản lý chặn đang phát triển", "info")} />
            <ListItem icon={<Database className="w-5 h-5" />} label="Dung lượng trò chuyện" hasArrow onClick={() => addToast("Chức năng xem dung lượng đang phát triển", "info")} />
            <ListItem icon={<Trash2 className="w-5 h-5 text-red-500" />} label="Xóa lịch sử trò chuyện" labelClassName="text-red-500" onClick={() => setConfirmClearHistory(true)} />
            {confirmClearHistory && (
              <div className="px-4 pb-3 flex items-center gap-2">
                <span className="text-xs text-red-500 flex-1">Xác nhận xóa toàn bộ?</span>
                <button onClick={handleClearHistory} className="px-3 py-1.5 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600 transition-colors">Xóa</button>
                <button onClick={() => setConfirmClearHistory(false)} className="px-3 py-1.5 bg-gray-200 text-gray-600 text-xs rounded-lg hover:bg-gray-300 transition-colors">Hủy</button>
              </div>
            )}
            <ListItem icon={<UserMinus className="w-5 h-5 text-red-500" />} label="Hủy kết bạn" labelClassName="text-red-500" onClick={() => setConfirmUnfriend(true)} />
            {confirmUnfriend && (
              <div className="px-4 pb-3 flex items-center gap-2">
                <span className="text-xs text-red-500 flex-1">Xác nhận hủy kết bạn?</span>
                <button onClick={handleUnfriend} className="px-3 py-1.5 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600 transition-colors">Hủy kết bạn</button>
                <button onClick={() => setConfirmUnfriend(false)} className="px-3 py-1.5 bg-gray-200 text-gray-600 text-xs rounded-lg hover:bg-gray-300 transition-colors">Hủy</button>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* ── Web Full-Screen Lightbox Image Viewer Modal ── */}
      {webViewerImage && (
        <div className="fixed inset-0 bg-black/95 z-[999] flex flex-col items-center justify-center animate-fade-in">
          {/* Header */}
          <div className="absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-black/60 to-transparent flex items-center justify-between px-6 z-10">
            <span className="text-white font-medium text-sm truncate max-w-lg">{webViewerImage.fileName}</span>
            <div className="flex items-center gap-4">
              {/* Go to message option */}
              <button
                type="button"
                onClick={() => {
                  if (webViewerImage.id) {
                    onJumpToMessage?.(webViewerImage.id);
                    setWebViewerImage(null);
                    setShowWebGallery(false);
                    onClose();
                  }
                }}
                className="text-white hover:text-yellow-400 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              >
                Xem tin nhắn gốc
              </button>

              {/* Copy link option */}
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(webViewerImage.url);
                  addToast("Đã sao chép liên kết hình ảnh!", "success");
                }}
                className="text-white hover:text-blue-400 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              >
                Chuyển tiếp (Copy Link)
              </button>

              {/* Download option */}
              <a
                href={webViewerImage.url}
                download={webViewerImage.fileName}
                target="_blank"
                rel="noreferrer"
                className="text-white hover:text-green-400 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              >
                Tải xuống
              </a>

              {/* Close */}
              <button
                type="button"
                onClick={() => setWebViewerImage(null)}
                className="p-1.5 bg-white/15 hover:bg-white/25 rounded-full text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Image content */}
          <div className="relative w-full h-[80%] flex items-center justify-center p-4">
            <img
              src={webViewerImage.url}
              alt={webViewerImage.fileName}
              className="max-w-full max-h-full object-contain shadow-2xl rounded-lg"
            />
          </div>
        </div>
      )}

      {/* ── Web Media Archive (Gallery) Modal ── */}
      {showWebGallery && (
        <div className="fixed inset-0 bg-black/50 z-[990] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-scale-up">
            {/* Header */}
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-lg font-bold text-gray-800">Kho lưu trữ trò chuyện</h3>
                <p className="text-xs text-gray-400 mt-0.5">Tổng hợp ảnh, tệp tin và liên kết đã chia sẻ</p>
              </div>
              <button
                type="button"
                onClick={() => setShowWebGallery(false)}
                className="p-2 hover:bg-gray-150 rounded-full text-gray-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab Bar */}
            <div className="flex border-b border-gray-100 bg-white shrink-0">
              {(['Ảnh', 'File', 'Link'] as const).map((tab) => {
                const count = tab === 'Ảnh' ? groupMediaItems.length : tab === 'File' ? groupFileItems.length : groupLinkItems.length;
                const isActive = galleryTab === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setGalleryTab(tab)}
                    className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-all flex items-center justify-center gap-1.5 ${
                      isActive ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {tab}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isActive ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Content Container */}
            <div className="flex-1 overflow-y-auto p-6 bg-[#f8fafc]">
              {galleryTab === 'Ảnh' && (
                groupMediaItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                    <ImageIcon className="w-12 h-12 mb-2 stroke-1" />
                    <span className="text-sm">Chưa có hình ảnh hay video nào được gửi</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-3">
                    {groupMediaItems.map((message) => {
                      const media = getGroupMediaPreview(message);
                      return (
                        <button
                          key={String(message.id)}
                          type="button"
                          onClick={() => {
                            setWebViewerImage({
                              url: media.mediaUrl || media.previewUrl,
                              fileName: media.fileName,
                              id: message.id,
                              message,
                            });
                          }}
                          className="group relative aspect-square overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer"
                        >
                          <img
                            src={media.previewUrl}
                            alt={media.fileName}
                            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <p className="truncate text-[10px] font-medium text-white">{media.fileName}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )
              )}

              {galleryTab === 'File' && (
                groupFileItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                    <Database className="w-12 h-12 mb-2 stroke-1" />
                    <span className="text-sm">Chưa có tệp tài liệu nào được gửi</span>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {groupFileItems.map((message) => {
                      const file = getGroupFileDetails(message);
                      return (
                        <a
                          key={String(message.id)}
                          href={file.url}
                          download={file.name}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-3 p-3.5 rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md hover:border-blue-100 transition-all group"
                        >
                          <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center shrink-0 text-blue-600 font-bold text-xs uppercase group-hover:bg-blue-100 transition-colors">
                            FILE
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-gray-800 truncate group-hover:text-blue-600 transition-colors">{file.name}</p>
                            <p className="text-xs text-gray-400 mt-1">{file.size}</p>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                )
              )}

              {galleryTab === 'Link' && (
                groupLinkItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                    <ArrowRight className="w-12 h-12 mb-2 stroke-1" />
                    <span className="text-sm">Chưa có liên kết chia sẻ nào</span>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {groupLinkItems.map((item) => (
                      <a
                        key={item.id}
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-3 p-3.5 rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md hover:border-blue-100 transition-all group"
                      >
                        <div className="w-11 h-11 rounded-xl bg-green-50 flex items-center justify-center shrink-0 text-green-600 font-bold text-xs uppercase group-hover:bg-green-100 transition-colors">
                          LINK
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">{item.linkDomain}</span>
                          <p className="text-sm font-semibold text-gray-800 truncate mt-0.5 group-hover:text-blue-600 transition-colors">{item.name}</p>
                          <p className="text-xs text-gray-400 mt-1 truncate">{item.url}</p>
                        </div>
                      </a>
                    ))}
                  </div>
                )
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setShowWebGallery(false)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-semibold rounded-xl transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────

function QuickAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <button className="flex flex-col items-center gap-2 group" onClick={onClick}>
      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 group-hover:bg-gray-200 transition-colors">{icon}</div>
      <span className="text-[11px] text-gray-600 text-center leading-tight">{label}</span>
    </button>
  );
}

function ListItem({ icon, label, subLabel, rightElement, hasArrow, count, labelClassName = "", onClick }: {
  icon: React.ReactNode; label: string; subLabel?: string; rightElement?: React.ReactNode;
  hasArrow?: boolean; count?: number; labelClassName?: string; onClick?: () => void;
}) {
  return (
    <button onClick={onClick} className="w-full flex items-center px-4 py-3.5 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
      <div className="w-8 h-8 flex items-center justify-center text-gray-500 shrink-0">{icon}</div>
      <div className="ml-3 flex-1 flex flex-col items-start overflow-hidden">
        <div className="flex items-center w-full">
          <span className={`text-[15px] text-gray-800 truncate ${labelClassName}`}>{label}</span>
          {count !== undefined && <span className="ml-1 text-gray-400 text-sm">({count})</span>}
        </div>
        {subLabel && <span className="text-xs text-gray-400 mt-0.5">{subLabel}</span>}
      </div>
      <div className="flex items-center ml-2 shrink-0">
        {rightElement}
        {hasArrow && <ChevronRight className="w-5 h-5 text-gray-300" />}
      </div>
    </button>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (val: boolean) => void }) {
  return (
    <div onClick={(e) => { e.stopPropagation(); onChange(!checked); }} className={`w-12 h-6 rounded-full relative transition-colors cursor-pointer ${checked ? "bg-blue-500" : "bg-gray-200"}`}>
      <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${checked ? "translate-x-6" : ""}`} />
    </div>
  );
}
