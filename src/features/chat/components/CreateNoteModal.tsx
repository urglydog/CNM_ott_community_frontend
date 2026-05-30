"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";

export interface NotePayload {
  content: string;
  pinToTop: boolean;
}

interface CreateNoteModalProps {
  onClose: () => void;
  onSubmit: (payload: NotePayload) => Promise<void>;
}

export default function CreateNoteModal({
  onClose,
  onSubmit,
}: CreateNoteModalProps) {
  const [content, setContent] = useState("");
  const [pinToTop, setPinToTop] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = content.trim().length > 0 && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        content: content.trim(),
        pinToTop,
      });
      onClose();
    } catch (error) {
      console.error("[CreateNoteModal] Submit error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-note-title"
    >
      <div className="w-full max-w-[426px] overflow-hidden rounded bg-white shadow-2xl">
        <div className="flex h-[52px] items-center justify-between border-b border-gray-200 px-[18px]">
          <h2
            id="create-note-title"
            className="text-[16px] font-semibold text-slate-800"
          >
            Tạo ghi chú
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-700 hover:bg-gray-100"
            aria-label="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-[18px] py-4">
          <label
            htmlFor="note-content"
            className="mb-1.5 block text-[14px] font-medium text-slate-700"
          >
            Nội dung
          </label>
          <textarea
            id="note-content"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            className="h-[182px] w-full resize-none rounded border border-blue-500 px-2.5 py-3 text-[15px] text-slate-800 outline-none placeholder:text-slate-500 focus:ring-1 focus:ring-blue-500"
            autoFocus
          />

          <label className="mt-4 flex w-fit cursor-pointer items-center gap-2 text-[14px] font-medium text-slate-600">
            <input
              type="checkbox"
              checked={pinToTop}
              onChange={(event) => setPinToTop(event.target.checked)}
              className="h-[18px] w-[18px] rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Ghim lên đầu trò chuyện</span>
          </label>
        </div>

        <div className="flex justify-end gap-3 px-[18px] pb-4 pt-0">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded bg-gray-200 px-4 text-[15px] font-semibold text-slate-700 hover:bg-gray-300"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex h-10 items-center gap-2 rounded bg-blue-600 px-4 text-[15px] font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Tạo ghi chú
          </button>
        </div>
      </div>
    </div>
  );
}
