"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { IncomingCallState } from "@/features/call/store/callStore";

interface IncomingCallModalProps {
  callData: IncomingCallState;
  onAccept: (callData: IncomingCallState) => void;
  onDecline: () => void;
  autoDeclineAfterSec?: number;
}

export default function IncomingCallModal({
  callData,
  onAccept,
  onDecline,
  autoDeclineAfterSec = 30,
}: IncomingCallModalProps) {
  const callLabel = callData.callType === "audio" ? "Goi thoai" : "Goi video";
  const isGroupCall = Boolean(callData.isGroupCall);

  const [remainingMs, setRemainingMs] = useState(autoDeclineAfterSec * 1000);
  const timeoutHandledRef = useRef(false);
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);

  const stopRingtone = useCallback(() => {
    if (!ringtoneRef.current) return;
    ringtoneRef.current.pause();
    ringtoneRef.current.currentTime = 0;
    ringtoneRef.current = null;
  }, []);

  const handleDecline = useCallback(() => {
    stopRingtone();
    onDecline();
  }, [onDecline, stopRingtone]);

  const handleAccept = useCallback(() => {
    stopRingtone();
    onAccept(callData);
  }, [callData, onAccept, stopRingtone]);

  useEffect(() => {
    timeoutHandledRef.current = false;
    setRemainingMs(autoDeclineAfterSec * 1000);

    const startedAt = Date.now();
    const tick = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const next = Math.max(autoDeclineAfterSec * 1000 - elapsed, 0);
      setRemainingMs(next);

      if (next <= 0 && !timeoutHandledRef.current) {
        timeoutHandledRef.current = true;
        handleDecline();
      }
    }, 100);

    return () => clearInterval(tick);
  }, [autoDeclineAfterSec, handleDecline]);

  useEffect(() => {
    const audio = new Audio("/sounds/ringtone.mp3");
    audio.loop = true;
    audio.volume = 0.85;
    ringtoneRef.current = audio;
    audio.play().catch(() => {
      // Browser can block autoplay when user has not interacted yet.
    });

    return () => stopRingtone();
  }, [stopRingtone]);

  const timeLeftText = useMemo(() => {
    const totalSeconds = Math.ceil(remainingMs / 1000);
    const mm = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
    const ss = String(totalSeconds % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }, [remainingMs]);

  const progress = useMemo(() => {
    const total = autoDeclineAfterSec * 1000;
    return total > 0 ? 1 - remainingMs / total : 1;
  }, [autoDeclineAfterSec, remainingMs]);

  const circleRadius = 34;
  const circumference = 2 * Math.PI * circleRadius;
  const strokeOffset = circumference * (1 - progress);

  return (
    <div className="fixed inset-0 z-10000 flex items-center justify-center bg-black/65 px-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-black/5">
        <div className="mb-5 flex items-center gap-4">
          <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <span className="absolute inset-0 animate-ping rounded-full bg-emerald-200/70" />
            <span className="relative text-xl font-bold">{(callData.callerName || "U").charAt(0).toUpperCase()}</span>
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-slate-900">{callData.callerName || "Nguoi dung"}</p>
            <p className="text-sm text-slate-500">{isGroupCall ? "Cuoc goi nhom" : callLabel}</p>
          </div>
        </div>

        <div className="mb-5 flex items-center justify-center">
          <div className="relative h-24 w-24">
            <svg className="h-24 w-24 -rotate-90" viewBox="0 0 80 80" aria-hidden>
              <circle cx="40" cy="40" r={circleRadius} className="fill-none stroke-slate-200" strokeWidth="7" />
              <circle
                cx="40"
                cy="40"
                r={circleRadius}
                className="fill-none stroke-emerald-500 transition-[stroke-dashoffset] duration-100"
                strokeWidth="7"
                strokeDasharray={circumference}
                strokeDashoffset={strokeOffset}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-base font-semibold text-slate-900">{timeLeftText}</span>
              <span className="text-[11px] text-slate-500">Tu dong huy</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleDecline}
            className="flex-1 rounded-2xl bg-rose-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-600"
          >
            Tu choi
          </button>
          <button
            onClick={handleAccept}
            className="flex-1 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600"
          >
            Nghe may
          </button>
        </div>
      </div>
    </div>
  );
}
