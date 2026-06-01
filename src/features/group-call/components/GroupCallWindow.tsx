"use client";

import { useEffect, useRef, useState } from "react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Phone,
  Loader2,
} from "lucide-react";
import { useGroupCallStore } from "../groupCallStore";
import { useGroupCallManager } from "../useGroupCallManager";
import { useGroupAgoraRtc } from "../useGroupAgoraRtc";
import type { RemoteParticipant } from "../groupCallTypes";

/**
 * Main group call window.
 *
 * Lifecycle coordination:
 *  1. When credentials appear in groupCallStore -> call rtc.join()
 *  2. When rtc joins successfully -> call manager.setActive()
 *  3. When phase becomes "ended" -> call rtc.leave()
 *
 * Group calls always use leave semantics on the red button. The backend
 * decides when the room should actually end, including when the last
 * participant leaves.
 */
export function GroupCallWindow() {
  const phase = useGroupCallStore((s) => s.phase);
  const callType = useGroupCallStore((s) => s.callType);
  const credentials = useGroupCallStore((s) => s.credentials);
  const remoteParticipants = useGroupCallStore((s) => s.remoteParticipants);
  const lastError = useGroupCallStore((s) => s.lastError);
  const popupOpened = useGroupCallStore((s: any) => s.popupOpened);

  const manager = useGroupCallManager();
  const rtc = useGroupAgoraRtc();

  const localVideoRef = useRef<HTMLDivElement>(null);
  const hasJoinedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationRef = useRef(0);
  const [duration, setDuration] = useState(0);

  const isVideo = callType === "video";

  useEffect(() => {
    if (!credentials) return;
    if (hasJoinedRef.current) return;
    if (phase !== "ringing" && phase !== "joining") return;

    hasJoinedRef.current = true;

    (async () => {
      try {
        await rtc.join(credentials, isVideo);
        manager.setActive();
      } catch (err) {
        console.error("[GroupCallWindow] Agora join failed:", err);
        hasJoinedRef.current = false;
      }
    })();
  }, [credentials, phase, isVideo, manager, rtc]);

  useEffect(() => {
    if (phase === "ended" && hasJoinedRef.current) {
      hasJoinedRef.current = false;
      rtc.leave();
    }
  }, [phase, rtc]);

  useEffect(() => {
    if (phase === "active") {
      durationRef.current = 0;
      setDuration(0);
      timerRef.current = setInterval(() => {
        durationRef.current += 1;
        setDuration(durationRef.current);
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [phase]);

  useEffect(() => {
    const el = localVideoRef.current;
    if (!el) return;

    if (rtc.isJoined && isVideo && rtc.isCameraEnabled) {
      rtc.playLocalVideo(el);
      return () => {
        rtc.stopLocalVideo();
      };
    }
  }, [rtc.isJoined, rtc.isCameraEnabled, isVideo, rtc]);

  useEffect(() => {
    if (phase === "ended") {
      const t = setTimeout(() => manager.dismissEnded(), 3000);
      return () => clearTimeout(t);
    }
  }, [phase, manager]);

  if (phase === "idle") return null;
  if (popupOpened) return null;
  if (phase === "ringing" && !credentials) return null;

  if (phase === "ended") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
        <div className="bg-gray-800 rounded-xl shadow-2xl px-6 py-4 flex flex-col items-center gap-3">
          <p className="text-white text-sm">Cuoc goi nhom da ket thuc</p>
          {lastError && (
            <p className="text-red-400 text-xs">{lastError.message}</p>
          )}
        </div>
      </div>
    );
  }

  const statusText =
    phase === "ringing"
      ? "Dang cho tham gia..."
      : phase === "joining"
        ? "Dang ket noi..."
        : formatDuration(duration);

  const participants = Array.from(remoteParticipants.values());

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-900">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800">
        <div className="flex items-center gap-2">
          <Phone className="w-4 h-4 text-green-400" />
          <span className="text-white text-sm font-medium">Cuoc goi nhom</span>
          <span className="text-gray-400 text-xs">
            {participants.length + 1} nguoi
          </span>
        </div>
        <div className="flex items-center gap-2 text-gray-400 text-xs">
          {phase !== "active" && <Loader2 className="w-3 h-3 animate-spin" />}
          <span>{statusText}</span>
        </div>
      </div>

      {rtc.localMediaWarning && (
        <div className="bg-yellow-600/90 text-white text-xs text-center px-3 py-2">
          <div>{rtc.localMediaWarning}</div>
          <div className="mt-1 text-[11px] text-yellow-100">
            Goi y: mo quyen micro/camera tren trinh duyet hoac dong ung dung
            khac dang su dung thiet bi.
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto p-2">
        <div
          className="grid gap-2 h-full"
          style={{
            gridTemplateColumns: `repeat(${Math.max(
              1,
              Math.ceil(Math.sqrt(participants.length + 1)),
            )}, 1fr)`,
            gridTemplateRows: `repeat(${Math.max(
              1,
              Math.ceil(Math.sqrt(participants.length + 1)),
            )}, 1fr)`,
          }}
        >
          <div className="relative bg-gray-800 rounded-lg overflow-hidden min-h-[120px]">
            {isVideo && rtc.isCameraEnabled ? (
              <div ref={localVideoRef} className="w-full h-full scale-x-[-1]" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center text-white text-xl font-bold">
                  Ban
                </div>
              </div>
            )}
            <div className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-2 py-0.5 rounded">
              Ban{rtc.isMicMuted ? " (muted)" : ""}
            </div>
          </div>

          {participants.map((p) => (
            <RemoteVideoTile key={p.uid} participant={p} />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-center gap-4 py-4 bg-gray-800">
        <button
          type="button"
          onClick={() => rtc.toggleMic()}
          disabled={phase !== "active"}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 ${
            rtc.isMicMuted
              ? "bg-red-500/80 text-white"
              : "bg-white/20 text-white hover:bg-white/30"
          }`}
          title={rtc.isMicMuted ? "Bat mic" : "Tat mic"}
        >
          {rtc.isMicMuted ? (
            <MicOff className="w-5 h-5" />
          ) : (
            <Mic className="w-5 h-5" />
          )}
        </button>

        {isVideo && (
          <button
            type="button"
            onClick={() => rtc.toggleCamera()}
            disabled={phase !== "active"}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 ${
              !rtc.isCameraEnabled
                ? "bg-red-500/80 text-white"
                : "bg-white/20 text-white hover:bg-white/30"
            }`}
            title={rtc.isCameraEnabled ? "Tat camera" : "Bat camera"}
          >
            {rtc.isCameraEnabled ? (
              <Video className="w-5 h-5" />
            ) : (
              <VideoOff className="w-5 h-5" />
            )}
          </button>
        )}

        <button
          type="button"
          onClick={() => manager.leaveGroupCall()}
          className="w-14 h-12 rounded-full flex items-center justify-center bg-red-500 text-white hover:bg-red-600 transition-colors cursor-pointer"
          title="Roi cuoc goi"
        >
          <PhoneOff className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

function RemoteVideoTile({ participant }: { participant: RemoteParticipant }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (participant.videoTrack && participant.hasVideo) {
      try {
        participant.videoTrack.play(el);
      } catch {}
    }

    return () => {
      try {
        participant.videoTrack?.stop();
      } catch {}
    };
  }, [participant.videoTrack, participant.hasVideo]);

  const displayName =
    participant.displayName ||
    (participant.userId
      ? `User ${participant.userId}`
      : `Nguoi dung ${String(participant.uid).slice(-4)}`);

  return (
    <div className="relative bg-gray-800 rounded-lg overflow-hidden min-h-[120px]">
      {participant.hasVideo && participant.videoTrack ? (
        <div ref={containerRef} className="w-full h-full" />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-purple-500 flex items-center justify-center text-white text-xl font-bold">
            {displayName.charAt(0).toUpperCase()}
          </div>
        </div>
      )}
      <div className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-2 py-0.5 rounded">
        {displayName}
        {!participant.hasAudio && " (muted)"}
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
