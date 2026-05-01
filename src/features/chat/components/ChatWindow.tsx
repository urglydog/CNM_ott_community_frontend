"use client";

import { 
  MoreHorizontal, Phone, Search, ThumbsUp, Video, Smile, Image, 
  Paperclip, Link as LinkIcon, MapPin, Contact, CheckSquare, Type, 
  AtSign, Gift, Loader2, WifiOff, FileText, Users, RotateCcw, 
  Trash2, Share2, Sparkles, X, Mic, Square, Send, Paintbrush, Pin,
  ChevronUp, ChevronRight, ChevronDown
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  Smile,
  Sparkles,
} from "lucide-react";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import { dmConversationId, useDirectMessage } from "../hooks/useChatHooks";
import {
  groupConversationId,
  useGroupChat,
  type GroupChatMessage,
} from "../hooks/useGroupChat";
import { getGroupMembers } from "../api";
import {
  getPresignedViewUrl,
  searchConversationMessages,
  searchGlobalMessages,
} from "../../../api/client";
import { useSocket } from "../../../contexts/SocketContext";
import { useChatStore } from "../store/chatStore";
import { useGroupsStore } from "../../groups/store/groupsStore";
import type { AuthUser, StickerData, ReplyToMessage } from "../../../types";
import { askBot } from "../api";
import CallOverlay from "@/features/chat/components/CallOverlay";
import { useToast } from "../../../contexts/ToastContext";
import type { GroupMember } from "../../groups/types";
import type { StickerData } from "../../../types";
import {
  formatSearchDateTime,
  getMessageDomId,
  highlightKeyword,
} from "../utils/messageSearch";
import ChatSettingsSidebar from "./ChatSettingsSidebar";
import { getChatBackground } from "../../../api/client";
import { getMessageDomId } from "../utils/messageSearch";
import { useLiveLocation } from "../../../hooks/useLiveLocation";
import LocationShareButton from "../../../components/chat/LocationShareButton";
import LocationMessage from "../../../components/chat/LocationMessage";
import LiveLocationMap from "../../../components/chat/LiveLocationMap";

// Components
import { GroupAvatar } from "./Avatar";
import { ReadByAvatars } from "./ReadByAvatars";
import { ReplyPreview } from "./ReplyComponents";
import { MessageContextMenu } from "./MessageContextMenu";
import { GroupMessageBubble, SystemMessageBubble } from "./GroupMessageBubble";
import { PrivateMessageBubble } from "./PrivateMessageBubble";
import { ChatHeader } from "./ChatHeader";
import { MessageList } from "./MessageList";
import { ChatToolbar } from "./ChatToolbar";
import { ChatInput } from "./ChatInput";
import { AiChatMessages, type AiConversationTurn } from "./AiChatMessages";
import { MessageSearchPanel } from "./MessageSearchPanel";
import EmojiStickerPicker from "./EmojiStickerPicker";
import ForwardMessageModal from "./ForwardMessageModal";
import apiClient from "../../../lib/axios";

interface ChatWindowProps {
  authUser: AuthUser;
}

type SearchScope = "conversation" | "global";

interface MessageSearchRow {
  id: string | number;
  senderId: string | number;
  senderDisplayName?: string;
  senderAvatarUrl?: string | null;
  content: string;
  contentType?: string;
  createdAt: string;
  conversationId: string;
}

const AI_HISTORY_STORAGE_PREFIX = "ott_ai_history_v1";

function getAvatarInitial(name: string): string {
  return name?.charAt(0)?.toUpperCase() ?? "?";
}

function formatTime(isoString: string) {
  try {
    const d = new Date(isoString);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const timeStr = d.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
    
    if (isToday) return `${timeStr} Hôm nay`;
    
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return `${timeStr} Hôm qua`;
    
    return `${timeStr} ${d.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    })}`;
  } catch {
    return "";
  }
}

/** Tạo avatar ghép (Zalo style) từ danh sách avatar thành viên */
function buildGroupAvatarUrls(
  members: GroupMember[],
  maxCount = 4,
): (string | null)[] {
  return members.slice(0, maxCount).map((m) => m.avatarUrl);
}

