/**
 * Multi-user Agora RTC hook for group calls.
 *
 * ⚠️ DOES NOT touch the direct-call singleton (agoraRtc.ts / useAgoraRtc.ts).
 * Creates and manages its OWN IAgoraRTCClient instance dedicated to group channels.
 *
 * Design:
 *  - One client per group call (created on join, destroyed on leave)
 *  - Subscribes to user-published / user-unpublished / user-left events
 *  - Maintains remoteParticipants Map in groupCallStore with actual track references
 *  - Auto-plays remote audio on subscribe
 *  - Provides local media controls (mic, camera, speaker)
 *
 * Track lifecycle (Agora convention):
 *  subscribe → track received → store reference → UI renders
 *  user-unpublished → nullify track in store
 *  user-left → remove participant from store
 *  leave → unpublish local → close local tracks → client.leave() → destroy client
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type {
  IAgoraRTCClient,
  IMicrophoneAudioTrack,
  ICameraVideoTrack,
  UID,
} from "agora-rtc-sdk-ng";
import { useGroupCallStore, type GroupCallCredentials } from "./groupCallStore";
import type { RemoteParticipant } from "./groupCallTypes";

// ── Types ───────────────────────────────────────────────────────────────────

export interface UseGroupAgoraRtcState {
  isJoined: boolean;
  localUid: number | null;
  isMicMuted: boolean;
  isCameraEnabled: boolean;
  isSpeakerOn: boolean;
  connectionState: string;
  localMediaWarning: string | null;
}

export interface UseGroupAgoraRtcActions {
  join: (creds: GroupCallCredentials, enableVideo?: boolean) => Promise<void>;
  leave: () => Promise<void>;
  toggleMic: () => Promise<boolean>;
  toggleCamera: () => Promise<boolean>;
  toggleSpeaker: () => boolean;
  renewToken: (token: string) => Promise<void>;
  playRemoteVideo: (uid: number, element: HTMLElement) => void;
  stopRemoteVideo: (uid: number) => void;
  playLocalVideo: (element: HTMLElement) => void;
  stopLocalVideo: () => void;
}

export type UseGroupAgoraRtcReturn = UseGroupAgoraRtcState & UseGroupAgoraRtcActions;

// ── Hook ────────────────────────────────────────────────────────────────────

export function useGroupAgoraRtc(): UseGroupAgoraRtcReturn {
  // ── Refs (not reactive, used for cleanup and async guards) ──────────────
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const audioTrackRef = useRef<IMicrophoneAudioTrack | null>(null);
  const videoTrackRef = useRef<ICameraVideoTrack | null>(null);
  const joinAttemptRef = useRef(0);
  const isLeavingRef = useRef(false);

  // ── Local state ────────────────────────────────────────────────────────
  const [state, setState] = useState<UseGroupAgoraRtcState>({
    isJoined: false,
    localUid: null,
    isMicMuted: false,
    isCameraEnabled: false,
    isSpeakerOn: true,
    connectionState: "DISCONNECTED",
    localMediaWarning: null,
  });

  // ── Store actions (stable references) ──────────────────────────────────
  const addRemoteParticipant = useGroupCallStore((s) => s.addRemoteParticipant);
  const updateRemoteParticipant = useGroupCallStore((s) => s.updateRemoteParticipant);
  const removeRemoteParticipant = useGroupCallStore((s) => s.removeRemoteParticipant);
  const clearRemoteParticipants = useGroupCallStore((s) => s.clearRemoteParticipants);

  // Ref for store actions to avoid stale closures in event handlers
  const storeActionsRef = useRef({
    addRemoteParticipant,
    updateRemoteParticipant,
    removeRemoteParticipant,
    clearRemoteParticipants,
  });
  storeActionsRef.current = {
    addRemoteParticipant,
    updateRemoteParticipant,
    removeRemoteParticipant,
    clearRemoteParticipants,
  };

  // ── Cleanup on unmount ─────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (clientRef.current) {
        // Best-effort cleanup — cannot await in effect teardown
        const c = clientRef.current;
        const at = audioTrackRef.current;
        const vt = videoTrackRef.current;
        if (at) { try { at.stop(); at.close(); } catch {} }
        if (vt) { try { vt.stop(); vt.close(); } catch {} }
        c.removeAllListeners();
        try { c.leave(); } catch {}
        clientRef.current = null;
        audioTrackRef.current = null;
        videoTrackRef.current = null;
      }
    };
  }, []);

  // ── Actions ─────────────────────────────────────────────────────────────

  const join = useCallback(
    async (creds: GroupCallCredentials, enableVideo = false): Promise<void> => {
      // Guard: already joining/joined
      if (clientRef.current && state.isJoined) {
        console.log("[group-rtc] Already joined, skipping");
        return;
      }

      const joinAttemptId = ++joinAttemptRef.current;
      isLeavingRef.current = false;

      try {
        // Lazy-load SDK
        const AgoraRTC = (await import("agora-rtc-sdk-ng")).default;

        // Create a fresh client for this group call
        const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
        clientRef.current = client;

        // ── Register event handlers BEFORE join (Agora best practice) ────

        client.on("connection-state-change", (curState: string) => {
          setState((prev) => ({ ...prev, connectionState: curState }));
        });

        client.on("user-joined", (user: any) => {
          const uid = user.uid as number;
          console.log("[group-rtc] user-joined", uid);
          // Only add if not already tracked (reconnect fires user-joined again)
          const existing = useGroupCallStore.getState().remoteParticipants.get(uid);
          if (!existing) {
            // Look up display name from participantProfiles (populated by socket events)
            const profile = useGroupCallStore.getState().participantProfiles.get(uid);
            storeActionsRef.current.addRemoteParticipant({
              uid,
              userId: "",
              displayName: profile?.displayName || undefined,
              avatarUrl: profile?.avatarUrl || null,
              audioTrack: null,
              videoTrack: null,
              hasAudio: false,
              hasVideo: false,
            });
          }
        });

        client.on("user-published", async (user: any, mediaType: "audio" | "video") => {
          const uid = user.uid as number;
          console.log("[group-rtc] user-published", uid, mediaType);

          try {
            await client.subscribe(user, mediaType);
          } catch (err) {
            console.warn("[group-rtc] subscribe failed", uid, mediaType, err);
            return;
          }

          // Auto-play remote audio
          if (mediaType === "audio" && user.audioTrack) {
            user.audioTrack.play();
          }

          // Update store with track reference
          const patch: Partial<Omit<RemoteParticipant, "uid" | "userId">> = {};
          if (mediaType === "audio") {
            patch.audioTrack = user.audioTrack ?? null;
            patch.hasAudio = true;
          }
          if (mediaType === "video") {
            patch.videoTrack = user.videoTrack ?? null;
            patch.hasVideo = true;
          }
          storeActionsRef.current.updateRemoteParticipant(uid, patch);
        });

        client.on("user-unpublished", (user: any, mediaType: "audio" | "video") => {
          const uid = user.uid as number;
          console.log("[group-rtc] user-unpublished", uid, mediaType);

          const patch: Partial<Omit<RemoteParticipant, "uid" | "userId">> = {};
          if (mediaType === "audio") {
            patch.audioTrack = null;
            patch.hasAudio = false;
          }
          if (mediaType === "video") {
            patch.videoTrack = null;
            patch.hasVideo = false;
          }
          storeActionsRef.current.updateRemoteParticipant(uid, patch);
        });

        client.on("user-left", (user: any) => {
          const uid = user.uid as number;
          console.log("[group-rtc] user-left", uid);
          storeActionsRef.current.removeRemoteParticipant(uid);
        });

        client.on("token-privilege-will-expire", () => {
          console.log("[group-rtc] token will expire — caller should renew");
        });

        client.on("token-privilege-did-expire", () => {
          console.warn("[group-rtc] token expired — call may be dropped");
        });

        // ── Join channel ─────────────────────────────────────────────────

        console.log(
          `[group-rtc:join] channel=${creds.channelName} uid=${creds.uid} video=${enableVideo}`,
        );

        const assignedUid: UID = await client.join(
          creds.appId,
          creds.channelName,
          creds.token,
          creds.uid,
        );

        // Stale join guard
        if (joinAttemptId !== joinAttemptRef.current) {
          console.warn("[group-rtc] Stale join aborted");
          try { await client.leave(); } catch {}
          client.removeAllListeners();
          return;
        }

        const localUid = assignedUid as number;

        // ── Create local tracks ──────────────────────────────────────────

        let audioTrack: IMicrophoneAudioTrack | null = null;
        let videoTrack: ICameraVideoTrack | null = null;
        let audioUnavailable = false;
        let videoUnavailable = false;

        try {
          audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
        } catch (err: any) {
          console.warn("[group-rtc] mic unavailable:", err?.message);
          audioUnavailable = true;
        }

        if (enableVideo) {
          try {
            videoTrack = await AgoraRTC.createCameraVideoTrack();
          } catch (err: any) {
            console.warn("[group-rtc] camera unavailable:", err?.message);
            videoUnavailable = true;
          }
        }

        audioTrackRef.current = audioTrack;
        videoTrackRef.current = videoTrack;

        // ── Publish local tracks ─────────────────────────────────────────

        const tracks = [audioTrack, videoTrack].filter(Boolean) as (
          | IMicrophoneAudioTrack
          | ICameraVideoTrack
        )[];

        if (tracks.length > 0) {
          // Guard: still joined before publish
          if (joinAttemptId !== joinAttemptRef.current || isLeavingRef.current) {
            console.warn("[group-rtc] Stale before publish — aborting");
            tracks.forEach((t) => { try { t.stop(); t.close(); } catch {} });
            try { await client.leave(); } catch {}
            client.removeAllListeners();
            return;
          }
          await client.publish(tracks);
        }

        // ── Build media warning ──────────────────────────────────────────

        let warning: string | null = null;
        if (audioUnavailable && videoUnavailable) {
          warning = "Không truy cập được micro/camera. Bạn đã vào phòng ở chế độ không âm thanh/hình ảnh.";
        } else if (audioUnavailable) {
          warning = "Micro đang được thiết bị/tab khác sử dụng, bạn đã vào phòng ở chế độ không âm thanh.";
        } else if (videoUnavailable) {
          warning = "Camera đang được thiết bị/tab khác sử dụng, bạn đã vào phòng ở chế độ không video.";
        }

        // ── Update state ─────────────────────────────────────────────────

        setState({
          isJoined: true,
          localUid,
          isMicMuted: audioUnavailable,
          isCameraEnabled: !videoUnavailable && enableVideo,
          isSpeakerOn: true,
          connectionState: client.connectionState as string,
          localMediaWarning: warning,
        });

        console.log(
          `[group-rtc:joined] channel=${creds.channelName} uid=${localUid}`,
        );
      } catch (err) {
        console.error("[group-rtc:join:error]", err);
        // Cleanup on failure
        if (audioTrackRef.current) {
          try { audioTrackRef.current.stop(); audioTrackRef.current.close(); } catch {}
          audioTrackRef.current = null;
        }
        if (videoTrackRef.current) {
          try { videoTrackRef.current.stop(); videoTrackRef.current.close(); } catch {}
          videoTrackRef.current = null;
        }
        if (clientRef.current) {
          clientRef.current.removeAllListeners();
          try { await clientRef.current.leave(); } catch {}
          clientRef.current = null;
        }
        setState((prev) => ({
          ...prev,
          isJoined: false,
          localUid: null,
          connectionState: "DISCONNECTED",
        }));
        throw err;
      }
    },
    [state.isJoined],
  );

  const leave = useCallback(async (): Promise<void> => {
    isLeavingRef.current = true;
    joinAttemptRef.current++; // Abort any in-flight join

    const client = clientRef.current;
    const at = audioTrackRef.current;
    const vt = videoTrackRef.current;

    console.log("[group-rtc:leave] Starting cleanup");

    // 1. Unpublish local tracks
    if (client && at) {
      try { await client.unpublish(at); } catch {}
    }
    if (client && vt) {
      try { await client.unpublish(vt); } catch {}
    }

    // 2. Stop + close local tracks
    if (at) { try { at.stop(); at.close(); } catch {} }
    if (vt) { try { vt.stop(); vt.close(); } catch {} }
    audioTrackRef.current = null;
    videoTrackRef.current = null;

    // 3. Leave channel + destroy client
    if (client) {
      try { await client.leave(); } catch {}
      client.removeAllListeners();
      clientRef.current = null;
    }

    // 4. Clear remote participants in store
    storeActionsRef.current.clearRemoteParticipants();

    // 5. Reset local state
    setState({
      isJoined: false,
      localUid: null,
      isMicMuted: false,
      isCameraEnabled: false,
      isSpeakerOn: true,
      connectionState: "DISCONNECTED",
      localMediaWarning: null,
    });

    isLeavingRef.current = false;
    console.log("[group-rtc:leave] Done");
  }, []);

  const toggleMic = useCallback(async (): Promise<boolean> => {
    const at = audioTrackRef.current;
    if (!at) return true; // No track = muted

    const currentlyEnabled = at.enabled;
    at.setEnabled(!currentlyEnabled);
    const newMuted = currentlyEnabled; // was enabled → now muted
    setState((prev) => ({ ...prev, isMicMuted: newMuted }));
    return newMuted;
  }, []);

  const toggleCamera = useCallback(async (): Promise<boolean> => {
    const vt = videoTrackRef.current;
    if (!vt) return false; // No track = disabled

    const currentlyEnabled = vt.enabled;
    vt.setEnabled(!currentlyEnabled);
    const newEnabled = !currentlyEnabled;
    setState((prev) => ({ ...prev, isCameraEnabled: newEnabled }));
    return newEnabled;
  }, []);

  const toggleSpeaker = useCallback((): boolean => {
    setState((prev) => {
      const newOn = !prev.isSpeakerOn;
      return { ...prev, isSpeakerOn: newOn };
    });
    return !state.isSpeakerOn;
  }, [state.isSpeakerOn]);

  const renewToken = useCallback(async (token: string): Promise<void> => {
    const client = clientRef.current;
    if (!client) {
      console.warn("[group-rtc] renewToken: no client");
      return;
    }
    await client.renewToken(token);
    console.log("[group-rtc] token renewed");
  }, []);

  const playRemoteVideo = useCallback(
    (uid: number, element: HTMLElement): void => {
      const client = clientRef.current;
      if (!client) return;
      const remoteUser = client.remoteUsers.find((u) => u.uid === uid);
      if (remoteUser?.videoTrack) {
        remoteUser.videoTrack.play(element);
      }
    },
    [],
  );

  const stopRemoteVideo = useCallback((uid: number): void => {
    const client = clientRef.current;
    if (!client) return;
    const remoteUser = client.remoteUsers.find((u) => u.uid === uid);
    if (remoteUser?.videoTrack) {
      remoteUser.videoTrack.stop();
    }
  }, []);

  const playLocalVideo = useCallback((element: HTMLElement): void => {
    videoTrackRef.current?.play(element);
  }, []);

  const stopLocalVideo = useCallback((): void => {
    videoTrackRef.current?.stop();
  }, []);

  return {
    // State
    isJoined: state.isJoined,
    localUid: state.localUid,
    isMicMuted: state.isMicMuted,
    isCameraEnabled: state.isCameraEnabled,
    isSpeakerOn: state.isSpeakerOn,
    connectionState: state.connectionState,
    localMediaWarning: state.localMediaWarning,
    // Actions
    join,
    leave,
    toggleMic,
    toggleCamera,
    toggleSpeaker,
    renewToken,
    playRemoteVideo,
    stopRemoteVideo,
    playLocalVideo,
    stopLocalVideo,
  };
}
