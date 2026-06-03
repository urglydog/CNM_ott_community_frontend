"use client";

import { FileText, Loader2, Reply } from "lucide-react";
import AudioMessage from "./AudioMessage";
import { ReadByAvatars } from "./ReadByAvatars";
import { ReplyReference } from "./ReplyComponents";
import type { GroupChatMessage } from "../hooks/useGroupChat";
import { formatTime, isPureEmoji } from "../utils/messageUtils";
import LocationMessage from "../../../components/chat/LocationMessage";
import { SenderAvatar } from "./Avatar";
import {
  BOT_AVATAR_URL,
  BOT_DISPLAY_NAME,
  isBotSender,
  renderBotMentionHighlight,
} from "../utils/botMention";
import { CallMessageCard } from "./CallMessageCard";

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
  focusedMessageId?: string | null;
  isFocusBlue?: boolean;
  onCall?: (callType: 'video' | 'audio') => void;
}


/** Bubble tin nhắn 1:1 (Private DM) */
export function PrivateMessageBubble({
  msg,
  friendName,
  friendAvatarUrl,
  authUserId,
  onContextMenu,
  onReply,
  onJumpToMessage,
  focusedMessageId,
  isFocusBlue,
  onCall,
}: PrivateMessageBubbleProps) {
  const isOwn = msg.isOwn || Number(msg.senderId) === Number(authUserId);
  const isBot = isBotSender(msg.senderId);
  const incomingName = isBot
    ? msg.senderDisplayName || BOT_DISPLAY_NAME
    : msg.senderDisplayName || friendName;
  const incomingAvatarUrl = isBot
    ? msg.senderAvatarUrl || BOT_AVATAR_URL
    : msg.senderAvatarUrl || friendAvatarUrl;

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
        className={`flex flex-col ${isOwn ? "items-end" : "items-start"} mb-0`}
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

  // ── Call messages: early return WITHOUT bubble wrapper ───────────────────
  if (msg.contentType === "call_log" || (msg as any).messageType === "call_log") {
    const callData = (msg as any).callData;
    if (callData) {
      const callType = callData?.callType || "video";
      const endedReason = callData?.endedReason || null;
      const durationSeconds = callData?.durationSeconds ?? callData?.duration ?? 0;

      let status: "ended" | "missed" | "cancelled" | "rejected" = "ended";
      const hasDuration = durationSeconds > 0 || endedReason === "user_ended" || endedReason === "disconnect_timeout";
      if (hasDuration) {
        status = "ended";
      } else if (endedReason === "callee_rejected") {
        status = "rejected";
      } else if (endedReason === "caller_cancelled") {
        status = "cancelled";
      } else {
        status = "missed";
      }

      return (
        <div
          className={`flex ${!isOwn && isBot ? "items-start gap-2" : "flex-col"} ${isOwn ? "items-end" : "items-start"} mb-0`}
          data-message-id={String(msg.id)}
          onContextMenu={(e) => {
            onContextMenu?.(e, msg, msg.conversationId ?? "", isOwn);
          }}
        >
          <CallMessageCard
            variant="direct"
            callType={callType as "video" | "audio"}
            status={status}
            durationSeconds={durationSeconds}
            endedReason={endedReason}
            isOwn={isOwn}
            onCall={onCall}
          />
        </div>
      );
    }
  }

  return (
    <div
      className={`flex ${!isOwn && isBot ? "items-start gap-2" : "flex-col"} ${isOwn ? "items-end" : "items-start"} mb-0`}
      data-message-id={String(msg.id)}
    >
      {!isOwn && isBot && (
        <SenderAvatar
          avatarUrl={incomingAvatarUrl}
          name={incomingName}
          size={28}
        />
      )}

      {/* Main bubble — w-fit so it hugs content, max-w-[70%] to cap width */}
      <div
        className={`relative group w-fit max-w-[70%] flex flex-col px-3.5 py-2 rounded-[20px] text-[14px] shadow-sm border ${isOwn
            ? "bg-[#dff1ff] text-gray-900 border-[#dff1ff] rounded-br-sm"
            : isBot
              ? "bg-gradient-to-br from-slate-50 to-blue-50 text-slate-900 border-blue-100 rounded-bl-sm"
              : "bg-white text-gray-800 border-transparent shadow-sm rounded-bl-sm"
          } ${msg.sendStatus === "failed" ? "opacity-70 border-red-400" : ""} ${msg.contentType === "revoked" ? "bg-gray-100 border-gray-200 opacity-80 italic" : ""} ${pureEmoji ? "px-4 py-3" : ""} ${
            String(msg.id) === focusedMessageId
              ? isFocusBlue 
                ? "ring-2 ring-blue-500 animate-pulse-blue shadow-lg z-10 scale-[1.02] transition-transform" 
                : "ring-2 ring-amber-400 bg-amber-50/40 shadow-md scale-[1.01] transition-all z-10"
              : ""
          }`}

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
        {msg.storyReply && (
          <div className={`mb-2 rounded-lg border-l-4 border-violet-400 px-2 py-1.5 ${isOwn ? "bg-white/20" : "bg-violet-50"}`}>
            <p className="text-[11px] font-semibold text-violet-600">Bạn đã trả lời tin của họ</p>
            <p className="line-clamp-2 text-xs opacity-80">
              {msg.storyReply.text || (msg.storyReply.type === "image" ? "[Ảnh story]" : "[Story]")}
            </p>
          </div>
        )}

        {msg.replyToMessage && (
          <ReplyReference
            replyToMessage={msg.replyToMessage}
            onJumpToMessage={onJumpToMessage || handleJumpClick}
            isOwn={isOwn}
          />
        )}

        {!isOwn && (
          <div className="mb-0.5 flex items-center gap-1.5">
            <div
              className={`text-[11px] font-normal ${isBot ? "text-slate-700" : "text-gray-400"}`}
            >
              {incomingName}
            </div>
            {isBot && (
              <span className="rounded-full bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-600">
                BOT
              </span>
            )}
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
          <div className="mt-1">
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
        ) : (
          <div
            className={`whitespace-pre-wrap wrap-break-word ${pureEmoji ? "text-3xl leading-none" : ""}`}
          >
            {msg.content
              ? renderBotMentionHighlight(msg.content, `private-bot-${msg.id}`)
              : "[Không có nội dung]"}
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
