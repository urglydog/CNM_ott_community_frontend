"use client";

import { Loader2, Smile } from "lucide-react";
import type { GroupChatMessage } from "../hooks/useGroupChat";
import type { GroupMember } from "../../groups/types";
import type { FriendItem } from "../../../types";
import type { ChatMode } from "../store/chatStore";
import { GroupMessageBubble } from "./GroupMessageBubble";
import { PrivateMessageBubble } from "./PrivateMessageBubble";
import { SystemMessageBubble, GroupCallStartedBanner } from "./GroupMessageBubble";
import { getMessageDomId } from "../utils/messageSearch";

interface MessageListProps {
  chatMode: ChatMode | null;
  messages: GroupChatMessage[];
  isLoading: boolean;
  error: string | null;
  currentUserId: string;
  groupName: string;
  friendName: string;
  selectedFriend?: FriendItem | null;
  groupMembers?: GroupMember[];
  focusedMessageId: string | null;
  activeScrollRef: React.RefObject<HTMLDivElement>;
  activeSentinelRef: React.RefObject<HTMLDivElement>;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
  onMessageContextMenu?: (
    e: React.MouseEvent,
    msg: GroupChatMessage,
    conversationId: string,
    canRevoke: boolean,
  ) => void;
  onReplyToMessage?: (msg: GroupChatMessage) => void;
  onJumpToMessage?: (messageId: string | number) => void;
  resolveDisplayAvatar?: (rawUrl: string | null | undefined) => string | null;
  onJoinGroupCall?: (roomId: string) => void;
}

export function MessageList({
  chatMode,
  messages,
  isLoading,
  error,
  currentUserId,
  groupName,
  friendName,
  selectedFriend,
  groupMembers = [],
  focusedMessageId,
  activeScrollRef,
  activeSentinelRef,
  onScroll,
  onMessageContextMenu,
  onReplyToMessage,
  onJumpToMessage,
  resolveDisplayAvatar,
  onJoinGroupCall,
}: MessageListProps) {
  const isSystemMessage = (msg: GroupChatMessage) => msg.contentType === "system";
  const isGroupCallStarted = (msg: GroupChatMessage) =>
    (msg as any).contentType === "group_call_started" ||
    (msg as any).messageType === "group_call_started";

  return (
    <div
      ref={activeScrollRef}
      onScroll={onScroll}
      className="flex-1 overflow-y-auto p-4 flex flex-col"
    >
      {isLoading && (
        <div className="flex items-center justify-center py-8 text-gray-400 text-sm gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Đang tải tin nhắn...
        </div>
      )}

      {error && !isLoading && (
        <div className="flex items-center justify-center py-8 text-red-400 text-sm">
          {error}
        </div>
      )}

      {!isLoading && !error && messages.length === 0 && (
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

      {messages.map((msg) => {
        const wrapperClass =
          focusedMessageId != null && String(msg.id) === focusedMessageId
            ? "rounded-xl bg-yellow-100/70 ring-1 ring-yellow-300 transition-all"
            : "";

        // System message
        if (isSystemMessage(msg)) {
          return (
            <div key={msg.id} id={getMessageDomId(msg.id)} className={wrapperClass}>
              <SystemMessageBubble msg={msg} />
            </div>
          );
        }

        // Banner cuộc gọi nhóm đang diễn ra — hiển thị nút [Tham gia]
        if (isGroupCallStarted(msg)) {
          return (
            <div key={msg.id} id={getMessageDomId(msg.id)} className={wrapperClass}>
              <GroupCallStartedBanner msg={msg} onJoin={onJoinGroupCall} />
            </div>
          );
        }

        if (chatMode === "GROUP") {
          return (
            <div key={msg.id} id={getMessageDomId(msg.id)} className={wrapperClass}>
              <GroupMessageBubble
                msg={msg}
                authUserId={currentUserId}
                senderAvatarUrl={resolveDisplayAvatar?.(msg.senderAvatarUrl)}
                onContextMenu={onMessageContextMenu}
                onReply={onReplyToMessage}
                onJumpToMessage={onJumpToMessage}
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
              onContextMenu={onMessageContextMenu}
              onReply={onReplyToMessage}
              onJumpToMessage={onJumpToMessage}
            />
          </div>
        );
      })}

      <div ref={activeSentinelRef} />
    </div>
  );
}
