"use client";

import { FileText, Loader2, Reply, Phone, PhoneMissed, Video, VideoOff } from "lucide-react";
import AudioMessage from "./AudioMessage";
import { ReadByAvatars } from "./ReadByAvatars";
import { ReplyReference } from "./ReplyComponents";
import type { GroupChatMessage } from "../hooks/useGroupChat";
import { formatTime, isPureEmoji } from "../utils/messageUtils";
import LocationMessage from "../../../components/chat/LocationMessage";

interface PrivateMessageBubbleProps {
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
  onReply?: (msg: GroupChatMessage) => void;
  onJumpToMessage?: (messageId: string | number) => void;
}

/** Bubble tin nhắn 1:1 (Private DM) */
export function PrivateMessageBubble({
  msg,
  friendName,
  authUserId,
  onContextMenu,
  onReply,
  onJumpToMessage,
}: PrivateMessageBubbleProps) {
  const isOwn = msg.isOwn || Number(msg.senderId) === Number(authUserId);

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
        className={`flex flex-col ${isOwn ? "items-end" : "items-start"} mb-3`}
        data-message-id={String(msg.id)}
      >
        {/* Reply Reference shown above sticker (outside bubble since stickers have no bubble) */}
        {msg.replyToMessage && (
          <div className={`w-fit max-w-[70%] mb-1 px-2 py-1.5 rounded-xl border-l-4 cursor-pointer transition-opacity hover:opacity-75 ${
            isOwn
              ? "bg-blue-100/60 border-blue-400"
              : "bg-gray-100 border-blue-500"
          }`}
            onClick={() => onJumpToMessage?.(msg.replyToMessage!.id)}
          >
            <p className={`text-sm font-semibold truncate ${isOwn ? "text-blue-700" : "text-blue-600"}`}>
              {msg.replyToMessage.senderDisplayName || "Người dùng"}
            </p>
            <p className="text-sm opacity-80 line-clamp-1 text-gray-600">
              {msg.replyToMessage.content || "[Ảnh/Tệp]"}
            </p>
          </div>
        )}
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
          {/* Reply button on hover */}
          <button
            type="button"
            onClick={handleReplyClick}
            className="absolute -top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-white rounded-full shadow-md hover:bg-gray-50"
            title="Trả lời"
          >
            <Reply className="w-3.5 h-3.5 text-gray-500" />
          </button>
          <div
            className={`mt-0.5 text-[10px] flex items-center gap-1 ${isOwn ? "text-gray-500 justify-end" : "text-gray-400"
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

  const pureEmoji = isPureEmoji(msg.content ?? "");

  return (
    <div
      className={`flex flex-col ${isOwn ? "items-end" : "items-start"} mb-3`}
      data-message-id={String(msg.id)}
    >
      {/* Main bubble — w-fit so it hugs content, max-w-[70%] to cap width */}
      <div
        className={`relative group w-fit max-w-[70%] flex flex-col px-3 py-2 rounded-2xl text-[14px] shadow-sm border ${isOwn
            ? "bg-blue-200 text-gray-900 border-blue-200 rounded-br-sm"
            : "bg-white text-gray-800 border-gray-200 rounded-bl-sm"
          } ${msg.sendStatus === "failed" ? "opacity-70 border-red-400" : ""} ${msg.contentType === "revoked" ? "bg-gray-100 border-gray-200 opacity-80 italic" : ""} ${pureEmoji ? "px-4 py-3" : ""}`}
        onContextMenu={(e) => {
          if (msg.contentType === "revoked") return;
          onContextMenu?.(e, msg, msg.conversationId ?? "", isOwn);
        }}
      >
        {/* Reply button (shows on hover) */}
        <button
          type="button"
          onClick={handleReplyClick}
          className={`absolute -top-3 left-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full shadow-md ${isOwn ? "bg-blue-200 text-gray-700 hover:bg-blue-300" : "bg-white text-gray-500 hover:bg-gray-50"}`}
          title="Trả lời"
        >
          <Reply className="w-3.5 h-3.5" />
        </button>

        {/* ── Reply Reference — nested inside bubble at the top ── */}
        {msg.replyToMessage && (
          <ReplyReference
            replyToMessage={msg.replyToMessage}
            onJumpToMessage={onJumpToMessage || handleJumpClick}
            isOwn={isOwn}
          />
        )}

        {!isOwn && (
          <div
            className={`text-xs font-medium mb-0.5 ${isOwn ? "text-blue-200" : "text-gray-400"}`}
          >
            {friendName}
          </div>
        )}

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
        ) : msg.contentType === "voice" ? (
          <div className="py-1">
            <AudioMessage audioUrl={msg.attachments?.[0]?.url || msg.content} isOwn={isOwn} />
          </div>
        ) : msg.contentType === "location" && msg.locationData ? (
          /* Tin nhắn vị trí — hiển thị bản đồ tĩnh Google Maps Static API */
          <div className="-mx-3 -my-2">
            <LocationMessage
              locationData={msg.locationData}
              isOwn={isOwn}
              isLive={msg.locationData.isLive === true}
              liveUntil={msg.locationData.liveUntil || null}
              senderAvatarUrl={msg.senderAvatarUrl || null}
              senderDisplayName={msg.senderDisplayName || null}
              mapWidth={240}
              mapHeight={150}
            />
          </div>
        ) : (msg.contentType === "call_log" || (msg as any).messageType === "call_log") && (msg as any).callData ? (
          (() => {
            const callData = (msg as any).callData;
            const callType = callData?.callType || "video";
            const status = callData?.status || "missed";
            const duration = callData?.duration || 0;

            const isVideo = callType === "video";
            const isMissed = status === "missed" || status === "rejected";

            let icon = isVideo ? <Video className="w-5 h-5" /> : <Phone className="w-5 h-5" />;
            if (isMissed) {
              icon = isVideo ? <VideoOff className="w-5 h-5" /> : <PhoneMissed className="w-5 h-5" />;
            }

            let statusText = isVideo ? "Cuộc gọi video" : "Cuộc gọi thoại";
            if (isMissed) {
              statusText = isVideo ? "Cuộc gọi video nhỡ" : "Cuộc gọi thoại nhỡ";
            }

            const formatDuration = (secs: number) => {
              const m = Math.floor(secs / 60);
              const s = secs % 60;
              return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
            };

            return (
              <div className="flex items-center gap-3 pr-4 py-1 w-52">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full shrink-0 ${isMissed ? "bg-red-100 text-red-500" : (isOwn ? "bg-blue-100/50 text-blue-600" : "bg-gray-100 text-gray-600")}`}>
                  {icon}
                </div>
                <div className="flex flex-col">
                  <span className={`font-semibold text-[15px] ${isMissed ? "text-red-500" : (isOwn ? "text-gray-900" : "text-gray-800")}`}>{statusText}</span>
                  <span className={`text-xs mt-0.5 ${isOwn ? "text-gray-600" : "text-gray-500"}`}>
                    {duration > 0 ? formatDuration(duration) : "Không bắt máy"}
                  </span>
                </div>
              </div>
            );
          })()
        ) : (
          <div
            className={`whitespace-pre-wrap wrap-break-word ${pureEmoji ? "text-3xl leading-none" : ""}`}
          >
            {msg.content || "[Không có nội dung]"}
          </div>
        )}

        <div
          className={`mt-1 text-[10px] flex items-center gap-1 ${isOwn ? "text-gray-500 justify-end" : "text-gray-400"
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
