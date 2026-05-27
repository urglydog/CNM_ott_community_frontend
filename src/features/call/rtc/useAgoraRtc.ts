/**
 * React hook wrapping the Agora RTC singleton (agoraRtc.ts).
 *
 * Exposes:
 *  - State:  isJoined, localUid, remoteUids, isMicMuted, isCameraEnabled,
 *            isSpeakerOn, connectionState
 *  - Actions: join, leave, toggleMic, toggleCamera, switchCamera,
 *            toggleSpeaker, renewToken, playRemoteVideo, stopRemoteVideo,
 *            playLocalVideo, stopLocalVideo
 *
 * Token rules:
 *  - join() accepts a TokenPayload received from backend ack/REST.
 *  - The token is forwarded directly to the Agora SDK — never stored by this hook.
 *
 * Notes:
 *  - Only ONE instance of this hook should be active at a time (single call).
 *  - The hook does NOT auto-leave on unmount — the caller must call leave()
 *    explicitly when the call ends. This is intentional so that navigating
 *    between components during a call doesn't disconnect.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import type { TokenPayload } from "../types";
import type { RtcCallbacks } from "./agoraRtc";
import * as rtc from "./agoraRtc";

// ── State shape ─────────────────────────────────────────────────────────────

export interface UseAgoraRtcState {
  /** Whether the local user is currently in an Agora channel. */
  isJoined: boolean;
  /** The numeric UID assigned by Agora, or null. */
  localUid: number | null;
  /** UIDs of all remote users currently in the channel. */
  remoteUids: number[];
  /** UIDs of remote users who have published video. */
  remoteVideoUids: number[];
  /** Whether the local microphone is muted. */
  isMicMuted: boolean;
  /** Whether the local camera is enabled. */
  isCameraEnabled: boolean;
  /** Whether speaker output is selected. */
  isSpeakerOn: boolean;
  /** Agora connection state string. */
  connectionState: string;
  /** Warning message when local camera/mic is unavailable, or null. */
  localMediaWarning: string | null;
  /** Whether the current device is mobile (Android/iOS/iPadOS). */
  isMobile: boolean;
}

// ── Actions shape ───────────────────────────────────────────────────────────

export interface UseAgoraRtcActions {
  /**
   * Join an Agora channel using a TokenPayload from the backend.
   * @param payload    – TokenPayload from call:start ack / call:accept ack / getCallToken()
   * @param enableVideo – true for video call, false for audio-only (default false)
   */
  join: (payload: TokenPayload, enableVideo?: boolean) => Promise<void>;

  /** Leave the current channel and clean up tracks. */
  leave: () => Promise<void>;

  /** Toggle mic mute. Returns the new muted state. Async because it may retry creating the audio track. */
  toggleMic: () => Promise<boolean>;

  /** Toggle camera on/off. Returns the new enabled state. May create a new video track asynchronously. */
  toggleCamera: () => Promise<boolean>;

  /** Switch to the next available camera (mobile flip / desktop multi-cam). */
  switchCamera: () => Promise<void>;

  /** Toggle speaker mode. Returns the new speaker state. */
  toggleSpeaker: () => boolean;

  /**
   * Renew the Agora token.
   * Call when onTokenWillExpire fires (via the integration layer).
   */
  renewToken: (token: string) => Promise<void>;

  /**
   * Render a remote user's video into a DOM element.
   * Typically called from a ref callback on the video container.
   */
  playRemoteVideo: (uid: number, element: HTMLElement) => void;

  /** Stop rendering a remote user's video. */
  stopRemoteVideo: (uid: number) => void;

  /** Render the local camera feed into a DOM element. */
  playLocalVideo: (element: HTMLElement) => void;

  /** Stop rendering the local camera feed. */
  stopLocalVideo: () => void;
}

/** Combined return type of the hook. */
export type UseAgoraRtcReturn = UseAgoraRtcState & UseAgoraRtcActions;

// ── Hook ────────────────────────────────────────────────────────────────────

