"use client";

/**
 * Standalone group call window — opens via window.open() from the main page.
 *
 * Owns the Agora RTC lifecycle for group calls. The main page does NOT join
 * Agora when this window is open.
 *
 * URL params:
 *   callId, callType, conversationId, channelName, appId, token, uid,
 *   mode (host-ringing | incoming | accepted | rejoin),
 *   remoteName, isHost
 *
 * Features:
 *   - Responsive video grid: 1/2/3/4/5+ participants
 *   - Screen sharing via replaceTrack (Agora 4.x single-video-track constraint)
 *   - Lazy media creation (no getUserMedia until user interaction)
 *   - Tile labels, mic indicators, avatar fallbacks
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
  Users,
  MonitorUp,
  MonitorOff,
  LayoutGrid,
  Pin,
  PinOff,
  Maximize2,
  PanelRight,
  Grid3X3,
  ChevronDown,
  X,
} from "lucide-react";
import {
  sendGroupMessage,
  onGroupMessage,
  closeGroupChannel,
  type GroupCallWindowMessage,
} from "../../../features/group-call/groupCallWindowChannel";


// ── Inline Agora RTC (self-contained, no shared singleton) ─────────────

let agoraModule: typeof import("agora-rtc-sdk-ng") | null = null;
let client: any = null;
let audioTrack: any = null;
let videoTrack: any = null;
let screenTrack: any = null;
let cameraMediaStream: MediaStreamTrack | null = null;

async function getAgora() {
  if (!agoraModule) {
    agoraModule = await import("agora-rtc-sdk-ng");
  }
  return agoraModule;
}

async function joinSignaling(appId: string, channel: string, token: string, uid: number) {
  const AgoraRTC = await getAgora();
  if (client) {
    try { await leaveChannel(); } catch {}
  }
  client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
  await client.join(appId, channel, token, uid);
  return client;
}

async function createAndPublishMedia(enableVideo: boolean) {
  if (!client) return { audioTrack: null, videoTrack: null };
  const AgoraRTC = await getAgora();
  const tracks: any[] = [];

  if (!audioTrack) {
    try {
      audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
      tracks.push(audioTrack);
    } catch (err) {
      console.warn("[group-call-window] Microphone unavailable:", err);
    }
  }

  if (enableVideo && !videoTrack) {
    try {
      videoTrack = await AgoraRTC.createCameraVideoTrack();
      tracks.push(videoTrack);
    } catch (err) {
      console.warn("[group-call-window] Camera unavailable:", err);
    }
  }

  if (tracks.length > 0) {
    await client.publish(tracks);
  }

  return { audioTrack, videoTrack };
}

/** Start screen sharing using replaceTrack (Agora 4.x constraint: one video track). */
async function startScreenShare(): Promise<boolean> {
  if (!client || !videoTrack) return false;
  try {
    const AgoraRTC = await getAgora();
    screenTrack = await AgoraRTC.createScreenVideoTrack(
      { encoderConfig: "1080p_1" },
      "disable",
    );

    // Save camera MediaStreamTrack for restore
    cameraMediaStream = videoTrack.getMediaStreamTrack();

    // Swap: replace camera with screen
    await videoTrack.replaceTrack(screenTrack.getMediaStreamTrack(), false);

    // Listen for browser "Stop sharing" button
    screenTrack.on("track-ended", () => {
      stopScreenShare();
    });

    return true;
  } catch (err) {
    // User cancelled screen picker or browser blocked
    console.warn("[group-call-window] Screen share cancelled/failed:", err);
    screenTrack = null;
    cameraMediaStream = null;
    return false;
  }
}

/** Stop screen sharing and restore camera. */
async function stopScreenShare() {
  if (screenTrack) {
    try { screenTrack.close(); } catch {}
    screenTrack = null;
  }
  if (videoTrack && cameraMediaStream) {
    try {
      await videoTrack.replaceTrack(cameraMediaStream, false);
    } catch (err) {
      console.warn("[group-call-window] Failed to restore camera:", err);
    }
    cameraMediaStream = null;
  }
}

