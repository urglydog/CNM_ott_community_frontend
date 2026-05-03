"use client";

import { FileText, Loader2, Reply, Phone, PhoneMissed, Video, VideoOff, Users, PhoneCall } from "lucide-react";

import AudioMessage from "./AudioMessage";
import { ReadByAvatars } from "./ReadByAvatars";
import { ReplyReference } from "./ReplyComponents";
import { SenderAvatar } from "./Avatar";
import type { GroupChatMessage } from "../hooks/useGroupChat";
import { formatTime, isPureEmoji } from "../utils/messageUtils";
import LocationMessage from "../../../components/chat/LocationMessage";
import { useChatStore } from "../store/chatStore";

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

/** Banner cuộc gọi nhóm đang diễn ra — hiển thị với nút [Tham gia] */
export function GroupCallStartedBanner({
  msg,
  onJoin,
}: {
  msg: GroupChatMessage;
  onJoin?: (roomId: string, callType?: string) => void;
}) {
  const callerName = msg.senderDisplayName || "Ai đó";
  // roomId: ưu tiên callData.roomId (từ DB), fallback msg.roomId (từ socket)
  const roomId = (msg as any).callData?.roomId || (msg as any).roomId || "";
  const callType = (msg as any).callData?.callType || "video";

  return (
    <div className="flex justify-center my-3">
      <div className="flex items-center justify-between gap-3 bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 shadow-sm w-full max-w-sm">
        <div className="flex items-center gap-2 text-blue-700">
          <PhoneCall className="w-4 h-4 animate-pulse shrink-0" />
          <div className="flex flex-col">
            <span className="text-sm font-semibold leading-tight">
              {callerName} đang gọi nhóm {callType === "audio" ? "thoại" : "video"}
            </span>
            <span className="text-[10px] text-gray-400">
              {new Date(msg.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        </div>
        {onJoin && (
          <button
            onClick={() => onJoin(roomId, callType)}
            disabled={!roomId}
            className="shrink-0 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-full flex items-center gap-1.5 transition-colors"
          >
            <Users className="w-3.5 h-3.5" />
            Tham gia
          </button>
        )}
      </div>
    </div>
  );
}

interface MessageBubbleProps {
  msg: GroupChatMessage;
  authUserId: string | number;
  senderAvatarUrl?: string | null;
  senderName?: string;
  isOwn?: boolean;
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
}


const renderMentionContent = (content: string, groupMembers: any[] = [], friends: any[] = []) => {
  if (!content) return content;

  const regex = /<@([^>]+)>/g;
  const parts: (string | JSX.Element)[] = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.substring(lastIndex, match.index));
    }

    const userId = match[1];
    if (userId === "all") {
      parts.push(
        <span
          key={`mention-all-${match.index}`}
          className="bg-orange-100 text-orange-600 font-bold px-1.5 py-0.5 rounded hover:underline cursor-pointer"
        >
          @Tất cả
        </span>
      );
    } else {
      const friend = friends.find((f) => String(f.friend_id || f.id || f.userId) === String(userId));
      const groupMember = groupMembers.find((m) => String(m.userId) === String(userId));

      let mentionName = "@Người dùng";
      if (friend?.nickname) {
        mentionName = `@${friend.nickname}`;
      } else if (friend?.friend_displayName || friend?.displayName) {
        mentionName = `@${friend.friend_displayName || friend.displayName}`;
      } else if (groupMember?.displayName || groupMember?.username) {
        mentionName = `@${groupMember.displayName || groupMember.username}`;
      }

      parts.push(
        <span
          key={`mention-${userId}-${match.index}`}
          className="text-blue-500 font-bold hover:underline cursor-pointer"
        >
          {mentionName}
        </span>
      );
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < content.length) {
    parts.push(content.substring(lastIndex));
  }

  return parts.length > 0 ? parts : content;
};

