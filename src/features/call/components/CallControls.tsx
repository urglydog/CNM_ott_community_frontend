"use client";

import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  SwitchCamera,
  Volume2,
  VolumeX,
} from "lucide-react";

interface CallControlsProps {
  /** Whether the local mic is currently muted */
  isMicMuted: boolean;
  /** Whether the local camera is currently enabled */
  isCameraEnabled: boolean;
  /** Whether speakerphone is currently on */
  isSpeakerOn: boolean;
  /** Call type — hides camera/switch controls for audio-only calls */
  callType: "audio" | "video";
  /** Toggle mic on/off */
  onToggleMic: () => void;
  /** Toggle camera on/off */
  onToggleCamera: () => void;
  /** Switch between front/back camera */
  onSwitchCamera: () => void;
  /** Toggle speakerphone */
  onToggleSpeaker: () => void;
  /** End the call */
  onEndCall: () => void;
  /** Optional: disable all controls (e.g. during reconnecting) */
  disabled?: boolean;
  /** Whether the current device is mobile — hides switch camera on desktop */
  isMobile?: boolean;
}

/**
 * Bottom control bar for an active or connecting call.
 * Shows mic, camera, speaker, switch-camera, and end-call buttons.
 */
export function CallControls({
  isMicMuted,
  isCameraEnabled,
  isSpeakerOn,
  callType,
  onToggleMic,
  onToggleCamera,
  onSwitchCamera,
  onToggleSpeaker,
  onEndCall,
  disabled = false,
  isMobile = true,
}: CallControlsProps) {
  const isVideo = callType === "video";

  return (
    <div className="flex items-center justify-center gap-4 py-4">
      {/* Mic toggle */}
      <button
        type="button"
        onClick={onToggleMic}
        disabled={disabled}
        className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
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
          onClick={onToggleCamera}
          disabled={disabled}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
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

      {/* Switch camera (video calls on mobile only — desktop has no front/back model) */}
      {isVideo && isMobile && (
        <button
          type="button"
          onClick={onSwitchCamera}
          disabled={disabled}
          className="w-12 h-12 rounded-full flex items-center justify-center bg-white/20 text-white hover:bg-white/30 transition-colors cursor-pointer"
          title="Đổi camera"
        >
          <SwitchCamera className="w-5 h-5" />
        </button>
      )}

      {/* Speaker toggle */}
      <button
        type="button"
        onClick={onToggleSpeaker}
        disabled={disabled}
        className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
          isSpeakerOn
            ? "bg-white/30 text-white hover:bg-white/40"
            : "bg-white/20 text-white hover:bg-white/30"
        }`}
        title={isSpeakerOn ? "Tắt loa ngoài" : "Bật loa ngoài"}
      >
        {isSpeakerOn ? (
          <Volume2 className="w-5 h-5" />
        ) : (
          <VolumeX className="w-5 h-5" />
        )}
      </button>

      {/* End call */}
      <button
        type="button"
        onClick={onEndCall}
        disabled={disabled}
        className="w-14 h-12 rounded-full flex items-center justify-center bg-red-500 text-white hover:bg-red-600 transition-colors cursor-pointer"
        title="Kết thúc cuộc gọi"
      >
        <PhoneOff className="w-5 h-5" />
      </button>
    </div>
  );
}
