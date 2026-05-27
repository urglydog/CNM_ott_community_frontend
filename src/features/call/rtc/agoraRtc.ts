/**
 * Agora RTC singleton engine.
 * Wraps agora-rtc-sdk-ng for the call feature.
 *
 * Provider-specific — ALL Agora SDK interactions live here.
 * The rest of the call module (callStore, callSocket, callApi) is provider-neutral.
 *
 * Token rules:
 *  - Tokens are NEVER generated here. They come from backend ack/REST only.
 *  - Tokens are NEVER stored in localStorage/sessionStorage.
 *  - They are consumed immediately by joinChannel() / renewToken().
 *
 * Lifecycle (per Agora Web SDK docs):
 *  1. initialize()        — create the AgoraRTC client (once, lazy)
 *  2. joinChannel()        — join channel + create/publish local tracks
 *  3. muteMic / toggleCamera / switchCamera — in-call controls
 *  4. leaveChannel()       — unpublish → stop → close tracks → leave channel
 *  5. destroy()            — full teardown (on logout / app exit)
 *
 * Track lifecycle (Agora convention):
 *  createCameraVideoTrack / createMicrophoneAudioTrack
 *    → client.publish(tracks)
 *    → track.setEnabled(true/false) for mute/unmute
 *    → client.unpublish(tracks)     // MUST unpublish before leave
 *    → track.stop()                 // stop rendering
 *    → track.close()                // release device resources
 *
 * NOT_READABLE handling:
 *  If createCameraVideoTrack throws NOT_READABLE / DEVICE_IN_USE,
 *  we fallback to audio-only join and notify via onCameraFallback callback.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── SDK types (imported lazily to avoid SSR breakage) ───────────────────────

import type {
  IAgoraRTCClient,
  IMicrophoneAudioTrack,
  ICameraVideoTrack,
  UID,
} from "agora-rtc-sdk-ng";

// ── Exported types ──────────────────────────────────────────────────────────

/** Minimal representation of a remote user for UI consumption. */
export interface RtcRemoteUser {
  uid: number;
  hasAudio: boolean;
  hasVideo: boolean;
}

/** Callbacks that the React hook / integration layer can subscribe to. */
export interface RtcCallbacks {
  /** Fired after a successful join. */
  onJoined?: (channelName: string, uid: number) => void;
  /** Fired after leaveChannel() completes. */
  onLeft?: () => void;
  /** A remote user entered the channel. */
  onUserJoined?: (uid: number) => void;
  /** A remote user left the channel. */
  onUserLeft?: (uid: number) => void;
  /** A remote user published audio or video. */
  onUserPublished?: (uid: number, mediaType: "audio" | "video") => void;
  /** A remote user unpublished audio or video. */
  onUserUnpublished?: (uid: number, mediaType: "audio" | "video") => void;
  /** Agora connection state changed. */
  onConnectionStateChange?: (
    curState: string,
    revState: string,
    reason?: string,
  ) => void;
  /** Token will expire in ~30 s — caller should fetch a new one. */
  onTokenWillExpire?: () => void;
  /** Token has already expired — call was likely dropped. */
  onTokenDidExpire?: () => void;
  /** Network quality report (uplink / downlink 0-8). */
  onNetworkQuality?: (stats: {
    uplinkNetworkQuality: number;
    downlinkNetworkQuality: number;
  }) => void;
  /** An unhandled error occurred inside the SDK. */
  onError?: (error: Error) => void;
  /** Camera creation failed (NOT_READABLE / PERMISSION_DENIED) — camera unavailable. */
  onCameraFallback?: (reason: string) => void;
  /** Mic creation failed (PERMISSION_DENIED / NOT_READABLE) — mic unavailable. */
  onMicFallback?: (reason: string) => void;
  /** Local media warning — combined message for UI display when no camera/mic. */
  onLocalMediaWarning?: (message: string | null) => void;
}

// ── Internal state ──────────────────────────────────────────────────────────

type AgoraRTCTypes = typeof import("agora-rtc-sdk-ng").default;

/**
 * Strict connection state machine for the Agora client.
 * Prevents race conditions by ensuring all operations check state before acting.
 *
 * Transitions:
 *   idle → joining → joined → publishing → joined
 *   joined → leaving → idle
 *   joining → idle (on error)
 *   any → idle (on destroy)
 */
export type AgoraConnectionState = "idle" | "joining" | "joined" | "publishing" | "leaving" | "ended";

let AgoraRTCLib: AgoraRTCTypes | null = null;
let client: IAgoraRTCClient | null = null;
let audioTrack: IMicrophoneAudioTrack | null = null;
let videoTrack: ICameraVideoTrack | null = null;

let _isJoined = false;
let _isJoining = false;
let _isLeaving = false;
let _joinPromise: Promise<number> | null = null;
let _currentChannelName: string | null = null;
let _localUid: number | null = null;
let _isMicMuted = false;
let _isCameraEnabled = false;
let _isSpeakerOn = true;
let _isVideoCall = false;
let _connectionState = "DISCONNECTED";
let _localMediaWarning: string | null = null;
let _connState: AgoraConnectionState = "idle";

/** Incremented on each joinChannel() call. Used to abort stale async joins. */
let _currentJoinAttempt = 0;

