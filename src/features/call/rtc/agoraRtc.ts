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
 * Lifecycle:
 *  1. initialize()      — create the AgoraRTC client (once, lazy)
 *  2. joinChannel()      — join channel + create/publish local tracks
 *  3. muteMic / toggleCamera / switchCamera — in-call controls
 *  4. leaveChannel()     — unpublish + close tracks + leave channel
 *  5. destroy()          — full teardown (on logout / app exit)
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
}

// ── Internal state ──────────────────────────────────────────────────────────

type AgoraRTCTypes = typeof import("agora-rtc-sdk-ng").default;

let AgoraRTCLib: AgoraRTCTypes | null = null;
let client: IAgoraRTCClient | null = null;
let audioTrack: IMicrophoneAudioTrack | null = null;
let videoTrack: ICameraVideoTrack | null = null;

let _isJoined = false;
let _isJoining = false;
let _localUid: number | null = null;
let _isMicMuted = false;
let _isCameraEnabled = false;
let _isSpeakerOn = true;
let _isVideoCall = false;
let _connectionState = "DISCONNECTED";

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

    try {
      await c.subscribe(user, mediaType);
    } catch (err) {
      console.warn("[agoraRtc] subscribe failed:", err);
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

/** Reset all internal state to initial values (but keep client alive). */
function resetState(): void {
  _isJoined = false;
  _localUid = null;
  _isMicMuted = false;
  _isCameraEnabled = false;
  _isVideoCall = false;
  _remoteUsers.clear();
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

  if (_isJoining) {
    throw new Error("[agoraRtc] Join already in progress.");
  }
  if (_isJoined) {
    console.warn("[agoraRtc] Already joined — returning existing localUid.");
    return _localUid!;
  }

  _isJoining = true;
  try {
    _isVideoCall = enableVideo;

    // 1. Join channel
    const assignedUid: UID = await client!.join(appId, channel, token, uid);
    _localUid = assignedUid as number;
    _isJoined = true;

    // 2. Create local audio track
    audioTrack = await AgoraRTCLib!.createMicrophoneAudioTrack();
    _isMicMuted = false;

    const tracks: (IMicrophoneAudioTrack | ICameraVideoTrack)[] = [audioTrack];

    // 3. Create local video track (if video call)
    if (enableVideo) {
      videoTrack = await AgoraRTCLib!.createCameraVideoTrack();
      _isCameraEnabled = true;
      tracks.push(videoTrack);
    } else {
      _isCameraEnabled = false;
    }

    // 4. Publish local tracks
    await client!.publish(tracks);

    notify("onJoined", channel, _localUid);
    return _localUid;
  } catch (err) {
    // Clean up on failure
    await cleanupTracks();
    _isJoined = false;
    _localUid = null;
    _isJoining = false;
    throw err;
  } finally {
    _isJoining = false;
  }
}

/**
 * Leave the current channel, close local tracks, and reset state.
 * Safe to call even if not joined (no-op).
 */
export async function leaveChannel(): Promise<void> {
  await cleanupTracks();

  if (client && _isJoined) {
    try {
      await client.leave();
    } catch (err) {
      console.warn("[agoraRtc] client.leave() error:", err);
    }
  }

  const wasJoined = _isJoined;
  resetState();

  if (wasJoined) {
    notify("onLeft");
  }
}

/**
 * Mute or unmute the local microphone.
 * @param muted – true = muted, false = unmuted
 */
export function muteMic(muted: boolean): void {
  if (!audioTrack) return;
  audioTrack.setEnabled(!muted);
  _isMicMuted = muted;
}

/**
 * Toggle microphone mute state.
 * @returns New muted state (true = muted).
 */
export function toggleMic(): boolean {
  muteMic(!_isMicMuted);
  return _isMicMuted;
}

/**
 * Enable or disable the local camera.
 * @param enabled – true = camera on, false = camera off
 */
export function setCameraEnabled(enabled: boolean): void {
  if (!videoTrack) return;
  videoTrack.setEnabled(enabled);
  _isCameraEnabled = enabled;
}

/**
 * Toggle camera on/off.
 * @returns New enabled state (true = camera on).
 */
export function toggleCamera(): boolean {
  setCameraEnabled(!_isCameraEnabled);
  return _isCameraEnabled;
}

/**
 * Switch between front/rear cameras (mobile) or multiple webcams (desktop).
 * No-op if fewer than 2 video input devices are available.
 *
 * Uses `ICameraVideoTrack.setDevice()` internally.
 */
export async function switchCamera(): Promise<void> {
  if (!videoTrack || !AgoraRTCLib) return;

  try {
    // Try the facingMode toggle first (works well on mobile, v4.19.0+)
    const mediaTrack = videoTrack.getMediaStreamTrack();
    const settings = mediaTrack.getSettings();
    const currentFacingMode = settings.facingMode;

    if (currentFacingMode === "user" || currentFacingMode === "environment") {
      const target: "user" | "environment" =
        currentFacingMode === "user" ? "environment" : "user";
      await videoTrack.setDevice({ facingMode: target });
      return;
    }

    // Fallback: enumerate cameras and cycle through deviceIds (desktop multi-cam)
    const devices = await AgoraRTCLib.getCameras();
    if (devices.length < 2) return;

    const currentDeviceId = settings.deviceId ?? "";
    const currentIdx = devices.findIndex(
      (d) => d.deviceId === currentDeviceId,
    );
    const nextIdx = (currentIdx + 1) % devices.length;
    await videoTrack.setDevice(devices[nextIdx].deviceId);
  } catch (err) {
    console.warn("[agoraRtc] switchCamera failed:", err);
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
  if (_isJoined || _isJoining) {
    await leaveChannel();
  }

  if (client) {
    client.removeAllListeners();
    client = null;
  }

  AgoraRTCLib = null;
  _callbacks.clear();
  _connectionState = "DISCONNECTED";
}

// ── State getters ───────────────────────────────────────────────────────────

/** Whether the local user is currently in a channel. */
export function isJoined(): boolean {
  return _isJoined;
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

// ── Video playback helpers ──────────────────────────────────────────────────

/**
 * Play a remote user's video track inside a DOM element.
 * Call this from a React ref callback / useEffect when the video container
 * mounts.
 */
export function playRemoteVideo(uid: number, element: HTMLElement): void {
  if (!client) return;
  const remoteUser = client.remoteUsers.find((u) => u.uid === uid);
  remoteUser?.videoTrack?.play(element);
}

/** Stop rendering a remote user's video. */
export function stopRemoteVideo(uid: number): void {
  if (!client) return;
  const remoteUser = client.remoteUsers.find((u) => u.uid === uid);
  remoteUser?.videoTrack?.stop();
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

// ── Internal cleanup helper ─────────────────────────────────────────────────

async function cleanupTracks(): Promise<void> {
  if (audioTrack) {
    try {
      audioTrack.close();
    } catch {
      /* already closed */
    }
    audioTrack = null;
  }
  if (videoTrack) {
    try {
      videoTrack.close();
    } catch {
      /* already closed */
    }
    videoTrack = null;
  }
}
