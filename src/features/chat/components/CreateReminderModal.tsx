"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronDown, Loader2, X } from "lucide-react";

export type ReminderRepeat = "none" | "daily" | "weekly" | "monthly";

export interface ReminderPayload {
  content: string;
  remindAt: string;
  repeat: ReminderRepeat;
}

interface CreateReminderModalProps {
  onClose: () => void;
  onSubmit: (payload: ReminderPayload) => Promise<void>;
}

const repeatLabels: Record<ReminderRepeat, string> = {
  none: "Không lặp lại",
  daily: "Lặp lại hằng ngày",
  weekly: "Lặp lại hằng tuần",
  monthly: "Lặp lại hằng tháng",
};

function toDateTimeLocalValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function addMinutes(minutes: number) {
  return toDateTimeLocalValue(new Date(Date.now() + minutes * 60 * 1000));
}

function tomorrowAtNine() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  return toDateTimeLocalValue(date);
}

function formatReminderTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(now.getDate() + 1);

  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  const nextDay =
    date.getFullYear() === tomorrow.getFullYear() &&
    date.getMonth() === tomorrow.getMonth() &&
    date.getDate() === tomorrow.getDate();

  const time = date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (sameDay) return `Hôm nay lúc ${time}`;
  if (nextDay) return `Ngày mai lúc ${time}`;

  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CreateReminderModal({
  onClose,
  onSubmit,
}: CreateReminderModalProps) {
  const [content, setContent] = useState("");
  const [remindAt, setRemindAt] = useState(addMinutes(30));
  const [selectedQuickOption, setSelectedQuickOption] = useState("30");
  const [repeat, setRepeat] = useState<ReminderRepeat>("none");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const minDateTime = useMemo(() => toDateTimeLocalValue(new Date()), []);
  const canSubmit =
    content.trim().length > 0 &&
    new Date(remindAt).getTime() > Date.now() &&
    !isSubmitting;

  const quickOptions = [
    { id: "15", label: "15 phút nữa", value: () => addMinutes(15) },
    { id: "30", label: "30 phút nữa", value: () => addMinutes(30) },
    { id: "tomorrow9", label: "9:00 ngày mai", value: tomorrowAtNine },
    { id: "custom", label: "Khác", value: () => remindAt },
  ];

  const handleQuickSelect = (option: (typeof quickOptions)[number]) => {
    setSelectedQuickOption(option.id);
    if (option.id !== "custom") {
      setRemindAt(option.value());
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        content: content.trim(),
        remindAt: new Date(remindAt).toISOString(),
        repeat,
      });
      onClose();
    } catch (error) {
      console.error("[CreateReminderModal] Submit error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-reminder-title"
    >
      <div className="w-full max-w-[462px] overflow-hidden rounded bg-white shadow-2xl">
        <div className="flex h-12 items-center justify-between border-b border-gray-200 px-4">
          <h2
            id="create-reminder-title"
            className="text-[16px] font-semibold text-slate-800"
          >
            Tạo nhắc hẹn
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

        <div className="space-y-4 px-4 py-4">
          <div>
            <label
              htmlFor="reminder-content"
              className="mb-1.5 block text-[14px] font-medium text-slate-700"
            >
              Nhập nội dung
            </label>
            <textarea
              id="reminder-content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Nhập nội dung mới hoặc dán link"
              className="h-[142px] w-full resize-none rounded border border-blue-500 px-2.5 py-3 text-[15px] text-slate-800 outline-none placeholder:text-slate-500 focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
          </div>

          <div>
            <div className="mb-2 text-[14px] font-medium text-slate-700">
              Chọn thời gian
            </div>
            <div className="flex flex-wrap gap-2">
              {quickOptions.map((option) => {
                const active = selectedQuickOption === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleQuickSelect(option)}
                    className={`h-8 rounded-full px-3 text-[14px] font-medium transition-colors ${
                      active
                        ? "bg-blue-100 text-blue-600"
                        : "bg-gray-200 text-slate-700 hover:bg-gray-300"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label
              htmlFor="reminder-time"
              className="mb-1.5 block text-[14px] font-medium text-slate-700"
            >
              Chọn ngày nhắc hẹn
            </label>
            <div className="relative">
              <input
                id="reminder-time"
                type="datetime-local"
                value={remindAt}
                min={minDateTime}
                onChange={(event) => {
                  setRemindAt(event.target.value);
                  setSelectedQuickOption("custom");
                }}
                className="h-10 w-full rounded border border-gray-300 px-3 pr-10 text-[14px] text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                aria-label={formatReminderTime(remindAt)}
              />
              <CalendarDays className="pointer-events-none absolute right-3 top-2.5 h-5 w-5 text-slate-500" />
            </div>
            <div className="mt-1 text-[12px] text-slate-500">
              {formatReminderTime(remindAt)}
            </div>
          </div>

          <div>
            <label
              htmlFor="reminder-repeat"
              className="mb-1.5 block text-[14px] font-medium text-slate-700"
            >
              Chọn kiểu lặp lại (vd: Lặp lại hằng tuần)
            </label>
            <div className="relative">
              <select
                id="reminder-repeat"
                value={repeat}
                onChange={(event) => setRepeat(event.target.value as ReminderRepeat)}
                className="h-10 w-full appearance-none rounded border border-gray-300 bg-white px-3 pr-10 text-[14px] text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="none">{repeatLabels.none}</option>
                <option value="daily">{repeatLabels.daily}</option>
                <option value="weekly">{repeatLabels.weekly}</option>
                <option value="monthly">{repeatLabels.monthly}</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-600" />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-4 pb-4 pt-1">
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
            className="flex h-10 items-center gap-2 rounded bg-blue-400 px-4 text-[15px] font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Tạo nhắc hẹn
          </button>
        </div>
      </div>
    </div>
  );
}