/** uid → { hasAudio, hasVideo } */
const _remoteUsers = new Map<number, { hasAudio: boolean; hasVideo: boolean }>();

/** Registered callback sets for event fan-out. */
const _callbacks = new Set<RtcCallbacks>();

// ── Helpers ─────────────────────────────────────────────────────────────────

function notify<K extends keyof RtcCallbacks>(
  event: K,
  ...args: Parameters<NonNullable<RtcCallbacks[K]>>
): void {
  for (const cb of _callbacks) {
    try {
      const fn = cb[event] as ((...a: any[]) => void) | undefined;
      fn?.(...args);
    } catch (err) {
      console.error(`[agoraRtc] callback error (${event}):`, err);
    }
  }
}

function remoteUserArray(): RtcRemoteUser[] {
  const arr: RtcRemoteUser[] = [];
  _remoteUsers.forEach((info, uid) => arr.push({ uid, ...info }));
  return arr;
}

/**
 * Lazy-import the Agora SDK.
 * Using dynamic import so Next.js SSR never tries to resolve browser-only code
 * at build time.
 */
async function loadSDK(): Promise<AgoraRTCTypes> {
  if (AgoraRTCLib) return AgoraRTCLib;
  const mod = await import("agora-rtc-sdk-ng");
  AgoraRTCLib = mod.default ?? mod;
  return AgoraRTCLib;
}

/** Attach all event listeners to the underlying Agora client. */
function attachClientListeners(c: IAgoraRTCClient): void {
  c.on("connection-state-change" as any, (cur: string, rev: string, reason?: string) => {
    _connectionState = cur;
    notify("onConnectionStateChange", cur, rev, reason);
  });

  c.on("user-joined" as any, (user: any) => {
    const uid = user.uid as number;
    _remoteUsers.set(uid, { hasAudio: false, hasVideo: false });
    notify("onUserJoined", uid);
  });

  c.on("user-left" as any, (user: any) => {
    const uid = user.uid as number;
    _remoteUsers.delete(uid);
    notify("onUserLeft", uid);
  });

  c.on("user-published" as any, async (user: any, mediaType: "audio" | "video") => {
    const uid = user.uid as number;
    const info = _remoteUsers.get(uid);
    if (info) {
      if (mediaType === "audio") info.hasAudio = true;
      if (mediaType === "video") info.hasVideo = true;
    }

    console.log("[agora:event:user-published]", uid, mediaType, {
      hasVideoTrack: !!user.videoTrack,
      hasAudioTrack: !!user.audioTrack,
    });

    try {
      await c.subscribe(user, mediaType);
      console.log("[agora:subscribe:success]", uid, mediaType, {
        hasVideoTrack: !!user.videoTrack,
        hasAudioTrack: !!user.audioTrack,
      });
    } catch (err) {
      console.warn("[agora:subscribe:failed]", uid, mediaType, err);
    }

    // Auto-play remote audio
    if (mediaType === "audio") {
      user.audioTrack?.play();
    }

    notify("onUserPublished", uid, mediaType);
  });

  c.on("user-unpublished" as any, (user: any, mediaType: "audio" | "video") => {
    const uid = user.uid as number;
    const info = _remoteUsers.get(uid);
    if (info) {
      if (mediaType === "audio") info.hasAudio = false;
      if (mediaType === "video") info.hasVideo = false;
    }
    console.log("[agora:event:user-unpublished]", uid, mediaType);
    notify("onUserUnpublished", uid, mediaType);
  });

  c.on("token-privilege-will-expire" as any, () => {
    notify("onTokenWillExpire");
  });

  c.on("token-privilege-did-expire" as any, () => {
    notify("onTokenDidExpire");
  });

  c.on("network-quality" as any, (stats: any) => {
    notify("onNetworkQuality", {
      uplinkNetworkQuality: stats.uplinkNetworkQuality,
      downlinkNetworkQuality: stats.downlinkNetworkQuality,
    });
  });

  c.on("exception" as any, (event: any) => {
    console.warn("[agoraRtc] exception:", event);
  });
}

/**
 * Safely stop and close a local track, releasing device resources.
 * Per Agora docs: close() releases the audio/video resources and the
 * MediaStreamTrack — the browser camera indicator turns off.
 */
function closeTrackSafely(
  track: IMicrophoneAudioTrack | ICameraVideoTrack | null,
  label: string,
): void {
  if (!track) return;
  try {
    // stop() halts rendering/playback; close() releases the device
    track.stop();
  } catch {
    /* already stopped */
  }
  try {
    track.close();
  } catch {
    /* already closed */
  }
  console.log(`[agora:tracks:closed] ${label}`);
}

/** Clean up both local tracks (stop + close + null). Safe to call multiple times. */
function cleanupLocalTracks(): void {
  closeTrackSafely(audioTrack, "audio");
  audioTrack = null;
  _isMicMuted = false;

  closeTrackSafely(videoTrack, "video");
  videoTrack = null;
  _isCameraEnabled = false;
}

/**
 * Re-evaluate the local media warning based on current track availability.
 * Fires onLocalMediaWarning callback if the warning changes.
 *
 * Warning messages include actionable browser instructions per skill spec.
 */
