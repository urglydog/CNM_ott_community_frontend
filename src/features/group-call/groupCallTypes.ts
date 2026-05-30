/**
 * Group Call feature type definitions.
 *
 * ⚠️ DIRECT CALL TYPES ARE NOT MODIFIED.
 * These types mirror the backend group-call socket payloads exactly.
 * Reuses CallSession / CallParticipant / TokenPayload from ../call/types.
 *
 * Event naming convention (from backend):
 *   - Server → Client:  "group:call:incoming", "group:call:accepted", etc.
 *   - Common (both modes): "call:join", "call:leave", "call:end",
 *     "call:participant-disconnected", "call:participant-reconnected"
 */

import type {
  CallSession,
  CallParticipant,
  CallErrorCode,
  CallMode,
  CallType,
} from "../call/types";

// ── Re-export shared types ─────────────────────────────────────────────────

export type { CallSession, CallParticipant };

// ── Agora remote participant (multi-user rendering) ────────────────────────

/**
 * Represents one remote user in the Agora channel.
 * Tracks both the Agora track objects and boolean flags
 * so the UI can render avatar vs video without checking track nullishness.
 */
export interface RemoteParticipant {
  /** Agora numeric UID (from sha256 hash of userId) */
  uid: number;
  /** Application user ID (string) */
  userId: string;
  /** Display name (enriched from backend payload) */
  displayName?: string;
  /** Avatar URL (enriched from backend payload) */
  avatarUrl?: string | null;
  /** Agora remote audio track reference (null if not subscribed or user muted) */
  audioTrack: import("agora-rtc-sdk-ng").IRemoteAudioTrack | null;
  /** Agora remote video track reference (null if not subscribed or user camera off) */
  videoTrack: import("agora-rtc-sdk-ng").IRemoteVideoTrack | null;
  /** Whether the remote user is currently publishing audio */
  hasAudio: boolean;
  /** Whether the remote user is currently publishing video */
  hasVideo: boolean;
}

// ── Group call lifecycle states ────────────────────────────────────────────

/**
 * UI-level lifecycle state for the group call window.
 * Transitions: idle → ringing → joining → active → ended
 */
export type GroupCallPhase =
  | "idle"        // No group call in progress
  | "ringing"     // Outgoing group call — waiting for first accept
  | "joining"     // Accepted / late-join — connecting to Agora channel
  | "active"      // Connected to Agora channel, media flowing
  | "ended";      // Call ended, cleanup in progress

// ── Socket event payloads — Server → Client ────────────────────────────────

/** group:call:incoming — received by invited participants */
export interface GroupCallIncomingPayload {
  callId: string;
  callSession: CallSession;
  conversationId: string;
  callMode: CallMode;
  callType: CallType;
  initiatorId: string;
  channelName: string;
  participants: CallParticipant[];
}

/** group:call:accepted — one participant accepted */
export interface GroupCallAcceptedPayload {
  callId: string;
  userId: string;
  participant: CallParticipant;
  callSession: CallSession;
}

/** group:call:rejected — one participant rejected */
export interface GroupCallRejectedPayload {
  callId: string;
  userId: string;
  callSession: CallSession;
}

/** group:call:ended — call has ended */
export interface GroupCallEndedPayload {
  callId: string;
  endedBy: string;
  reason: string;
  callSession: CallSession;
}

/** group:call:participant-joined — late-joiner arrived */
export interface GroupCallParticipantJoinedPayload {
  callId: string;
  userId: string;
  participant: CallParticipant;
  callSession: CallSession;
}

/** group:call:participant-left — participant left (not ended) */
export interface GroupCallParticipantLeftPayload {
  callId: string;
  userId: string;
  reason: string;
  callSession: CallSession;
}

// ── Socket event payloads — Common (both direct & group) ───────────────────

/** call:join — late-join ack from server */
export interface CallJoinAck {
  ok: boolean;
  callId?: string;
  token?: string;
  uid?: number;
  channelName?: string;
  callSession?: CallSession;
  error?: string;
}

/** call:leave — leave ack from server */
export interface CallLeaveAck {
  ok: boolean;
  callId?: string;
  ended?: boolean;
  selfOnly?: boolean;
  callSession?: CallSession;
  error?: string;
}

/** call:participant-disconnected — user lost connection */
export interface CallParticipantDisconnectedPayload {
  callId: string;
  userId: string;
  graceMs: number;
  callSession: CallSession;
}

/** call:participant-reconnected — user reconnected */
export interface CallParticipantReconnectedPayload {
  callId: string;
  userId: string;
  token?: string;
  uid?: number;
  channelName?: string;
  callSession: CallSession;
}

/** call:error — generic error from server */
export interface CallErrorPayload {
  code: CallErrorCode;
  message: string;
}

// ── Socket event payloads — Client → Server ────────────────────────────────

export interface GroupCallJoinData {
  callId: string;
}

export interface GroupCallLeaveData {
  callId: string;
}

export interface GroupCallEndData {
  callId: string;
}

export interface GroupCallHeartbeatData {
  callId: string;
}

export interface GroupCallAcceptData {
  callId: string;
}

export interface GroupCallRejectData {
  callId: string;
}