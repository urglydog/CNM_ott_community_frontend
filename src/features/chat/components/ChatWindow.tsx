"use client";

import { 
  MoreHorizontal, Phone, Search, Video, Smile, Image, 
  Paperclip, Link as LinkIcon, MapPin, Contact, CheckSquare, Type, 
  Loader2, WifiOff, FileText, Users, RotateCcw, 
  Trash2, Share2, Sparkles, X, Mic, Square, Send 
} from "lucide-react";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { dmConversationId, useDirectMessage } from "../hooks/useChatHooks";
import {
  groupConversationId,
  useGroupChat,
  isSystemMessage,
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
import type { AuthUser } from "../../../types";
import { askBot } from "../api";
import ForwardMessageModal from "./ForwardMessageModal";
import EmojiStickerPicker from "./EmojiStickerPicker";
import AudioMessage from "./AudioMessage";
import CallOverlay from "@/features/chat/components/CallOverlay";
import { useToast } from "../../../contexts/ToastContext";
import type { GroupMember } from "../../groups/types";
import type { StickerData, ReadReceiptReader } from "../../../types";
import {
  formatSearchDateTime,
  getMessageDomId,
  highlightKeyword,
} from "../utils/messageSearch";

interface ChatWindowProps {
  authUser: AuthUser;
}


interface AiConversationTurn {
  id: string;
  role: "user" | "assistant";
  content: string;
}

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

type SearchScope = "conversation" | "global";

const AI_HISTORY_STORAGE_PREFIX = "ott_ai_history_v1";

function getAvatarInitial(name: string): string {
  return name?.charAt(0)?.toUpperCase() ?? "?";
}

function formatTime(isoString: string) {
  try {
    return new Date(isoString).toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
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

/** Hiển thị avatar của những người đã đọc tin nhắn (Zalo style) */
function ReadByAvatars({
  readers,
  maxShow = 3,
  size = 18,
}: {
  readers: ReadReceiptReader[];
  maxShow?: number;
  size?: number;
}) {
  if (!readers || readers.length === 0) return null;

  const visibleReaders = readers.slice(0, maxShow);
  const remainingCount = readers.length - maxShow;

  return (
    <div className="flex items-center gap-1 mt-1">
      <div className="flex -space-x-1.5">
        {visibleReaders.map((reader, index) => (
          <div
            key={reader.userId}
            className="relative rounded-full ring-2 ring-white overflow-hidden"
            style={{
              width: size,
              height: size,
              zIndex: maxShow - index,
            }}
            title={reader.readerName}
          >
            {reader.readerAvatar ? (
              <img
                src={reader.readerAvatar}
                alt={reader.readerName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gray-300 flex items-center justify-center text-gray-600 text-[8px] font-medium">
                {getAvatarInitial(reader.readerName)}
              </div>
            )}
          </div>
        ))}
      </div>
      {remainingCount > 0 && (
        <span className="text-[10px] text-gray-500 ml-1">
          +{remainingCount}
        </span>
      )}
    </div>
  );
}

/** Tin nhắn hệ thống (hiển thị giữa màn hình) */
function SystemMessageBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-center my-2">
      <div className="bg-gray-200/70 text-gray-500 text-xs px-3 py-1 rounded-full">
        {content}
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
              {isOwn && (msg.sendStatus === "sent" || msg.sendStatus === "delivered") && <span>✓</span>}
              {isOwn && msg.sendStatus === "read" && <span className="text-blue-400">✓✓</span>}
              {isOwn && msg.sendStatus === "failed" && (
                <span className="text-red-300">✗</span>
              )}
            </div>
          </div>
          {/* Reader avatars for own messages */}
          {isOwn && msg.readBy && msg.readBy.length > 0 && (
            <ReadByAvatars readers={msg.readBy} maxShow={3} size={16} />
          )}
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
          {msg.contentType !== "voice" && msg.contentType !== "voice" && Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
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
          ) : msg.contentType === "voice" || msg.contentType === "voice" ? (
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
            {isOwn && (msg.sendStatus === "sent" || msg.sendStatus === "delivered") && <span>✓</span>}
            {isOwn && msg.sendStatus === "read" && <span className="text-blue-400">✓✓</span>}
            {isOwn && msg.sendStatus === "failed" && (
              <span className="text-red-300">✗</span>
            )}
          </div>
        </div>
        {/* Reader avatars for own messages */}
        {isOwn && msg.readBy && msg.readBy.length > 0 && (
          <ReadByAvatars readers={msg.readBy} maxShow={3} size={16} />
        )}
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
            {isOwn && (msg.sendStatus === "sent" || msg.sendStatus === "delivered") && <span>✓</span>}
            {isOwn && msg.sendStatus === "read" && <span className="text-blue-400">✓✓</span>}
            {isOwn && msg.sendStatus === "failed" && (
              <span className="text-red-300">✗</span>
            )}
          </div>
        </div>
        {/* Reader avatars for own messages */}
        {isOwn && msg.readBy && msg.readBy.length > 0 && (
          <ReadByAvatars readers={msg.readBy} maxShow={3} size={16} />
        )}
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

        {msg.contentType !== "voice" && msg.contentType !== "voice" && Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
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
        ) : msg.contentType === "voice" || msg.contentType === "voice" ? (
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
          {isOwn && (msg.sendStatus === "sent" || msg.sendStatus === "delivered") && <span>✓</span>}
          {isOwn && msg.sendStatus === "read" && <span className="text-blue-400">✓✓</span>}
          {isOwn && msg.sendStatus === "failed" && (
            <span className="text-red-300">✗</span>
          )}
        </div>
      </div>
      {/* Reader avatars for own messages */}
      {isOwn && msg.readBy && msg.readBy.length > 0 && (
        <ReadByAvatars readers={msg.readBy} maxShow={3} size={16} />
      )}
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
    friends,
    setSelectedFriend,
    setSelectedGroup,
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
    typingUsers: dmTypingUsers,
    onTypingChange: dmTypingChange,
    deleteMessage: deleteDmMessage,
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
    typingUsers: groupTypingUsers,
    onTypingChange: groupTypingChange,
    deleteMessage: deleteGroupMessage,
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
  } = useSocket();
  const { addToast } = useToast();
  const [inputValue, setInputValue] = useState("");
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiConversation, setAiConversation] = useState<AiConversationTurn[]>(
    [],
  );
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
  const [pendingFocusMessageId, setPendingFocusMessageId] = useState<string | null>(null);
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

  // ── Emoji / Sticker Picker state ─────────────────────────────────────────
  const [pickerOpen, setPickerOpen] = useState(false);

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
  const [revokingMessageId, setRevokingMessageId] = useState<string | null>(
    null,
  );

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
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(
    null,
  );

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
      // Khôi phục lại tin nhắn nếu API thất bại
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

  // Lấy ref đúng dựa trên mode
  const activeSentinelRef =
    chatMode === "GROUP" ? groupSentinelRef : dmSentinelRef;
  const activeScrollRef = chatMode === "GROUP" ? groupScrollRef : dmScrollRef;
  const activeTypingUsers =
    chatMode === "GROUP" ? groupTypingUsers : dmTypingUsers;
  const activeTypingChange =
    chatMode === "GROUP" ? groupTypingChange : dmTypingChange;

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

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 128)}px`;
  }, [inputValue]);

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
        console.debug(
          "[ChatWindow][emit group-call-request] payload:",
          groupCallPayload,
        );
        emitCallUser({
          ...groupCallPayload,
          receiverId: String(selectedGroup!.groupId),
          conversationId,
          isGroupCall: true,
        });
        setOutgoingCall({
          roomId: safeRoomId,
          conversationId,
          receiverId: String(selectedGroup!.groupId),
          receiverName: groupName || "Nhom",
          isGroupCall: true,
        });
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

  // Khi chuyển đổi giữa nhóm và DM, clear input
  useEffect(() => {
    setInputValue("");
  }, [chatMode, selectedGroup?.groupId, selectedFriend?.friend_id]);

  const handleSend = useCallback(async () => {
    if (!inputValue.trim()) return;
    if (chatMode === "GROUP") {
      if (groupSending) return;
      await sendGroupMessage(inputValue);
    } else {
      if (dmSending) return;
      await sendDmMessage(inputValue);
    }

    setInputValue("");
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
    const targetConversationId = String(item.conversationId || "");
    if (!targetConversationId) return;

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

  function handleSearchFromDateChange(value: string) {
    setSearchFromDate(value);
    if (!value) {
      setSearchToDate("");
      return;
    }

    // Khi user vừa chọn ngày bắt đầu, mặc định ngày kết thúc giống ngày bắt đầu.
    if (!searchToDate || searchToDate < value) {
      setSearchToDate(value);
    }
  }

  function handleSearchToDateChange(value: string) {
    if (searchFromDate && value && value < searchFromDate) {
      setSearchToDate(searchFromDate);
      return;
    }
    setSearchToDate(value);
  }

  function getSearchResultContext(item: MessageSearchRow) {
    const senderName = item.senderDisplayName || `Người dùng ${item.senderId}`;
    const conversationId = String(item.conversationId || "");

    if (conversationId.startsWith("dm:")) {
      const ids = conversationId.slice(3).split(":");
      const friendId = ids.find((id) => String(id) !== String(currentUserId));
      const friend = friends.find(
        (entry) => String(entry.friend_id) === String(friendId || ""),
      );
      const dmName =
        friend?.friend_display_name ||
        friend?.friend_username ||
        friendId ||
        "cuộc trò chuyện cá nhân";
      return `Gửi bởi ${senderName} trong cuộc trò chuyện với ${dmName}`;
    }

    const group = myGroups.find(
      (entry) => String(entry.groupId) === conversationId,
    );
    const groupName =
      group?.name ||
      (selectedGroup && String(selectedGroup.groupId) === conversationId
        ? selectedGroup.name
        : conversationId);

    return `Gửi bởi ${senderName} trong nhóm ${groupName}`;
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
        <div className="h-17 bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0">
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
      <div className="h-17 bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0">
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
            title="Khác"
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
        className="flex-1 overflow-y-auto p-4 flex flex-col"
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
          const wrapperClass =
            focusedMessageId != null && String(msg.id) === focusedMessageId
              ? "rounded-xl bg-yellow-100/70 ring-1 ring-yellow-300 transition-all"
              : "";

          // System message
          if (isSystemMessage(msg)) {
            return (
              <div key={msg.id} id={getMessageDomId(msg.id)} className={wrapperClass}>
                <SystemMessageBubble content={msg.content} />
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
    <div className="flex-1 bg-[#f3f5f6] flex flex-col relative min-w-0">
      {renderHeader()}

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
                    <p className="mt-1 text-sm text-gray-900 whitespace-pre-wrap wrap-break-word">
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
      )}

      {isAiChatOpen ? renderAiMessages() : renderMessages()}

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

      {/* Context menu – right-click: thu hồi / xóa ẩn tin nhắn */}
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

            {/* Toolbar + Emoji/Sticker picker */}
            <div className="relative border-b border-gray-100">
              <div className="flex items-center gap-4 px-4 py-2.5">
                <button
                  type="button"
                  onClick={() => setPickerOpen((prev) => !prev)}
                  className={`text-gray-500 hover:text-gray-700 ${pickerOpen ? "text-blue-500" : ""}`}
                  title="Biểu tượng cảm xúc & Sticker"
                >
                  <Smile className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={!isConnected || activeSending || activeUploading}
                  className="text-gray-500 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Gửi ảnh"
                >
                  <Image className="w-5 h-5 cursor-pointer" />
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!isConnected || activeSending || activeUploading}
                  className="text-gray-500 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Gửi tệp"
                >
                  <Paperclip className="w-5 h-5 cursor-pointer" />
                </button>
                <LinkIcon className="w-5 h-5 text-gray-500 cursor-pointer hover:text-gray-700" />
                <MapPin className="w-5 h-5 text-gray-500 cursor-pointer hover:text-gray-700" />
                <Contact className="w-5 h-5 text-gray-500 cursor-pointer hover:text-gray-700" />
                <CheckSquare className="w-5 h-5 text-gray-500 cursor-pointer hover:text-gray-700" />
                <Type className="w-5 h-5 text-gray-500 cursor-pointer hover:text-gray-700" />
                <MoreHorizontal className="w-5 h-5 text-gray-500 cursor-pointer hover:text-gray-700" />
                <EmojiStickerPicker
                  isOpen={pickerOpen}
                  onClose={() => setPickerOpen(false)}
                  onEmojiSelect={handleEmojiSelect}
                  onStickerSelect={handleStickerSelect}
                />
              </div>
            </div>

            {isRecording || audioBlob ? (
              <div className="flex items-center px-4 py-3 gap-3 w-full bg-white h-17 border-t border-gray-100">
                <button
                  type="button"
                  onClick={cancelRecording}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors shrink-0"
                  title="Hủy"
                >
                  <X className="w-6 h-6" />
                </button>

                {isRecording && (
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="p-2 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-full transition-colors shrink-0"
                    title="Dừng"
                  >
                    <Square className="w-5 h-5" fill="currentColor" />
                  </button>
                )}

                <div className="flex-1 h-11 bg-blue-50/80 border border-blue-100 rounded-full flex items-center justify-between px-4 overflow-hidden relative">
                  {isRecording && (
                    <div className="absolute left-0 top-0 bottom-0 bg-blue-200/50 animate-pulse w-full"></div>
                  )}
                  <div className="flex items-center gap-2 z-10 text-blue-500">
                    <Mic className={`w-4 h-4 ${isRecording ? "animate-pulse text-red-500" : ""}`} />
                    <span className="text-[15px] font-medium">
                      {isRecording ? "Đang ghi âm..." : "Đã ghi âm"}
                    </span>
                  </div>
                  <div className="z-10 text-[15px] font-mono text-blue-600 font-semibold">
                    {Math.floor(recordingTime / 60)}:
                    {(recordingTime % 60).toString().padStart(2, "0")}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSendAudio}
                  disabled={!audioBlob || !isConnected || activeSending}
                  className="w-11 h-11 rounded-full bg-blue-500 text-white flex items-center justify-center hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0 shadow-sm"
                  title="Gửi"
                >
                  {activeSending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5 ml-0.5" />
                  )}
                </button>
              </div>
            ) : (
              <div className="flex items-center px-4 py-3 gap-3">
                {/* Left side: icon buttons */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      activeTypingChange(false);
                      startRecording();
                    }}
                    disabled={!isConnected || activeSending}
                    className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-colors text-gray-500 hover:text-blue-500 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Ghi âm"
                  >
                    <Mic className="w-5 h-5" />
                  </button>
                </div>

                {/* Center: textarea input */}
                <div className="flex-1 relative">
                  <textarea
                    ref={textareaRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => activeTypingChange(true)}
                    onBlur={() => activeTypingChange(false)}
                    placeholder={placeHolder}
                    disabled={!isConnected || activeSending}
                    className="w-full resize-none min-h-[44px] max-h-32 focus:outline-none text-[15px] py-2.5 bg-gray-50 rounded-full px-4 pr-12 border border-gray-200 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 focus:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-all placeholder:text-gray-400"
                    rows={1}
                  />
                </div>

                {/* Right side: send button */}
                <button
                  type="button"
                  onClick={() => {
                    activeTypingChange(false);
                    handleSend();
                  }}
                  disabled={!inputValue.trim() || !isConnected || activeSending}
                  className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center cursor-pointer hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-all shadow-sm shrink-0"
                  title="Gửi tin nhắn (Enter)"
                >
                  {activeSending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <CallOverlay />
    </div>
  );
}