function updateLocalMediaWarning(): void {
  const hasAudio = !!audioTrack;
  const hasVideo = !!videoTrack;
  const isVideoCall = _isVideoCall;

  const browserHint =
    "Trình duyệt đang chặn micro/camera. Chrome → icon ổ khóa cạnh URL → Site settings → Allow";

  let newWarning: string | null = null;

  if (!hasAudio && (!hasVideo && isVideoCall)) {
    newWarning = `Không truy cập được micro/camera. Bạn đang ở chế độ không âm thanh/hình ảnh. ${browserHint}`;
  } else if (!hasAudio) {
    newWarning = `Không truy cập được micro. Cuộc gọi sẽ không có âm thanh từ bạn. ${browserHint}`;
  } else if (!hasVideo && isVideoCall) {
    newWarning = `Không truy cập được camera. Cuộc gọi sẽ chỉ có âm thanh. ${browserHint}`;
  }

  if (newWarning !== _localMediaWarning) {
    _localMediaWarning = newWarning;
    notify("onLocalMediaWarning", newWarning);
  }
}

/** Reset all internal state to initial values (but keep client alive). */
function resetState(): void {
  _isJoined = false;
  _isJoining = false;
  _isLeaving = false;
  _joinPromise = null;
  _currentChannelName = null;
  _localUid = null;
  _isMicMuted = false;
  _isCameraEnabled = false;
  _isVideoCall = false;
  _localMediaWarning = null;
  _connState = "idle";
  _remoteUsers.clear();
}

/**
 * Check if an error is a recoverable media-device error (permission denied,
 * device in use, etc.) that should not crash the call.
 */
function isRecoverableMediaError(err: any): boolean {
  const code = String(err?.code || "");
  const msg = String(err?.message || err);
  const name = String(err?.name || "");
  return (
    code.includes("PERMISSION_DENIED") ||
    code.includes("NOT_READABLE") ||
    name === "NotAllowedError" ||
    name === "NotReadableError" ||
    name === "NotFoundError" ||
    msg.includes("PERMISSION_DENIED") ||
    msg.includes("NOT_READABLE") ||
    msg.includes("NotAllowedError") ||
    msg.includes("NotReadableError") ||
    msg.includes("Permission denied") ||
    msg.includes("Device in use")
  );
}

/**
 * Pre-flight permission check using navigator.mediaDevices.getUserMedia().
 * Triggers the browser permission prompt. If granted, immediately stops
 * temp tracks to release the device, then returns true.
 * If denied/unavailable, logs and returns false.
 */
async function preflightMediaPermission(
  constraints: MediaStreamConstraints,
  label: string,
): Promise<boolean> {
  try {
    console.log(`[agora:permission:${label}] Requesting browser permission...`);
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    // Permission granted — release temp tracks immediately
    stream.getTracks().forEach((t) => t.stop());
    console.log(`[agora:permission:${label}] Permission granted`);
    return true;
  } catch (err: any) {
    const name = String(err?.name || "");
    const msg = String(err?.message || err);
    console.warn(`[agora:permission:${label}] Permission check failed: ${name} — ${msg}`);
    return false;
  }
}

/**
 * Query the Permissions API for the current state of a media permission.
 * Returns "granted" | "prompt" | "denied" | "unknown".
 * Useful for showing actionable UI when permission is blocked.
 */
async function queryPermissionStatus(
  name: "camera" | "microphone",
): Promise<string> {
  try {
    if (navigator.permissions?.query) {
      const status = await navigator.permissions.query({ name } as any);
      return status.state; // "granted" | "prompt" | "denied"
    }
  } catch {
    // Permissions API not supported for this type — fallback
  }
  return "unknown";
}

/**
 * Create a camera video track with graceful fallback.
 *
 * Flow:
 * 1. Pre-flight: navigator.mediaDevices.getUserMedia({ video: true })
 * 2. If pre-flight fails → log [agora:permission:camera], return null
 * 3. Pre-flight succeeded → stop temp tracks → Agora createCameraVideoTrack()
 * 4. If Agora create fails → log [agora:track:video-unavailable], return null
 * 5. Never throws — always returns track | null
 */
async function createVideoTrackSafe(): Promise<ICameraVideoTrack | null> {
  if (!AgoraRTCLib) return null;

  // 1. Pre-flight permission check
  const ok = await preflightMediaPermission({ video: true }, "camera");
  if (!ok) {
    const permStatus = await queryPermissionStatus("camera");
    const hint =
      permStatus === "denied"
        ? "Trình duyệt đang chặn camera. Chrome → icon ổ khóa cạnh URL → Site settings → Allow"
        : "Camera không khả dụng";
    console.warn(`[agora:track:video-unavailable] ${hint} (permission status: ${permStatus})`);
    notify("onCameraFallback", hint);
    return null;
  }

  // 2. Agora SDK create
  try {
    console.log("[agora:track:create-video] requesting camera via Agora SDK...");
    const track = await AgoraRTCLib.createCameraVideoTrack();
    console.log("[agora:track:create-video] camera acquired successfully");
    return track;
  } catch (err: any) {
    const msg = String(err?.message || err);
    const code = String(err?.code || "");
    console.warn(
      `[agora:track:video-unavailable] Camera unavailable (code=${code}): ${msg}`,
    );
    notify("onCameraFallback", msg);
    return null;
  }
}

