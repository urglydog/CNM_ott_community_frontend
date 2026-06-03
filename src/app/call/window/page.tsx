"use client";

/**
 * Standalone call window page — opens via window.open() from the main chat page.
 *
 * This page owns the Agora RTC lifecycle. The main page does NOT join Agora
 * when this window is open.
 *
 * URL params (search params):
 *   appId, channelName, token, uid, callType, remoteName, callId, isInitiator
 *
 * Communication:
 *   - BroadcastChannel "ott-call-window" for status sync with main page
 *   - beforeunload → leaveChannel + notify main page
 */

import { useEffect, useRef, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Loader2,
  WifiOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Phone,
} from "lucide-react";
import * as rtc from "../../../features/call/rtc/agoraRtc";
import {
  sendMessage,
  onMessage,
  closeChannel,
  type CallWindowMessage,
} from "../../../features/call/callWindowChannel";

function CallWindowContent() {
  const searchParams = useSearchParams();
  const hasJoinedRef = useRef(false);
  const pendingJoinRef = useRef(false);
  const closeActionRef = useRef<"end-call" | "sync-only">("end-call");
  const [phase, setPhase] = useState<"ringing" | "connecting" | "active" | "ended">("connecting");
  const [duration, setDuration] = useState(0);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [connectionState, setConnectionState] = useState("DISCONNECTED");
  const [localMediaWarning, setLocalMediaWarning] = useState<string | null>(null);
  const [endedText, setEndedText] = useState("Cuộc gọi đã kết thúc");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationRef = useRef(0);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLDivElement>(null);

  // Parse URL params
  const appId = searchParams.get("appId") || "";
  const channelName = searchParams.get("channelName") || "";
  const token = searchParams.get("token") || "";
  const uid = parseInt(searchParams.get("uid") || "0", 10);
  const callType = (searchParams.get("callType") as "audio" | "video") || "audio";
  const remoteName = searchParams.get("remoteName") || "Đối phương";
  const callId = searchParams.get("callId") || "";
  const isInitiator = searchParams.get("isInitiator") === "true";
  const mode = (searchParams.get("mode") as "outgoing" | "accepted" | "incoming-ringing") || "accepted";
  const isVideo = callType === "video";
  const [remoteUid, setRemoteUid] = useState<number | null>(null);
  const [remoteVideoUid, setRemoteVideoUid] = useState<number | null>(null);

  // ── Join Agora helper ───────────────────────────────────────────────

  const joinAgoraChannel = useCallback(async (override?: { appId: string; channelName: string; token: string; uid: number }) => {
    const _appId = override?.appId || appId;
    const _channelName = override?.channelName || channelName;
    const _token = override?.token || token;
    const _uid = override?.uid ?? uid;
    if (!_appId || !_channelName || !_token) {
      console.error("[call-window] Missing required params");
      setPhase("ended");
      setEndedText("Thiếu thông tin cuộc gọi");
      return;
    }
    try {
      setPhase("connecting");
      console.log("[call-window] Initializing Agora...");
      await rtc.initialize();

      rtc.subscribe({
        onJoined: () => {
          console.log("[call-window] Joined channel");
          setPhase("active");
          setConnectionState("CONNECTED");
        },
        onLeft: () => {
          console.log("[call-window] Left channel");
          setPhase("ended");
        },
        onUserJoined: (uid: number) => {
          setRemoteUid(uid);
        },
        onUserLeft: (uid: number) => {
          setRemoteUid((prev: number | null) => (prev === uid ? null : prev));
          setRemoteVideoUid((prev: number | null) => (prev === uid ? null : prev));
        },
        onUserPublished: (uid: number, mediaType: "audio" | "video") => {
          if (mediaType === "video") {
            console.log("[call-window] Remote user published video:", uid);
            setRemoteVideoUid(uid);
          }
        },
        onUserUnpublished: (uid: number, mediaType: "audio" | "video") => {
          if (mediaType === "video") {
            setRemoteVideoUid((prev: number | null) => (prev === uid ? null : prev));
          }
        },
        onConnectionStateChange: (cur: string) => {
          setConnectionState(cur);
        },
        onCameraFallback: (reason: string) => {
          console.warn("[call-window] Camera fallback:", reason);
          setIsCameraEnabled(false);
          setLocalMediaWarning(rtc.getLocalMediaWarning());
        },
        onMicFallback: (reason: string) => {
          console.warn("[call-window] Mic fallback:", reason);
          setIsMicMuted(true);
          setLocalMediaWarning(rtc.getLocalMediaWarning());
        },
        onLocalMediaWarning: (msg: string | null) => {
          setLocalMediaWarning(msg);
        },
      });

      console.log("[call-window] Joining channel:", _channelName);
      await rtc.joinChannel(_appId, _channelName, _token, _uid, isVideo);
      setIsMicMuted(rtc.isMicMuted());
      setIsCameraEnabled(rtc.isCameraEnabled());
      setIsSpeakerOn(rtc.isSpeakerOn());
      setLocalMediaWarning(rtc.getLocalMediaWarning());
    } catch (err) {
      console.error("[call-window] Join failed:", err);
      setPhase("ended");
      setEndedText("Không thể kết nối cuộc gọi");
    }
  }, [appId, channelName, token, uid, isVideo]);

  // ── Join Agora on mount ─────────────────────────────────────────────

  useEffect(() => {
    if (hasJoinedRef.current) return;
    hasJoinedRef.current = true;

    if (mode === "outgoing") {
      sendMessage({ type: "call-window:opened", callId });
      setPhase("ringing");
      pendingJoinRef.current = true;
    } else if (mode === "incoming-ringing") {
      sendMessage({ type: "call-window:opened", callId });
      setPhase("ringing");
    } else {
      sendMessage({ type: "call-window:opened", callId });
      joinAgoraChannel();
    }

    // Cleanup on unmount
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (rtc.isJoined()) {
        rtc.leaveChannel().catch(() => {});
      }
      closeChannel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Handle call accepted (outgoing mode) ────────────────────────────

  useEffect(() => {
    if (mode !== "outgoing") return;
    const unsub = onMessage((msg: CallWindowMessage) => {
      if (msg.type === "main:call-accepted" && pendingJoinRef.current) {
        console.log("[call-window] Call accepted — joining Agora now");
        pendingJoinRef.current = false;
        joinAgoraChannel();
      }
    });
    return unsub;
  }, [mode, joinAgoraChannel]);

  // ── Duration timer ──────────────────────────────────────────────────

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

  // ── Play remote video when available ────────────────────────────────
  // ONLY use remoteVideoUid (set on user-published). Do NOT fall back to
  // remoteUid (set on user-joined) because the video track may not exist
  // when user-joined fires, causing a silent failure. When remoteVideoUid
  // later gets the same value, the useEffect won't re-fire.

  useEffect(() => {
    if (remoteVideoUid != null && videoContainerRef.current && phase === "active") {
      console.log("[call-window] Playing remote video for uid:", remoteVideoUid);
      rtc.playRemoteVideo(remoteVideoUid, videoContainerRef.current);
    }
    return () => {
      if (remoteVideoUid != null) {
        rtc.stopRemoteVideo(remoteVideoUid);
      }
    };
  }, [remoteVideoUid, phase]);

  // ── Play local video ────────────────────────────────────────────────

  useEffect(() => {
    if (isCameraEnabled && localVideoRef.current) {
      rtc.playLocalVideo(localVideoRef.current);
    }
    return () => {
      rtc.stopLocalVideo();
    };
  }, [isCameraEnabled]);

  // ── Listen for messages from main page ──────────────────────────────

  useEffect(() => {
    const unsub = onMessage((msg: CallWindowMessage) => {
      if (msg.type === "main:leave-request") {
        console.log("[call-window] Main page requested leave");
        handleEndCall();
      }
      if (msg.type === "main:call-ended") {
        console.log("[call-window] Call ended by remote party, reason:", msg.reason);
        setEndedText(
          msg.reason === "callee_rejected"
            ? "Cuộc gọi bị từ chối"
            : msg.reason === "caller_cancelled"
              ? "Cuộc gọi đã bị huỷ"
              : msg.reason === "no_answer_timeout"
                ? "Không có phản hồi"
                : msg.reason === "disconnect_timeout"
                  ? "Mất kết nối"
                  : "Cuộc gọi đã kết thúc",
        );
        if (rtc.isJoined()) {
          rtc.leaveChannel().catch(() => {});
        }
        setPhase("ended");
        closeActionRef.current = "sync-only";
        sendMessage({ type: "call-window:closed", callId, action: "sync-only" });
        setTimeout(() => {
          window.close();
        }, 2000);
      }
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── beforeunload: notify main page ──────────────────────────────────

  useEffect(() => {
    const handleBeforeUnload = () => {
      sendMessage({
        type: "call-window:closed",
        callId,
        action: closeActionRef.current,
      });
      if (rtc.isJoined()) {
        rtc.leaveChannel().catch(() => {});
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [callId]);

  // ── Control handlers ────────────────────────────────────────────────

  const handleToggleMic = useCallback(async () => {
    const newMuted = await rtc.toggleMic();
    setIsMicMuted(newMuted);
    setLocalMediaWarning(rtc.getLocalMediaWarning());
  }, []);

  const handleToggleCamera = useCallback(async () => {
    const newEnabled = await rtc.toggleCamera();
    setIsCameraEnabled(newEnabled);
    setLocalMediaWarning(rtc.getLocalMediaWarning());
  }, []);

  const handleToggleSpeaker = useCallback(() => {
    rtc.toggleSpeaker();
    setIsSpeakerOn(rtc.isSpeakerOn());
  }, []);

  const handleSwitchCamera = useCallback(async () => {
    await rtc.switchCamera();
  }, []);

  const handleReject = useCallback(async () => {
    if (!callId) return;
    try {
      const callApi = await import("../../../features/call/callApi");
      await callApi.rejectCall(callId);
    } catch {
      // ignore
    }
    sendMessage({ type: "call-window:rejected", callId });
    closeActionRef.current = "sync-only";
    sendMessage({ type: "call-window:closed", callId, action: "sync-only" });
    setPhase("ended");
    setEndedText("Đã từ chối cuộc gọi");
    setTimeout(() => window.close(), 1500);
  }, [callId]);

  const handleEndCall = useCallback(async () => {
    if (mode === "outgoing" && phase === "ringing") {
      try {
        const { cancelCall } = await import("../../../features/call/callApi");
        if (callId) await cancelCall(callId);
      } catch { /* ignore */ }
    } else if (mode === "incoming-ringing" && phase === "ringing") {
      handleReject();
      return;
    } else {
      try {
        const { endCall } = await import("../../../features/call/callApi");
        if (callId) await endCall(callId);
      } catch { /* ignore */ }
      try { await rtc.leaveChannel(); } catch { /* ignore */ }
    }
    closeActionRef.current = "sync-only";
    sendMessage({ type: "call-window:closed", callId, action: "sync-only" });
    setPhase("ended");
    setEndedText(mode === "outgoing" && phase === "ringing" ? "Đã hủy cuộc gọi" : "Cuộc gọi đã kết thúc");
    setTimeout(() => window.close(), 1500);
  }, [callId, mode, phase, handleReject]);

  const handleAccept = useCallback(async () => {
    if (!callId) return;
    try {
      setPhase("connecting");
      const callApi = await import("../../../features/call/callApi");
      const response = await callApi.acceptCall(callId);
      
      sendMessage({ type: "call-window:accepting", callId });
      
      await joinAgoraChannel({
        appId: response.token.appId,
        channelName: response.token.channelName,
        token: response.token.token,
        uid: response.token.uid,
      });
      
      sendMessage({ type: "call-window:accepted", callId });
    } catch (err) {
      console.error("[call-window] Accept failed:", err);
      setPhase("ended");
      setEndedText("Không thể chấp nhận cuộc gọi");
    }
  }, [callId, joinAgoraChannel]);

  // ── Format duration ─────────────────────────────────────────────────

  function formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }

  const statusText =
    phase === "ringing"
      ? (mode === "incoming-ringing" ? (isVideo ? "Cuộc gọi video đến..." : "Cuộc gọi thoại đến...") : (isVideo ? "Đang gọi video..." : "Đang gọi..."))
      : phase === "connecting"
        ? "Đang kết nối..."
        : phase === "ended"
          ? endedText
          : formatDuration(duration);

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-900">
      {/* ── Media warning banner ──────────────────────────────────────── */}
      {localMediaWarning && (
        <div className="bg-yellow-600/90 text-white text-sm text-center px-4 py-2">
          {localMediaWarning}
        </div>
      )}

      {/* ── Title bar ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-800/80 shrink-0">
        <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
          {remoteName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-medium truncate">{remoteName}</p>
          <p className="text-gray-400 text-xs flex items-center gap-1">
            {connectionState === "RECONNECTING" && (
              <WifiOff className="w-3 h-3" />
            )}
            {(phase === "connecting" || phase === "ringing") && (
              <Loader2 className="w-3 h-3 animate-spin" />
            )}
            {statusText}
          </p>
        </div>
      </div>

      {/* ── Video / Audio content ─────────────────────────────────────── */}
      {isVideo ? (
        <div className="flex-1 relative bg-black">
          {/* Remote video (fills the panel) */}
          {remoteVideoUid != null ? (
            <div ref={videoContainerRef} className="w-full h-full" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gray-800">
              <div className="w-20 h-20 rounded-full bg-blue-500 flex items-center justify-center text-white text-3xl font-bold">
                {remoteName.charAt(0).toUpperCase()}
              </div>
              <p className="mt-3 text-gray-400 text-sm">
                {remoteUid != null ? "Đang chờ video..." : statusText}
              </p>
            </div>
          )}

          {/* Local video (PiP) */}
          <div className="absolute bottom-4 right-4 w-32 h-44 rounded-xl overflow-hidden border-2 border-white/20 shadow-lg">
            <div ref={localVideoRef} className="w-full h-full bg-gray-700" />
          </div>

          {/* Connecting / Ringing overlay */}
          {(phase === "connecting" || phase === "ringing") && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <div className="flex flex-col items-center gap-3">
                {phase === "ringing" ? (
                  <>
                    <div className="w-20 h-20 rounded-full bg-blue-500 flex items-center justify-center text-white text-3xl font-bold animate-pulse">
                      {remoteName.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-white text-sm">{statusText}</span>
                  </>
                ) : (
                  <>
                    <Loader2 className="w-8 h-8 text-white animate-spin" />
                    <span className="text-white text-sm">Đang kết nối...</span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Audio-only content */
        <div className="flex-1 flex flex-col items-center justify-center bg-gray-900">
          <div className="relative">
            <div className="w-28 h-28 rounded-full bg-blue-500 flex items-center justify-center text-white text-4xl font-bold shadow-lg">
              {remoteName.charAt(0).toUpperCase()}
            </div>
            {(phase === "connecting" || phase === "ringing") && (
              <div className="absolute inset-0 rounded-full bg-blue-400 animate-ping opacity-20" />
            )}
          </div>
          <h3 className="mt-4 text-xl font-semibold text-white">{remoteName}</h3>
          <p className="mt-1 text-gray-400 text-sm flex items-center gap-1.5">
            {phase === "connecting" || phase === "ringing" ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {statusText}
              </>
            ) : (
              statusText
            )}
          </p>
        </div>
      )}

      {/* ── Controls bar ──────────────────────────────────────────────── */}
      <div className="bg-gray-800/80 shrink-0">
        <div className="flex items-center justify-center gap-4 py-4">
          {mode === "incoming-ringing" && phase === "ringing" ? (
            <>
              {/* Reject */}
              <button
                type="button"
                onClick={handleReject}
                className="w-16 h-16 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg cursor-pointer"
                title="Từ chối"
              >
                <PhoneOff className="w-7 h-7" />
              </button>
              {/* Accept */}
              <button
                type="button"
                onClick={handleAccept}
                className="w-16 h-16 rounded-full bg-green-500 text-white flex items-center justify-center hover:bg-green-600 transition-colors shadow-lg animate-pulse cursor-pointer"
                title="Chấp nhận"
              >
                <Phone className="w-7 h-7" />
              </button>
            </>
          ) : (
            <>
              {/* Mic */}
              <button
                type="button"
                onClick={handleToggleMic}
                disabled={phase !== "active"}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 ${
                  isMicMuted
                    ? "bg-red-500/80 text-white hover:bg-red-600/80"
                    : "bg-white/20 text-white hover:bg-white/30"
                }`}
                title={isMicMuted ? "Bật mic" : "Tắt mic"}
              >
                {isMicMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>

              {/* Camera toggle (video calls only) */}
              {isVideo && (
                <button
                  type="button"
                  onClick={handleToggleCamera}
                  disabled={phase !== "active"}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 ${
                    !isCameraEnabled
                      ? "bg-red-500/80 text-white hover:bg-red-600/80"
                      : "bg-white/20 text-white hover:bg-white/30"
                  }`}
                  title={isCameraEnabled ? "Tắt camera" : "Bật camera"}
                >
                  {isCameraEnabled ? (
                    <Video className="w-5 h-5" />
                  ) : (
                    <VideoOff className="w-5 h-5" />
                  )}
                </button>
              )}

              {/* Switch camera (mobile only) */}
              {isVideo && rtc.isMobileDevice() && (
                <button
                  type="button"
                  onClick={handleSwitchCamera}
                  disabled={phase !== "active"}
                  className="w-12 h-12 rounded-full flex items-center justify-center bg-white/20 text-white hover:bg-white/30 transition-colors cursor-pointer disabled:opacity-40"
                  title="Đổi camera"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 19H4a2 2 0 01-2-2V7a2 2 0 012-2h5" />
                    <path d="M13 5h7a2 2 0 012 2v10a2 2 0 01-2 2h-5" />
                    <path d="M14 9l3-3 3 3" />
                    <path d="M10 15l-3 3-3-3" />
                  </svg>
                </button>
              )}

              {/* Speaker */}
              <button
                type="button"
                onClick={handleToggleSpeaker}
                disabled={phase !== "active"}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 ${
                  isSpeakerOn
                    ? "bg-white/30 text-white hover:bg-white/40"
                    : "bg-white/20 text-white hover:bg-white/30"
                }`}
                title={isSpeakerOn ? "Tắt loa ngoài" : "Bật loa ngoài"}
              >
                {isSpeakerOn ? (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M15.54 8.46a5 5 0 010 7.07" />
                    <path d="M19.07 4.93a10 10 0 010 14.14" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <line x1="23" y1="9" x2="17" y2="15" />
                    <line x1="17" y1="9" x2="23" y2="15" />
                  </svg>
                )}
              </button>

              {/* End call */}
              <button
                type="button"
                onClick={handleEndCall}
                className="w-14 h-12 rounded-full flex items-center justify-center bg-red-500 text-white hover:bg-red-600 transition-colors cursor-pointer"
                title="Kết thúc cuộc gọi"
              >
                <PhoneOff className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Default export with Suspense boundary (required by Next.js 15 useSearchParams) ──

export default function CallWindowPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen w-screen flex items-center justify-center bg-gray-900 text-white">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      }
    >
      <CallWindowContent />
    </Suspense>
  );
}
