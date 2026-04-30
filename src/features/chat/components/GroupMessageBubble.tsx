"use client";

import { FileText, Loader2, Reply } from "lucide-react";
import AudioMessage from "./AudioMessage";
import { ReadByAvatars } from "./ReadByAvatars";
import { ReplyReference } from "./ReplyComponents";
import { SenderAvatar } from "./Avatar";
import type { GroupChatMessage } from "../hooks/useGroupChat";
import { formatTime, isPureEmoji } from "../utils/messageUtils";

/** Tin nhắn hệ thống (hiển thị giữa màn hình) */
export function SystemMessageBubble({ msg }: { msg: GroupChatMessage }) {
  const text = msg.senderDisplayName ? `${msg.senderDisplayName} ${msg.content}` : msg.content;
  return (
    <div className="flex justify-center my-2">
      <div className="bg-gray-200/70 text-gray-500 text-xs px-3 py-1 rounded-full">
        {text}
      </div>
    </div>
  );
}

interface MessageBubbleProps {
  msg: GroupChatMessage;
  authUserId: string | number;
  senderAvatarUrl?: string | null;
  senderName: string;
  isOwn: boolean;
  onContextMenu?: (
    e: React.MouseEvent,
    msg: GroupChatMessage,
    conversationId: string,
    canRevoke: boolean,
  ) => void;
  onReply?: (msg: GroupChatMessage) => void;
  onJumpToMessage?: (messageId: string | number) => void;
}

function MessageBubbleContent({
  msg,
  isOwn,
  onContextMenu,
  onReply,
  onJumpToMessage,
}: MessageBubbleProps & { senderName: string }) {
  const handleReplyClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onReply?.(msg);
  };

  const handleJumpClick = () => {
    onJumpToMessage?.(msg.id);
  };

  // ── Sticker: hiển thị hình ảnh lớn không có bubble ────────────────────
  if (msg.contentType === "sticker" && msg.stickerData?.stickerUrl) {
    return (
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
        {/* Reply button on hover */}
        <button
          type="button"
          onClick={handleReplyClick}
          className="absolute -bottom-1 left-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-white rounded-full shadow-md hover:bg-gray-50"
          title="Trả lời"
        >
          <Reply className="w-3.5 h-3.5 text-gray-500" />
        </button>
      </div>
    );
  }

  // ── Emoji: hiển thị lớn trong bubble ─────────────────────────────────
  const pureEmoji = isPureEmoji(msg.content ?? "");

  return (
    <div
      className={`relative group px-3 py-2 rounded-2xl text-[14px] shadow-sm border ${isOwn
          ? "bg-blue-500 text-white border-blue-500 rounded-br-sm"
          : "bg-white text-gray-800 border-gray-200 rounded-bl-sm"
        } ${msg.sendStatus === "failed" ? "opacity-70 border-red-400" : ""} ${msg.contentType === "revoked" ? "bg-gray-100 border-gray-200 opacity-80 italic" : ""} ${pureEmoji ? "px-4 py-3" : ""}`}
      onContextMenu={(e) => {
        if (msg.contentType === "revoked") return;
        onContextMenu?.(e, msg, msg.conversationId ?? "", isOwn);
      }}
    >
      {/* Reply button */}
      <button
        type="button"
        onClick={handleReplyClick}
        className={`absolute -top-3 left-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full shadow-md hover:bg-gray-100 ${isOwn ? "bg-blue-500 text-white hover:bg-blue-600" : "bg-white text-gray-500 hover:bg-gray-50"}`}
        title="Trả lời"
      >
        <Reply className="w-3.5 h-3.5" />
      </button>
      {/* File/Image attachments */}
      {msg.contentType !== "voice" && Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
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
      ) : msg.contentType === "voice" ? (
        <div className="py-1">
          <AudioMessage audioUrl={msg.attachments?.[0]?.url || msg.content} isOwn={isOwn} />
        </div>
      ) : (
        <div
          className={`whitespace-pre-wrap wrap-break-word ${pureEmoji ? "text-3xl leading-none" : ""}`}
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
  );
}

/** Bubble tin nhắn nhóm — hiển thị avatar + tên người gửi bên trái (Zalo style) */
export function GroupMessageBubble({
  msg,
  authUserId,
  senderAvatarUrl,
  onContextMenu,
  onReply,
  onJumpToMessage,
}: MessageBubbleProps) {
  const isOwn = msg.isOwn || Number(msg.senderId) === Number(authUserId);
  const senderName = msg.senderDisplayName || (isOwn ? "Bạn" : "Người dùng");

  // Sticker special rendering
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
            size={36}
          />
        )}
        <div className={`flex flex-col ${isOwn ? "items-end" : "items-start"}`}>
          {!isOwn && (
            <span className="text-xs text-gray-500 mb-0.5 ml-1">
              {senderName}
            </span>
          )}
          {/* Reply Reference */}
          {msg.replyToMessage && (
            <ReplyReference
              replyToMessage={msg.replyToMessage}
              onJumpToMessage={onJumpToMessage}
              isOwn={isOwn}
            />
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
            {/* Reply button on hover */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onReply?.(msg);
              }}
              className="absolute -bottom-1 left-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-white rounded-full shadow-md hover:bg-gray-50"
              title="Trả lời"
            >
              <Reply className="w-3.5 h-3.5 text-gray-500" />
            </button>
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
          size={36}
        />
      )}

      <div
        className={`flex flex-col ${isOwn ? "items-end" : "items-start"} max-w-[68%] ${isPureEmoji(msg.content ?? "") ? "max-w-max" : ""}`}
      >
        {/* Tên người gửi — chỉ hiện nếu không phải mình */}
        {!isOwn && (
          <span className="text-xs text-gray-500 mb-0.5 ml-1">
            {senderName}
          </span>
        )}

        {/* Reply Reference */}
        {msg.replyToMessage && (
          <ReplyReference
            replyToMessage={msg.replyToMessage}
            onJumpToMessage={onJumpToMessage}
            isOwn={isOwn}
          />
        )}

        <MessageBubbleContent
          msg={msg}
          authUserId={authUserId}
          senderAvatarUrl={senderAvatarUrl}
          senderName={senderName}
          isOwn={isOwn}
          onContextMenu={onContextMenu}
          onReply={onReply}
          onJumpToMessage={onJumpToMessage}
        />
        {/* Reader avatars for own messages */}
        {isOwn && msg.readBy && msg.readBy.length > 0 && (
          <ReadByAvatars readers={msg.readBy} maxShow={3} size={16} />
        )}
      </div>
    </div>
  );
}