async function leaveChannel() {
  // Clean up screen share
  if (screenTrack) {
    try { screenTrack.close(); } catch {}
    screenTrack = null;
    cameraMediaStream = null;
  }
  if (audioTrack) {
    audioTrack.stop();
    audioTrack.close();
    audioTrack = null;
  }
  if (videoTrack) {
    videoTrack.stop();
    videoTrack.close();
    videoTrack = null;
  }
  if (client) {
    await client.leave();
    client = null;
  }
}

function isJoined() {
  return client !== null;
}

// ── Layout types ────────────────────────────────────────────────────────

type LayoutMode = "auto" | "grid" | "speaker" | "sidebar" | "pinned";

interface Participant {
  uid: number;
  label: string;
  hasAudio: boolean;
  hasVideo: boolean;
  isLocal: boolean;
  isScreenShare?: boolean;
}

// ── Featured tile priority: screenShare > pinned > activeSpeaker > first ──

function getFeaturedUid(
  participants: Participant[],
  pinnedUid: number | null,
  isScreenSharing: boolean,
  localUid: number,
): number | null {
  // 1. Screen share has highest priority
  if (isScreenSharing) return localUid;
  const screenSharer = participants.find(p => p.isScreenShare);
  if (screenSharer) return screenSharer.uid;

  // 2. Pinned participant
  if (pinnedUid != null && participants.some(p => p.uid === pinnedUid)) {
    return pinnedUid;
  }

  // 3. Active speaker (first remote with audio)
  const activeSpeaker = participants.find(p => !p.isLocal && p.hasAudio);
  if (activeSpeaker) return activeSpeaker.uid;

  // 4. First participant (local or first remote)
  return participants[0]?.uid ?? null;
}

// ── Layout calculator ───────────────────────────────────────────────────

interface TileLayout {
  uid: number;
  style: React.CSSProperties;
  isFeatured: boolean;
}

