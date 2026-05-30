"use client";

import { FileText, X, Copy, Check } from "lucide-react";
import { useState } from "react";
import type { GroupChatMessage } from "../hooks/useGroupChat";
import { useToast } from "../../../contexts/ToastContext";

interface NoteMessageBubbleProps {
  msg: GroupChatMessage;
  currentUserId: string | number;
}

function NoteDetailDialog({
  creator,
  content,
  createdAt,
  onClose,
}: {
  creator: string;
  content: string;
  createdAt: string;
  onClose: () => void;
}) {
  const { addToast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      addToast("Đã sao chép nội dung ghi chú", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      addToast("Không thể sao chép nội dung", "error");
    }
  };

  const formattedTime = new Date(createdAt).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/35 px-4" onClick={onClose}>
      <div 
        className="w-full max-w-[450px] overflow-hidden rounded-xl bg-white shadow-2xl transition-all border border-gray-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex h-[52px] items-center justify-between border-b border-slate-100 px-5">
          <h2 className="text-[16px] font-semibold text-slate-800 flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-500" />
            Chi tiết ghi chú
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            aria-label="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="bg-[#f8f9fa] px-6 py-6 border-b border-slate-100">
          <div className="max-h-[260px] overflow-y-auto pr-2 bg-white rounded-lg p-4 border border-slate-200/60 shadow-sm">
            <div className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-slate-800 font-normal">
              {content}
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-1 text-[12px] text-slate-400">
            <div>
              Tạo bởi <span className="font-medium text-slate-600">{creator}</span>
            </div>
            <div>{formattedTime}</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex h-[64px] items-center justify-end px-5 gap-3 bg-white">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 h-10 rounded-lg border border-slate-200 px-4 text-[14px] font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-green-500" />
                <span>Đã sao chép</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                <span>Sao chép</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-lg bg-blue-600 hover:bg-blue-700 px-6 text-[14px] font-semibold text-white transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

export default function NoteMessageBubble({
  msg,
  currentUserId,
}: NoteMessageBubbleProps) {
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const isOwn = msg.isOwn || Number(msg.senderId) === Number(currentUserId);
  const creator = isOwn ? "Bạn" : msg.senderDisplayName || "Ai đó";
  const noteContent = msg.content || "";

  return (
    <div className="my-2 flex flex-col items-center">
      <div className="flex max-w-[88%] items-center gap-2 rounded-full bg-white px-3 py-1 text-[13px] leading-5 text-slate-500 shadow-sm border border-slate-100">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-500">
          <FileText className="h-4 w-4" />
        </span>
        <span className="truncate flex items-center gap-1">
          <span>{creator} tạo ghi chú </span>
          <span className="font-semibold text-slate-700 max-w-[120px] sm:max-w-[200px] truncate">
            {noteContent}
          </span>
          <span> . </span>
          <button
            type="button"
            onClick={() => setIsDetailOpen(true)}
            className="font-semibold text-blue-600 hover:underline shrink-0"
          >
            Xem
          </button>
        </span>
      </div>

      {isDetailOpen && (
        <NoteDetailDialog
          creator={creator}
          content={noteContent}
          createdAt={msg.createdAt}
          onClose={() => setIsDetailOpen(false)}
        />
      )}
    </div>
  );
}
