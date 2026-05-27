/**
 * Call feature barrel export.
 * Public API for the call module — state + transport only (no UI).
 */

// Types
export type {
  CallStatus,
  CallMode,
  CallType,
  ParticipantStatus,
  ConnectionState,
  EndedReason,
  CallErrorCode,
  CallParticipant,
  CallSession,
  TokenPayload,
  StartCallRequest,
  StartCallResponse,
  GetTokenResponse,
  AcceptCallResponse,
  RejectCallResponse,
  CancelCallResponse,
  EndCallResponse,
  GetActiveCallResponse,
  GetCallHistoryResponse,
  CallApiError,
  CallStartData,
  CallAcceptData,
  CallRejectData,
  CallCancelData,
  CallEndData,
  CallJoinData,
  CallLeaveData,
  CallHeartbeatData,
  CallSocketAck,
  CallIncomingPayload,
  CallRingingPayload,
  CallAcceptedPayload,
  CallRejectedPayload,
  CallCancelledPayload,
  CallEndedPayload,
  CallMissedPayload,
  CallParticipantJoinedPayload,
  CallParticipantLeftPayload,
  CallParticipantDisconnectedPayload,
  CallParticipantReconnectedPayload,
  CallStateUpdatedPayload,
  CallBusyPayload,
  CallErrorPayload,
} from "./types";

// REST API client
export {
  startCall,
  getCallToken,
  acceptCall as acceptCallApi,
  rejectCall as rejectCallApi,
  cancelCall as cancelCallApi,
  endCall as endCallApi,
  getActiveCall,
  getCallHistory,
} from "./callApi";

// Socket transport
export {
  CALL_EVENTS,
  CALL_LISTEN_EVENTS,
  emitCallStart,
  emitCallAccept,
  emitCallReject,
  emitCallCancel,
  emitCallEnd,
  emitCallJoin,
  emitCallLeave,
  emitCallHeartbeat,
  registerCallListeners,
  CallSocketError,
} from "./callSocket";
export type { CallEventHandlers } from "./callSocket";

// State store
export { useCallStore } from "./callStore";
export type { CallPhase } from "./callStore";

// Hooks
export { useCallSocketListener } from "./hooks/useCallSocketListener";
export { useCallRecovery } from "./hooks/useCallRecovery";
