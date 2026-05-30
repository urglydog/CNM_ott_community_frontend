"use client";

import { AlarmClock, Clock3, RotateCcw, Settings2, X } from "lucide-react";
import { useState } from "react";
import type { GroupChatMessage } from "../hooks/useGroupChat";

interface ParsedReminder {
  content: string;
  fullTime: string;
  shortTime: string;
  topTime: string;
  repeat: string;
  date: Date | null;
}

function parseVietnameseDateTime(value: string): Date | null {
  const match = value.match(
    /(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s+(\d{1,2}):(\d{2})/,
  );
  if (!match) return null;

  const [, day, month, year, hour, minute] = match;
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  );

  return Number.isNaN(date.getTime()) ? null : date;
}

function getRelativeTimeLabel(date: Date | null, fallback: string) {
  if (!date) return fallback;

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

function getTopTimeLabel(date: Date | null, fallback: string) {
  if (!date) return fallback;

  return date
    .toLocaleString("vi-VN", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
    .replace(",", "")
    .replace("tháng", "Tháng");
}

export function isReminderMessage(
  msg: Pick<GroupChatMessage, "content" | "contentType">,
) {
  return (
    msg.contentType === "reminder" ||
    String(msg.content || "").startsWith("[Nhắc hẹn]\n")
  );
}

export function parseReminderMessage(content: string): ParsedReminder {
  const lines = content.split("\n").map((line) => line.trim());
  const reminderContent =
    lines.find(
      (line) =>
        !line.startsWith("[") &&
        !line.startsWith("Thời gian:") &&
        !line.startsWith("Lặp lại:"),
    ) || "Nhắc hẹn";
  const timeLine = lines.find((line) => line.startsWith("Thời gian:"));
  const repeatLine = lines.find((line) => line.startsWith("Lặp lại:"));
  const rawTime = timeLine?.replace("Thời gian:", "").trim() || "";
  const date = parseVietnameseDateTime(rawTime);

  return {
    content: reminderContent,
    fullTime: rawTime,
    shortTime: getRelativeTimeLabel(date, rawTime),
    topTime: getTopTimeLabel(date, rawTime),
    repeat: repeatLine?.replace("Lặp lại:", "").trim() || "Nhắc 1 lần",
    date,
  };
}

function ReminderDateCard({ date }: { date: Date | null }) {
  const safeDate = date ?? new Date();
  const weekday = safeDate
    .toLocaleDateString("vi-VN", { weekday: "long" })
    .toUpperCase();

  return (
    <div className="h-[108px] w-[86px] overflow-hidden rounded-[4px] bg-white shadow-lg ring-1 ring-slate-200">
      <div className="flex h-8 items-center justify-center bg-blue-600 px-2 text-[10px] font-bold uppercase text-white">
        {weekday}
      </div>
      <div className="flex h-[76px] flex-col items-center justify-center">
        <div className="text-[38px] font-bold leading-none text-slate-950">
          {safeDate.getDate()}
        </div>
        <div className="mt-3 text-[11px] font-bold uppercase text-slate-700">
          THÁNG {safeDate.getMonth() + 1}
        </div>
      </div>
    </div>
  );
}

function ReminderDetailDialog({
  creator,
  reminder,
  onClose,
}: {
  creator: string;
  reminder: ParsedReminder;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/35 px-4">
      <div className="w-full max-w-[442px] overflow-hidden rounded-[4px] bg-white shadow-2xl">
        <div className="flex h-[50px] items-center justify-between border-b border-slate-200 px-4">
          <h2 className="text-[17px] font-semibold text-slate-800">
            Chi tiết nhắc hẹn
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100"
            aria-label="Đóng"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex gap-5 bg-[#E9EAEE] px-4 py-6">
          <ReminderDateCard date={reminder.date} />
          <div className="min-w-0 flex-1 pt-1">
            <div className="truncate text-[18px] font-semibold text-slate-950">
              {reminder.content}
            </div>
            <div className="mt-3 text-[12px] text-slate-500">
              Tạo bởi {creator} -{" "}
              {new Date().toLocaleTimeString("vi-VN", {
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              Hôm nay
            </div>
            <div className="mt-4 flex items-center gap-2 text-[14px] text-slate-700">
              <Clock3 className="h-4 w-4 text-slate-600" />
              <span>{reminder.shortTime || reminder.fullTime}</span>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[14px] text-slate-700">
              <RotateCcw className="h-4 w-4 text-slate-600" />
              <span>{reminder.repeat}</span>
            </div>
          </div>
        </div>

        <div className="flex h-[68px] items-center justify-between px-4">
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded bg-slate-100 text-slate-700 hover:bg-slate-200"
            aria-label="Tùy chỉnh nhắc hẹn"
          >
            <Settings2 className="h-5 w-5" />
          </button>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded bg-slate-200 px-6 text-[15px] font-semibold text-slate-700 hover:bg-slate-300"
            >
              Đóng
            </button>
            <button
              type="button"
              className="h-10 rounded bg-blue-50 px-6 text-[15px] font-semibold text-blue-700 hover:bg-blue-100"
            >
              Chỉnh sửa
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ReminderMessageBubble({
  msg,
  currentUserId,
}: {
  msg: GroupChatMessage;
  currentUserId: string | number;
}) {
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const reminder = parseReminderMessage(String(msg.content || ""));
  const isOwn = msg.isOwn || Number(msg.senderId) === Number(currentUserId);
  const creator = isOwn ? "Bạn" : msg.senderDisplayName || "Ai đó";

  return (
    <div className="my-2 flex flex-col items-center gap-6">
      <div className="flex max-w-[88%] items-center gap-2 rounded-full bg-white px-3 py-1 text-[13px] leading-5 text-slate-500 shadow-sm">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-500">
          <AlarmClock className="h-4 w-4" />
        </span>
        <span className="truncate">
          <span>{creator} tạo nhắc hẹn mới </span>
          <span className="font-semibold text-slate-600">
            {reminder.content}
          </span>
          {reminder.topTime && <span> - {reminder.topTime}</span>}
          <span> . </span>
          <button
            type="button"
            onClick={() => setIsDetailOpen(true)}
            className="font-semibold text-blue-600 hover:underline"
          >
            Xem
          </button>
        </span>
      </div>

      <div className="w-full max-w-[354px] rounded-md bg-white px-4 py-5 text-center shadow-sm">
        <div className="mb-3 flex justify-center text-red-500">
          <AlarmClock className="h-7 w-7" />
        </div>
        <div className="mb-1 text-[14px] font-semibold text-slate-800">
          {reminder.content}
        </div>
        <div className="mb-3 flex items-center justify-center gap-1 text-[14px] text-slate-700">
          <AlarmClock className="h-4 w-4 text-slate-600" />
          <span>{reminder.shortTime || reminder.fullTime}</span>
        </div>
        <button
          type="button"
          onClick={() => setIsDetailOpen(true)}
          className="h-8 w-full rounded border border-blue-600 text-[15px] font-semibold text-blue-600 transition-colors hover:bg-blue-50"
        >
          Xem chi tiết
        </button>
      </div>

      {isDetailOpen && (
        <ReminderDetailDialog
          creator={creator}
          reminder={reminder}
          onClose={() => setIsDetailOpen(false)}
        />
      )}
    </div>
  );
}
