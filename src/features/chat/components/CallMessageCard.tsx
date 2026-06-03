"use client";

import React from "react";
import { Video, VideoOff, Phone, PhoneOff, PhoneMissed } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────

export type CallVariant = "direct" | "group";
export type CallStatus = "active" | "ended" | "missed" | "cancelled" | "rejected";

export interface CallMessageCardProps {
  /** "direct" for 1:1 calls, "group" for group calls */
  variant: CallVariant;
  /** Call type: video or audio */
  callType?: "video" | "audio";
  /** Call status determines color + text */
  status: CallStatus;
  /** Duration in seconds (for ended calls) */
  durationSeconds?: number;
  /** Number of participants (group calls only) */
  participantCount?: number;
  /** endedReason from backend */
  endedReason?: string | null;
  /** Whether the current user is the sender/caller */
  isOwn?: boolean;
  /** Callback when "Tham gia" button is clicked (active group calls only) */
  onJoin?: () => void;
  /** Callback for Call Back button */
  onCall?: (callType: 'video' | 'audio') => void;
  /** Whether the join button is disabled */
  joinDisabled?: boolean;
  /** Label for the join button */
  joinLabel?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function resolveStatusText(
  variant: CallVariant,
  callType: "video" | "audio",
  status: CallStatus,
  durationSeconds: number,
  endedReason?: string | null,
): { text: string; isNegative: boolean } {
  const typeLabel =
    variant === "group"
      ? "Cuộc gọi nhóm"
      : callType === "video"
        ? "Cuộc gọi video"
        : "Cuộc gọi thoại";

  if (status === "active") {
    return { text: typeLabel, isNegative: false };
  }

  if (status === "ended") {
    if (durationSeconds > 0) {
      return { text: `${typeLabel} · ${formatDuration(durationSeconds)}`, isNegative: false };
    }
    return { text: `${typeLabel} · đã kết thúc`, isNegative: false };
  }

  if (status === "rejected") {
    return { text: `${typeLabel} · đã từ chối`, isNegative: true };
  }

  if (status === "cancelled") {
    return { text: `${typeLabel} · đã hủy`, isNegative: true };
  }

  // missed
  return { text: `${typeLabel} · không bắt máy`, isNegative: true };
}

// ── Component ─────────────────────────────────────────────────────────────

export const CallMessageCard: React.FC<CallMessageCardProps> = ({
  variant,
  callType = "video",
  status,
  durationSeconds = 0,
  participantCount,
  endedReason,
  isOwn = false,
  onJoin,
  onCall,
  joinDisabled = false,
  joinLabel = "Tham gia",
}) => {
  const isVideo = callType === "video";
  const isActive = status === "active";
  const { text: statusText, isNegative } = resolveStatusText(
    variant,
    callType,
    status,
    durationSeconds,
    endedReason,
  );

  // ── Icon ──────────────────────────────────────────────────────────────
  let icon: React.ReactNode;
  let iconBg: string;
  let iconColor: string;

  if (isActive) {
    icon = isVideo ? <Video className="w-5 h-5" /> : <Phone className="w-5 h-5" />;
    iconBg = "bg-blue-100";
    iconColor = "text-blue-600";
  } else if (isNegative) {
    icon = isVideo ? (
      <Video className="w-5 h-5" />
    ) : (
      <Phone className="w-5 h-5" />
    );
    iconBg = "bg-red-50";
    iconColor = "text-red-500";
  } else {
    // ended normally
    icon = variant === "group" ? (
      <PhoneOff className="w-5 h-5" />
    ) : isVideo ? (
      <Video className="w-5 h-5" />
    ) : (
      <Phone className="w-5 h-5" />
    );
    iconBg = isOwn ? "bg-blue-100/50" : "bg-gray-100";
    iconColor = isOwn ? "text-blue-600" : "text-gray-600";
  }

  // ── Card style ────────────────────────────────────────────────────────
  const cardBorder = isActive
    ? "border-blue-200"
    : isNegative
      ? "border-red-100"
      : "border-gray-200";

  const cardBg = isActive ? "bg-blue-50/60" : "bg-white";

  // ── Title color ───────────────────────────────────────────────────────
  const titleColor = isActive
    ? "text-blue-800"
    : isNegative
      ? "text-red-500"
      : "text-gray-800";

  const subtitleColor = isActive ? "text-blue-600" : "text-gray-500";

  // ── Subtitle ──────────────────────────────────────────────────────────
  let subtitle: string | null = null;
  if (isActive) {
    subtitle = "Đang diễn ra";
  } else if (variant === "group" && participantCount && participantCount > 0) {
    subtitle = `${participantCount} người tham gia`;
  }

  return (
    <div
      className={`mx-1 my-1 w-72 rounded-xl border ${cardBorder} ${cardBg} p-3 shadow-sm`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex items-center justify-center w-10 h-10 rounded-full shrink-0 ${iconBg} ${iconColor}`}
        >
          {icon}
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <span className={`font-semibold text-[14px] ${titleColor}`}>
            {statusText}
          </span>
          {subtitle && (
            <span className={`text-xs ${subtitleColor} mt-0.5 flex items-center gap-1`}>
              {isActive && (
                <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              )}
              {subtitle}
            </span>
          )}
        </div>
      </div>
      {isActive && onJoin && (
        <button
          type="button"
          disabled={joinDisabled}
          onClick={(e) => {
            e.stopPropagation();
            onJoin();
          }}
          className="mt-3 w-full px-3 py-2 bg-blue-500 text-white text-sm font-medium rounded-full hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {joinLabel}
        </button>
      )}
      {!isActive && onCall && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onCall(callType);
          }}
          className="mt-3 w-full px-3 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-full hover:bg-gray-200 transition-colors cursor-pointer"
        >
          Gọi lại
        </button>
      )}
    </div>
  );
};

export default CallMessageCard;
