"use client";

import { useEffect, useRef } from "react";
import { Loader2, Mic, Send, Square, X } from "lucide-react";

interface ChatInputProps {
  inputValue: string;
  isConnected: boolean;
  isSending: boolean;
  isRecording: boolean;
  audioBlob: Blob | null;
  recordingTime: number;
  placeholder: string;
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
  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef?.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 128)}px`;
  }, [inputValue, textareaRef]);

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
        <textarea
          ref={textareaRef}
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => onTypingChange(true)}
          onBlur={() => onTypingChange(false)}
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
