"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  X, Search, User, Image as ImageIcon, BellOff, Bell,
  Pencil, Star, BookOpen, Users, UserPlus, ArrowRight,
  Pin, EyeOff, Phone, Settings, Clock, AlertTriangle,
  Lock, Database, Trash2, ChevronRight, Loader2, Check, Upload, Camera,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useChatStore } from "../store/chatStore";
import { useGroupsStore } from "../../groups/store/groupsStore";
import { useToast } from "../../../contexts/ToastContext";
import { useSocket } from "../../../contexts/SocketContext";
import { createGroup, addMemberToGroup } from "../../groups/api";
import {
  updateFriendNickname,
  updateChatBackground as apiUpdateChatBackground,
  getChatBackground as apiGetChatBackground,
  uploadFileDirect,
  getPresignedViewUrl,
} from "../../../api/client";
import type { AuthUser, Friend } from "../../../types";
import type { Group } from "../../groups/types";

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
  selectedFriend: Friend | null;
  authUser: AuthUser;
  onSearchMessages?: () => void;
  onBackgroundChange?: (bgUrl: string | null) => void;
  resolveDisplayAvatar?: (rawUrl: string | null | undefined) => string | null;
}


// ── Main Component ──────────────────────────────────────────────────────
export default function ChatSettingsSidebar({
  isOpen, onClose, selectedFriend, authUser, onSearchMessages, onBackgroundChange, resolveDisplayAvatar,
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

  // ── State ──────────────────────────────────────────────────────────
  const [localSettings, setLocalSettings] = useState<LocalSettings>({});
  const [nicknameEditing, setNicknameEditing] = useState(false);
  const [nicknameValue, setNicknameValue] = useState("");
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

  if (!selectedFriend) return null;

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/10 z-[55] transition-opacity" onClick={handleClose} />
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelected}
      />

      <div
        className={`fixed top-0 right-0 h-full w-[360px] bg-[#f4f5f7] shadow-2xl z-[60] transform transition-transform duration-300 ease-in-out flex flex-col ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="h-[68px] bg-white border-b border-gray-200 flex items-center px-4 shrink-0">
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
            <div className="grid grid-cols-4 gap-2 w-full max-w-[280px] mt-4">
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
          </div>
        </div>
      </div>
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
