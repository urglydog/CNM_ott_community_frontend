"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Send, Square, X } from "lucide-react";
import { useChatStore } from "../store/chatStore";

interface ChatInputProps {
  inputValue: string;
  isConnected: boolean;
  isSending: boolean;
  isRecording: boolean;
  audioBlob: Blob | null;
  recordingTime: number;
  placeholder: string;
  mentionUsers?: any[];
  authUserId?: string | number | null;
  onInputChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onCancelRecording: () => void;
  onSendAudio: () => void;
  onTypingChange: (isTyping: boolean) => void;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
}

export function ChatInput({
  inputValue,
  isConnected,
  isSending,
  isRecording,
  audioBlob,
  recordingTime,
  placeholder,
  mentionUsers = [],
  authUserId,
  onInputChange,
  onKeyDown,
  onSend,
  onStartRecording,
  onStopRecording,
  onCancelRecording,
  onSendAudio,
  onTypingChange,
  textareaRef,
}: ChatInputProps) {
  const [mentionFilter, setMentionFilter] = useState("");
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const friends = useChatStore((state) => state.friends || []);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef?.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 128)}px`;
  }, [inputValue, textareaRef]);

  const getDisplayIdentifier = (userId: any) => {
    if (userId === "all") return "Tất cả mọi người";
    const friend = friends.find((f) => String(f.friend_id || f.id || f.userId) === String(userId));
    if (friend?.nickname) {
      return friend.nickname;
    }
    const groupMember = mentionUsers.find((m) => String(m.userId) === String(userId));
    return groupMember?.displayName || groupMember?.username || groupMember?.userId || "Thành viên";
  };

  const filteredMembers = mentionUsers
    .filter((u) => String(u.userId) !== String(authUserId))
    .filter((u) => {
      const friend = friends.find((f) => String(f.friend_id || f.id || f.userId) === String(u.userId));
      const nickname = friend?.nickname ? String(friend.nickname).toLowerCase() : "";
      const displayName = String(u.displayName || u.username || u.userId || "").toLowerCase();
      
      const query = mentionFilter.toLowerCase();
      return nickname.includes(query) || displayName.includes(query);
    });

  const allOption = { userId: "all", displayName: "Tất cả mọi người" };
  const query = mentionFilter.toLowerCase();
  const includesAll = "tất cả mọi người".includes(query) || "all".includes(query);

  const dropdownItems = includesAll ? [allOption, ...filteredMembers] : filteredMembers;

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    onInputChange(val);

    const lastAtIndex = val.lastIndexOf("@");
    if (lastAtIndex !== -1 && lastAtIndex >= val.lastIndexOf(" ")) {
      const query = val.substring(lastAtIndex + 1).split(/\s/)[0];
      setMentionFilter(query);
      setShowMentionMenu(true);
    } else {
      setShowMentionMenu(false);
    }
  };

  const handleSelectMention = (member: any) => {
    const name = getDisplayIdentifier(member.userId);
    const lastAtIndex = inputValue.lastIndexOf("@");
    if (lastAtIndex !== -1 && lastAtIndex >= inputValue.lastIndexOf(" ")) {
      const beforeAt = inputValue.substring(0, lastAtIndex);
      const newVal = `${beforeAt}@${name} `;
      onInputChange(newVal);
    }
    setShowMentionMenu(false);
  };

  if (isRecording || audioBlob) {
    return (
      <div className="flex items-center px-4 py-3 gap-3 w-full bg-white h-17 border-t border-gray-100">
        <button
          type="button"
          onClick={onCancelRecording}
          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors shrink-0"
          title="Hủy"
        >
          <X className="w-6 h-6" />
        </button>

        {isRecording && (
          <button
            type="button"
            onClick={onStopRecording}
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
          onClick={onSendAudio}
          disabled={!audioBlob || !isConnected || isSending}
          className="w-11 h-11 rounded-full bg-blue-500 text-white flex items-center justify-center hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0 shadow-sm"
          title="Gửi"
        >
          {isSending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5 ml-0.5" />
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center px-4 py-3 gap-3">
      {/* Left side: icon buttons */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => {
            onTypingChange(false);
            onStartRecording();
          }}
          disabled={!isConnected || isSending}
          className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-colors text-gray-500 hover:text-blue-500 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed"
          title="Ghi âm"
        >
          <Mic className="w-5 h-5" />
        </button>
      </div>

      {/* Center: textarea input */}
      <div className="flex-1 relative">
        {showMentionMenu && dropdownItems.length > 0 && (
          <div className="absolute bottom-full left-0 mb-2 w-64 max-h-48 bg-white border border-gray-200 rounded-lg shadow-xl overflow-y-auto z-50">
            <div className="p-2 text-xs font-semibold text-gray-500 bg-gray-50 border-b border-gray-100">
              Nhắc tên thành viên
            </div>
            {dropdownItems.map((member) => {
              const displayName = getDisplayIdentifier(member.userId);
              return (
                <button
                  key={member.userId}
                  type="button"
                  onClick={() => handleSelectMention(member)}
                  className="flex items-center gap-2 px-3 py-2 w-full text-left hover:bg-blue-50 transition-colors text-sm"
                >
                  {member.avatarUrl ? (
                    <img
                      src={member.avatarUrl}
                      alt={displayName}
                      className="w-6 h-6 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-600 shrink-0 text-xs">
                      {String(displayName || "U").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="font-medium text-gray-700 truncate">
                    {displayName}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={onKeyDown}
          onFocus={() => onTypingChange(true)}
          onBlur={() => {
            // Delay closing mention menu to allow clicks on dropdown
            setTimeout(() => setShowMentionMenu(false), 200);
            onTypingChange(false);
          }}
          placeholder={placeholder}
          disabled={!isConnected || isSending}
          className="w-full resize-none min-h-[44px] max-h-32 focus:outline-none text-[15px] py-2.5 bg-gray-50 rounded-full px-4 pr-12 border border-gray-200 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 focus:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-all placeholder:text-gray-400"
          rows={1}
        />
      </div>

      {/* Right side: send button */}
      <button
        type="button"
        onClick={() => {
          onTypingChange(false);
          onSend();
        }}
        disabled={!inputValue.trim() || !isConnected || isSending}
        className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center cursor-pointer hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-all shadow-sm shrink-0"
        title="Gửi tin nhắn (Enter)"
      >
        {isSending ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Send className="w-5 h-5" />
        )}
      </button>
    </div>
  );
}