function calculateLayout(
  participants: Participant[],
  layoutMode: LayoutMode,
  pinnedUid: number | null,
  isScreenSharing: boolean,
  localUid: number,
): { containerStyle: React.CSSProperties; tiles: TileLayout[] } {
  const count = participants.length;
  if (count === 0) return { containerStyle: {}, tiles: [] };

  const featuredUid = getFeaturedUid(participants, pinnedUid, isScreenSharing, localUid);
  const effectiveMode: LayoutMode = layoutMode === "pinned" && pinnedUid == null ? "auto" : layoutMode;

  // ── Grid mode: all tiles equal ──
  if (effectiveMode === "grid") {
    const cols = count === 1 ? 1 : count === 2 ? 2 : count <= 4 ? 2 : 3;
    const rows = Math.ceil(count / cols);
    return {
      containerStyle: {
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        gap: "4px",
      },
      tiles: participants.map(p => ({ uid: p.uid, style: {}, isFeatured: false })),
    };
  }

  // ── Speaker mode: featured large + sidebar strip ──
  if (effectiveMode === "speaker") {
    const others = participants.filter(p => p.uid !== featuredUid);
    if (others.length === 0 || count === 1) {
      return {
        containerStyle: { display: "grid", gridTemplateColumns: "1fr", gridTemplateRows: "1fr" },
        tiles: participants.map(p => ({ uid: p.uid, style: {}, isFeatured: true })),
      };
    }
    return {
      containerStyle: {
        display: "grid",
        gridTemplateColumns: "3fr 1fr",
        gridTemplateRows: "1fr",
        gap: "4px",
      },
      tiles: participants.map(p => ({
        uid: p.uid,
        style: p.uid === featuredUid
          ? { gridColumn: "1 / 2", gridRow: "1 / -1" }
          : {},
        isFeatured: p.uid === featuredUid,
      })),
    };
  }

  // ── Sidebar mode: featured large left + vertical strip right ──
  if (effectiveMode === "sidebar") {
    const others = participants.filter(p => p.uid !== featuredUid);
    if (others.length === 0 || count === 1) {
      return {
        containerStyle: { display: "grid", gridTemplateColumns: "1fr", gridTemplateRows: "1fr" },
        tiles: participants.map(p => ({ uid: p.uid, style: {}, isFeatured: true })),
      };
    }
    return {
      containerStyle: {
        display: "grid",
        gridTemplateColumns: "4fr 1fr",
        gridTemplateRows: `repeat(${others.length}, 1fr)`,
        gap: "4px",
      },
      tiles: participants.map(p => ({
        uid: p.uid,
        style: p.uid === featuredUid
          ? { gridColumn: "1 / 2", gridRow: `1 / ${others.length + 1}` }
          : {},
        isFeatured: p.uid === featuredUid,
      })),
    };
  }

  // ── Pinned mode: same as speaker but explicitly for pinned ──
  if (effectiveMode === "pinned" && pinnedUid != null) {
    const others = participants.filter(p => p.uid !== pinnedUid);
    if (others.length === 0) {
      return {
        containerStyle: { display: "grid", gridTemplateColumns: "1fr", gridTemplateRows: "1fr" },
        tiles: participants.map(p => ({ uid: p.uid, style: {}, isFeatured: true })),
      };
    }
    return {
      containerStyle: {
        display: "grid",
        gridTemplateColumns: "3fr 1fr",
        gridTemplateRows: "1fr",
        gap: "4px",
      },
      tiles: participants.map(p => ({
        uid: p.uid,
        style: p.uid === pinnedUid
          ? { gridColumn: "1 / 2", gridRow: "1 / -1" }
          : {},
        isFeatured: p.uid === pinnedUid,
      })),
    };
  }

  // ── Auto mode (default) ──
  // Screen share → speaker layout
  if (isScreenSharing || participants.some(p => p.isScreenShare)) {
    return calculateLayout(participants, "speaker", null, isScreenSharing, localUid);
  }

  switch (count) {
    case 1:
      return {
        containerStyle: { display: "grid", gridTemplateColumns: "1fr", gridTemplateRows: "1fr" },
        tiles: [{ uid: participants[0].uid, style: {}, isFeatured: true }],
      };
    case 2:
      return {
        containerStyle: { display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr", gap: "4px" },
        tiles: participants.map(p => ({ uid: p.uid, style: {}, isFeatured: false })),
      };
    case 3:
      return {
        containerStyle: { display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "2fr 1fr", gap: "4px" },
        tiles: participants.map((p, i) => ({
          uid: p.uid,
          style: i === 0 ? { gridColumn: "1 / -1" } : {},
          isFeatured: i === 0,
        })),
      };
    case 4:
      return {
        containerStyle: { display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: "4px" },
        tiles: participants.map(p => ({ uid: p.uid, style: {}, isFeatured: false })),
      };
    default:
      return {
        containerStyle: {
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gridAutoRows: "1fr",
          gap: "4px",
          overflowY: "auto",
        },
        tiles: participants.map(p => ({ uid: p.uid, style: {}, isFeatured: false })),
      };
  }
}

// ── Component ──────────────────────────────────────────────────────────

function GroupCallWindowContent() {
  const searchParams = useSearchParams();
  const hasInitRef = useRef(false);
  const [phase, setPhase] = useState<"waiting" | "ringing" | "connecting" | "active" | "ended">("connecting");
  const [duration, setDuration] = useState(0);
  const [isMicMuted, setIsMicMuted] = useState(true);
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [connectionState, setConnectionState] = useState("DISCONNECTED");
  const [endedText, setEndedText] = useState("Cuộc gọi nhóm đã kết thúc");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationRef = useRef(0);
  const localVideoRef = useRef<HTMLDivElement>(null);
  const [remoteUsers, setRemoteUsers] = useState<Map<number, { hasAudio: boolean; hasVideo: boolean }>>(new Map());
  const mediaCreatedRef = useRef(false);

  // ── Layout state ─────────────────────────────────────────────────────
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("groupCall.layoutMode");
      if (saved && ["auto", "grid", "speaker", "sidebar", "pinned"].includes(saved)) {
        return saved as LayoutMode;
      }
    }
    return "auto";
  });
  const [pinnedUid, setPinnedUid] = useState<number | null>(null);
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  const [contextMenuUid, setContextMenuUid] = useState<number | null>(null);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persist layout mode to localStorage
  useEffect(() => {
    localStorage.setItem("groupCall.layoutMode", layoutMode);
  }, [layoutMode]);

  // Close context menu on outside click
  useEffect(() => {
    if (contextMenuUid == null) return;
    const handler = () => setContextMenuUid(null);
    const timer = setTimeout(() => document.addEventListener("click", handler), 50);
    return () => { clearTimeout(timer); document.removeEventListener("click", handler); };
  }, [contextMenuUid]);

  // Close layout menu on outside click
  useEffect(() => {
    if (!showLayoutMenu) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-layout-menu]")) {
        setShowLayoutMenu(false);
      }
    };
    const timer = setTimeout(() => document.addEventListener("click", handler), 50);
    return () => { clearTimeout(timer); document.removeEventListener("click", handler); };
  }, [showLayoutMenu]);

  const appId = searchParams.get("appId") || "";
  const channelName = searchParams.get("channelName") || "";
  const token = searchParams.get("token") || "";
  const uid = parseInt(searchParams.get("uid") || "0", 10);
  const callType = (searchParams.get("callType") as "audio" | "video") || "video";
  const remoteName = searchParams.get("remoteName") || "Cuộc gọi nhóm";
  const callId = searchParams.get("callId") || "";
  const isHost = searchParams.get("isHost") === "true";
  const mode = (searchParams.get("mode") as "host-ringing" | "incoming" | "accepted" | "rejoin") || "accepted";
  const isVideo = callType === "video";

  // ── Build participant list ────────────────────────────────────────────

  const participants: Participant[] = [];
  // Local user first
  participants.push({
    uid: uid,
    label: "Bạn",
    hasAudio: !isMicMuted && !!audioTrack,
    hasVideo: isCameraEnabled && !!videoTrack,
    isLocal: true,
  });
  // Remote users
  for (const [rUid, info] of remoteUsers) {
    participants.push({
      uid: rUid,
      label: `User ${rUid}`,
      hasAudio: info.hasAudio,
      hasVideo: info.hasVideo,
      isLocal: false,
    });
  }

  const participantCount = participants.length;
  const hasScreenShare = isScreenSharing;
  const layoutConfig = calculateLayout(participants, layoutMode, pinnedUid, isScreenSharing, uid);

  // ── Setup Agora event listeners ─────────────────────────────────────

  const setupAgoraListeners = useCallback(() => {
    if (!client) return;

    client.on("user-published", async (user: any, mediaType: string) => {
      await client.subscribe(user, mediaType);
      setRemoteUsers(prev => {
        const next = new Map(prev);
        const existing = next.get(user.uid) || { hasAudio: false, hasVideo: false };
        if (mediaType === "audio") existing.hasAudio = true;
        if (mediaType === "video") existing.hasVideo = true;
        next.set(user.uid, existing);
        return next;
      });
      if (mediaType === "video") {
        setTimeout(() => {
          const el = document.getElementById(`remote-video-${user.uid}`);
          if (el) user.videoTrack?.play(el);
        }, 100);
      }
      if (mediaType === "audio") {
        user.audioTrack?.play();
      }
    });

    client.on("user-unpublished", (user: any, mediaType: string) => {
      setRemoteUsers(prev => {
        const next = new Map(prev);
        const existing = next.get(user.uid);
        if (existing) {
          if (mediaType === "audio") existing.hasAudio = false;
          if (mediaType === "video") existing.hasVideo = false;
          next.set(user.uid, existing);
        }
        return next;
      });
    });

    client.on("user-joined", (user: any) => {
      console.log("[group-call-window] Remote user joined:", user.uid);
      setRemoteUsers(prev => {
        const next = new Map(prev);
        next.set(user.uid, { hasAudio: false, hasVideo: false });
        return next;
      });
    });

    client.on("user-left", (user: any) => {
      console.log("[group-call-window] Remote user left:", user.uid);
      setRemoteUsers(prev => {
        const next = new Map(prev);
        next.delete(user.uid);
        return next;
      });
    });

    client.on("connection-state-change", (cur: string) => {
      setConnectionState(cur);
    });
  }, []);

  // ── Mount ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (hasInitRef.current) return;
    hasInitRef.current = true;

    sendGroupMessage({ type: "group-call-window:opened", callId });

    (async () => {
      try {
        if (mode === "host-ringing") {
          await joinSignaling(appId, channelName, token, uid);
          setupAgoraListeners();
          setPhase("waiting");
          setConnectionState("CONNECTED");
        } else if (mode === "incoming") {
          setPhase("ringing");
        } else {
          setPhase("connecting");
          await joinSignaling(appId, channelName, token, uid);
          setupAgoraListeners();
          setConnectionState("CONNECTED");
          await createAndPublishMedia(isVideo);
          mediaCreatedRef.current = true;
          setIsMicMuted(!audioTrack);
          setIsCameraEnabled(!!videoTrack);
          setPhase("active");
        }
      } catch (err) {
        console.error("[group-call-window] Init failed:", err);
        setPhase("ended");
        setEndedText("Không thể kết nối cuộc gọi nhóm");
      }
    })();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      leaveChannel().catch(() => {});
      closeGroupChannel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Host: auto-switch to active when first remote user joins ────────

  useEffect(() => {
    if (mode === "host-ringing" && phase === "waiting" && remoteUsers.size > 0) {
      console.log("[group-call-window] First participant joined — switching to active");
      (async () => {
        if (!mediaCreatedRef.current) {
          await createAndPublishMedia(isVideo);
          mediaCreatedRef.current = true;
          setIsMicMuted(!audioTrack);
          setIsCameraEnabled(!!videoTrack);
        }
        setPhase("active");
      })();
    }
  }, [mode, phase, remoteUsers.size, isVideo]);

  // Removed Ringtone logic here because browsers block autoplay in popups.
  // We now play the outgoing ringtone in the main window via GroupOutgoingCallRingtone.

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
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    };
  }, [phase]);

  // ── Play local video ────────────────────────────────────────────────

  useEffect(() => {
    if (isCameraEnabled && localVideoRef.current && videoTrack && !isScreenSharing) {
      videoTrack.play(localVideoRef.current);
    }
  }, [isCameraEnabled, phase, isScreenSharing]);

  // ── Listen for messages from main page ──────────────────────────────

  useEffect(() => {
    const unsub = onGroupMessage((msg: GroupCallWindowMessage) => {
      if (msg.type === "main:group-call-ended") {
        if (isJoined()) leaveChannel().catch(() => {});
        setPhase("ended");
        sendGroupMessage({ type: "group-call-window:closed", callId });
        setTimeout(() => window.close(), 2000);
      }
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── beforeunload ────────────────────────────────────────────────────

  useEffect(() => {
    const handleBeforeUnload = () => {
      sendGroupMessage({ type: "group-call-window:closed", callId, reason: "beforeunload" });
      leaveChannel().catch(() => {});
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [callId]);

  // ── Handlers ────────────────────────────────────────────────────────

  const handleToggleMic = useCallback(async () => {
    if (!audioTrack && !mediaCreatedRef.current) {
      await createAndPublishMedia(isVideo);
      mediaCreatedRef.current = true;
    }
    if (audioTrack) {
      audioTrack.setEnabled(isMicMuted);
      setIsMicMuted(!isMicMuted);
    }
  }, [isMicMuted, isVideo]);

  const handleToggleCamera = useCallback(async () => {
    if (!videoTrack && !mediaCreatedRef.current) {
      await createAndPublishMedia(isVideo);
      mediaCreatedRef.current = true;
    }
    if (videoTrack) {
      videoTrack.setEnabled(!isCameraEnabled);
      setIsCameraEnabled(!isCameraEnabled);
      if (!isCameraEnabled && localVideoRef.current && !isScreenSharing) {
        setTimeout(() => videoTrack?.play(localVideoRef.current), 100);
      }
    }
  }, [isCameraEnabled, isVideo, isScreenSharing]);

  const handleToggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      await stopScreenShare();
      setIsScreenSharing(false);
      // Restore camera view
      if (isCameraEnabled && localVideoRef.current && videoTrack) {
        setTimeout(() => videoTrack?.play(localVideoRef.current), 200);
      }
    } else {
      const started = await startScreenShare();
      if (started) {
        setIsScreenSharing(true);
        // Play screen on local tile
        if (localVideoRef.current && videoTrack) {
          setTimeout(() => videoTrack?.play(localVideoRef.current), 200);
        }
      }
    }
  }, [isScreenSharing, isCameraEnabled]);

  const handleAccept = useCallback(async () => {
    if (!callId) return;
    try {
      setPhase("connecting");
      const { default: apiClient } = await import("../../../lib/axios");
      const { data } = await apiClient.post(`/api/calls/group/${callId}/accept`);
      const session = data?.data?.session;
      if (session?.token && session?.agoraUid != null) {
        sendGroupMessage({ type: "group-call-window:accepted", callId });
        await joinSignaling(
          session.appId || appId,
          session.channelName || session.agoraChannelName,
          session.token,
          session.agoraUid,
        );
        setupAgoraListeners();
        setConnectionState("CONNECTED");
        await createAndPublishMedia(isVideo);
        mediaCreatedRef.current = true;
        setIsMicMuted(!audioTrack);
        setIsCameraEnabled(!!videoTrack);
        setPhase("active");
        sendGroupMessage({ type: "group-call-window:accepted", callId });
      } else {
        throw new Error("No credentials in accept response");
      }
    } catch (err) {
      console.error("[group-call-window] Accept failed:", err);
      setPhase("ended");
      setEndedText("Không thể tham gia cuộc gọi nhóm");
    }
  }, [callId, appId, isVideo, setupAgoraListeners]);

  const handleReject = useCallback(async () => {
    if (!callId) return;
    try {
      const { default: apiClient } = await import("../../../lib/axios");
      await apiClient.post(`/api/calls/group/${callId}/reject`);
    } catch {}
    sendGroupMessage({ type: "group-call-window:rejected", callId });
    sendGroupMessage({ type: "group-call-window:closed", callId, reason: "reject" });
    setPhase("ended");
    setEndedText("Đã từ chối");
    setTimeout(() => window.close(), 1500);
  }, [callId]);

  const handleLeave = useCallback(async () => {
    if (!callId) return;
    try {
      const { default: apiClient } = await import("../../../lib/axios");
      await apiClient.post(`/api/calls/group/${callId}/leave`);
    } catch {}
    await leaveChannel().catch(() => {});
    sendGroupMessage({ type: "group-call-window:closed", callId, reason: "leave" });
    setPhase("ended");
    setEndedText("Đã rời cuộc gọi");
    setTimeout(() => window.close(), 1500);
  }, [callId]);

  // ── Format ──────────────────────────────────────────────────────────

  function formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }

  const statusText =
    phase === "waiting" ? "Đang chờ mọi người tham gia..."
    : phase === "ringing" ? "Cuộc gọi nhóm đến..."
    : phase === "connecting" ? "Đang kết nối..."
    : phase === "ended" ? endedText
    : formatDuration(duration);

  // ── Render tile ──────────────────────────────────────────────────────

  function renderParticipantTile(p: Participant, tileLayout: TileLayout) {
    const showVideo = p.isLocal ? (isCameraEnabled || isScreenSharing) : p.hasVideo;
    const isPinned = pinnedUid === p.uid;
    const isContextMenuOpen = contextMenuUid === p.uid;

    const handleTileClick = () => {
      // Single click: toggle context menu (with delay to distinguish from double-click)
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
        // Double-click: toggle pin
        handlePinToggle(p.uid);
        return;
      }
      clickTimerRef.current = setTimeout(() => {
        clickTimerRef.current = null;
        setContextMenuUid(prev => prev === p.uid ? null : p.uid);
      }, 250);
    };

    const handlePinToggle = (targetUid: number) => {
      setPinnedUid(prev => {
        const newPinned = prev === targetUid ? null : targetUid;
        if (newPinned != null) {
          setLayoutMode("pinned");
        } else if (layoutMode === "pinned") {
          setLayoutMode("auto");
        }
        return newPinned;
      });
      setContextMenuUid(null);
    };

    return (
      <div
        key={p.uid}
        className={`relative bg-gray-800 rounded-lg overflow-hidden cursor-pointer transition-all ${tileLayout.isFeatured ? "ring-2 ring-blue-500/50" : ""} ${isPinned ? "ring-2 ring-yellow-500/70" : ""}`}
        style={{ minHeight: 0, ...tileLayout.style }}
        onClick={handleTileClick}
      >
        {/* Video container */}
        {showVideo ? (
          p.isLocal ? (
            <div ref={localVideoRef} className="w-full h-full" />
          ) : (
            <div id={`remote-video-${p.uid}`} className="w-full h-full" />
          )
        ) : (
          /* Avatar fallback */
          <div className="w-full h-full flex flex-col items-center justify-center">
            <div className={`${tileLayout.isFeatured ? "w-24 h-24 text-3xl" : "w-16 h-16 text-2xl"} rounded-full bg-blue-500 flex items-center justify-center text-white font-bold transition-all`}>
              {p.label.charAt(0).toUpperCase()}
            </div>
          </div>
        )}

        {/* Top indicators */}
        <div className="absolute top-2 right-2 flex items-center gap-1">
          {isPinned && (
            <div className="bg-yellow-500/80 rounded-full p-1">
              <Pin className="w-3 h-3 text-white" />
            </div>
          )}
          {p.isScreenShare && (
            <div className="bg-green-500/80 rounded-full p-1">
              <MonitorUp className="w-3 h-3 text-white" />
            </div>
          )}
        </div>

        {/* Bottom label bar */}
        <div className="absolute bottom-0 left-0 right-0 flex items-center gap-1.5 px-2 py-1.5 bg-gradient-to-t from-black/70 to-transparent">
          {(!p.hasAudio && !p.isLocal) || (p.isLocal && isMicMuted) ? (
            <MicOff className="w-3.5 h-3.5 text-red-400" />
          ) : null}
          <span className="text-white text-xs font-medium truncate">{p.label}</span>
        </div>

        {/* Context menu */}
        {isContextMenuOpen && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 bg-gray-900/95 rounded-xl shadow-2xl border border-white/10 p-2 min-w-[160px]">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handlePinToggle(p.uid); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            >
              {isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
              {isPinned ? "Bỏ ghim" : "Ghim"}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setLayoutMode("speaker");
                setContextMenuUid(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            >
              <Maximize2 className="w-4 h-4" />
              Xem loa
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setContextMenuUid(null); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
              Đóng
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-900">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-800/80 shrink-0">
        <div className="w-9 h-9 rounded-full bg-green-500 flex items-center justify-center text-white shrink-0">
          <Users className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-medium truncate">{remoteName}</p>
          <p className="text-gray-400 text-xs flex items-center gap-1">
            {connectionState === "RECONNECTING" && <WifiOff className="w-3 h-3" />}
            {(phase === "connecting" || phase === "waiting") && <Loader2 className="w-3 h-3 animate-spin" />}
            {statusText}
            {phase === "active" && ` · ${participantCount} người`}
          </p>
        </div>
        {isScreenSharing && (
          <div className="flex items-center gap-1 px-2 py-1 bg-green-600/80 rounded-full">
            <MonitorUp className="w-3 h-3 text-white" />
            <span className="text-white text-xs">Đang chia sẻ</span>
          </div>
        )}
      </div>

      {/* ── Content ────────────────────────────────────────────────────── */}
      {phase === "ringing" && mode === "incoming" ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-gray-900 gap-6">
          <div className="relative">
            <div className="w-28 h-28 rounded-full bg-green-500 flex items-center justify-center text-white text-4xl shadow-lg">
              <Users className="w-14 h-14" />
            </div>
            <div className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-20" />
          </div>
          <div className="text-center">
            <h3 className="text-xl font-semibold text-white">Cuộc gọi nhóm</h3>
            <p className="text-gray-400 text-sm mt-1">{isVideo ? "Video" : "Thoại"} · Nhấn để tham gia</p>
          </div>
          <div className="flex items-center gap-8">
            <button type="button" onClick={handleReject} className="w-16 h-16 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg cursor-pointer" title="Từ chối">
              <PhoneOff className="w-7 h-7" />
            </button>
            <button type="button" onClick={handleAccept} className="w-16 h-16 rounded-full bg-green-500 text-white flex items-center justify-center hover:bg-green-600 transition-colors shadow-lg animate-pulse cursor-pointer" title="Tham gia">
              <Phone className="w-7 h-7" />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 relative bg-black p-1" style={{ minHeight: 0 }}>
          {/* Layout grid */}
          <div className="w-full h-full" style={layoutConfig.containerStyle}>
            {layoutConfig.tiles.map(tile => {
              const p = participants.find(pp => pp.uid === tile.uid);
              if (!p) return null;
              return renderParticipantTile(p, tile);
            })}
          </div>

          {/* Waiting overlay */}
          {phase === "waiting" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
                <span className="text-white text-sm">Đang chờ mọi người tham gia...</span>
              </div>
            </div>
          )}

          {/* Connecting overlay */}
          {phase === "connecting" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
                <span className="text-white text-sm">Đang kết nối...</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Controls bar ──────────────────────────────────────────────── */}
      {phase !== "ringing" && (
        <div className="bg-gray-800/80 shrink-0 relative">
          <div className="flex items-center justify-center gap-3 py-3">
            {/* Layout selector */}
            <div className="relative" data-layout-menu>
              <button
                type="button"
                onClick={() => setShowLayoutMenu(prev => !prev)}
                className="w-12 h-12 rounded-full flex items-center justify-center bg-white/20 text-white hover:bg-white/30 transition-colors cursor-pointer"
                title="Bố cục"
              >
                <LayoutGrid className="w-5 h-5" />
              </button>

              {/* Layout dropdown */}
              {showLayoutMenu && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-gray-900/95 rounded-xl shadow-2xl border border-white/10 p-2 min-w-[180px] z-30">
                  <p className="text-gray-400 text-xs px-3 py-1 mb-1">Bố cục</p>
                  {([
                    { key: "auto", label: "Tự động", icon: LayoutGrid },
                    { key: "grid", label: "Lưới", icon: Grid3X3 },
                    { key: "speaker", label: "Diễn giả", icon: Maximize2 },
                    { key: "sidebar", label: "Thanh bên", icon: PanelRight },
                    { key: "pinned", label: "Ghim", icon: Pin },
                  ] as const).map(opt => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => { setLayoutMode(opt.key as LayoutMode); setShowLayoutMenu(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors cursor-pointer ${layoutMode === opt.key ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-white/10"}`}
                    >
                      <opt.icon className="w-4 h-4" />
                      {opt.label}
                      {layoutMode === opt.key && <span className="ml-auto text-xs">✓</span>}
                    </button>
                  ))}
                  {pinnedUid != null && (
                    <button
                      type="button"
                      onClick={() => { setPinnedUid(null); if (layoutMode === "pinned") setLayoutMode("auto"); setShowLayoutMenu(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-yellow-400 hover:bg-white/10 rounded-lg transition-colors cursor-pointer mt-1 border-t border-white/10 pt-2"
                    >
                      <PinOff className="w-4 h-4" />
                      Bỏ ghim tất cả
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Mic */}
            <button
              type="button"
              onClick={handleToggleMic}
              disabled={phase !== "active" && phase !== "waiting"}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 ${isMicMuted ? "bg-red-500/80 text-white" : "bg-white/20 text-white hover:bg-white/30"}`}
              title={isMicMuted ? "Bật mic" : "Tắt mic"}
            >
              {isMicMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            {/* Camera */}
            {isVideo && (
              <button
                type="button"
                onClick={handleToggleCamera}
                disabled={phase !== "active" && phase !== "waiting"}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 ${!isCameraEnabled ? "bg-red-500/80 text-white" : "bg-white/20 text-white hover:bg-white/30"}`}
                title={isCameraEnabled ? "Tắt camera" : "Bật camera"}
              >
                {isCameraEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              </button>
            )}

            {/* Screen share */}
            {phase === "active" && (
              <button
                type="button"
                onClick={handleToggleScreenShare}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors cursor-pointer ${isScreenSharing ? "bg-green-500/80 text-white" : "bg-white/20 text-white hover:bg-white/30"}`}
                title={isScreenSharing ? "Dừng chia sẻ" : "Chia sẻ màn hình"}
              >
                {isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <MonitorUp className="w-5 h-5" />}
              </button>
            )}

            {/* Spacer */}
            <div className="w-px h-8 bg-white/20 mx-1" />

            {/* Leave — all users (host or not) leave individually; backend ends session when empty */}
            <button type="button" onClick={handleLeave} className="w-14 h-12 rounded-full flex items-center justify-center bg-red-500 text-white hover:bg-red-600 transition-colors cursor-pointer" title="Rời cuộc gọi">
              <PhoneOff className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function GroupCallWindowPage() {
  return (
    <Suspense fallback={<div className="h-screen w-screen flex items-center justify-center bg-gray-900 text-white"><Loader2 className="w-8 h-8 animate-spin" /></div>}>
      <GroupCallWindowContent />
    </Suspense>
  );
}