/** Avatar group: hiển thị lưới 2x2 avatar thành viên hoặc icon mặc định */
function GroupAvatar({
  members,
  size = 48,
}: {
  members: GroupMember[];
  size?: number;
}) {
  const urls = buildGroupAvatarUrls(members, 4);
  const initials = urls.map(
    (_, i) => members[i]?.displayName?.charAt(0)?.toUpperCase() ?? "?",
  );
  const colors = [
    "bg-blue-500",
    "bg-green-500",
    "bg-purple-500",
    "bg-orange-500",
  ];
  const half = size / 2;

  if (urls.length === 0) {
    return (
      <div
        className="rounded-full bg-gray-300 flex items-center justify-center text-white font-semibold shrink-0"
        style={{ width: size, height: size }}
      >
        <Users className="w-5 h-5" />
      </div>
    );
  }

  if (urls.length === 1) {
    return (
      <div
        className="rounded-full overflow-hidden flex items-center justify-center text-white font-semibold shrink-0"
        style={{ width: size, height: size }}
      >
        {urls[0] ? (
          <img src={urls[0]} alt="" className="w-full h-full object-cover" />
        ) : (
          <div
            className={`${colors[0]} w-full h-full flex items-center justify-center`}
          >
            {initials[0]}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="rounded-full overflow-hidden flex flex-wrap shrink-0"
      style={{ width: size, height: size }}
    >
      {urls.slice(0, 2).map((url, i) => (
        <div key={i} className="relative" style={{ width: half, height: half }}>
          {url ? (
            <img src={url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div
              className={`w-full h-full flex items-center justify-center text-white text-[10px] font-semibold ${colors[i]}`}
            >
              {initials[i]}
            </div>
          )}
        </div>
      ))}
      {urls.slice(2, 4).map((url, i) => (
        <div
          key={i + 2}
          className="relative"
          style={{ width: half, height: half }}
        >
          {url ? (
            <img src={url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div
              className={`w-full h-full flex items-center justify-center text-white text-[10px] font-semibold ${colors[i + 2]}`}
            >
              {initials[i + 2]}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/** Avatar người gửi (Zalo style) */
function SenderAvatar({
  avatarUrl,
  name,
  size = 36,
}: {
  avatarUrl: string | null | undefined;
  name: string;
  size?: number;
}) {
  return (
    <div
      className="rounded-full overflow-hidden bg-gray-200 flex items-center justify-center text-gray-500 font-medium shrink-0"
      style={{ width: size, height: size, minWidth: size }}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name}
          className="w-full h-full object-cover"
        />
      ) : (
        getAvatarInitial(name)
      )}
    </div>
  );
}

/** Tin nhắn hệ thống (hiển thị giữa màn hình) */
function SystemMessageBubble({ content, createdAt, onAction }: { content: string, createdAt?: string, onAction?: () => void }) {
  const isBgChange = content.includes("hình nền");
  
  return (
    <div className="flex flex-col items-center my-6">
      {createdAt && (
        <div className="bg-black/10 backdrop-blur-sm text-white/90 text-[10px] px-2 py-0.5 rounded-md mb-3 font-medium">
          {formatTime(createdAt)}
        </div>
      )}
      <div className="bg-white text-gray-700 text-[13.5px] px-6 py-2.5 rounded-full flex items-center gap-2.5 shadow-md border border-gray-100 hover:shadow-lg transition-all group active:scale-95">
        {isBgChange && (
          <div className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center">
            <Paintbrush className="w-3.5 h-3.5 text-blue-500" />
          </div>
        )}
        <span className="font-semibold tracking-tight">{content}</span>
        {isBgChange && (
          <button 
            onClick={onAction}
            className="ml-1 text-blue-600 font-bold hover:underline cursor-pointer border-l border-gray-200 pl-2 py-0.5"
          >
            Thay đổi
          </button>
        )}
      </div>
    </div>
  );
}

/** Bubble tin nhắn nhóm — hiển thị avatar + tên người gửi bên trái (Zalo style) */
function GroupMessageBubble({
  msg,
  authUserId,
  senderAvatarUrl,
  onContextMenu,
}: {
  msg: GroupChatMessage;
  authUserId: string | number;
  senderAvatarUrl?: string | null;
  onContextMenu?: (
    e: React.MouseEvent,
    msg: GroupChatMessage,
    conversationId: string,
    canRevoke: boolean,
  ) => void;
}) {
  const isOwn = msg.isOwn || Number(msg.senderId) === Number(authUserId);

  const senderName = msg.senderDisplayName || (isOwn ? "Bạn" : "Người dùng");

  // ── Sticker: hiển thị hình ảnh lớn không có bubble ────────────────────
  if (msg.contentType === "sticker" && msg.stickerData?.stickerUrl) {
    return (
      <div
        className={`flex items-start gap-2 mb-3 ${isOwn ? "flex-row-reverse" : "flex-row"}`}
        data-message-id={String(msg.id)}
      >
        {!isOwn && (
          <SenderAvatar
            avatarUrl={senderAvatarUrl ?? msg.senderAvatarUrl}
            name={senderName}
          />
        )}
        <div className={`flex flex-col ${isOwn ? "items-end" : "items-start"}`}>
          {!isOwn && (
            <span className="text-xs text-gray-500 mb-0.5 ml-1">
              {senderName}
            </span>
          )}
          <div
            className="relative group"
            onContextMenu={(e) => {
              onContextMenu?.(e, msg, msg.conversationId ?? "", isOwn);
            }}
          >
            <img
              src={msg.stickerData.stickerUrl}
              alt={msg.stickerData.stickerName || msg.content || "sticker"}
              className="w-28 h-28 object-contain rounded-xl"
            />
            <div
              className={`mt-0.5 text-[10px] flex items-center gap-1 ${isOwn ? "text-blue-200 justify-end" : "text-gray-400"
                }`}
            >
              {formatTime(msg.createdAt)}
              {isOwn && msg.sendStatus === "sending" && (
                <Loader2 className="w-3 h-3 animate-spin inline-block" />
              )}
              {isOwn && msg.sendStatus === "sent" && <span>✓</span>}
              {isOwn && msg.sendStatus === "failed" && (
                <span className="text-red-300">✗</span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Emoji: hiển thị lớn trong bubble ─────────────────────────────────
  const isPureEmoji =
    msg.contentType === "emoji" &&
    msg.content &&
    /^(\p{Emoji_Presentation}|\p{Extended_Pictographic})+$/u.test(
      msg.content.trim(),
    );

  return (
    <div
      className={`flex items-start gap-2 mb-3 ${isOwn ? "flex-row-reverse" : "flex-row"}`}
      data-message-id={String(msg.id)}
    >
      {/* Avatar người gửi — chỉ hiện nếu không phải mình */}
      {!isOwn && (
        <SenderAvatar
          avatarUrl={senderAvatarUrl ?? msg.senderAvatarUrl}
          name={senderName}
        />
      )}

      <div
        className={`flex flex-col ${isOwn ? "items-end" : "items-start"} max-w-[68%] ${isPureEmoji ? "max-w-max" : ""}`}
      >
        {/* Tên người gửi — chỉ hiện nếu không phải mình */}
        {!isOwn && (
          <span className="text-xs text-gray-500 mb-0.5 ml-1">
            {senderName}
          </span>
        )}

        <div
          className={`px-3 py-2 rounded-2xl text-[14px] shadow-sm border ${isOwn
              ? "bg-blue-500 text-white border-blue-500 rounded-br-sm"
              : "bg-white text-gray-800 border-gray-200 rounded-bl-sm"
            } ${msg.sendStatus === "failed" ? "opacity-70 border-red-400" : ""} ${msg.contentType === "revoked" ? "bg-gray-100 border-gray-200 opacity-80 italic" : ""} ${isPureEmoji ? "px-4 py-3" : ""}`}
          onContextMenu={(e) => {
            if (msg.contentType === "revoked") return;
            onContextMenu?.(e, msg, msg.conversationId ?? "", isOwn);
          }}
        >
          {/* File/Image attachments */}
          {msg.contentType !== "voice" && msg.type !== "voice" && Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
            <div className="mb-2 space-y-2">
              {msg.attachments.map((att, idx) => {
                if (att?.type === "image" && att.url) {
                  return (
                    <a
                      key={`${msg.id}-att-${idx}`}
                      href={att.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block"
                    >
                      <img
                        src={att.url}
                        alt={msg.content || "Ảnh"}
                        className="max-h-56 max-w-full rounded-lg border border-black/10 object-cover"
                      />
                    </a>
                  );
                }
                if (att?.type === "video" && att.url) {
                  return (
                    <video
                      key={`${msg.id}-att-${idx}`}
                      src={att.url}
                      controls
                      preload="none"
                      poster={att.thumbnailUrl || undefined}
                      className="max-h-72 w-full rounded-lg border border-black/10 bg-black"
                    />
                  );
                }
                if (att?.url) {
                  return (
                    <a
                      key={`${msg.id}-att-${idx}`}
                      href={att.url}
                      target="_blank"
                      rel="noreferrer"
                      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs border ${isOwn
                          ? "border-blue-200/50 bg-blue-400/30 text-blue-100"
                          : "border-gray-200 bg-gray-50 text-gray-700"
                        }`}
                    >
                      <FileText className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate max-w-36">
                        {msg.content || "Tệp"}
                      </span>
                    </a>
                  );
                }
                return null;
              })}
            </div>
          )}

          {/* Nội dung tin nhắn — hiển thị placeholder nếu đã thu hồi */}
          {msg.contentType === "revoked" ? (
            <div className="italic text-gray-400 text-xs flex items-center gap-1">
              <span>Tin nhắn đã được thu hồi</span>
            </div>
          ) : msg.contentType === "voice" || msg.type === "voice" ? (
            <div className="py-1">
              <AudioMessage audioUrl={msg.attachments?.[0]?.url || msg.content} isOwn={isOwn} />
            </div>
          ) : (
            <div
              className={`whitespace-pre-wrap wrap-break-word ${isPureEmoji ? "text-3xl leading-none" : ""}`}
            >
              {msg.content || "[Không có nội dung]"}
            </div>
          )}

          {/* Thời gian + trạng thái gửi */}
          <div
            className={`mt-1 text-[10px] flex items-center gap-1 ${isOwn ? "text-blue-200 justify-end" : "text-gray-400"
              }`}
          >
            {formatTime(msg.createdAt)}
            {isOwn && msg.sendStatus === "sending" && (
              <Loader2 className="w-3 h-3 animate-spin inline-block" />
            )}
            {isOwn && msg.sendStatus === "sent" && <span>✓</span>}
            {isOwn && msg.sendStatus === "failed" && (
              <span className="text-red-300">✗</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Bubble tin nhắn 1:1 (Private DM) */
function PrivateMessageBubble({
  msg,
  friendName,
  friendAvatarUrl,
  authUserId,
  onContextMenu,
}: {
  msg: GroupChatMessage;
  friendName: string;
  friendAvatarUrl: string | null;
  authUserId: string | number;
  onContextMenu?: (
    e: React.MouseEvent,
    msg: GroupChatMessage,
    conversationId: string,
    canRevoke: boolean,
  ) => void;
}) {
  const isOwn = msg.isOwn || Number(msg.senderId) === Number(authUserId);

  // ── Sticker: hiển thị hình ảnh lớn không có bubble ────────────────────
  if (msg.contentType === "sticker" && msg.stickerData?.stickerUrl) {
    return (
      <div
        className={`flex flex-col ${isOwn ? "items-end" : "items-start"} mb-3`}
        data-message-id={String(msg.id)}
      >
        <div
          className="relative group"
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onContextMenu?.(e, msg, msg.conversationId ?? "", isOwn);
          }}
        >
          <img
            src={msg.stickerData.stickerUrl}
            alt={msg.stickerData.stickerName || msg.content || "sticker"}
            className="w-28 h-28 object-contain rounded-xl"
          />
          <div
            className={`mt-0.5 text-[10px] flex items-center gap-1 ${isOwn ? "text-blue-200 justify-end" : "text-gray-400"
              }`}
          >
            {formatTime(msg.createdAt)}
            {isOwn && msg.sendStatus === "sending" && (
              <Loader2 className="w-3 h-3 animate-spin inline-block" />
            )}
            {isOwn && msg.sendStatus === "sent" && <span>✓</span>}
            {isOwn && msg.sendStatus === "failed" && (
              <span className="text-red-300">✗</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Emoji: hiển thị lớn trong bubble ─────────────────────────────────
  const isPureEmoji =
    msg.contentType === "emoji" &&
    msg.content &&
    /^(\p{Emoji_Presentation}|\p{Extended_Pictographic})+$/u.test(
      msg.content.trim(),
    );

  return (
    <div
      className={`flex flex-col ${isOwn ? "items-end" : "items-start"} mb-3`}
      data-message-id={String(msg.id)}
    >
      <div
        className={`max-w-[70%] px-3 py-2 rounded-2xl text-[14px] shadow-sm border ${isOwn
            ? "bg-blue-500 text-white border-blue-500 rounded-br-sm"
            : "bg-white text-gray-800 border-gray-200 rounded-bl-sm"
          } ${msg.sendStatus === "failed" ? "opacity-70 border-red-400" : ""} ${msg.contentType === "revoked" ? "bg-gray-100 border-gray-200 opacity-80 italic" : ""} ${isPureEmoji ? "px-4 py-3" : ""}`}
        onContextMenu={(e) => {
          if (msg.contentType === "revoked") return;
          onContextMenu?.(e, msg, msg.conversationId ?? "", isOwn);
        }}
      >
        {!isOwn && (
          <div
            className={`text-xs font-medium mb-0.5 ${isOwn ? "text-blue-200" : "text-gray-400"}`}
          >
            {friendName}
          </div>
        )}

        {msg.contentType !== "voice" && msg.type !== "voice" && Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
          <div className="mb-2 space-y-2">
            {msg.attachments.map((att, idx) => {
              if (att?.type === "image" && att.url) {
                return (
                  <a
                    key={`${msg.id}-att-${idx}`}
                    href={att.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block"
                  >
                    <img
                      src={att.url}
                      alt={msg.content || "Ảnh"}
                      className="max-h-60 max-w-full rounded-lg border border-black/10 object-cover"
                    />
                  </a>
                );
              }
              if (att?.type === "video" && att.url) {
                return (
                  <video
                    key={`${msg.id}-att-${idx}`}
                    src={att.url}
                    controls
                    preload="none"
                    poster={att.thumbnailUrl || undefined}
                    className="max-h-72 w-full rounded-lg border border-black/10 bg-black"
                  />
                );
              }
              if (att?.url) {
                return (
                  <a
                    key={`${msg.id}-att-${idx}`}
                    href={att.url}
                    target="_blank"
                    rel="noreferrer"
                    className={`inline-flex items-center gap-2 rounded-md px-2 py-1 text-xs border ${isOwn
                        ? "border-blue-200 bg-blue-400/40 text-white"
                        : "border-gray-200 bg-gray-50 text-gray-700"
                      }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span className="truncate max-w-44">
                      {msg.content || "Tệp"}
                    </span>
                  </a>
                );
              }
              return null;
            })}
          </div>
        )}

        {/* Nội dung tin nhắn — hiển thị placeholder nếu đã thu hồi */}
        {msg.contentType === "revoked" ? (
          <div className="italic text-gray-400 text-xs flex items-center gap-1">
            <span>Tin nhắn đã được thu hồi</span>
          </div>
        ) : msg.contentType === "voice" || msg.type === "voice" ? (
          <div className="py-1">
            <AudioMessage audioUrl={msg.attachments?.[0]?.url || msg.content} isOwn={isOwn} />
          </div>
        ) : (
          <div
            className={`whitespace-pre-wrap wrap-break-word ${isPureEmoji ? "text-3xl leading-none" : ""}`}
          >
            {msg.content || "[Không có nội dung]"}
          </div>
        )}

        <div
          className={`mt-1 text-[10px] flex items-center gap-1 ${isOwn ? "text-blue-200 justify-end" : "text-gray-400"
            }`}
        >
          {formatTime(msg.createdAt)}
          {isOwn && msg.sendStatus === "sending" && (
            <Loader2 className="w-3 h-3 animate-spin inline-block" />
          )}
          {isOwn && msg.sendStatus === "sent" && <span>✓</span>}
          {isOwn && msg.sendStatus === "failed" && (
            <span className="text-red-300">✗</span>
          )}
        </div>
      </div>
    </div>
  );
}

/** Context menu hiện ra khi right-click vào tin nhắn — Zalo style */
interface MessageContextMenuProps {
  x: number;
  y: number;
  canRevoke: boolean;
  isOwn: boolean;
  onRevoke: () => void;
  onDeleteForMe: () => void;
  onForward: () => void;
  onPin?: () => void;
  isDeleting: boolean;
  onClose: () => void;
}

function MessageContextMenu({
  x,
  y,
  canRevoke,
  isOwn,
  onRevoke,
  onDeleteForMe,
  onForward,
  onPin,
  isDeleting,
  onClose,
}: MessageContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Đóng khi click ra ngoài hoặc scroll
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleScroll() {
      onClose();
    }
    document.addEventListener("mousedown", handleOutside);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [onClose]);

  // Đảm bảo menu không bị tràn ngoài viewport
  const [adjustedX, setAdjustedX] = useState(x);
  const [adjustedY, setAdjustedY] = useState(y);

  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const rect = menu.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    setAdjustedX(Math.min(x, vw - rect.width - 8));
    setAdjustedY(Math.min(y, vh - rect.height - 8));
  }, [x, y]);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white rounded-xl shadow-xl border border-gray-200 py-1 min-w-40 animate-in fade-in zoom-in-95 duration-100"
      style={{ top: adjustedY, left: adjustedX }}
    >
      {/* Nút Xóa với tôi — hiện cho MỌI tin nhắn (kể cả của mình) */}
      <button
        type="button"
        onClick={() => {
          onDeleteForMe();
          onClose();
        }}
        disabled={isDeleting}
        className="w-full px-3 py-2.5 flex items-center gap-2.5 text-left hover:bg-orange-50 transition-colors text-orange-600 group disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="w-6 h-6 rounded-full bg-orange-50 group-hover:bg-orange-100 flex items-center justify-center transition-colors">
          {isDeleting ? (
            <Loader2 className="w-3.5 h-3.5 text-orange-500 animate-spin" />
          ) : (
            <Trash2 className="w-3.5 h-3.5 text-orange-500" />
          )}
        </span>
        <span className="text-sm font-medium text-orange-600">
          {isDeleting ? "Đang xóa..." : "Xóa với tôi"}
        </span>
      </button>

      {/* Nút Thu hồi — chỉ hiện nếu là tin nhắn của chính mình */}
      {canRevoke && (
        <button
          type="button"
          onClick={() => {
            onRevoke();
            onClose();
          }}
          className="w-full px-3 py-2.5 flex items-center gap-2.5 text-left hover:bg-red-50 transition-colors text-red-600 group"
        >
          <span className="w-6 h-6 rounded-full bg-red-50 group-hover:bg-red-100 flex items-center justify-center transition-colors">
            <RotateCcw className="w-3.5 h-3.5 text-red-500" />
          </span>
          <span className="text-sm font-medium text-red-600">Thu hồi</span>
        </button>
      )}

      {/* Nút Ghim tin nhắn */}
      <button
        type="button"
        onClick={() => {
          onPin?.();
          onClose();
        }}
        className="w-full px-3 py-2.5 flex items-center gap-2.5 text-left hover:bg-blue-50 transition-colors text-blue-600 group"
      >
        <span className="w-6 h-6 rounded-full bg-blue-50 group-hover:bg-blue-100 flex items-center justify-center transition-colors">
          <Pin className="w-3.5 h-3.5 text-blue-500 fill-blue-500" />
        </span>
        <span className="text-sm font-medium text-blue-600">Ghim tin nhắn</span>
      </button>

      {/* Nút Chuyển tiếp — hiện cho MỌI tin nhắn (kể cả đã thu hồi trên Zalo UX) */}
      <button
        type="button"
        onClick={() => {
          onForward();
          onClose();
        }}
        className="w-full px-3 py-2.5 flex items-center gap-2.5 text-left hover:bg-blue-50 transition-colors text-blue-600 group"
      >
        <span className="w-6 h-6 rounded-full bg-blue-50 group-hover:bg-blue-100 flex items-center justify-center transition-colors">
          <Share2 className="w-3.5 h-3.5 text-blue-500" />
        </span>
        <span className="text-sm font-medium text-blue-600">Chuyển tiếp</span>
      </button>

      {/* Tùy chọn khác cho tin nhắn người khác */}
      {!canRevoke && (
        <>
          <button
            type="button"
            className="w-full px-3 py-2.5 flex items-center gap-2.5 text-left hover:bg-gray-50 transition-colors text-gray-700"
          >
            <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
              <Smile className="w-3.5 h-3.5 text-gray-500" />
            </span>
            <span className="text-sm">Thả cảm xúc</span>
          </button>
          <button
            type="button"
            className="w-full px-3 py-2.5 flex items-center gap-2.5 text-left hover:bg-gray-50 transition-colors text-gray-700"
          >
            <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
              <MoreHorizontal className="w-3.5 h-3.5 text-gray-500" />
            </span>
            <span className="text-sm">Xem thêm</span>
          </button>
        </>
      )}
    </div>
  );
}

export default function ChatWindow({ authUser }: ChatWindowProps) {
  const {
    selectedFriend,
    selectedGroup,
    chatMode,
    isAiChatOpen,
    pendingAiPrompt,
    clearPendingAiPrompt,
    setOutgoingCall,
    setActiveCall,
    friends,
    setSelectedFriend,
    setSelectedGroup,
    replyingMessage,
    setReplyingMessage,
    clearReplyingMessage,
  } = useChatStore();
  const { myGroups } = useGroupsStore();

  const {
    isRecording,
    audioBlob,
    recordingTime,
    startRecording,
    stopRecording,
    cancelRecording,
    setAudioBlob,
  } = useAudioRecorder();

  const currentUserId = String((authUser as any)._id || authUser.id || "");
  const currentUserName = authUser.displayName || authUser.username || "User";
  const aiHistoryStorageKey = `${AI_HISTORY_STORAGE_PREFIX}:${currentUserId}`;

  // ── Private mode ───────────────────────────────────────────────────────
  const friendId = selectedFriend?.friend_id ?? null;
  const {
    messages: dmMessages,
    isLoadingHistory: dmLoading,
    historyError: dmError,
    sendMessage: sendDmMessage,
    sendFileMessage: sendDmFileMessage,
    sendStickerMessage: sendDmStickerMessage,
    sendEmojiMessage: sendDmEmojiMessage,
    isSending: dmSending,
    isUploadingFile: dmUploadingFile,
    uploadProgress: dmUploadProgress,
    bottomSentinelRef: dmSentinelRef,
    scrollContainerRef: dmScrollRef,
    handleScroll: dmHandleScroll,
    typingUsers: dmTypingUsers,
    onTypingChange: dmTypingChange,
    deleteMessage: deleteDmMessage,
    setMessages: setDmMessages,
  } = useDirectMessage(friendId);

  // ── Group mode ────────────────────────────────────────────────────────
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [resolvedAvatarUrls, setResolvedAvatarUrls] = useState<
    Record<string, string>
  >({});

  const {
    messages: groupMessages,
    isLoadingHistory: groupLoading,
    historyError: groupError,
    sendMessage: sendGroupMessage,
    sendFileMessage: sendGroupFileMessage,
    sendStickerMessage: sendGroupStickerMessage,
    sendEmojiMessage: sendGroupEmojiMessage,
    isSending: groupSending,
    isUploadingFile: groupUploadingFile,
    uploadProgress: groupUploadProgress,
    bottomSentinelRef: groupSentinelRef,
    scrollContainerRef: groupScrollRef,
    handleScroll: groupHandleScroll,
    typingUsers: groupTypingUsers,
    onTypingChange: groupTypingChange,
    deleteMessage: deleteGroupMessage,
    setMessages: setGroupMessages,
  } = useGroupChat(selectedGroup ?? null, groupMembers);

  // Load group members when selectedGroup changes
  useEffect(() => {
    if (!selectedGroup) {
      setGroupMembers([]);
      return;
    }
    const groupIdForMembers = selectedGroup.groupId;

    getGroupMembers(groupIdForMembers)
      .then((members) => {
        const normalized: GroupMember[] = members.map((m) => ({
          userId: String(m.userId),
          displayName: m.displayName || m.username || String(m.userId),
          username: m.username || "",
          avatarUrl: m.avatarUrl || null,
          role:
            String(m.role).toUpperCase() === "OWNER"
              ? "OWNER"
              : String(m.role).toUpperCase() === "DEPUTY" ||
                String(m.role).toUpperCase() === "ADMIN"
                ? "DEPUTY"
                : "MEMBER",
        }));
        setGroupMembers(normalized);
      })
      .catch(() => setGroupMembers([]));
  }, [selectedGroup]);

  const {
    status,
    emitCallUser,
    socket,
  } = useSocket();
  const { status, emitCallUser } = useSocket();
  const { addToast } = useToast();
  const [inputValue, setInputValue] = useState("");
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiConversation, setAiConversation] = useState<AiConversationTurn[]>([]);
  const [isAskingAI, setIsAskingAI] = useState(false);
  const [aiError, setAiError] = useState("");

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchScope, setSearchScope] = useState<SearchScope>("conversation");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchFromDate, setSearchFromDate] = useState("");
  const [searchToDate, setSearchToDate] = useState("");
  const [searchResults, setSearchResults] = useState<MessageSearchRow[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [focusedMessageId, setFocusedMessageId] = useState<string | null>(null);
  const [isFocusBlue, setIsFocusBlue] = useState(false);
  const [pendingFocusMessageId, setPendingFocusMessageId] = useState<string | null>(null);
  const [isPinnedExpanded, setIsPinnedExpanded] = useState(false);
  const focusTimeoutRef = useRef<number | null>(null);

  const todayDateString = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }, []);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isConnected = status === "connected";

  const activeConversationId = useMemo(() => {
    if (chatMode === "GROUP") {
      return selectedGroup ? groupConversationId(selectedGroup.groupId) : null;
    }
    if (!selectedFriend?.friend_id) return null;
    return dmConversationId(currentUserId, selectedFriend.friend_id);
  }, [chatMode, currentUserId, selectedFriend?.friend_id, selectedGroup]);

  const [pickerOpen, setPickerOpen] = useState(false);

  // ── Location Share state ─────────────────────────────────────────────────
  const [locationMenuOpen, setLocationMenuOpen] = useState(false);

  // useLiveLocation: quản lý live location realtime
  const {
    isSharing: isLiveSharing,
    liveLocations,
    myLocation,
    startSharing,
    stopSharing,
  } = useLiveLocation(activeConversationId);

  /** Gửi vị trí hiện tại (một lần) qua API */
  async function handleSendCurrentLocation() {
    setLocationMenuOpen(false);
    if (!activeConversationId) {
      addToast("Vui lòng chọn cuộc trò chuyện trước", "error");
      return;
    }
    if (!navigator.geolocation) {
      addToast("Trình duyệt không hỗ trợ Geolocation", "error");
      return;
    }
    addToast("Đang lấy vị trí...", "info", 2000);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        try {
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/messages/location`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${authUser.token}`,
              },
              body: JSON.stringify({ conversationId: activeConversationId, locationData: { lat, lng } }),
            },
          );
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || "Gửi vị trí thất bại");
          }
          // Lấy tin nhắn từ response và thêm vào state local của người gửi (bên A)
          const savedMsg = await res.json();
          const localMsg = {
            ...savedMsg,
            isOwn: true,
            sendStatus: "sent" as const,
          };
          if (chatMode === "GROUP") {
            setGroupMessages((prev) => {
              if (prev.some((m) => String(m.id) === String(savedMsg.id))) return prev;
              return [...prev, localMsg];
            });
          } else {
            setDmMessages((prev) => {
              if (prev.some((m) => String(m.id) === String(savedMsg.id))) return prev;
              return [...prev, localMsg];
            });
          }
          addToast("Đã gửi vị trí!", "success", 2000);
        } catch (err: any) {
          addToast(err?.message || "Không thể gửi vị trí", "error");
        }
      },
      (err) => {
        const msgs: Record<number, string> = {
          1: "Bạn đã từ chối quyền truy cập vị trí",
          2: "Không xác định được vị trí",
          3: "Hết thời gian chờ lấy vị trí",
        };
        addToast(msgs[err.code] || "Lỗi Geolocation", "error");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }

  /** Bắt đầu / dừng chia sẻ Live Location */
  async function handleToggleLiveLocation(durationMs?: number) {
    setLocationMenuOpen(false);
    if (isLiveSharing || !durationMs) {
      stopSharing();
      
      // Cập nhật local state messages để đổi status thành "đã dừng"
      const now = new Date(Date.now() - 1000).toISOString(); // Lùi lại 1s để chắc chắn đã hết hạn
      if (chatMode === "GROUP") {
        setGroupMessages((prev) => prev.map(m => 
          (m.contentType === "location" && m.isOwn && (m.locationData as any)?.isLive && (!m.locationData?.liveUntil || new Date(m.locationData.liveUntil).getTime() > Date.now())) 
            ? { ...m, locationData: { ...m.locationData, liveUntil: now } as any } 
            : m
        ));
      } else {
        setDmMessages((prev) => prev.map(m => 
          (m.contentType === "location" && m.isOwn && (m.locationData as any)?.isLive && (!m.locationData?.liveUntil || new Date(m.locationData.liveUntil).getTime() > Date.now())) 
            ? { ...m, locationData: { ...m.locationData, liveUntil: now } as any } 
            : m
        ));
      }
      
      addToast("Đã dừng chia sẻ vị trí trực tiếp", "info", 2000);
    } else {
      if (!activeConversationId) {
        addToast("Vui lòng chọn cuộc trò chuyện trước", "error");
        return;
      }
      if (!navigator.geolocation) {
        addToast("Trình duyệt không hỗ trợ Geolocation", "error");
        return;
      }
      // Lấy vị trí hiện tại trước, rồi mới bắt đầu share + gửi tin nhắn
      addToast("Đang lấy vị trí...", "info", 2000);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude: lat, longitude: lng } = position.coords;
          // Thời điểm kết thúc theo durationMs
          const liveUntil = new Date(Date.now() + durationMs).toISOString();
          try {
            // Gửi tin nhắn live_location vào chat qua API
            const res = await fetch(
              `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/messages/location`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${authUser.token}`,
                },
                body: JSON.stringify({
                  conversationId: activeConversationId,
                  locationData: { lat, lng, label: "Đang chia sẻ hành trình" },
                  isLive: true,
                  liveUntil,
                }),
              },
            );
            if (res.ok) {
              const savedMsg = await res.json();
              const localMsg = {
                ...savedMsg,
                isOwn: true,
                sendStatus: "sent" as const,
                locationData: { lat, lng, label: "Đang chia sẻ hành trình", isLive: true, liveUntil },
                senderAvatarUrl: (authUser as any).avatarUrl || null,
                senderDisplayName: authUser.displayName || authUser.username || null,
              };
              if (chatMode === "GROUP") {
                setGroupMessages((prev) => {
                  if (prev.some((m) => String(m.id) === String(savedMsg.id))) return prev;
                  return [...prev, localMsg];
                });
              } else {
                setDmMessages((prev) => {
                  if (prev.some((m) => String(m.id) === String(savedMsg.id))) return prev;
                  return [...prev, localMsg];
                });
              }
            }
          } catch {
            // Nếu API lỗi, vẫn tiếp tục share qua socket
          }
          // Bắt đầu live share qua socket sau khi đã gửi tin nhắn
          startSharing();
          addToast("Đang chia sẻ vị trí trực tiếp...", "success", 3000);
        },
        () => {
          addToast("Không thể lấy vị trí. Vui lòng cấp quyền.", "error");
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
      );
    }
  }


  // ── Context menu state ──────────────────────────────────────────────────
  const [ctxMenu, setCtxMenu] = useState<{
    x: number;
    y: number;
    msg: GroupChatMessage;
    conversationId: string;
    canRevoke: boolean;
  } | null>(null);

  // ── Forward modal state ────────────────────────────────────────────────
  const [forwardModal, setForwardModal] = useState<{
    message: GroupChatMessage;
    sourceConversationId: string;
  } | null>(null);

  function handleMessageContextMenu(
    e: React.MouseEvent,
    msg: GroupChatMessage,
    conversationId: string,
    isOwn: boolean,
  ) {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({
      x: e.clientX,
      y: e.clientY,
      msg,
      conversationId,
      canRevoke: isOwn,
    });
  }

  function closeCtxMenu() {
    setCtxMenu(null);
  }

  // ── Revoke handler ──────────────────────────────────────────────────────
  const [revokingMessageId, setRevokingMessageId] = useState<string | null>(null);

  async function handleRevokeMessage() {
    if (!ctxMenu) return;
    const { msg, conversationId } = ctxMenu;
    setRevokingMessageId(String(msg.id));

    try {
      const { revokeMessage: revokeApi } = await import("../api");
      await revokeApi({ conversationId, messageId: String(msg.id) });
      addToast("Tin nhắn đã được thu hồi", "success");
      closeCtxMenu();
    } catch (err: unknown) {
      const msg2 =
        err instanceof Error ? err.message : "Không thể thu hồi tin nhắn";
      addToast(msg2, "error");
    } finally {
      setRevokingMessageId(null);
    }
  }

  // ── Delete-for-me handler ───────────────────────────────────────────────
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);

  async function handleDeleteForMe() {
    if (!ctxMenu) return;
    const { msg, conversationId } = ctxMenu;
    const msgId = String(msg.id);
    setDeletingMessageId(msgId);

    // Optimistic: xóa ngay khỏi UI trước khi API trả về
    const targetDeleteFn =
      chatMode === "GROUP" ? deleteGroupMessage : deleteDmMessage;
    targetDeleteFn(msgId);

    try {
      const { deleteMessageForMe: deleteApi } = await import("../api");
      await deleteApi({ conversationId, messageId: msgId });
      addToast("Đã ẩn tin nhắn khỏi cuộc trò chuyện này", "success");
      closeCtxMenu();
    } catch (err: unknown) {
      addToast(
        err instanceof Error ? err.message : "Không thể ẩn tin nhắn",
        "error",
      );
    } finally {
      setDeletingMessageId(null);
    }
  }

  function handleForwardMessage(msg: GroupChatMessage, conversationId: string) {
    closeCtxMenu();
    setForwardModal({ message: msg, sourceConversationId: conversationId });
  }

  // ── Settings sidebar state ──────────────────────────────────────────────
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // ── Chat background state ──────────────────────────────────────────────
  const [chatBgUrl, setChatBgUrl] = useState<string | null>(null);

  // ── Pinned messages state ──────────────────────────────────────────────
  const [pinnedMessages, setPinnedMessages] = useState<any[]>([]);

  // Load pinned messages when conversation changes
  useEffect(() => {
    if (chatMode === "GROUP") {
      setPinnedMessages(selectedGroup?.pinnedMessages || []);
    } else {
      setPinnedMessages(selectedFriend?.pinnedMessages || []);
    }
  }, [chatMode, selectedGroup?.pinnedMessages, selectedFriend?.pinnedMessages]);

  // Listen for pinned messages updates
  useEffect(() => {
    if (!socket || !activeConversationId) return;

    const handlePinnedUpdate = (data: { roomId: string; pinnedMessages: any[] }) => {
      if (String(data.roomId) === String(activeConversationId)) {
        setPinnedMessages(data.pinnedMessages);
      }
    };

    socket.on("message_pinned_updated", handlePinnedUpdate);
    return () => {
      socket.off("message_pinned_updated", handlePinnedUpdate);
    };
  }, [socket, activeConversationId]);

  async function handlePinMessage(msg: GroupChatMessage) {
    if (!socket || !activeConversationId) return;
    
    // Tạo snapshot của tin nhắn để ghim
    const pinData = {
      id: msg.id,
      content: msg.content,
      contentType: msg.contentType,
      senderId: msg.senderId,
      senderName: msg.senderDisplayName || (Number(msg.senderId) === Number(currentUserId) ? "Bạn" : "Người dùng"),
      createdAt: msg.createdAt,
    };

    socket.emit("pin_message", { roomId: activeConversationId, message: pinData }, (res: any) => {
      if (res.ok) {
        addToast("Đã ghim tin nhắn", "success");
      } else {
        addToast(res.error || "Không thể ghim tin nhắn", "error");
      }
    });
    closeCtxMenu();
  }

  async function handleUnpinMessage(messageId: string | number) {
    if (!socket || !activeConversationId) return;
    
    socket.emit("unpin_message", { roomId: activeConversationId, messageId: String(messageId) }, (res: any) => {
      if (res.ok) {
        addToast("Đã bỏ ghim tin nhắn", "success");
      } else {
        addToast(res.error || "Không thể bỏ ghim tin nhắn", "error");
      }
    });
  }

  const canUnpin = useCallback((pin: any) => {
    // Nếu tin nhắn cũ chưa có pinnedBy, cho phép gỡ (Zalo UX fallback)
    if (!pin.pinnedBy) return true;
    // Nếu mình là người ghim, cho phép gỡ
    if (String(pin.pinnedBy) === currentUserId) return true;
    // Nếu là nhóm và mình là OWNER/DEPUTY, cho phép gỡ mọi ghim
    if (chatMode === "GROUP") {
      const me = groupMembers.find((m) => String(m.userId) === currentUserId);
      if (me?.role === "OWNER" || me?.role === "DEPUTY") return true;
    }
    return false;
  }, [currentUserId, chatMode, groupMembers]);

  // Load background when selectedFriend changes
  useEffect(() => {
    if (!selectedFriend?.friendshipId) {
      setChatBgUrl(null);
      return;
    }
    getChatBackground(selectedFriend.friendshipId)
      .then(res => setChatBgUrl(res.chatBgUrl))
      .catch(() => setChatBgUrl(null));
  }, [selectedFriend?.friendshipId]);

  // Listen for real-time background updates via socket
  useEffect(() => {
    if (!socket || !selectedFriend?.friendshipId) return;

    const handleBgUpdate = (data: { friendshipId: string; bgUrl: string | null }) => {
      if (String(data.friendshipId) === String(selectedFriend.friendshipId)) {
        setChatBgUrl(data.bgUrl);
      }
    };

    socket.on("chat_background_updated", handleBgUpdate);
    return () => {
      socket.off("chat_background_updated", handleBgUpdate);
    };
  }, [socket, selectedFriend?.friendshipId]);

  // Lấy ref đúng dựa trên mode
  const activeSentinelRef =
    chatMode === "GROUP" ? groupSentinelRef : dmSentinelRef;
  const activeScrollRef = chatMode === "GROUP" ? groupScrollRef : dmScrollRef;
  const activeHandleScroll = chatMode === "GROUP" ? groupHandleScroll : dmHandleScroll;
  const activeTypingUsers =
    chatMode === "GROUP" ? groupTypingUsers : dmTypingUsers;
  const activeTypingChange =
    chatMode === "GROUP" ? groupTypingChange : dmTypingChange;

  // Track conversation ID trước đó để phát hiện khi chuyển conversation
  const prevConversationIdRef = useRef<string | null>(null);

  // Scroll xuống bottom mỗi khi:
  // 1. Chuyển sang conversation mới (kể cả quay lại conversation cũ)
  // 2. Loading hoàn thành (messages đã có trong DOM)
  // Tính loading state trực tiếp từ các biến đã khai báo (tránh TDZ với activeLoading)
  useEffect(() => {
    const currentConvId = activeConversationId;
    if (!currentConvId) return;

    // Tính loading state inline để tránh dùng activeLoading trước khi khai báo
    const isLoading = chatMode === "GROUP" ? groupLoading : dmLoading;
    if (isLoading) return;

    // Cập nhật ref để track conversation hiện tại
    prevConversationIdRef.current = currentConvId;

    // Dùng double-rAF để đảm bảo React đã render messages vào DOM
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (activeScrollRef.current) {
          activeScrollRef.current.scrollTop = activeScrollRef.current.scrollHeight;
        }
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId, chatMode, groupLoading, dmLoading]);

  const friendName = selectedFriend?.friend_display_name ?? "";
  const groupName = selectedGroup?.name ?? "";
  const memberCount = groupMembers.length || selectedGroup?.memberCount || 0;

  const resolveDisplayAvatar = useCallback(
    (rawUrl: string | null | undefined) => {
      const input = String(rawUrl || "").trim();
      if (!input) return null;
      if (!/\.amazonaws\.com/i.test(input)) return input;
      return resolvedAvatarUrls[input] || input;
    },
    [resolvedAvatarUrls],
  );

  const resolvedGroupMembers = useMemo(
    () =>
      groupMembers.map((m) => ({
        ...m,
        avatarUrl: resolveDisplayAvatar(m.avatarUrl),
      })),
    [groupMembers, resolveDisplayAvatar],
  );

  useEffect(() => {
    let cancelled = false;

    const rawUrls = new Set<string>();

    for (const member of groupMembers) {
      const raw = String(member.avatarUrl || "").trim();
      if (raw) rawUrls.add(raw);
    }

    for (const msg of groupMessages) {
      const raw = String(msg.senderAvatarUrl || "").trim();
      if (raw) rawUrls.add(raw);
    }

    for (const msg of dmMessages) {
      const raw = String(msg.senderAvatarUrl || "").trim();
      if (raw) rawUrls.add(raw);
    }

    const selectedFriendAvatar = String(
      selectedFriend?.friend_avatar_url || "",
    ).trim();
    if (selectedFriendAvatar) {
      rawUrls.add(selectedFriendAvatar);
    }

    const candidates = Array.from(rawUrls).filter((raw) => {
      if (!/\.amazonaws\.com/i.test(raw)) return false;
      if (/X-Amz-Algorithm=/i.test(raw)) return false;
      return !resolvedAvatarUrls[raw];
    });

    if (candidates.length === 0) return;

    Promise.all(
      candidates.map(async (raw) => {
        try {
          const signed = await getPresignedViewUrl({ url: raw });
          return [raw, signed.viewUrl || raw] as const;
        } catch {
          return [raw, raw] as const;
        }
      }),
    ).then((entries) => {
      if (cancelled) return;
      setResolvedAvatarUrls((prev) => {
        const next = { ...prev };
        let changed = false;

        for (const [raw, resolved] of entries) {
          if (resolved && next[raw] !== resolved) {
            next[raw] = resolved;
            changed = true;
          }
        }

        return changed ? next : prev;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [
    groupMembers,
    groupMessages,
    dmMessages,
    selectedFriend?.friend_avatar_url,
    resolvedAvatarUrls,
  ]);

  async function submitAiQuestion(rawQuestion: string) {
    const trimmed = rawQuestion.trim();
    if (!trimmed || isAskingAI) return;

    const turnId = `${Date.now()}`;
    setAiError("");
    setAiQuestion("");
    setAiConversation((prev) => {
      const next = [
        ...prev,
        { id: `${turnId}-u`, role: "user" as const, content: trimmed },
      ];
      return next.slice(-60);
    });

    try {
      setIsAskingAI(true);
      const response = await askBot(trimmed);
      setAiConversation((prev) => {
        const next = [
          ...prev,
          {
            id: `${turnId}-a`,
            role: "assistant" as const,
            content: response.content || "AI chưa có phản hồi.",
          },
        ];
        return next.slice(-60);
      });
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.message || "Không thể kết nối AI Bot.";
      setAiError(errorMessage);
    } finally {
      setIsAskingAI(false);
    }
  }

  useEffect(() => {
    if (!isAiChatOpen || !pendingAiPrompt.trim()) return;
    const prompt = pendingAiPrompt;
    clearPendingAiPrompt();
    void submitAiQuestion(prompt);
  }, [isAiChatOpen, pendingAiPrompt, clearPendingAiPrompt]);

  useEffect(() => {
    if (!currentUserId) return;
    try {
      const raw = window.localStorage.getItem(aiHistoryStorageKey);
      if (!raw) {
        setAiConversation([]);
        return;
      }
      const parsed = JSON.parse(raw) as AiConversationTurn[];
      if (!Array.isArray(parsed)) {
        setAiConversation([]);
        return;
      }

      const normalized = parsed
        .filter(
          (item) =>
            item &&
            (item.role === "user" || item.role === "assistant") &&
            typeof item.content === "string" &&
            item.content.trim().length > 0,
        )
        .map((item, index) => ({
          id: String(item.id || `${Date.now()}-${index}`),
          role: item.role,
          content: item.content,
        }))
        .slice(-60);

      setAiConversation(normalized);
    } catch {
      setAiConversation([]);
    }
  }, [currentUserId, aiHistoryStorageKey]);

  useEffect(() => {
    if (!currentUserId) return;
    try {
      window.localStorage.setItem(
        aiHistoryStorageKey,
        JSON.stringify(aiConversation.slice(-60)),
      );
    } catch {
      // ignore localStorage write errors in private mode/quota limits
    }
  }, [aiConversation, currentUserId, aiHistoryStorageKey]);

  async function handleStartVideoCall() {
    const isGroupCall = chatMode === "GROUP";
    const hasTarget = isGroupCall
      ? selectedGroup != null
      : selectedFriend != null;

    if (!hasTarget) return;
    try {
      const directFriendId = String(
        (selectedFriend as any)?.friend_id ??
        (selectedFriend as any)?._id ??
        (selectedFriend as any)?.id ??
        "",
      );

      if (!isGroupCall && !directFriendId) {
        throw new Error("Khong tim thay ID nguoi nhan de goi 1-1");
      }

      const normalizedGroupId = isGroupCall
        ? String(selectedGroup!.groupId).replace("group_", "")
        : "";

      const rawRoomId = isGroupCall
        ? `group_call_${normalizedGroupId}`
        : `call_1vs1_${[currentUserId, directFriendId].sort().join("_")}`;
      const safeRoomId = rawRoomId.replace(/:/g, "_");
      const conversationId = isGroupCall
        ? groupConversationId(selectedGroup!.groupId)
        : dmConversationId(currentUserId, directFriendId);

      if (isGroupCall) {
        const groupCallPayload = {
          groupId: String(selectedGroup!.groupId),
          roomId: safeRoomId,
          callerId: currentUserId,
          callerName: currentUserName,
        };
        // Emit socket để backend lưu group_call_started và broadcast banner
        emitCallUser({
          ...groupCallPayload,
          receiverId: String(selectedGroup!.groupId),
          conversationId,
          isGroupCall: true,
        });
        // Caller join phòng ngay (không cần cần cần chờ ai accept) — lấy token rồi set activeCall
        try {
          const response = await apiClient.get<{ appID: number; token: string }>("/api/calls/token", {
            params: { userID: currentUserId },
          });
          setActiveCall({
            roomId: safeRoomId,
            token: String(response.data.token),
            appId: Number(response.data.appID),
            conversationId,
            remoteUserId: String(selectedGroup!.groupId),
            remoteUserName: groupName || "Nhóm",
            isGroupCall: true,
          });
        } catch {
          addToast("Không thể tạo phòng gọi nhóm", "error", 2500);
        }
      } else {
        const oneToOnePayload = {
          roomId: safeRoomId,
          callerId: currentUserId,
          callerName: currentUserName,
          receiverId: directFriendId,
          to: directFriendId,
          conversationId,
          isGroupCall: false,
        };
        console.debug("[ChatWindow][emit call-user] payload:", oneToOnePayload);
        emitCallUser(oneToOnePayload);
        setOutgoingCall({
          roomId: safeRoomId,
          conversationId,
          receiverId: directFriendId,
          receiverName: friendName || "Ban be",
          isGroupCall: false,
        });
      }
    } catch {
      addToast("Khong the bat dau cuoc goi", "error", 2500);
    }
  }

  /** Tham gia phòng gọi nhóm đang diễn ra (từ nút [Tham gia] trong banner) */
  async function handleJoinGroupCall(roomId: string) {
    if (!roomId || !currentUserId) return;
    const conversationId = selectedGroup ? groupConversationId(selectedGroup.groupId) : roomId;
    try {
      const response = await apiClient.get<{ appID: number; token: string }>("/api/calls/token", {
        params: { userID: currentUserId },
      });
      setActiveCall({
        roomId,
        token: String(response.data.token),
        appId: Number(response.data.appID),
        conversationId,
        remoteUserId: selectedGroup ? String(selectedGroup.groupId) : "",
        remoteUserName: groupName || "Nhóm",
        isGroupCall: true,
      });
    } catch {
      addToast("Không thể tham gia cuộc gọi nhóm", "error", 2500);
    }
  }

  // Khi chuyển đổi giữa nhóm và DM, clear input
  useEffect(() => {
    setInputValue("");
  }, [chatMode, selectedGroup?.groupId, selectedFriend?.friend_id]);

  const handleSend = useCallback(async () => {
    if (!inputValue.trim()) return;

    if (chatMode === "GROUP" && selectedGroup) {
      const allowSendLinks = selectedGroup.allowSendLinks || 'ALL';
      if (allowSendLinks === 'ADMINS_ONLY') {
        const currentUserRole = groupMembers.find((m) => String(m.userId) === String(currentUserId))?.role;
        if (currentUserRole === 'MEMBER' || !currentUserRole) {
          const hasUrl = /https?:\/\/[^\s]+|www\.[^\s]+/i.test(inputValue);
          if (hasUrl) {
            addToast("Chỉ Trưởng/Phó nhóm mới được phép gửi liên kết trong nhóm này.", "warning", 3000);
            return;
          }
        }
      }
    }

    if (chatMode === "GROUP") {
      if (groupSending) return;
      await sendGroupMessage(inputValue, replyingMessage?.id || null);
    } else {
      if (dmSending) return;
      await sendDmMessage(inputValue, replyingMessage?.id || null);
    }

    setInputValue("");
    clearReplyingMessage();
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    textareaRef.current?.focus();
  }, [
    inputValue,
    chatMode,
    groupSending,
    dmSending,
    sendGroupMessage,
    sendDmMessage,
    replyingMessage,
    clearReplyingMessage,
  ]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handlePickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!isConnected) {
      addToast("Mất kết nối, chưa thể gửi tệp", "error");
      return;
    }

    try {
      if (chatMode === "GROUP") {
        if (groupUploadingFile) return;
        await sendGroupFileMessage(file);
        return;
      }

      if (!selectedFriend?.friend_id) {
        addToast("Vui lòng chọn một cuộc trò chuyện cá nhân", "error");
        return;
      }

      await sendDmFileMessage(file);
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Không thể gửi tệp, vui lòng thử lại";
      addToast(message, "error");
    }
  }

  const handleSendAudio = async () => {
    if (audioBlob) {
      const audioFile = new File([audioBlob], `voice_${Date.now()}.webm`, { type: "audio/webm" });
      try {
        if (chatMode === "GROUP") {
          if (groupUploadingFile) return;
          await sendGroupFileMessage(audioFile);
        } else {
          if (!selectedFriend?.friend_id) return;
          await sendDmFileMessage(audioFile);
        }
        setAudioBlob(null);
      } catch (error: any) {
        addToast("Không thể gửi tin nhắn thoại", "error");
      }
    }
  };

  // ── Reply Message Handlers ─────────────────────────────────────────────
  function handleReplyToMessage(msg: GroupChatMessage) {
    const replyInfo: ReplyToMessage = {
      id: msg.id,
      content: msg.content || "",
      contentType: msg.contentType,
      senderId: msg.senderId,
      senderDisplayName: msg.senderDisplayName || null,
      senderAvatarUrl: msg.senderAvatarUrl || null,
      attachments: msg.attachments || null,
    };
    setReplyingMessage(replyInfo);
  }

  function handleJumpToMessage(messageId: string | number) {
    const domId = getMessageDomId(messageId);
    const target = document.getElementById(domId);
    if (!target) {
      addToast("Tin nhắn gốc không còn trong cuộc trò chuyện này", "info");
      return;
    }
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    setFocusedMessageId(String(messageId));
    if (focusTimeoutRef.current != null) {
      window.clearTimeout(focusTimeoutRef.current);
    }
    focusTimeoutRef.current = window.setTimeout(() => {
      setFocusedMessageId(null);
      focusTimeoutRef.current = null;
    }, 2000);
  }

  function handleClearReply() {
    clearReplyingMessage();
  }

  async function handleAskAI() {
    await submitAiQuestion(aiQuestion);
  }

  function handleAiKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    void handleAskAI();
  }

  async function handleSearchMessages(e?: React.FormEvent) {
    e?.preventDefault();
    if (searchScope === "conversation" && !activeConversationId) {
      setSearchError("Vui lòng chọn một cuộc trò chuyện trước.");
      return;
    }

    setSearchLoading(true);
    setSearchError("");
    try {
      const response =
        searchScope === "conversation"
          ? await searchConversationMessages({
              conversationId: activeConversationId as string,
              keyword: searchKeyword.trim() || undefined,
              fromDate: searchFromDate || undefined,
              toDate: searchToDate || undefined,
              limit: 100,
            })
          : await searchGlobalMessages({
              keyword: searchKeyword.trim() || undefined,
              fromDate: searchFromDate || undefined,
              toDate: searchToDate || undefined,
              limit: 100,
            });
      setSearchResults((response.data || []) as MessageSearchRow[]);
    } catch (error: any) {
      setSearchResults([]);
      setSearchError(
        error?.message || "Không thể tìm kiếm tin nhắn, vui lòng thử lại",
      );
    } finally {
      setSearchLoading(false);
    }
  }

  useEffect(() => {
    setSearchOpen(false);
    setSearchScope("conversation");
    setSearchResults([]);
    setSearchError("");
    setSearchKeyword("");
    setSearchFromDate("");
    setSearchToDate("");
  }, [activeConversationId]);

  function triggerFocusMessage(messageId: string | number) {
    const domId = getMessageDomId(messageId);
    const target = document.getElementById(domId);
    if (!target) return;

    target.scrollIntoView({ behavior: "smooth", block: "center" });
    setFocusedMessageId(String(messageId));

    if (focusTimeoutRef.current != null) {
      window.clearTimeout(focusTimeoutRef.current);
    }
    focusTimeoutRef.current = window.setTimeout(() => {
      setFocusedMessageId(null);
      setIsFocusBlue(false);
      focusTimeoutRef.current = null;
    }, 1800);
  }

  useEffect(() => {
    return () => {
      if (focusTimeoutRef.current != null) {
        window.clearTimeout(focusTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!pendingFocusMessageId) return;
    const t = window.setTimeout(() => {
      triggerFocusMessage(pendingFocusMessageId);
      setPendingFocusMessageId(null);
    }, 120);
    return () => window.clearTimeout(t);
  }, [
    pendingFocusMessageId,
    activeConversationId,
    chatMode,
    groupMessages,
    dmMessages,
  ]);

  function handleSearchResultClick(item: MessageSearchRow) {
    setIsFocusBlue(false); // Đảm bảo search dùng highlight vàng mặc định
    const targetConversationId = String(item.conversationId || "");

    if (targetConversationId === activeConversationId) {
      triggerFocusMessage(item.id);
      return;
    }

    if (targetConversationId.startsWith("dm:")) {
      const ids = targetConversationId.slice(3).split(":");
      const friendId = ids.find((id) => String(id) !== String(currentUserId));
      const targetFriend = friends.find(
        (friend) => String(friend.friend_id) === String(friendId || ""),
      );
      if (!targetFriend) {
        addToast("Khong tim thay cuoc tro chuyen ca nhan tu ket qua nay", "error");
        return;
      }
      setSelectedFriend(targetFriend);
      setPendingFocusMessageId(String(item.id));
      setSearchOpen(false);
      return;
    }

    const targetGroup = myGroups.find(
      (group) => String(group.groupId) === targetConversationId,
    );
    if (!targetGroup) {
      addToast("Khong tim thay nhom tu ket qua nay", "error");
      return;
    }

    setSelectedGroup(targetGroup as any);
    setPendingFocusMessageId(String(item.id));
    setSearchOpen(false);
  }

  function handleSearchClearFilters() {
    setSearchKeyword("");
    setSearchFromDate("");
    setSearchToDate("");
    setSearchResults([]);
    setSearchError("");
  }

  // ── Emoji / Sticker picker handlers ────────────────────────────────────
  async function handleEmojiSelect(emoji: string) {
    setPickerOpen(false);
    if (!emoji.trim()) return;

    if (chatMode === "GROUP") {
      await sendGroupEmojiMessage(emoji);
    } else {
      await sendDmEmojiMessage(emoji);
    }
  }

  async function handleStickerSelect(stickerData: StickerData) {
    setPickerOpen(false);
    if (chatMode === "GROUP") {
      await sendGroupStickerMessage(stickerData);
    } else {
      await sendDmStickerMessage(stickerData);
    }
  }

  // ── Lấy danh sách tin nhắn & trạng thái đúng mode ───────────────────
  const activeMessages: GroupChatMessage[] =
    chatMode === "GROUP" ? groupMessages : dmMessages;
  const activeLoading = chatMode === "GROUP" ? groupLoading : dmLoading;
  const activeError = chatMode === "GROUP" ? groupError : dmError;
  const activeSending = chatMode === "GROUP" ? groupSending : dmSending;
  const activeUploading =
    chatMode === "GROUP" ? groupUploadingFile : dmUploadingFile;
  const activeUploadProgress =
    chatMode === "GROUP" ? groupUploadProgress : dmUploadProgress;

  const placeHolder =
    chatMode === "GROUP"
      ? `Nhắn tin trong ${groupName}`
      : `Nhắn tin cho ${friendName}`;

  // ── Header ──────────────────────────────────────────────────────────
  function renderHeader() {
    if (isAiChatOpen) {
      return (
        <div className="h-17 bg-white/80 backdrop-blur-md border-b border-gray-200 flex items-center justify-between px-4 shrink-0 z-20">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-linear-to-br from-cyan-500 via-blue-500 to-indigo-500 text-white flex items-center justify-center shadow-sm">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 text-base leading-tight">
                AI Bot
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">Trợ lý thông minh</p>
            </div>
          </div>
        </div>
      );
    }

    const isGroup = chatMode === "GROUP";

    return (
      <div className={`h-17 ${chatBgUrl ? 'bg-white/70' : 'bg-white'} backdrop-blur-md border-b border-gray-200/50 flex items-center justify-between px-4 shrink-0 z-20 transition-colors`}>
        <div className="flex items-center gap-3">
          {/* Avatar */}
          {isGroup ? (
            <GroupAvatar members={resolvedGroupMembers} size={48} />
          ) : (
            <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold text-xl relative overflow-hidden shrink-0">
              {selectedFriend?.friend_avatar_url ? (
                <img
                  src={
                    resolveDisplayAvatar(selectedFriend.friend_avatar_url) ||
                    selectedFriend.friend_avatar_url
                  }
                  alt={friendName}
                  className="w-full h-full object-cover"
                />
              ) : (
                getAvatarInitial(friendName)
              )}
              {isConnected && (
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 border-2 border-white rounded-full" />
              )}
            </div>
          )}

          {/* Name + subtitle */}
          <div>
            <h2 className="font-semibold text-gray-900 text-base leading-tight">
              {isGroup ? groupName : friendName}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
              {isGroup ? (
                <>
                  <Users className="w-3 h-3" />
                  {memberCount > 0
                    ? `${memberCount} thành viên`
                    : isConnected
                      ? "Đang hoạt động"
                      : "Kết nối..."}
                </>
              ) : isConnected ? (
                <>
                  <span className="inline-block w-1.5 h-1.5 bg-green-500 rounded-full" />
                  Đang hoạt động
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3" />
                  Đang kết nối lại...
                </>
              )}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="p-2 hover:bg-gray-100 rounded-md cursor-pointer text-gray-600 transition-colors"
            title="Gọi thoại"
          >
            <Phone className="w-5 h-5" />
          </button>
          <button
            type="button"
            className="p-2 hover:bg-gray-100 rounded-md cursor-pointer text-gray-600 transition-colors"
            title="Gọi video"
            onClick={handleStartVideoCall}
            disabled={!isConnected}
          >
            <Video className="w-5 h-5" />
          </button>
          <div className="w-px h-5 bg-gray-300 mx-1" />
          <button
            type="button"
            className="p-2 hover:bg-gray-100 rounded-md cursor-pointer text-gray-600 transition-colors"
            title="Tìm kiếm"
            onClick={() => setSearchOpen((prev) => !prev)}
            disabled={!activeConversationId}
          >
            <Search className="w-5 h-5" />
          </button>
          <button
            type="button"
            className="p-2 hover:bg-gray-100 rounded-md cursor-pointer text-gray-600 transition-colors"
            title="Tuỳ chọn"
            onClick={() => setIsSettingsOpen(true)}
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  // ── Message list ────────────────────────────────────────────────────
  function renderMessages() {
    return (
      <div
        ref={activeScrollRef as React.RefObject<HTMLDivElement>}
        className="flex-1 overflow-y-auto p-4 flex flex-col bg-transparent"
      >
        {activeLoading && (
          <div className="flex items-center justify-center py-8 text-gray-400 text-sm gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Đang tải tin nhắn...
          </div>
        )}

        {activeError && !activeLoading && (
          <div className="flex items-center justify-center py-8 text-red-400 text-sm">
            {activeError}
          </div>
        )}

        {!activeLoading && !activeError && activeMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
              <Smile className="w-6 h-6" />
            </div>
            <p className="text-sm">
              {chatMode === "GROUP"
                ? `Bắt đầu trò chuyện trong ${groupName}`
                : `Bắt đầu cuộc trò chuyện với ${friendName}`}
            </p>
            <p className="text-xs">Hãy gửi tin nhắn đầu tiên!</p>
          </div>
        )}

        {activeMessages.map((msg) => {
          const isFocused = focusedMessageId != null && String(msg.id) === focusedMessageId;
          const wrapperClass = isFocused
            ? isFocusBlue 
               ? "rounded-xl bg-blue-100/70 ring-1 ring-blue-300 transition-all"
               : "rounded-xl bg-yellow-100/70 ring-1 ring-yellow-300 transition-all"
            : "";

          // System message (using heuristic for legacy messages)
          const isSystem = isSystemMessage(msg) || msg.content === "Hình nền đã được thay đổi";
          
          if (isSystem) {
            return (
              <div key={msg.id} id={getMessageDomId(msg.id)} className={`w-full flex justify-center ${wrapperClass}`}>
                <SystemMessageBubble 
                  content={msg.content} 
                  createdAt={msg.createdAt}
                  onAction={msg.content.includes("hình nền") ? () => setIsSettingsOpen(true) : undefined}
                />
              </div>
            );
          }

          if (chatMode === "GROUP") {
            return (
              <div key={msg.id} id={getMessageDomId(msg.id)} className={wrapperClass}>
                <GroupMessageBubble
                  msg={msg}
                  authUserId={currentUserId}
                  senderAvatarUrl={resolveDisplayAvatar(msg.senderAvatarUrl)}
                  onContextMenu={handleMessageContextMenu}
                />
              </div>
            );
          }

          return (
            <div key={msg.id} id={getMessageDomId(msg.id)} className={wrapperClass}>
              <PrivateMessageBubble
                msg={msg}
                friendName={friendName}
                friendAvatarUrl={selectedFriend?.friend_avatar_url ?? null}
                authUserId={currentUserId}
                onContextMenu={handleMessageContextMenu}
              />
            </div>
          );
        })}

        <div ref={activeSentinelRef as React.RefObject<HTMLDivElement>} />
      </div>
    );
  }

  function renderAiMessages() {
    return (
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {aiConversation.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
              <Sparkles className="w-6 h-6" />
            </div>
            <p className="text-sm text-gray-600">
              Bắt đầu cuộc trò chuyện với AI
            </p>
            <p className="text-xs">
              Bạn có thể hỏi nhanh ngay trong khung chat này.
            </p>
          </div>
        )}

        {aiConversation.map((turn) => {
          const isUser = turn.role === "user";
          return (
            <div
              key={turn.id}
              className={`flex ${isUser ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm border shadow-sm whitespace-pre-wrap ${isUser
                    ? "bg-blue-500 border-blue-500 text-white rounded-br-sm"
                    : "bg-white border-gray-200 text-gray-800 rounded-bl-sm"
                  }`}
              >
                {turn.content}
              </div>
            </div>
          );
        })}

        {isAskingAI && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            AI đang trả lời...
          </div>
        )}
      </div>
    );
  }

  function renderPinnedHeader() {
    if (!pinnedMessages || pinnedMessages.length === 0) return null;

    const isMulti = pinnedMessages.length > 1;

    if (!isPinnedExpanded) {
      const mainPin = pinnedMessages[0];
      return (
        <div className="bg-white/95 backdrop-blur-md border-b border-gray-200 px-4 py-2 flex items-center gap-3 relative z-20 shadow-sm animate-in slide-in-from-top duration-300 group">
          <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
            <Pin className="w-4 h-4 text-blue-500 fill-blue-500" />
          </div>
          
          <div 
            className="flex-1 min-w-0 cursor-pointer py-0.5"
            onClick={() => {
              setPendingFocusMessageId(String(mainPin.id));
              setIsFocusBlue(true);
            }}
          >
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Tin nhắn được ghim</span>
              {isMulti && (
                <div 
                  className="flex items-center gap-0.5 bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-bold cursor-pointer hover:bg-blue-200 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsPinnedExpanded(true);
                  }}
                >
                  <span className="text-[9px]">+{pinnedMessages.length - 1} ghim khác</span>
                  <ChevronDown className="w-2.5 h-2.5" />
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
               <span className="text-xs font-semibold text-gray-900 truncate max-w-[120px]">{mainPin.senderName}:</span>
               <p className="text-xs text-gray-600 truncate">{mainPin.content || "[Tin nhắn tệp/sticker]"}</p>
            </div>
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {isMulti && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPinnedExpanded(true);
                }}
                className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
                title="Xem danh sách"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            )}
            {/* Chỉ hiện nút gỡ ghim nếu mình có quyền */}
            {canUnpin(mainPin) && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  handleUnpinMessage(mainPin.id);
                }}
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                title="Bỏ ghim"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      );
    }

    // --- Expanded State (Danh sách ghim) ---
    return (
      <div className="bg-white/98 backdrop-blur-lg border-b border-gray-200 relative z-30 shadow-xl animate-in slide-in-from-top duration-300">
        {/* Header của danh sách ghim */}
        <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <span className="text-xs font-bold text-gray-700">Danh sách ghim ({pinnedMessages.length})</span>
          <button 
            onClick={() => setIsPinnedExpanded(false)}
            className="flex items-center gap-1 text-[11px] font-semibold text-gray-500 hover:text-blue-600 transition-colors"
          >
            Thu gọn
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* List items */}
        <div className="max-h-[300px] overflow-y-auto scrollbar-thin">
          {pinnedMessages.map((pin, index) => (
            <div 
              key={`${pin.id}-${index}`}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50/40 transition-colors border-b border-gray-50 last:border-none group"
            >
              <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                <Pin className="w-3.5 h-3.5 text-blue-400 fill-blue-400" />
              </div>
              
              <div 
                className="flex-1 min-w-0 cursor-pointer"
                onClick={() => {
                  setPendingFocusMessageId(String(pin.id));
                  setIsFocusBlue(true);
                  setIsPinnedExpanded(false); // Thu gọn khi click vào tin nhắn
                }}
              >
                <p className="text-[11px] font-bold text-blue-600 mb-0.5 uppercase tracking-tight">Tin nhắn</p>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-gray-800 truncate max-w-[150px]">{pin.senderName}:</span>
                  <p className="text-xs text-gray-600 truncate">{pin.content || "[Tin nhắn tệp/sticker]"}</p>
                </div>
              </div>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {canUnpin(pin) && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUnpinMessage(pin.id);
                    }}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                    title="Bỏ ghim"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        
        {/* Footer optionally */}
        <div className="px-4 py-2 bg-gray-50/30 flex justify-center border-t border-gray-100">
          <button className="text-[11px] font-bold text-gray-400 hover:text-blue-500 transition-colors flex items-center gap-1">
             Xem tất cả ở bảng tin nhóm
             <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  }

  // ── Empty state ────────────────────────────────────────────────────
  if (!selectedFriend && !selectedGroup && !isAiChatOpen) {
    return (
      <div className="flex-1 bg-[#f3f5f6] flex flex-col items-center justify-center min-w-0 text-gray-400 px-6">
        <div className="w-16 h-16 rounded-full bg-gray-200/80 flex items-center justify-center mb-4">
          <Smile className="w-8 h-8 text-gray-500" />
        </div>
        <p className="text-sm font-medium text-gray-600">
          Chọn một cuộc trò chuyện
        </p>
        <p className="text-xs text-gray-500 mt-1 text-center max-w-sm">
          Danh sách bạn bè hoặc nhóm ở cột bên trái. Tin nhắn mới sẽ cập nhật
          realtime.
        </p>
      </div>
    );
  }

  return (
    <div 
      className="flex-1 bg-[#f3f5f6] flex flex-col relative min-w-0 overflow-hidden"
      style={chatBgUrl ? {
        backgroundImage: `url(${chatBgUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      } : undefined}
    >
      {chatBgUrl && <div className="absolute inset-0 bg-black/10 z-0 pointer-events-none" />}
      <div 
        className="flex-1 flex flex-col relative z-10 overflow-hidden"
        onClick={() => {
          if (isPinnedExpanded) setIsPinnedExpanded(false);
          if (ctxMenu) closeCtxMenu();
        }}
      >
        {renderHeader()}
        {renderPinnedHeader()}

      {searchOpen && !isAiChatOpen && (
        <div className="absolute right-4 top-20 z-20 w-[min(92vw,720px)] rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden">
          <form
            className="border-b border-gray-100 p-4 space-y-3"
            onSubmit={handleSearchMessages}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Tìm kiếm tin nhắn
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Lọc theo từ khóa, khoảng thời gian và phạm vi tìm kiếm.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="text-xs font-medium text-gray-500 hover:text-gray-800"
              >
                Đóng
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-xs text-gray-600">
                <span>Từ khóa</span>
                <input
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  placeholder="Ví dụ: họp, file, ảnh..."
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
                />
              </label>
              <label className="space-y-1 text-xs text-gray-600">
                <span>Từ ngày</span>
                <input
                  type="date"
                  value={searchFromDate}
                  max={searchToDate || todayDateString}
                  onChange={(e) => handleSearchFromDateChange(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
                />
              </label>
              <label className="space-y-1 text-xs text-gray-600">
                <span>Đến ngày</span>
                <input
                  type="date"
                  value={searchToDate}
                  min={searchFromDate || undefined}
                  max={todayDateString}
                  onChange={(e) => handleSearchToDateChange(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
                />
              </label>
            </div>

            <div className="flex items-center gap-3 text-xs text-gray-600">
              <span className="font-medium">Phạm vi:</span>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="search-scope"
                  checked={searchScope === "conversation"}
                  onChange={() => setSearchScope("conversation")}
                />
                Cuộc trò chuyện hiện tại
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="search-scope"
                  checked={searchScope === "global"}
                  onChange={() => setSearchScope("global")}
                />
                Tin nhắn tổng
              </label>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={
                  searchLoading ||
                  (searchScope === "conversation" && !activeConversationId)
                }
                className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {searchLoading ? "Đang tìm..." : "Tìm ngay"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearchKeyword("");
                  setSearchFromDate("");
                  setSearchToDate("");
                  setSearchResults([]);
                  setSearchError("");
                }}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Xóa bộ lọc
              </button>
            </div>

            {searchError && (
              <p className="text-sm text-red-600">{searchError}</p>
            )}
          </form>

          <div className="max-h-[42vh] overflow-y-auto">
            {searchResults.length === 0 ? (
              <div className="px-4 py-6 text-sm text-gray-500">
                {searchLoading
                  ? "Đang tải kết quả..."
                  : "Nhập điều kiện rồi bấm Tìm ngay để xem kết quả."}
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {searchResults.map((item) => (
                  <button
                    key={`${item.conversationId}-${item.id}`}
                    type="button"
                    onClick={() => handleSearchResultClick(item)}
                    className="w-full px-4 py-3 text-left hover:bg-blue-50/60 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3 text-xs text-gray-500">
                      <span className="font-medium text-gray-700">
                        {item.senderDisplayName || `Người gửi ${item.senderId}`}
                      </span>
                      <span>{formatSearchDateTime(item.createdAt)}</span>
                    </div>
                    <p className="mt-1 text-sm text-gray-900 whitespace-pre-wrap break-words">
                      {highlightKeyword(
                        item.content || "[Không có nội dung]",
                        searchKeyword,
                      )}
                    </p>
                    <p className="mt-1 text-[11px] text-gray-400">
                      {getSearchResultContext(item)}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
    <div className="flex-1 bg-[#f3f5f6] flex flex-col relative min-w-0">
      <ChatHeader
        chatMode={chatMode}
        isAiChatOpen={isAiChatOpen}
        isConnected={isConnected}
        selectedFriend={selectedFriend}
        selectedGroup={selectedGroup}
        groupMembers={resolvedGroupMembers}
        groupName={groupName}
        friendName={friendName}
        memberCount={memberCount}
        onStartVideoCall={handleStartVideoCall}
        onToggleSearch={() => setSearchOpen((prev) => !prev)}
        activeConversationId={activeConversationId}
        resolveDisplayAvatar={resolveDisplayAvatar}
      />

      <MessageSearchPanel
        isOpen={searchOpen && !isAiChatOpen}
        searchScope={searchScope}
        searchKeyword={searchKeyword}
        searchFromDate={searchFromDate}
        searchToDate={searchToDate}
        searchResults={searchResults}
        searchLoading={searchLoading}
        searchError={searchError}
        activeConversationId={activeConversationId}
        currentUserId={currentUserId}
        friends={friends}
        myGroups={myGroups}
        selectedGroup={selectedGroup}
        todayDateString={todayDateString}
        onClose={() => setSearchOpen(false)}
        onSearch={handleSearchMessages}
        onScopeChange={setSearchScope}
        onKeywordChange={setSearchKeyword}
        onFromDateChange={setSearchFromDate}
        onToDateChange={setSearchToDate}
        onClearFilters={handleSearchClearFilters}
        onResultClick={handleSearchResultClick}
      />

      {isAiChatOpen ? (
        <AiChatMessages
          aiConversation={aiConversation}
          isAskingAI={isAskingAI}
          aiError={aiError}
        />
      ) : (
        <MessageList
          chatMode={chatMode}
          messages={activeMessages}
          isLoading={activeLoading}
          error={activeError}
          currentUserId={currentUserId}
          groupName={groupName}
          friendName={friendName}
          selectedFriend={selectedFriend}
          groupMembers={resolvedGroupMembers}
          focusedMessageId={focusedMessageId}
          activeScrollRef={activeScrollRef as React.RefObject<HTMLDivElement>}
          activeSentinelRef={activeSentinelRef as React.RefObject<HTMLDivElement>}
          onScroll={activeHandleScroll}
          onMessageContextMenu={handleMessageContextMenu}
          onReplyToMessage={handleReplyToMessage}
          onJumpToMessage={handleJumpToMessage}
          resolveDisplayAvatar={resolveDisplayAvatar}
          onJoinGroupCall={handleJoinGroupCall}
        />
      )}

      {/* Typing indicator */}
      {!isAiChatOpen && activeTypingUsers.length > 0 && (
        <div className="px-4 py-1.5 bg-[#f3f5f6]">
          <p className="text-xs italic text-gray-500">
            {activeTypingUsers.length === 1
              ? `${activeTypingUsers[0]} đang soạn tin...`
              : `${activeTypingUsers.slice(0, -1).join(", ")} và ${activeTypingUsers[activeTypingUsers.length - 1]} đang soạn tin...`}
          </p>
        </div>
      )}

      {!isAiChatOpen && activeUploading && (
        <div className="px-4 py-2 bg-[#f3f5f6] border-t border-gray-200/70">
          <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
            <span>Đang tải tệp lên S3...</span>
            <span>{Math.max(0, Math.min(100, activeUploadProgress))}%</span>
          </div>
          <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-150"
              style={{
                width: `${Math.max(0, Math.min(100, activeUploadProgress))}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Context menu */}
      {ctxMenu && (
        <MessageContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          canRevoke={ctxMenu.canRevoke}
          isOwn={ctxMenu.canRevoke}
          onRevoke={handleRevokeMessage}
          onDeleteForMe={handleDeleteForMe}
          onForward={() =>
            handleForwardMessage(ctxMenu.msg, ctxMenu.conversationId)
          }
          onPin={() => handlePinMessage(ctxMenu.msg)}
          isDeleting={deletingMessageId === String(ctxMenu.msg.id)}
          onClose={closeCtxMenu}
        />
      )}

      {forwardModal && (
        <ForwardMessageModal
          isOpen
          onClose={() => setForwardModal(null)}
          message={forwardModal.message}
          sourceConversationId={forwardModal.sourceConversationId}
          authUserId={currentUserId}
        />
      )}

      {/* Input area */}
      <div className="bg-white border-t border-gray-200 flex flex-col shrink-0">
        {isAiChatOpen ? (
          <div className="px-4 py-3 bg-gray-50">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={aiQuestion}
                  onChange={(e) => setAiQuestion(e.target.value)}
                  onKeyDown={handleAiKeyDown}
                  placeholder="Nhập câu hỏi cho AI..."
                  disabled={isAskingAI}
                  className="w-full h-11 rounded-lg border border-gray-300 pl-10 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 disabled:opacity-60"
                />
                <Sparkles className="w-4 h-4 text-blue-500 absolute left-3 top-3.5" />
              </div>

              <button
                type="button"
                onClick={handleAskAI}
                disabled={!aiQuestion.trim() || isAskingAI}
                className="h-11 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isAskingAI ? "Đang hỏi..." : "Hỏi AI"}
              </button>
            </div>

            {aiError && <p className="mt-2 text-xs text-red-500">{aiError}</p>}
          </div>
        ) : (
          <>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif"
              className="hidden"
              onChange={handlePickFile}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime,.pdf,.doc,.docx,.txt"
              className="hidden"
              onChange={handlePickFile}
            />

            <ChatToolbar
              isConnected={isConnected}
              isSending={activeSending}
              isUploading={activeUploading}
              isPickerOpen={pickerOpen}
              onTogglePicker={() => setPickerOpen((prev) => !prev)}
              onImageClick={() => imageInputRef.current?.click()}
              onFileClick={() => fileInputRef.current?.click()}
              onLocationClick={() => setLocationMenuOpen((prev) => !prev)}
            >
              <EmojiStickerPicker
                isOpen={pickerOpen}
                onClose={() => setPickerOpen(false)}
                onEmojiSelect={handleEmojiSelect}
                onStickerSelect={handleStickerSelect}
              />

              {/* Dropdown menu chọn kiểu chia sẻ vị trí */}
              {locationMenuOpen && (
                <div
                  style={{
                    position: "absolute",
                    bottom: "calc(100% + 8px)",
                    left: 120,
                    background: "linear-gradient(135deg,#1e293b 0%,#0f172a 100%)",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.1)",
                    boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                    overflow: "hidden",
                    minWidth: 230,
                    zIndex: 50,
                    animation: "fadeInUp 0.15s ease",
                  }}
                >
                  <style>{`@keyframes fadeInUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>

                  {/* Nút đóng */}
                  <button
                    onClick={() => setLocationMenuOpen(false)}
                    style={{ position:"absolute", top:8, right:10, background:"none", border:"none", color:"#94a3b8", cursor:"pointer", fontSize:18 }}
                  >×</button>

                  {/* Option 1: Vị trí hiện tại */}
                  <button
                    onClick={handleSendCurrentLocation}
                    style={{ display:"flex", alignItems:"center", gap:12, width:"100%", padding:"12px 16px", border:"none", background:"transparent", color:"#e2e8f0", cursor:"pointer", textAlign:"left" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background="rgba(96,165,250,0.12)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background="transparent"; }}
                  >
                    <span style={{ width:36, height:36, borderRadius:"50%", background:"rgba(96,165,250,0.15)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>📍</span>
                    <div>
                      <div style={{ fontSize:14, fontWeight:600 }}>Vị trí hiện tại</div>
                      <div style={{ fontSize:11, color:"#64748b", marginTop:2 }}>Gửi vị trí một lần</div>
                    </div>
                  </button>

                  <div style={{ height:1, background:"rgba(255,255,255,0.06)", margin:"0 12px" }} />

                  {/* Option 2: Vị trí trực tiếp */}
                  {isLiveSharing ? (
                    <button
                      onClick={() => handleToggleLiveLocation()}
                      style={{ display:"flex", alignItems:"center", gap:12, width:"100%", padding:"12px 16px", border:"none", background:"transparent", color:"#e2e8f0", cursor:"pointer", textAlign:"left" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background="rgba(239,68,68,0.12)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background="transparent"; }}
                    >
                      <span style={{ width:36, height:36, borderRadius:"50%", background:"rgba(239,68,68,0.15)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>
                        ⏹
                      </span>
                      <div>
                        <div style={{ fontSize:14, fontWeight:600, color: "#f87171" }}>
                          Dừng chia sẻ
                        </div>
                        <div style={{ fontSize:11, color:"#64748b", marginTop:2 }}>
                          Ngừng phát vị trí cho mọi người
                        </div>
                      </div>
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => handleToggleLiveLocation(15 * 60 * 1000)}
                        style={{ display:"flex", alignItems:"center", gap:12, width:"100%", padding:"12px 16px", border:"none", background:"transparent", color:"#e2e8f0", cursor:"pointer", textAlign:"left" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background="rgba(74,222,128,0.12)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background="transparent"; }}
                      >
                        <span style={{ width:36, height:36, borderRadius:"50%", background:"rgba(74,222,128,0.15)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>🔴</span>
                        <div>
                          <div style={{ fontSize:14, fontWeight:600, color: "#4ade80" }}>Chia sẻ trực tiếp 15 phút</div>
                        </div>
                      </button>
                      <button
                        onClick={() => handleToggleLiveLocation(30 * 60 * 1000)}
                        style={{ display:"flex", alignItems:"center", gap:12, width:"100%", padding:"12px 16px", border:"none", background:"transparent", color:"#e2e8f0", cursor:"pointer", textAlign:"left" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background="rgba(74,222,128,0.12)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background="transparent"; }}
                      >
                        <span style={{ width:36, height:36, borderRadius:"50%", background:"rgba(74,222,128,0.15)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>🔴</span>
                        <div>
                          <div style={{ fontSize:14, fontWeight:600, color: "#4ade80" }}>Chia sẻ trực tiếp 30 phút</div>
                        </div>
                      </button>
                      <button
                        onClick={() => handleToggleLiveLocation(60 * 60 * 1000)}
                        style={{ display:"flex", alignItems:"center", gap:12, width:"100%", padding:"12px 16px", border:"none", background:"transparent", color:"#e2e8f0", cursor:"pointer", textAlign:"left" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background="rgba(74,222,128,0.12)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background="transparent"; }}
                      >
                        <span style={{ width:36, height:36, borderRadius:"50%", background:"rgba(74,222,128,0.15)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>🔴</span>
                        <div>
                          <div style={{ fontSize:14, fontWeight:600, color: "#4ade80" }}>Chia sẻ trực tiếp 1 giờ</div>
                        </div>
                      </button>
                      <button
                        onClick={() => handleToggleLiveLocation(8 * 60 * 60 * 1000)}
                        style={{ display:"flex", alignItems:"center", gap:12, width:"100%", padding:"12px 16px", border:"none", background:"transparent", color:"#e2e8f0", cursor:"pointer", textAlign:"left" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background="rgba(74,222,128,0.12)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background="transparent"; }}
                      >
                        <span style={{ width:36, height:36, borderRadius:"50%", background:"rgba(74,222,128,0.15)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>🔴</span>
                        <div>
                          <div style={{ fontSize:14, fontWeight:600, color: "#4ade80" }}>Chia sẻ trực tiếp 8 giờ</div>
                        </div>
                      </button>
                    </>
                  )}
                </div>
              )}
            </ChatToolbar>

            {replyingMessage && (
              <ReplyPreview
                replyingMessage={replyingMessage}
                onClear={handleClearReply}
                onJumpToMessage={handleJumpToMessage}
              />
            )}

            <ChatInput
              inputValue={inputValue}
              isConnected={isConnected}
              isSending={activeSending}
              isRecording={isRecording}
              audioBlob={audioBlob}
              recordingTime={recordingTime}
              placeholder={placeHolder}
              onInputChange={setInputValue}
              onKeyDown={handleKeyDown}
              onSend={handleSend}
              onStartRecording={startRecording}
              onStopRecording={stopRecording}
              onCancelRecording={cancelRecording}
              onSendAudio={handleSendAudio}
              onTypingChange={activeTypingChange}
              textareaRef={textareaRef}
            />
          </>
        )}
      </div>
    </div>

    <CallOverlay />

      {/* Settings Sidebar */}
      <ChatSettingsSidebar
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        selectedFriend={selectedFriend}
        authUser={authUser}
        onSearchMessages={() => setSearchOpen(true)}
        onBackgroundChange={(bgUrl) => setChatBgUrl(bgUrl)}
      />
    </div>
  );
}
