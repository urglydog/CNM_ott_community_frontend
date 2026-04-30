"use client";

import { X } from "lucide-react";
import type { ReplyToMessage } from "../../../types";
import { getReplyContent } from "../utils/messageUtils";

/** Hiển thị preview của tin nhắn đang được trả lời - Zalo style */
export function ReplyPreview({
  replyingMessage,
  onClear,
  onJumpToMessage,
}: {
  replyingMessage: ReplyToMessage;
  onClear: () => void;
  onJumpToMessage: (messageId: string | number) => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-[#E0F7FA] border-t border-[#B2EBF2]">
      <button
        type="button"
        onClick={onClear}
        className="p-1.5 hover:bg-[#B2EBF2] rounded-full transition-colors shrink-0"
        title="Hủy trả lời"
      >
        <X className="w-4 h-4 text-[#00695C]" />
      </button>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="text-[#00695C] text-xs font-semibold shrink-0">Trả lời</span>
        <div className="h-4 w-px bg-[#00695C]/30" />
        <button
          type="button"
          onClick={() => onJumpToMessage(replyingMessage.id)}
          className="flex items-center gap-1.5 min-w-0 text-left hover:bg-[#B2EBF2] rounded px-1.5 py-0.5 transition-colors"
          title="Nhấn để xem tin nhắn gốc"
        >
          <span className="text-[#00695C] text-xs font-semibold shrink-0">
            {replyingMessage.senderDisplayName || "Người dùng"}:
          </span>
          <span className="text-[#00796B] text-xs truncate">
            {getReplyContent(replyingMessage)}
          </span>
        </button>
      </div>
    </div>
  );
}

/** Khối hiển thị tin nhắn gốc trong bubble (reply reference) - Zalo style */
export function ReplyReference({
  replyToMessage,
  onJumpToMessage,
  isOwn,
}: {
  replyToMessage: ReplyToMessage;
  onJumpToMessage?: (messageId: string | number) => void;
  isOwn: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onJumpToMessage?.(replyToMessage.id)}
      className={`w-full text-left mb-1.5 px-2.5 py-1.5 rounded-lg border-l-[3px] transition-all hover:opacity-80 ${
        isOwn
          ? "bg-[#B2EBF2]/50 border-[#0A5FBA]"
          : "bg-[#F5F5F5] border-[#0A5FBA]"
      }`}
      title="Nhấn để xem tin nhắn gốc"
    >
      <p className={`text-xs font-semibold truncate ${isOwn ? "text-[#0A5FBA]" : "text-[#0A5FBA]"}`}>
        {replyToMessage.senderDisplayName || "Người dùng"}
      </p>
      <p className={`text-xs truncate mt-0.5 ${isOwn ? "text-[#00695C]/80" : "text-gray-600"}`}>
        {getReplyContent(replyToMessage)}
      </p>
    </button>
  );
}