export function useAgoraRtc(): UseAgoraRtcReturn {
  const [state, setState] = useState<UseAgoraRtcState>({
    isJoined: false,
    localUid: null,
    remoteUids: [],
    remoteVideoUids: [],
    isMicMuted: false,
    isCameraEnabled: false,
    isSpeakerOn: true,
    connectionState: "DISCONNECTED",
    localMediaWarning: null,
    isMobile: rtc.isMobileDevice(),
  });

  // ── Subscribe to singleton events ───────────────────────────────────────

  useEffect(() => {
    const callbacks: RtcCallbacks = {
      onJoined: (_channel, uid) => {
        const remoteUsers = rtc.getRemoteUsers();
        setState((prev) => ({
          ...prev,
          isJoined: true,
          localUid: uid,
          remoteUids: remoteUsers.map((u) => u.uid),
          remoteVideoUids: remoteUsers.filter((u) => u.hasVideo).map((u) => u.uid),
          isMicMuted: rtc.isMicMuted(),
          isCameraEnabled: rtc.isCameraEnabled(),
          isSpeakerOn: rtc.isSpeakerOn(),
          connectionState: rtc.getConnectionState(),
          localMediaWarning: rtc.getLocalMediaWarning(),
        }));
      },

      onLeft: () => {
        setState((prev) => ({
          ...prev,
          isJoined: false,
          localUid: null,
          remoteUids: [],
          remoteVideoUids: [],
          isMicMuted: false,
          isCameraEnabled: false,
          connectionState: "DISCONNECTED",
          localMediaWarning: null,
        }));
      },

      onLocalMediaWarning: (message) => {
        setState((prev) => ({ ...prev, localMediaWarning: message }));
      },

      onUserJoined: (uid) => {
        setState((prev) => ({
          ...prev,
          remoteUids: prev.remoteUids.includes(uid)
            ? prev.remoteUids
            : [...prev.remoteUids, uid],
        }));
      },

      onUserLeft: (uid) => {
        setState((prev) => ({
          ...prev,
          remoteUids: prev.remoteUids.filter((id) => id !== uid),
          remoteVideoUids: prev.remoteVideoUids.filter((id) => id !== uid),
        }));
      },

      onUserPublished: (uid, mediaType) => {
        if (mediaType === "video") {
          setState((prev) => ({
            ...prev,
            remoteVideoUids: prev.remoteVideoUids.includes(uid)
              ? prev.remoteVideoUids
              : [...prev.remoteVideoUids, uid],
          }));
        }
      },

      onUserUnpublished: (uid, mediaType) => {
        if (mediaType === "video") {
          setState((prev) => ({
            ...prev,
            remoteVideoUids: prev.remoteVideoUids.filter((id) => id !== uid),
          }));
        }
      },

      onConnectionStateChange: (curState) => {
        setState((prev) => ({ ...prev, connectionState: curState }));
      },
    };

    const unsubscribe = rtc.subscribe(callbacks);

    // Sync with current singleton state on mount (handles re-mount during active call)
    const currentRemoteUsers = rtc.getRemoteUsers();
    setState({
      isJoined: rtc.isJoined(),
      localUid: rtc.getLocalUid(),
      remoteUids: currentRemoteUsers.map((u) => u.uid),
      remoteVideoUids: currentRemoteUsers.filter((u) => u.hasVideo).map((u) => u.uid),
      isMicMuted: rtc.isMicMuted(),
      isCameraEnabled: rtc.isCameraEnabled(),
      isSpeakerOn: rtc.isSpeakerOn(),
      connectionState: rtc.getConnectionState(),
      localMediaWarning: rtc.getLocalMediaWarning(),
      isMobile: rtc.isMobileDevice(),
    });

    return unsubscribe;
  }, []);

  // ── Actions ─────────────────────────────────────────────────────────────

  const join = useCallback(
    async (payload: TokenPayload, enableVideo = false) => {
      await rtc.joinChannel(
        payload.appId,
        payload.channelName,
        payload.token,
        payload.uid,
        enableVideo,
      );
    },
    [],
  );

  const leave = useCallback(async () => {
    await rtc.leaveChannel();
  }, []);

  const toggleMic = useCallback(async () => {
    const newMuted = await rtc.toggleMic();
    setState((prev) => ({
      ...prev,
      isMicMuted: newMuted,
      localMediaWarning: rtc.getLocalMediaWarning(),
    }));
    return newMuted;
  }, []);

  const toggleCamera = useCallback(async () => {
    const newEnabled = await rtc.toggleCamera();
    setState((prev) => ({
      ...prev,
      isCameraEnabled: newEnabled,
      localMediaWarning: rtc.getLocalMediaWarning(),
    }));
    return newEnabled;
  }, []);

  const switchCamera = useCallback(async () => {
    await rtc.switchCamera();
  }, []);

  const toggleSpeaker = useCallback(() => {
    const newOn = rtc.toggleSpeaker();
    setState((prev) => ({ ...prev, isSpeakerOn: newOn }));
    return newOn;
  }, []);

  const renewToken = useCallback(async (token: string) => {
    await rtc.renewToken(token);
  }, []);

  const playRemoteVideo = useCallback(
    (uid: number, element: HTMLElement) => {
      rtc.playRemoteVideo(uid, element);
    },
    [],
  );

  const stopRemoteVideo = useCallback((uid: number) => {
    rtc.stopRemoteVideo(uid);
  }, []);

  const playLocalVideo = useCallback((element: HTMLElement) => {
    rtc.playLocalVideo(element);
  }, []);

  const stopLocalVideo = useCallback(() => {
    rtc.stopLocalVideo();
  }, []);

  return {
    // State
    isJoined: state.isJoined,
    localUid: state.localUid,
    remoteUids: state.remoteUids,
    remoteVideoUids: state.remoteVideoUids,
    isMicMuted: state.isMicMuted,
    isCameraEnabled: state.isCameraEnabled,
    isSpeakerOn: state.isSpeakerOn,
    connectionState: state.connectionState,
    localMediaWarning: state.localMediaWarning,
    isMobile: state.isMobile,
    // Actions
    join,
    leave,
    toggleMic,
    toggleCamera,
    switchCamera,
    toggleSpeaker,
    renewToken,
    playRemoteVideo,
    stopRemoteVideo,
    playLocalVideo,
    stopLocalVideo,
  };
}
