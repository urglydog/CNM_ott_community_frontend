/**
 * Call feature type definitions.
 * Mirrors the backend call.constants.js + callModel.js + callController.js shapes exactly.
 * Provider-neutral — no Agora-specific types here.
 */

// ── Enums matching backend call.constants.js ───────────────────────────────

export type CallStatus = "ringing" | "active" | "ended" | "missed" | "rejected" | "cancelled";
export type CallMode = "direct" | "group";
export type CallType = "audio" | "video";

export type ParticipantStatus = "invited" | "accepted" | "rejected" | "missed" | "left";
export type ConnectionState = "connected" | "disconnected";

export type EndedReason =
  | "user_ended"
  | "caller_cancelled"
  | "callee_rejected"
  | "no_answer_timeout"
  | "participant_disconnected_timeout"
  | "group_empty"
  | "system_cleanup";

// ── Call error codes matching backend callValidation.js ─────────────────────

export type CallErrorCode =
  | "INVALID_INPUT"
  | "CALL_NOT_FOUND"
  | "CALL_NOT_RINGING"
  | "NOT_PARTICIPANT"
  | "ALREADY_RESPONDED"
  | "CALL_BUSY"
  | "CALL_EXISTS"
  | "NOT_MEMBER"
  | "GROUP_AUDIO_NOT_ALLOWED"
  | "CONVERSATION_NOT_FOUND"
  | "INVALID_CONVERSATION"
  | "NOT_INITIATOR"
  | "CALL_ALREADY_ENDED"
  | "CALL_NOT_ACTIVE"
  | "NOT_GROUP_CALL"
  | "INTERNAL_ERROR";

// ── Data shapes matching backend callModel.js ──────────────────────────────

export interface CallParticipant {
  userId: string;
  role: string;
  status: ParticipantStatus;
  connectionState: ConnectionState;
  joinedAt: string | null;
  leftAt: string | null;
  disconnectedAt?: string | null;
  reconnectedAt?: string | null;
}

export interface CallSession {
  callId: string;
  conversationId: string;
  initiatorId: string;
  callMode: CallMode;
  callType: CallType;
  provider: string;
  channelName: string;
  participants: CallParticipant[];
  status: CallStatus;
  endedReason: EndedReason | null;
  endedBy: string | null;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  callLogCreated: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Token payload (received via ack or REST, NEVER stored in callStore) ────

export interface TokenPayload {
  appId: string;
  token: string;
  uid: number;
  channelName: string;
  expireAt: string;
}

// ── REST API request/response shapes matching backend callController.js ─────

/** POST /api/calls/start — request body */
export interface StartCallRequest {
  conversationId: string;
  callType: CallType;
}

/** POST /api/calls/start — response */
export interface StartCallResponse {
  call: CallSession;
  token: TokenPayload;
  recipientIds: string[];
}

/** POST /api/calls/:callId/token — response */
export type GetTokenResponse = TokenPayload;

/** POST /api/calls/:callId/accept — response */
export interface AcceptCallResponse {
  call: CallSession;
  token: TokenPayload;
}

/** POST /api/calls/:callId/reject — response */
export interface RejectCallResponse {
  ended: boolean;
  call: CallSession;
}

/** POST /api/calls/:callId/cancel — response */
export interface CancelCallResponse {
  ended: boolean;
  call: CallSession;
}

/** POST /api/calls/:callId/end — response */
export interface EndCallResponse {
  ended: boolean;
  selfOnly?: boolean;
  call: CallSession;
}

/** GET /api/calls/active — response */
export interface GetActiveCallResponse {
  call: CallSession | null;
  token?: TokenPayload | null;
}

/** GET /api/calls/history/:conversationId — response */
export interface GetCallHistoryResponse {
  items: CallSession[];
  nextCursor: string | null;
}

/** Error response from backend */
export interface CallApiError {
  error: string;
  code: CallErrorCode;
}

// ── Socket event payload shapes ────────────────────────────────────────────

// Client → Server data payloads
export interface CallStartData {
  conversationId: string;
  callType: CallType;
}

export interface CallAcceptData {
  callId: string;
}

export interface CallRejectData {
  callId: string;
}

export interface CallCancelData {
  callId: string;
}

export interface CallEndData {
  callId: string;
}

export interface CallJoinData {
  callId: string;
}

export interface CallLeaveData {
  callId: string;
}

export interface CallHeartbeatData {
  callId: string;
}

// Socket ack callback responses (matching backend sendOk/sendError)
export interface CallSocketAck {
  ok: boolean;
  error?: string;
  callId?: string;
  token?: string;
  uid?: number;
  channelName?: string;
  callSession?: CallSession;
  recipientIds?: string[];
  ended?: boolean;
  selfOnly?: boolean;
}

// Server → Client event payloads
export interface CallIncomingPayload {
  callId: string;
  callMode: CallMode;
  callType: CallType;
  initiatorId: string;
  initiatorName: string;
  conversationId: string;
  participants: CallParticipant[];
  callSession: CallSession;
}

export interface CallRingingPayload {
  callId: string;
  callSession: CallSession;
}

export interface CallAcceptedPayload {
  callId: string;
  userId: string;
  callSession: CallSession;
}

export interface CallRejectedPayload {
  callId: string;
  userId: string;
  callSession: CallSession;
}

export interface CallCancelledPayload {
  callId: string;
  cancelledBy: string;
  callSession: CallSession;
}

export interface CallEndedPayload {
  callId: string;
  endedBy: string;
  reason: EndedReason;
  callSession: CallSession;
}

export interface CallMissedPayload {
  callId: string;
  userId: string;
  callSession: CallSession;
}

export interface CallParticipantJoinedPayload {
  callId: string;
  userId: string;
  participant: CallParticipant;
  callSession: CallSession;
}

export interface CallParticipantLeftPayload {
  callId: string;
  userId: string;
  reason: string;
  callSession: CallSession;
}

export interface CallParticipantDisconnectedPayload {
  callId: string;
  userId: string;
  graceMs: number;
  callSession: CallSession;
}

export interface CallParticipantReconnectedPayload {
  callId: string;
  userId: string;
  token?: string;
  uid?: number;
  channelName?: string;
  callSession: CallSession;
}

export interface CallStateUpdatedPayload {
  callId: string;
  callSession: CallSession;
}

export interface CallBusyPayload {
  callId: string;
  message: string;
}

export interface CallErrorPayload {
  code: CallErrorCode;
  message: string;
}