function MessageBubbleContent({
  msg,
  isOwn: isOwnProp,
  groupMembers = [],
  authUserId,
  onContextMenu,
  onReply,
  onJumpToMessage,
  focusedMessageId,
  isFocusBlue,
}: MessageBubbleProps & { senderName: string; groupMembers?: any[]; authUserId: string | number }) {
  const isOwn: boolean = isOwnProp ?? false;
  const friends = useChatStore((state) => state.friends || []);
  const isMentioned = Array.isArray(msg.mentions) && (msg.mentions.map(String).includes(String(authUserId)) || msg.mentions.includes("all"));

  const handleReplyClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onReply?.(msg);
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
      className={`relative group w-fit max-w-full flex flex-col px-3 py-2 rounded-2xl text-[14px] shadow-sm border ${
        isMentioned
          ? "bg-yellow-100 border-yellow-500 border-l-4 text-gray-900"
          : isOwn
          ? "bg-blue-200 text-gray-900 border-blue-200 rounded-br-sm"
          : "bg-white text-gray-800 border-gray-200 rounded-bl-sm"
      } ${msg.sendStatus === "failed" ? "opacity-70 border-red-400" : ""} ${msg.contentType === "revoked" ? "bg-gray-100 border-gray-200 opacity-80 italic" : ""} ${pureEmoji ? "px-4 py-3" : ""} ${
        String(msg.id) === focusedMessageId
          ? isFocusBlue 
            ? "ring-2 ring-blue-500 animate-pulse-blue shadow-lg z-10 scale-[1.02] transition-transform" 
            : "ring-2 ring-yellow-400 bg-yellow-50/30"
          : ""
      }`}


      onContextMenu={(e) => {
        if (msg.contentType === "revoked") return;
        onContextMenu?.(e, msg, msg.conversationId ?? "", isOwn);
      }}
    >
      {/* Reply button */}
      <button
        type="button"
        onClick={handleReplyClick}
        className={`absolute -top-3 left-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full shadow-md hover:bg-gray-100 ${isOwn ? "bg-blue-200 text-gray-700 hover:bg-blue-300" : "bg-white text-gray-500 hover:bg-gray-50"}`}
        title="Trả lời"
      >
        <Reply className="w-3.5 h-3.5" />
      </button>

      {/* ── Reply Reference — nested inside bubble at the top ── */}
      {msg.replyToMessage && (
        <ReplyReference
          replyToMessage={msg.replyToMessage}
          onJumpToMessage={onJumpToMessage}
          isOwn={isOwn}
        />
      )}

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
      ) : msg.contentType === "location" && msg.locationData ? (
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
          {msg.content ? renderMentionContent(msg.content, groupMembers, friends) : "[Không có nội dung]"}
        </div>
      )}

      {/* Thời gian + trạng thái gửi */}
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
  );
}

/** Bubble tin nhắn nhóm — hiển thị avatar + tên người gửi bên trái (Zalo style) */
export function GroupMessageBubble({
  msg,
  authUserId,
  senderAvatarUrl,
  groupMembers = [],
  onContextMenu,
  onReply,
  onJumpToMessage,
  focusedMessageId,
  isFocusBlue,
}: MessageBubbleProps & { groupMembers?: any[] }) {
  const isOwn = msg.isOwn || Number(msg.senderId) === Number(authUserId);
  const senderName = msg.senderDisplayName || (isOwn ? "Bạn" : "Người dùng");

  // Sticker special rendering
  if (msg.contentType === "sticker" && msg.stickerData?.stickerUrl) {
    return (
      <div
        className={`flex items-start gap-2 mb-0 ${isOwn ? "flex-row-reverse" : "flex-row"}`}
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
          {/* Reply Reference above sticker (stickers have no bubble to nest inside) */}
          {msg.replyToMessage && (
            <div
              className={`w-fit max-w-[260px] mb-1 px-2 py-1.5 rounded-r-md border-l-4 cursor-pointer transition-opacity hover:opacity-75 ${
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
      </div>
    );
  }

  return (
    <div
      className={`flex items-start gap-2 mb-0 ${isOwn ? "flex-row-reverse" : "flex-row"}`}
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

      {/* Wrapper capping width at 68% of chat window */}
      <div
        className={`flex flex-col ${isOwn ? "items-end" : "items-start"} max-w-[68%] ${isPureEmoji(msg.content ?? "") ? "max-w-max" : ""}`}
      >
        {/* Tên người gửi — chỉ hiện nếu không phải mình */}
        {!isOwn && (
          <span className="text-xs text-gray-500 mb-0.5 ml-1">
            {senderName}
          </span>
        )}

        {/* MessageBubbleContent already has ReplyReference nested inside */}
        <MessageBubbleContent
          msg={msg}
          authUserId={authUserId}
          senderAvatarUrl={senderAvatarUrl}
          senderName={senderName}
          isOwn={isOwn}
          groupMembers={groupMembers}
          onContextMenu={onContextMenu}
          onReply={onReply}
          onJumpToMessage={onJumpToMessage}
          focusedMessageId={focusedMessageId}
          isFocusBlue={isFocusBlue}
        />

        {/* Reader avatars for own messages */}
        {isOwn && msg.readBy && msg.readBy.length > 0 && (
          <ReadByAvatars readers={msg.readBy} maxShow={3} size={16} />
        )}
      </div>
    </div>
  );
}
