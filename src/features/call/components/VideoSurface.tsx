"use client";

import { useEffect, useRef } from "react";
import {
  playAgoraRemoteVideo,
  stopAgoraRemoteVideo,
  playAgoraLocalVideo,
  stopAgoraLocalVideo,
  subscribeAgoraRtc,
} from "../index";

interface VideoSurfaceProps {
  /** Agora UID of the remote user, or "local" for the local video track */
  uid: number | "local";
  /** Whether video is currently enabled (controls visibility/styling) */
  videoEnabled?: boolean;
  /** Optional className for the container div */
  className?: string;
  /** Display name overlay */
  displayName?: string;
  /** Whether to mirror the local video (selfie style) */
  mirror?: boolean;
}

/**
 * Thin wrapper around a <div> that binds an Agora video track.
 *
 * - `uid="local"` → calls `playLocalVideo(element)`
 * - `uid=<number>` → calls `playRemoteVideo(uid, element)`
 *
 * Automatically unbinds on unmount or uid change.
 *
 * Also subscribes to onUserPublished so that when the remote user's video
 * track becomes available (race: user-joined fires before user-published),
 * we retry playRemoteVideo.
 */
export function VideoSurface({
  uid,
  videoEnabled = true,
  className = "",
  displayName,
  mirror = false,
}: VideoSurfaceProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Bind / unbind video track to the DOM element
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (!videoEnabled) {
      // If video disabled, stop playback
      if (uid === "local") {
        stopAgoraLocalVideo();
      } else {
        stopAgoraRemoteVideo(uid);
      }
      return;
    }

    if (uid === "local") {
      playAgoraLocalVideo(el);
      return () => {
        stopAgoraLocalVideo();
      };
    }

    // Remote video: try to play immediately
    console.log("[VideoSurface] Initial play attempt for uid:", uid);
    playAgoraRemoteVideo(uid, el);

    // Subscribe to onUserPublished to retry when the video track becomes
    // available. This handles the race condition where user-joined fires
    // (uid is set) but user-published hasn't fired yet (videoTrack missing).
    const unsubscribe = subscribeAgoraRtc({
      onUserPublished: (pubUid: number, mediaType: "audio" | "video") => {
        if (pubUid === uid && mediaType === "video") {
          const currentEl = containerRef.current;
          if (currentEl) {
            console.log("[VideoSurface] Retrying play for uid:", uid, "after onUserPublished(video)");
            playAgoraRemoteVideo(uid, currentEl);
          }
        }
      },
      onUserUnpublished: (pubUid: number, mediaType: "audio" | "video") => {
        if (pubUid === uid && mediaType === "video") {
          console.log("[VideoSurface] Stopping video for uid:", uid, "after onUserUnpublished(video)");
          stopAgoraRemoteVideo(uid);
        }
      },
    });

    return () => {
      unsubscribe();
      stopAgoraRemoteVideo(uid);
    };
  }, [uid, videoEnabled]);

  return (
    <div
      className={`relative overflow-hidden bg-gray-900 ${className}`}
    >
      {/* Video container — Agora SDK injects a <video> element here */}
      <div
        ref={containerRef}
        className={`w-full h-full ${mirror && uid === "local" ? "scale-x-[-1]" : ""}`}
      />

      {/* Avatar / name overlay when video is off */}
      {!videoEnabled && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-800">
          <div className="w-20 h-20 rounded-full bg-blue-500 flex items-center justify-center text-white text-2xl font-bold">
            {displayName ? displayName.charAt(0).toUpperCase() : "?"}
          </div>
          {displayName && (
            <p className="mt-2 text-white text-sm font-medium">{displayName}</p>
          )}
        </div>
      )}
    </div>
  );
}