/**
 * Create a microphone audio track with graceful fallback.
 *
 * Flow:
 * 1. Pre-flight: navigator.mediaDevices.getUserMedia({ audio: true })
 * 2. If pre-flight fails → log [agora:permission:mic], return null
 * 3. Pre-flight succeeded → stop temp tracks → Agora createMicrophoneAudioTrack()
 * 4. If Agora create fails → log [agora:track:audio-unavailable], return null
 * 5. Never throws — always returns track | null
 */
async function createAudioTrackSafe(): Promise<IMicrophoneAudioTrack | null> {
  if (!AgoraRTCLib) return null;

  // 1. Pre-flight permission check
  const ok = await preflightMediaPermission({ audio: true }, "mic");
  if (!ok) {
    const permStatus = await queryPermissionStatus("microphone");
    const hint =
      permStatus === "denied"
        ? "Trình duyệt đang chặn micro. Chrome → icon ổ khóa cạnh URL → Site settings → Allow"
        : "Micro không khả dụng";
    console.warn(`[agora:track:audio-unavailable] ${hint} (permission status: ${permStatus})`);
    notify("onMicFallback", hint);
    return null;
  }

  // 2. Agora SDK create
  try {
    console.log("[agora:track:create-audio] requesting microphone via Agora SDK...");
    const track = await AgoraRTCLib.createMicrophoneAudioTrack();
    console.log("[agora:track:create-audio] microphone acquired successfully");
    return track;
  } catch (err: any) {
    const msg = String(err?.message || err);
    const code = String(err?.code || "");
    console.warn(
      `[agora:track:audio-unavailable] Microphone unavailable (code=${code}): ${msg}`,
    );
    notify("onMicFallback", msg);
    return null;
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Initialize the Agora RTC client.
 * Safe to call multiple times (idempotent).
 * Automatically called by joinChannel() if not yet initialized.
 */
export async function initialize(): Promise<void> {
  if (client) return;

  const sdk = await loadSDK();
  client = sdk.createClient({ mode: "rtc", codec: "vp8" });
  attachClientListeners(client);
  _connectionState = client.connectionState as string;
}

/**
 * Join an Agora channel and publish local media tracks.
 *
 * **Idempotent**: if already joining the same channel, returns the existing
 * promise. If already joined the same channel, returns the existing UID.
 * If joining a different channel, leaves the old one first.
 *
 * **NOT_READABLE handling**: if createCameraVideoTrack fails with NOT_READABLE
 * (device in use by another app/tab), falls back to audio-only join and fires
 * `onCameraFallback` callback. The call continues without video.
 *
 * @param appId      – Agora App ID (from TokenPayload)
 * @param channel    – Channel name (from TokenPayload)
 * @param token      – Ephemeral token (from TokenPayload)
 * @param uid        – Numeric UID (from TokenPayload)
 * @param enableVideo – Whether to capture & publish camera (default: false)
 * @returns The local UID actually assigned by Agora (may differ from requested).
 */
export async function joinChannel(
  appId: string,
  channel: string,
  token: string,
  uid: number,
  enableVideo = false,
): Promise<number> {
  // Auto-initialize if needed
  if (!client) {
    await initialize();
  }

  // ── Idempotency guards ───────────────────────────────────────────────────

  // Already joined this exact channel — return existing UID
  if (_isJoined && _currentChannelName === channel && _connState === "joined") {
    console.log(
      `[agora:join:skip-already-joined] channel=${channel} localUid=${_localUid}`,
    );
    return _localUid!;
  }

  // Already joining this exact channel — return existing promise (StrictMode safe)
  if (_isJoining && _currentChannelName === channel && _joinPromise) {
    console.log(
      `[agora:join:skip-already-joining] channel=${channel}`,
    );
    return _joinPromise;
  }

  // Currently leaving — cannot join until leave completes
  if (_isLeaving) {
    console.warn(
      `[agora:join:blocked-leaving] Cannot join while leaving channel. Waiting...`,
    );
    // Wait for leave to finish (poll with small delay)
    for (let i = 0; i < 50 && _isLeaving; i++) {
      await new Promise((r) => setTimeout(r, 100));
    }
    if (_isLeaving) {
      console.error("[agora:join:blocked-leaving] Leave still in progress after 5s — aborting join");
      throw new Error("Cannot join: leave operation still in progress");
    }
  }

  // Joining a different channel — must leave the old one first
  if (_isJoined && _currentChannelName !== channel) {
    console.log(
      `[agora:join] Leaving old channel ${_currentChannelName} before joining ${channel}`,
    );
    await leaveChannel();
  }

  // ── Start join (with joinAttemptId for stale-join abort) ─────────────────

  const joinAttemptId = ++_currentJoinAttempt;
  console.log(
    `[agora:join:start] channel=${channel} uid=${uid} video=${enableVideo} attemptId=${joinAttemptId}`,
  );
  _isJoining = true;
  _connState = "joining";
  _currentChannelName = channel;

  _joinPromise = (async (): Promise<number> => {
    try {
      _isVideoCall = enableVideo;
      _localMediaWarning = null;
      let audioUnavailable = false;
      let videoUnavailable = false;

      // 1. Join channel (only this step can throw fatally)
      const assignedUid: UID = await client!.join(appId, channel, token, uid);

      // ── Abort check: if a newer join started or we're leaving, abort this stale join
      if (joinAttemptId !== _currentJoinAttempt) {
        console.warn(`[agora:join:stale-aborted] attemptId=${joinAttemptId} current=${_currentJoinAttempt} — aborting stale join`);
        // Leave the channel we just joined since we're stale
        try { await client!.leave(); } catch { /* best-effort */ }
        throw new Error("Stale join aborted");
      }

      // ── Abort check: if leaving started while we were joining
      if (_isLeaving) {
        console.warn(`[agora:join:stale-aborted] leaving in progress — aborting join attemptId=${joinAttemptId}`);
        try { await client!.leave(); } catch { /* best-effort */ }
        throw new Error("Join aborted: leave in progress");
      }

      _localUid = assignedUid as number;
      _isJoined = true;
      _connState = "joined";
      console.log(`[agora:join:success] channel=${channel} uid=${_localUid} attemptId=${joinAttemptId}`);

      // 2. Create local audio track (safe — never throws)
      audioTrack = await createAudioTrackSafe();
      if (audioTrack) {
        _isMicMuted = false;
      } else {
        _isMicMuted = true;
        audioUnavailable = true;
      }

      const tracks: (IMicrophoneAudioTrack | ICameraVideoTrack)[] = [];
      if (audioTrack) tracks.push(audioTrack);

      // 3. Create local video track (if video call — safe, never throws)
      if (enableVideo) {
        const vt = await createVideoTrackSafe();
        if (vt) {
          videoTrack = vt;
          _isCameraEnabled = true;
          tracks.push(videoTrack);
        } else {
          _isCameraEnabled = false;
          videoUnavailable = true;
        }
      } else {
        _isCameraEnabled = false;
      }

      // 4. Publish local tracks — with stale-join guard
      if (tracks.length > 0) {
        // ── Guard: abort if this join is stale or we're no longer joined
        if (joinAttemptId !== _currentJoinAttempt) {
          console.warn(`[agora:publish:skip-not-joined] Stale join attemptId=${joinAttemptId} — skipping publish`);
          cleanupLocalTracks();
          throw new Error("Stale join: publish skipped");
        }
        if (!_isJoined || _isLeaving) {
          console.warn(`[agora:publish:skip-not-joined] _isJoined=${_isJoined} _isLeaving=${_isLeaving} — skipping publish`);
          cleanupLocalTracks();
          throw new Error("Not joined or leaving: publish skipped");
        }

        _connState = "publishing";
        console.log(`[agora:publish:start] Publishing ${tracks.length} track(s)`);
        try {
          await client!.publish(tracks);
          console.log(`[agora:publish:success] ${tracks.length} track(s) published`);
        } catch (pubErr: any) {
          // Gracefully handle INVALID_OPERATION (race condition)
          const errMsg = String(pubErr?.message || pubErr);
          if (errMsg.includes("INVALID_OPERATION") || errMsg.includes("haven't joined")) {
            console.warn(`[agora:publish:ignored-race] ${errMsg}`);
            cleanupLocalTracks();
            throw new Error("Publish race condition — call likely ended");
          }
          throw pubErr;
        }
        _connState = "joined";
      } else {
        console.log("[agora:publish:skip-empty] No local tracks to publish — observer mode");
      }

      // 5. Build local media warning message
      if (audioUnavailable && videoUnavailable) {
        _localMediaWarning =
          "Không truy cập được micro/camera. Bạn đang tham gia cuộc gọi ở chế độ không âm thanh/hình ảnh.";
        console.log("[agora:join:no-local-media] Both audio and video unavailable — observer mode");
      } else if (audioUnavailable) {
        _localMediaWarning =
          "Không truy cập được micro. Cuộc gọi sẽ không có âm thanh từ bạn.";
        console.log("[agora:join:no-local-media] Audio unavailable — video-only mode");
      } else if (videoUnavailable) {
        _localMediaWarning =
          "Không truy cập được camera. Cuộc gọi sẽ chỉ có âm thanh.";
        console.log("[agora:join:fallback-audio-only] Video unavailable — proceeding audio-only");
      }

      if (_localMediaWarning) {
        notify("onLocalMediaWarning", _localMediaWarning);
      }

      notify("onJoined", channel, _localUid);
      return _localUid;
    } catch (err) {
      // Only fatal errors reach here (appId/token/channel/network/stale)
      console.error(`[agora:join:error] Join failed (attemptId=${joinAttemptId}):`, err);
      cleanupLocalTracks();
      _isJoined = false;
      _localUid = null;
      _connState = "idle";
      throw err;
    } finally {
      // Only clear joining state if this is still the current attempt
      if (joinAttemptId === _currentJoinAttempt) {
        _isJoining = false;
        _joinPromise = null;
      }
    }
  })();

  return _joinPromise;
}

/**
 * Leave the current channel, close local tracks, and reset state.
 * Safe to call even if not joined (no-op).
 *
 * Order (per Agora docs):
 *  1. Unpublish local tracks
 *  2. Stop + close local tracks (releases device)
 *  3. client.leave()
 *  4. Reset state
 */
export async function leaveChannel(): Promise<void> {
  // ── Set leaving flags IMMEDIATELY (synchronously) to prevent race conditions ──
  //  Any concurrent join/publish checks _isJoined and _isLeaving synchronously,
  //  so setting these BEFORE any await is critical.
  const wasJoined = _isJoined;
  _isJoined = false;
  _isLeaving = true;
  _connState = "leaving";
  _isJoining = false;
  _joinPromise = null;

  // Abort any in-progress stale join by bumping the join attempt counter
  _currentJoinAttempt++;

  console.log(`[agora:leave:start] wasJoined=${wasJoined} channel=${_currentChannelName}`);

  // 1. Unpublish local tracks if was previously joined
  if (client && wasJoined) {
    const tracksToUnpublish: (IMicrophoneAudioTrack | ICameraVideoTrack)[] = [];
    if (audioTrack) tracksToUnpublish.push(audioTrack);
    if (videoTrack) tracksToUnpublish.push(videoTrack);

    if (tracksToUnpublish.length > 0) {
      try {
        console.log(`[agora:unpublish] Unpublishing ${tracksToUnpublish.length} track(s)`);
        await client.unpublish(tracksToUnpublish);
      } catch (err) {
        console.warn("[agora:publish:ignored-race] client.unpublish() error:", err);
      }
    }
  }

  // 2. Stop + close local tracks (releases camera/mic device)
  cleanupLocalTracks();

  // 3. Leave channel
  if (client && wasJoined) {
    try {
      await client.leave();
    } catch (err) {
      console.warn("[agora:publish:ignored-race] client.leave() error:", err);
    }
  }

  resetState();

  if (wasJoined) {
    notify("onLeft");
  }

  console.log("[agora:leave:done]");
}

/**
 * Mute or unmute the local microphone.
 * Uses setEnabled() — does NOT recreate the track.
 * No-op if audioTrack is null (mic was unavailable at join time).
 * @param muted – true = muted, false = unmuted
 */
export function muteMic(muted: boolean): void {
  if (!audioTrack) return;
  audioTrack.setEnabled(!muted);
  _isMicMuted = muted;
}

/**
 * Enable or disable the local microphone.
 *
 * **Safe toggle**: if audioTrack exists, uses setEnabled().
 * If audioTrack is null (e.g., permission denied at join), attempts to create a
 * new mic track and publish it. If PERMISSION_DENIED / NOT_READABLE, keeps mic off
 * and fires onMicFallback — no crash.
 *
 * @param enabled – true = mic on, false = mic off
 */
export async function setMicEnabled(enabled: boolean): Promise<void> {
  if (enabled) {
    // Turning mic ON
    if (audioTrack) {
      audioTrack.setEnabled(true);
      _isMicMuted = false;
    } else if (client && _isJoined && !_isLeaving && AgoraRTCLib) {
      // No audio track — try to create one
      const at = await createAudioTrackSafe();
      if (at) {
        audioTrack = at;
        // Guard: re-check joined state after async track creation
        if (!_isJoined || _isLeaving) {
          console.warn("[agora:publish:skip-not-joined] Leaving during mic track creation — aborting publish");
          closeTrackSafely(audioTrack, "audio (aborted)");
          audioTrack = null;
          _isMicMuted = true;
          updateLocalMediaWarning();
          return;
        }
        try {
          await client.publish(audioTrack);
          console.log("[agora:publish:success] Published new audio track after mic toggle");
        } catch (err: any) {
          const errMsg = String(err?.message || err);
          if (errMsg.includes("INVALID_OPERATION") || errMsg.includes("haven't joined")) {
            console.warn(`[agora:publish:ignored-race] ${errMsg}`);
          } else {
            console.warn("[agora:publish:ignored-race] Failed to publish audio track:", err);
          }
          closeTrackSafely(audioTrack, "audio (publish failed)");
          audioTrack = null;
          _isMicMuted = true;
          updateLocalMediaWarning();
          return;
        }
        _isMicMuted = false;
      } else {
        // Mic still unavailable
        _isMicMuted = true;
      }
    }
  } else {
    // Turning mic OFF — use setEnabled(false) for fast toggle, don't close
    if (audioTrack) {
      audioTrack.setEnabled(false);
    }
    _isMicMuted = true;
  }
  updateLocalMediaWarning();
}

/**
 * Toggle microphone mute state.
 * Async because setMicEnabled may need to create a new audio track
 * (e.g., after permission-denied join or mic recovery).
 * @returns New muted state (true = muted).
 */
export async function toggleMic(): Promise<boolean> {
  await setMicEnabled(_isMicMuted); // if muted → enable; if unmuted → disable
  return _isMicMuted;
}

/**
 * Enable or disable the local camera.
 *
 * **Safe toggle**: if videoTrack exists, uses setEnabled().
 * If videoTrack is null (e.g., audio-only join), attempts to create a new
 * camera track and publish it. If NOT_READABLE, keeps camera off and
 * fires onCameraFallback.
 *
 * @param enabled – true = camera on, false = camera off
 */
export async function setCameraEnabled(enabled: boolean): Promise<void> {
  if (enabled) {
    // Turning camera ON
    if (videoTrack) {
      videoTrack.setEnabled(true);
      _isCameraEnabled = true;
    } else if (client && _isJoined && !_isLeaving && AgoraRTCLib) {
      // No video track — create one
      const vt = await createVideoTrackSafe();
      if (vt) {
        videoTrack = vt;
        // Guard: re-check joined state after async track creation
        if (!_isJoined || _isLeaving) {
          console.warn("[agora:publish:skip-not-joined] Leaving during camera track creation — aborting publish");
          closeTrackSafely(videoTrack, "video (aborted)");
          videoTrack = null;
          _isCameraEnabled = false;
          updateLocalMediaWarning();
          return;
        }
        try {
          await client.publish(videoTrack);
          console.log("[agora:publish:success] Published new video track after camera toggle");
        } catch (err: any) {
          const errMsg = String(err?.message || err);
          if (errMsg.includes("INVALID_OPERATION") || errMsg.includes("haven't joined")) {
            console.warn(`[agora:publish:ignored-race] ${errMsg}`);
          } else {
            console.warn("[agora:publish:ignored-race] Failed to publish video track:", err);
          }
          closeTrackSafely(videoTrack, "video (publish failed)");
          videoTrack = null;
          _isCameraEnabled = false;
          updateLocalMediaWarning();
          return;
        }
        _isCameraEnabled = true;
      } else {
        // Camera still unavailable
        _isCameraEnabled = false;
      }
    }
  } else {
    // Turning camera OFF — use setEnabled(false) for fast toggle, don't close
    if (videoTrack) {
      videoTrack.setEnabled(false);
    }
    _isCameraEnabled = false;
  }
  updateLocalMediaWarning();
}

/**
 * Toggle camera on/off.
 * Async because setCameraEnabled may need to create a new video track
 * (e.g., after audio-only join or camera recovery).
 * @returns New enabled state (true = camera on).
 */
export async function toggleCamera(): Promise<boolean> {
  await setCameraEnabled(!_isCameraEnabled);
  return _isCameraEnabled;
}

/**
 * Switch between front/rear cameras (mobile) or multiple webcams (desktop).
 * No-op if fewer than 2 video input devices are available.
 *
 * Uses `ICameraVideoTrack.setDevice()` internally.
 */
/**
 * Detect mobile devices (Android, iOS, iPad).
 * Uses userAgent + maxTouchPoints for reliable detection including iPadOS.
 */
export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return (
    /Android|iPhone|iPad|iPod/i.test(ua) ||
    (navigator.maxTouchPoints > 0 && /Macintosh/i.test(ua)) // iPadOS 13+
  );
}

/**
 * Switch between cameras.
 *
 * **Desktop:** cycles through available camera deviceIds (no facingMode —
 * desktop has no front/back model). If only one camera, no-op.
 *
 * **Mobile:** uses facingMode toggle first ("user" ↔ "environment"),
 * falls back to deviceId cycling if facingMode is not reported by the device.
 */
export async function switchCamera(): Promise<void> {
  if (!videoTrack || !AgoraRTCLib) return;

  const isMobile = isMobileDevice();

  // On desktop, skip facingMode entirely — use deviceId cycling
  if (!isMobile) {
    console.log("[agora:camera:flip-disabled-desktop] Using deviceId cycling instead of facingMode");
    try {
      const devices = await AgoraRTCLib.getCameras();
      if (devices.length < 2) {
        console.log("[agora:camera:switch-by-device-id] Only one camera found, no-op");
        return;
      }
      const mediaTrack = videoTrack.getMediaStreamTrack();
      const currentDeviceId = mediaTrack.getSettings().deviceId ?? "";
      const currentIdx = devices.findIndex((d) => d.deviceId === currentDeviceId);
      const nextIdx = (currentIdx + 1) % devices.length;
      console.log("[agora:camera:switch-by-device-id] Switching to:", devices[nextIdx].label);
      await videoTrack.setDevice(devices[nextIdx].deviceId);
    } catch (err) {
      console.warn("[agoraRtc] switchCamera (desktop) failed:", err);
    }
    return;
  }

  // Mobile: try facingMode toggle first, then fall back to deviceId
  try {
    const mediaTrack = videoTrack.getMediaStreamTrack();
    const settings = mediaTrack.getSettings();
    const currentFacingMode = settings.facingMode;

    if (currentFacingMode === "user" || currentFacingMode === "environment") {
      console.log("[agora:camera:facing-mode-mobile-only] Switching facingMode:", currentFacingMode, "→", currentFacingMode === "user" ? "environment" : "user");
      const target: "user" | "environment" =
        currentFacingMode === "user" ? "environment" : "user";
      await videoTrack.setDevice({ facingMode: target });
      return;
    }

    // facingMode not reported — fallback to deviceId cycling
    console.log("[agora:camera:facing-mode-mobile-only] facingMode not available, falling back to deviceId cycling");
    const devices = await AgoraRTCLib.getCameras();
    if (devices.length < 2) return;

    const currentDeviceId = settings.deviceId ?? "";
    const currentIdx = devices.findIndex(
      (d) => d.deviceId === currentDeviceId,
    );
    const nextIdx = (currentIdx + 1) % devices.length;
    await videoTrack.setDevice(devices[nextIdx].deviceId);
  } catch (err) {
    console.warn("[agoraRtc] switchCamera (mobile) failed:", err);
  }
}

/**
 * Set speaker/earpiece mode.
 * On web this is effectively a no-op — audio always plays through the default
 * output device. State is tracked for UI consistency.
 * @param on – true = speaker, false = earpiece (best-effort)
 */
export function setSpeakerphone(on: boolean): void {
  _isSpeakerOn = on;
}

/**
 * Toggle speaker mode.
 * @returns New speaker state (true = speaker on).
 */
export function toggleSpeaker(): boolean {
  setSpeakerphone(!_isSpeakerOn);
  return _isSpeakerOn;
}

/**
 * Renew the Agora token.
 * Call this when `onTokenWillExpire` fires.
 * @param newToken – Fresh token from backend (getCallToken).
 */
export async function renewToken(newToken: string): Promise<void> {
  if (!client) {
    throw new Error("[agoraRtc] Not initialized.");
  }
  await client.renewToken(newToken);
}

/**
 * Full teardown: leave channel, close tracks, remove all listeners, null out
 * the client. Call on logout or when the call feature is permanently unmounted.
 */
export async function destroy(): Promise<void> {
  if (_isJoined || _isJoining || _isLeaving) {
    await leaveChannel();
  }

  if (client) {
    client.removeAllListeners();
    client = null;
  }

  AgoraRTCLib = null;
  _callbacks.clear();
  _connectionState = "DISCONNECTED";
  _connState = "ended";
}

// ── State getters ───────────────────────────────────────────────────────────

/** Whether the local user is currently in a channel. */
export function isJoined(): boolean {
  return _isJoined && !_isLeaving;
}

/** Whether the client is currently in the process of leaving. */
export function isLeaving(): boolean {
  return _isLeaving;
}

/** The strict connection state machine value. */
export function getConnectionStateMachine(): AgoraConnectionState {
  return _connState;
}

/** The numeric UID assigned by Agora, or null if not joined. */
export function getLocalUid(): number | null {
  return _localUid;
}

/** Snapshot of all remote users currently in the channel. */
export function getRemoteUsers(): RtcRemoteUser[] {
  return remoteUserArray();
}

/** Whether the local mic is muted. */
export function isMicMuted(): boolean {
  return _isMicMuted;
}

/** Whether the local camera is enabled. */
export function isCameraEnabled(): boolean {
  return _isCameraEnabled;
}

/** Whether speaker output is selected. */
export function isSpeakerOn(): boolean {
  return _isSpeakerOn;
}

/** Current Agora connection state string. */
export function getConnectionState(): string {
  return _connectionState;
}

/** Current local media warning message, or null if all media is available. */
export function getLocalMediaWarning(): string | null {
  return _localMediaWarning;
}

// ── Video playback helpers ──────────────────────────────────────────────────

/**
 * Play a remote user's video track inside a DOM element.
 * Call this from a React ref callback / useEffect when the video container
 * mounts.
 */
export function playRemoteVideo(uid: number, element: HTMLElement): void {
  if (!client) {
    console.warn("[agora:playRemoteVideo] No client, skipping uid:", uid);
    return;
  }
  const remoteUser = client.remoteUsers.find((u) => u.uid === uid);
  if (!remoteUser) {
    console.warn("[agora:playRemoteVideo] Remote user not found, uid:", uid);
    return;
  }
  if (!remoteUser.videoTrack) {
    console.warn("[agora:playRemoteVideo] No videoTrack for uid:", uid, "hasVideo:", remoteUser.hasVideo);
    return;
  }
  console.log("[agora:playRemoteVideo] Playing video for uid:", uid, "into element:", element.tagName);
  remoteUser.videoTrack.play(element);
}

/** Stop rendering a remote user's video. */
export function stopRemoteVideo(uid: number): void {
  if (!client) return;
  const remoteUser = client.remoteUsers.find((u) => u.uid === uid);
  if (remoteUser?.videoTrack) {
    console.log("[agora:stopRemoteVideo] Stopping video for uid:", uid);
    remoteUser.videoTrack.stop();
  }
}

/** Play the local camera feed inside a DOM element. */
export function playLocalVideo(element: HTMLElement): void {
  videoTrack?.play(element);
}

/** Stop rendering the local camera feed. */
export function stopLocalVideo(): void {
  videoTrack?.stop();
}

// ── Event subscription ──────────────────────────────────────────────────────

/**
 * Subscribe to RTC lifecycle events.
 * @returns Unsubscribe function.
 */
export function subscribe(callbacks: RtcCallbacks): () => void {
  _callbacks.add(callbacks);
  return () => {
    _callbacks.delete(callbacks);
  };
}

// ── Low-level accessors (for advanced / escape-hatch usage) ─────────────────

/** The underlying IAgoraRTCClient, or null. */
export function getClient(): IAgoraRTCClient | null {
  return client;
}

/** The local microphone track, or null. */
export function getLocalAudioTrack(): IMicrophoneAudioTrack | null {
  return audioTrack;
}

/** The local camera track, or null. */
export function getLocalVideoTrack(): ICameraVideoTrack | null {
  return videoTrack;
}
