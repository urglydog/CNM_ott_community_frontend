"use client";

import { useEffect, useRef, useState } from "react";
import {
  Loader2,
  WifiOff,
  Minimize2,
  Maximize2,
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  ExternalLink,
} from "lucide-react";
import { useCallManager } from "../hooks/useCallManager";
import { useAgoraRtc } from "../rtc/useAgoraRtc";
import { useCallStore } from "../callStore";
import { VideoSurface } from "./VideoSurface";
import { CallControls } from "./CallControls";

/**
 * Floating call window for direct 1-1 calls.
 *
 * Renders as a positioned floating panel at the bottom-right corner,
 * allowing the user to continue using the chat page during an active call.
 *
 * Supports minimize (compact bar) and maximize (full floating window).
 * The Agora RTC lifecycle is NOT affected by minimize — it is driven by
 * the global callStore phase machine via useCallRtcLifecycle.
 *
 * Only renders during "connecting", "active", "reconnecting", and "ended" phases.
 * Incoming/outgoing modals are handled by IncomingCallModal / OutgoingCallModal.
 */
export function DirectCallScreen() {
  const {
    phase,
    callSession,
    isInitiator,
    endCall,
    dismissEnded,
  } = useCallManager();

  const rtc = useAgoraRtc();
  const localMediaWarning = rtc.localMediaWarning;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationRef = useRef(0);
  const [duration, setDuration] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);

  // Call window (popup) state — from callStore
  const callWindowOpening = useCallStore((s) => s.callWindowOpening);
  const callWindowJoined = useCallStore((s) => s.callWindowJoined);
  const callWindowClosed = useCallStore((s) => (s as any).callWindowClosed);

  // Start/stop call duration timer when phase becomes "active"
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

  // Auto-dismiss ended state after 2 seconds
  useEffect(() => {
    if (phase === "ended") {
      const t = setTimeout(dismissEnded, 2000);
      return () => clearTimeout(t);
    }
  }, [phase, dismissEnded]);

  // Only render for call-related phases
  if (
    phase !== "connecting" &&
    phase !== "active" &&
    phase !== "reconnecting" &&
    phase !== "ended"
  ) {
    return null;
  }

  if (!callSession) return null;

  // ── Call window (popup) is handling the call — show minimal indicator ──
  if (callWindowOpening || callWindowJoined || callWindowClosed) {
    const remoteName =
      (callSession as any).remoteName ||
      (isInitiator
        ? (callSession as any).recipientName || "Đối phương"
        : (callSession as any).initiatorName || "Đối phương");

    if (callWindowClosed) {
      return null;
    }

    return (
      <div className="fixed bottom-4 right-4 z-50 animate-slideUp">
        <div className="bg-gray-900 rounded-2xl shadow-2xl border border-white/10 overflow-hidden min-w-[280px]">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="relative">
              <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
                {remoteName.charAt(0).toUpperCase()}
              </div>
              {callWindowOpening && (
                <div className="absolute inset-0 rounded-full bg-blue-400 animate-ping opacity-20" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">
                {remoteName}
              </p>
              <p className="text-gray-400 text-xs flex items-center gap-1">
                {callWindowOpening ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Đang mở cửa sổ gọi...
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-3 h-3" />
                    Đang gọi trong cửa sổ riêng
                  </>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={endCall}
              className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600 transition-colors cursor-pointer"
              title="Kết thúc"
            >
              <PhoneOff className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isVideo = callSession.callType === "video";
  const isDisabled = phase === "reconnecting";

  // Remote display name
  const remoteName =
    (callSession as any).remoteName ||
    (isInitiator
      ? (callSession as any).recipientName || "Đối phương"
      : (callSession as any).initiatorName || "Đối phương");

  // Get the remote Agora UID for video binding — ONLY use video-published UIDs.
  // Do NOT fall back to remoteUids (presence) because the video track may not
  // exist yet when user-joined fires. Using presence UIDs here would cause
  // VideoSurface to fire playRemoteVideo before the track exists, and when
  // remoteVideoUids later provides the same UID, the useEffect won't re-fire.
  const remoteVideoUid = rtc.remoteVideoUids.length > 0 ? rtc.remoteVideoUids[0] : null;
  // Presence: is the remote user in the channel (for avatar display)
  const remotePresenceUid = rtc.remoteUids.length > 0 ? rtc.remoteUids[0] : null;

  // Determine if local video should be shown
  const localVideoEnabled = isVideo && rtc.isCameraEnabled;

  // ── Ended state: brief summary toast-like overlay ──────────────────
  if (phase === "ended") {
    const endedReason = callSession.endedReason;
    let endedText = "Cuộc gọi đã kết thúc";
    if (endedReason === "caller_cancelled") endedText = "Cuộc gọi đã bị huỷ";
    else if (endedReason === "callee_rejected") endedText = "Cuộc gọi bị từ chối";
    else if (endedReason === "no_answer_timeout") endedText = "Không có phản hồi";
    else if (endedReason === "participant_disconnected_timeout")
      endedText = "Mất kết nối";

    return (
      <div className="fixed bottom-4 right-4 z-50 animate-slideUp">
        <div className="bg-gray-900 rounded-xl shadow-2xl px-5 py-3 flex items-center gap-3 min-w-[260px]">
          <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-white text-sm font-bold shrink-0">
            {remoteName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{remoteName}</p>
            <p className="text-gray-400 text-xs">{endedText}</p>
            {callSession.durationSeconds != null && callSession.durationSeconds > 0 && (
              <p className="text-gray-500 text-xs">
                {formatDuration(callSession.durationSeconds)}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Minimized: compact bar ─────────────────────────────────────────
  if (isMinimized) {
    const statusLabel =
      phase === "connecting"
        ? "Đang kết nối..."
        : phase === "reconnecting"
          ? "Đang kết nối lại..."
          : formatDuration(duration);

    return (
      <div className="fixed bottom-4 right-4 z-50 animate-slideUp">
        <div className="bg-gray-900 rounded-2xl shadow-2xl border border-white/10 overflow-hidden min-w-[300px]">
          {/* Warning banner (if any) */}
          {localMediaWarning && (
            <div className="bg-yellow-600/90 text-white text-xs text-center px-3 py-1">
              {localMediaWarning}
            </div>
          )}

          <div className="flex items-center gap-3 px-4 py-3">
            {/* Avatar */}
            <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
              {remoteName.charAt(0).toUpperCase()}
            </div>

            {/* Name + status */}
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">
                {remoteName}
              </p>
              <p className="text-gray-400 text-xs flex items-center gap-1">
                {phase === "reconnecting" && (
                  <WifiOff className="w-3 h-3" />
                )}
                {phase === "connecting" && (
                  <Loader2 className="w-3 h-3 animate-spin" />
                )}
                {statusLabel}
              </p>
            </div>

            {/* Compact controls */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => rtc.toggleMic()}
                disabled={isDisabled}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                title={rtc.isMicMuted ? "Bật mic" : "Tắt mic"}
                style={{
                  backgroundColor: rtc.isMicMuted
                    ? "rgba(239,68,68,0.8)"
                    : "rgba(255,255,255,0.15)",
                }}
              >
                {rtc.isMicMuted ? (
                  <MicOff className="w-4 h-4 text-white" />
                ) : (
                  <Mic className="w-4 h-4 text-white" />
                )}
              </button>

              {isVideo && (
                <button
                  type="button"
                  onClick={() => rtc.toggleCamera()}
                  disabled={isDisabled}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  title={rtc.isCameraEnabled ? "Tắt camera" : "Bật camera"}
                  style={{
                    backgroundColor: !rtc.isCameraEnabled
                      ? "rgba(239,68,68,0.8)"
                      : "rgba(255,255,255,0.15)",
                  }}
                >
                  {rtc.isCameraEnabled ? (
                    <Video className="w-4 h-4 text-white" />
                  ) : (
                    <VideoOff className="w-4 h-4 text-white" />
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={endCall}
                className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600 transition-colors cursor-pointer"
                title="Kết thúc"
              >
                <PhoneOff className="w-4 h-4 text-white" />
              </button>

              <button
                type="button"
                onClick={() => setIsMinimized(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer"
                title="Phóng to"
              >
                <Maximize2 className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Maximized: full floating window ────────────────────────────────
  const statusText =
    phase === "connecting"
      ? "Đang kết nối..."
      : phase === "reconnecting"
        ? "Đang kết nối lại..."
        : formatDuration(duration);

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-slideUp">
      <div className="bg-gray-900 rounded-2xl shadow-2xl border border-white/10 overflow-hidden w-[360px] flex flex-col">
        {/* ── Warning banner ──────────────────────────────────────────── */}
        {localMediaWarning && (
          <div className="bg-yellow-600/90 text-white text-xs text-center px-3 py-1.5">
            {localMediaWarning}
          </div>
        )}

        {/* ── Title bar ───────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-800/80">
          <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
            {remoteName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">
              {remoteName}
            </p>
            <p className="text-gray-400 text-xs flex items-center gap-1">
              {phase === "reconnecting" && (
                <WifiOff className="w-3 h-3" />
              )}
              {phase === "connecting" && (
                <Loader2 className="w-3 h-3 animate-spin" />
              )}
              {statusText}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsMinimized(true)}
            className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer"
            title="Thu nhỏ"
          >
            <Minimize2 className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* ── Video / Audio content ───────────────────────────────────── */}
        {isVideo ? (
          <div className="relative w-full aspect-video bg-black">
            {/* Remote video (fills the panel) */}
            {remoteVideoUid != null ? (
              <VideoSurface
                uid={remoteVideoUid}
                videoEnabled={true}
                className="w-full h-full"
                displayName={remoteName}
              />
            ) : (
              /* No remote video yet — show avatar (remotePresenceUid tells us user is in channel) */
              <div className="w-full h-full flex flex-col items-center justify-center bg-gray-800">
                <div className="w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center text-white text-2xl font-bold">
                  {remoteName.charAt(0).toUpperCase()}
                </div>
                <p className="mt-2 text-gray-400 text-xs">
                  {remotePresenceUid != null ? "Đang chờ video..." : statusText}
                </p>
              </div>
            )}

            {/* Local video (small PiP overlay) */}
            <div className="absolute bottom-2 right-2 w-24 h-32 rounded-lg overflow-hidden border border-white/20 shadow-lg">
              <VideoSurface
                uid="local"
                videoEnabled={localVideoEnabled}
                className="w-full h-full"
                displayName="Bạn"
                mirror={true}
              />
            </div>

            {/* Reconnecting overlay for video */}
            {phase === "reconnecting" && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <div className="bg-black/70 rounded-lg px-4 py-2 flex items-center gap-2">
                  <WifiOff className="w-4 h-4 text-yellow-400" />
                  <span className="text-white text-xs">Đang kết nối lại...</span>
                </div>
              </div>
            )}

            {/* Connecting overlay for video */}
            {phase === "connecting" && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                  <span className="text-white text-xs">Đang kết nối...</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Audio-only content */
          <div className="w-full flex flex-col items-center justify-center bg-gray-800 py-6">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-blue-500 flex items-center justify-center text-white text-3xl font-bold shadow-lg">
                {remoteName.charAt(0).toUpperCase()}
              </div>
              {phase === "connecting" && (
                <div className="absolute inset-0 rounded-full bg-blue-400 animate-ping opacity-20" />
              )}
            </div>
            <p className="mt-3 text-gray-400 text-xs flex items-center gap-1.5">
              {phase === "reconnecting" ? (
                <>
                  <WifiOff className="w-3.5 h-3.5" />
                  Đang kết nối lại...
                </>
              ) : phase === "connecting" ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Đang kết nối...
                </>
              ) : (
                statusText
              )}
            </p>
          </div>
        )}

        {/* ── Controls bar ────────────────────────────────────────────── */}
        <div className="bg-gray-800/80">
          <CallControls
            isMicMuted={rtc.isMicMuted}
            isCameraEnabled={rtc.isCameraEnabled}
            isSpeakerOn={rtc.isSpeakerOn}
            callType={callSession.callType}
            onToggleMic={rtc.toggleMic}
            onToggleCamera={rtc.toggleCamera}
            onSwitchCamera={rtc.switchCamera}
            onToggleSpeaker={rtc.toggleSpeaker}
            onEndCall={endCall}
            disabled={isDisabled}
            isMobile={rtc.isMobile}
          />
        </div>
      </div>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
