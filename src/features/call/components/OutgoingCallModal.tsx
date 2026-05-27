"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface OutgoingCallModalProps {
  receiverName: string;
  callType?: "video" | "audio";
  isGroupCall?: boolean;
  onCancel: () => void;
  autoCancelAfterSec?: number;
}

export default function OutgoingCallModal({
  receiverName,
  callType = "video",
  isGroupCall = false,
  onCancel,
  autoCancelAfterSec = 35,
}: OutgoingCallModalProps) {
  const [remainingMs, setRemainingMs] = useState(autoCancelAfterSec * 1000);
  const timeoutHandledRef = useRef(false);
  const waitingAudioRef = useRef<HTMLAudioElement | null>(null);

  const stopWaitingAudio = useCallback(() => {
    if (!waitingAudioRef.current) return;
    waitingAudioRef.current.pause();
    waitingAudioRef.current.currentTime = 0;
    waitingAudioRef.current = null;
  }, []);

  const handleCancel = useCallback(() => {
    stopWaitingAudio();
    onCancel();
  }, [onCancel, stopWaitingAudio]);

  useEffect(() => {
    timeoutHandledRef.current = false;
    setRemainingMs(autoCancelAfterSec * 1000);

    const startedAt = Date.now();
    const tick = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const next = Math.max(autoCancelAfterSec * 1000 - elapsed, 0);
      setRemainingMs(next);

      if (next <= 0 && !timeoutHandledRef.current) {
        timeoutHandledRef.current = true;
        handleCancel();
      }
    }, 100);

    return () => clearInterval(tick);
  }, [autoCancelAfterSec, handleCancel]);

  useEffect(() => {
    const audio = new Audio("/sounds/waiting.mp3");
    audio.loop = true;
    audio.volume = 0.65;
    waitingAudioRef.current = audio;
    audio.play().catch(() => {
      // Browser có thể chặn autoplay nếu chưa có tương tác người dùng.
    });

    return () => stopWaitingAudio();
  }, [stopWaitingAudio]);

  const title = isGroupCall ? "Dang goi nhom" : "Dang goi";
  const subtitle = isGroupCall
    ? `Moi thanh vien vao phong` 
    : callType === "audio"
      ? "Dang cho doi phuong nhac may (thoai)"
      : "Dang cho doi phuong nhac may (video)";

  const timeLeftText = useMemo(() => {
    const totalSeconds = Math.ceil(remainingMs / 1000);
    const mm = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
    const ss = String(totalSeconds % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }, [remainingMs]);

  const progress = useMemo(() => {
    const total = autoCancelAfterSec * 1000;
    return total > 0 ? 1 - remainingMs / total : 1;
  }, [autoCancelAfterSec, remainingMs]);

  const circleRadius = 44;
  const circumference = 2 * Math.PI * circleRadius;
  const strokeOffset = circumference * (1 - progress);

  return (
    <div className="fixed inset-0 z-10000 flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl bg-linear-to-br from-slate-900 via-slate-800 to-emerald-900 p-7 text-white shadow-2xl ring-1 ring-white/10">
        <p className="text-xs uppercase tracking-[0.25em] text-emerald-300">{title}</p>
        <p className="mt-2 truncate text-2xl font-semibold">{receiverName || "Nguoi dung"}</p>
        <p className="mt-1 text-sm text-slate-200/85">{subtitle}</p>

        <div className="my-7 flex items-center justify-center">
          <div className="relative h-32 w-32">
            <svg className="h-32 w-32 -rotate-90" viewBox="0 0 100 100" aria-hidden>
              <circle cx="50" cy="50" r={circleRadius} className="fill-none stroke-white/15" strokeWidth="8" />
              <circle
                cx="50"
                cy="50"
                r={circleRadius}
                className="fill-none stroke-emerald-300 transition-[stroke-dashoffset] duration-100"
                strokeWidth="8"
                strokeDasharray={circumference}
                strokeDashoffset={strokeOffset}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold tabular-nums">{timeLeftText}</span>
              <span className="text-xs text-slate-200/80">Tu dong huy</span>
            </div>
          </div>
        </div>

        <button
          onClick={handleCancel}
          className="w-full rounded-2xl bg-rose-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-600"
        >
          Huy cuoc goi
        </button>
      </div>
    </div>
  );
}
