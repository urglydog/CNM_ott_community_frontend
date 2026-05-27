"use client";

import { Loader2, Smile } from "lucide-react";
import type { GroupChatMessage } from "../hooks/useGroupChat";
import type { GroupMember } from "../../groups/types";
import type { FriendItem } from "../../../types";
import type { ChatMode } from "../store/chatStore";
import { GroupMessageBubble } from "./GroupMessageBubble";
import { PrivateMessageBubble } from "./PrivateMessageBubble";
import { SystemMessageBubble } from "./GroupMessageBubble";
import { PollMessageBubble } from "./PollMessageBubble";
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
  isFocusBlue?: boolean;
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
  isFocusBlue,
}: MessageListProps) {

  const isSystemMessage = (msg: GroupChatMessage) => msg.contentType === "system";

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
            ? isFocusBlue
              ? "rounded-xl bg-blue-500/10 ring-1 ring-blue-500/20 transition-all duration-700 py-2 px-2 mx-1 shadow-sm"
              : "rounded-xl bg-yellow-400/15 ring-1 ring-yellow-400/30 transition-all duration-700 py-2 px-2 mx-1 shadow-sm"
            : "px-2 py-2";




        // System message
        if (isSystemMessage(msg)) {
          return (
            <div key={msg.id} id={getMessageDomId(msg.id)} className={wrapperClass}>
              <SystemMessageBubble msg={msg} />
            </div>
          );
        }

        // Poll message — centered layout with voting UI
        if (msg.contentType === "poll" && msg.pollData) {
          return (
            <div key={`poll-${msg.id}`} id={getMessageDomId(msg.id)} className={wrapperClass}>
              <PollMessageBubble key={`poll-bubble-${msg.id}`} msg={msg} currentUserId={currentUserId} />
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
                groupMembers={groupMembers}
                onContextMenu={onMessageContextMenu}
                onReply={onReplyToMessage}
                onJumpToMessage={onJumpToMessage}
                focusedMessageId={focusedMessageId}
                isFocusBlue={isFocusBlue}
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
              focusedMessageId={focusedMessageId}
              isFocusBlue={isFocusBlue}
            />

          </div>
        );
      })}

      <div ref={activeSentinelRef} />
    </div>
  );
}
