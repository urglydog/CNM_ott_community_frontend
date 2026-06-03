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
export { useCallRtcLifecycle, consumeRtcToken } from "./hooks/useCallRtcLifecycle";
export { useCallManager } from "./hooks/useCallManager";

// Agora RTC singleton (provider-specific)
export {
  initialize as initAgoraRtc,
  joinChannel as joinAgoraChannel,
  leaveChannel as leaveAgoraChannel,
  muteMic as muteAgoraMic,
  toggleMic as toggleAgoraMic,
  setCameraEnabled as setAgoraCameraEnabled,
  toggleCamera as toggleAgoraCamera,
  switchCamera as switchAgoraCamera,
  setSpeakerphone as setAgoraSpeakerphone,
  toggleSpeaker as toggleAgoraSpeaker,
  renewToken as renewAgoraToken,
  destroy as destroyAgoraRtc,
  isJoined as isAgoraJoined,
  getLocalUid as getAgoraLocalUid,
  getRemoteUsers as getAgoraRemoteUsers,
  isMicMuted as isAgoraMicMuted,
  isCameraEnabled as isAgoraCameraEnabled,
  isSpeakerOn as isAgoraSpeakerOn,
  getConnectionState as getAgoraConnectionState,
  playRemoteVideo as playAgoraRemoteVideo,
  stopRemoteVideo as stopAgoraRemoteVideo,
  playLocalVideo as playAgoraLocalVideo,
  stopLocalVideo as stopAgoraLocalVideo,
  subscribe as subscribeAgoraRtc,
  getClient as getAgoraClient,
  getLocalAudioTrack as getAgoraLocalAudioTrack,
  getLocalVideoTrack as getAgoraLocalVideoTrack,
} from "./rtc/agoraRtc";
export type { RtcRemoteUser, RtcCallbacks } from "./rtc/agoraRtc";

// Agora RTC React hook
export { useAgoraRtc } from "./rtc/useAgoraRtc";
export type { UseAgoraRtcState, UseAgoraRtcActions, UseAgoraRtcReturn } from "./rtc/useAgoraRtc";

// UI Components
export { VideoSurface } from "./components/VideoSurface";
export { CallControls } from "./components/CallControls";
export { IncomingCallModal } from "./components/IncomingCallModal";
export { OutgoingCallModal } from "./components/OutgoingCallModal";
export { DirectCallScreen } from "./components/DirectCallScreen";
