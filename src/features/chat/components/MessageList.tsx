"use client";

import { Loader2, Smile, Video, Phone } from "lucide-react";
import { useState } from "react";
import type { GroupChatMessage } from "../hooks/useGroupChat";
import type { GroupMember } from "../../groups/types";
import type { FriendItem } from "../../../types";
import type { ChatMode } from "../store/chatStore";
import { GroupMessageBubble } from "./GroupMessageBubble";
import { PrivateMessageBubble } from "./PrivateMessageBubble";
import { SystemMessageBubble } from "./GroupMessageBubble";
import { PollMessageBubble } from "./PollMessageBubble";
import ReminderMessageBubble, { isReminderMessage } from "./ReminderMessageBubble";
import NoteMessageBubble from "./NoteMessageBubble";
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
  activeGroupCall?: { callId: string; channelName: string } | null;
  onJoinActiveGroupCall?: (activeCall: { callId: string; channelName: string }) => void;
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
  activeGroupCall,
  onJoinActiveGroupCall,
}: MessageListProps) {

  const [isJoining, setIsJoining] = useState(false);
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

      {/* Active group call banner — synthetic, not from message DB */}
      {activeGroupCall && (() => {
        // Don't show if messages already contain group_call_active for this callId
        const hasActiveMessage = messages.some(
          (m) => m.contentType === "group_call_active" && (m as any).callData?.callId === activeGroupCall.callId,
        );
        // Don't show if call_log ended exists for this callId
        const hasEndedLog = messages.some(
          (m) => m.contentType === "call_log" && (m as any).callData?.callMode === "group" && (m as any).callData?.callId === activeGroupCall.callId,
        );
        if (hasActiveMessage || hasEndedLog) return null;

        const handleJoin = async () => {
          if (isJoining || !onJoinActiveGroupCall) return;
          setIsJoining(true);
          try {
            await onJoinActiveGroupCall(activeGroupCall);
          } finally {
            setIsJoining(false);
          }
        };

        return (
          <div className="mx-4 mb-3 flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-xl">
            <div className="flex items-center justify-center w-10 h-10 rounded-full shrink-0 bg-green-100 text-green-600">
              <Video className="w-5 h-5" />
            </div>
            <div className="flex flex-col flex-1 min-w-0">
              <span className="font-semibold text-[14px] text-green-800">
                Cuộc gọi nhóm đang diễn ra
              </span>
              <span className="text-xs text-green-600 mt-0.5">
                Nhấn để tham gia
              </span>
            </div>
            <button
              type="button"
              disabled={isJoining}
              onClick={handleJoin}
              className="px-4 py-2 bg-green-500 text-white text-xs font-medium rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0"
            >
              {isJoining ? "Đang tham gia..." : "Tham gia"}
            </button>
          </div>
        );
      })()}

      {(() => {
        const endedCallIds = new Set(
          messages
            .filter(
              (m) =>
                m.contentType === "call_log" &&
                (m as any).callData?.callMode === "group" &&
                (m as any).callData?.callId,
            )
            .map((m) => (m as any).callData.callId as string),
        );

        return messages.map((msg) => {
          // Skip group_call_active if ended call_log exists for same callId
          if (
            msg.contentType === "group_call_active" &&
            endedCallIds.has((msg as any).callData?.callId)
          ) {
            return null;
          }

          const wrapperClass =
            focusedMessageId != null && String(msg.id) === focusedMessageId
              ? isFocusBlue
                ? "rounded-xl bg-blue-500/10 ring-1 ring-blue-500/20 py-2 px-2 mx-1 shadow-sm"
                : "rounded-xl animate-flash-gold ring-2 ring-amber-400 py-2 px-2 mx-1 shadow-lg scale-[1.01] transition-all z-10"
              : "px-2 py-2";

          // System message
          if (isSystemMessage(msg)) {
            return (
              <div key={msg.id} id={getMessageDomId(msg.id)} className={wrapperClass}>
                <SystemMessageBubble msg={msg} />
              </div>
            );
          }

          // Reminder message
          if (isReminderMessage(msg)) {
            return (
              <div key={`reminder-${msg.id}`} id={getMessageDomId(msg.id)} className={wrapperClass}>
                <ReminderMessageBubble msg={msg} currentUserId={currentUserId} />
              </div>
            );
          }

          // Note message
          if (msg.contentType === "note") {
            return (
              <div key={`note-${msg.id}`} id={getMessageDomId(msg.id)} className={wrapperClass}>
                <NoteMessageBubble msg={msg} currentUserId={currentUserId} />
              </div>
            );
          }

          // Poll message
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
        });
      })()}

      <div ref={activeSentinelRef} />
    </div>
  );
}
