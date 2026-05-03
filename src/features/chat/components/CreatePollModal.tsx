"use client";

import { useState } from "react";
import { X, Plus, Settings } from "lucide-react";
import { Loader2 } from "lucide-react";
import type { PollOption, PollData } from "../../../types";

interface CreatePollModalProps {
  onClose: () => void;
  onSubmit: (pollData: {
    content: string;
    pollData: PollData;
  }) => Promise<void>;
}

const MAX_QUESTION_LENGTH = 200;

export default function CreatePollModal({ onClose, onSubmit }: CreatePollModalProps) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [multipleChoice, setMultipleChoice] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filledOptions = options.filter((opt) => opt.trim().length > 0);
  const canSubmit =
    question.trim().length > 0 &&
    filledOptions.length >= 2 &&
    !isSubmitting;

  const handleAddOption = () => {
    if (options.length < 10) {
      setOptions([...options, ""]);
    }
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > 2) {
      const newOptions = options.filter((_, i) => i !== index);
      setOptions(newOptions);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setIsSubmitting(true);
    try {
      const pollOptions: PollOption[] = options
        .filter((opt) => opt.trim().length > 0)
        .map((opt, index) => ({
          id: `poll-option-${Date.now()}-${index}`,
          text: opt.trim(),
          voterIds: [],
        }));

      await onSubmit({
        content: question.trim(),
        pollData: {
          pollOptions,
          pollSettings: {
            multipleChoice,
            allowAddOption: false,
          },
        },
      });
      onClose();
    } catch (error) {
      console.error("[CreatePollModal] Submit error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-poll-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative w-full max-w-[420px] rounded-2xl bg-white shadow-2xl flex flex-col animate-scaleIn overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <h2
            id="create-poll-title"
            className="text-[16px] font-semibold text-gray-900"
          >
            Tạo bình chọn
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5 max-h-[60vh]">
          {/* Question Field */}
          <div>
            <label
              htmlFor="poll-question"
              className="block text-[13px] font-medium text-gray-700 mb-2"
            >
              Chủ đề bình chọn
            </label>
            <div className="relative">
              <textarea
                id="poll-question"
                value={question}
                onChange={(e) => setQuestion(e.target.value.slice(0, MAX_QUESTION_LENGTH))}
                placeholder="Đặt câu hỏi bình chọn"
                className="w-full px-4 py-3 text-[14px] border-2 border-gray-200 rounded-xl focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all placeholder:text-gray-400 resize-none"
                rows={3}
                autoFocus
              />
              <span className="absolute bottom-3 right-4 text-[11px] text-gray-400 font-medium">
                {question.length}/{MAX_QUESTION_LENGTH}
              </span>
            </div>
          </div>

          {/* Options Field */}
          <div>
            <label className="block text-[13px] font-medium text-gray-700 mb-2">
              Các lựa chọn
            </label>
            <div className="space-y-2">
              {options.map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => handleOptionChange(index, e.target.value)}
                      placeholder={`Lựa chọn ${index + 1}`}
                      className="w-full px-4 py-2.5 text-[14px] border-2 border-gray-200 rounded-xl focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all placeholder:text-gray-400"
                      maxLength={100}
                    />
                  </div>
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(index)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      aria-label="Xóa lựa chọn"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Add Option Button */}
            {options.length < 10 && (
              <button
                type="button"
                onClick={handleAddOption}
                className="mt-3 flex items-center gap-1.5 text-[13px] font-medium text-blue-500 hover:text-blue-600 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Thêm lựa chọn
              </button>
            )}
          </div>

          {/* Settings */}
          {showSettings && (
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
              <label className="flex items-center gap-3 cursor-pointer">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={multipleChoice}
                    onChange={(e) => setMultipleChoice(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-6 bg-gray-200 rounded-full peer peer-checked:bg-blue-500 transition-colors"></div>
                  <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4 shadow-sm"></div>
                </div>
                <span className="text-[13px] text-gray-700">
                  Cho phép chọn nhiều đáp án
                </span>
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 shrink-0 bg-gray-50/50">
          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-xl transition-colors ${
              showSettings
                ? "bg-blue-100 text-blue-500"
                : "text-gray-500 hover:bg-gray-200 hover:text-gray-700"
            }`}
            aria-label="Cài đặt"
            title="Cài đặt bình chọn"
          >
            <Settings className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-[14px] font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="px-5 py-2 text-[14px] font-medium text-white bg-blue-500 rounded-xl hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 shadow-sm"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Tạo bình chọn
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
