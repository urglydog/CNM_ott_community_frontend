/**
 * Call socket event transport layer.
 * Handles all real-time call signaling via socket.io.
 *
 * Design:
 * - Uses the existing socket instance from lib/socket.ts (same socket as SocketContext)
 * - Emits client→server events with ack callbacks
 * - Registers/deregisters server→client event listeners
 * - Token is received ONLY via ack callbacks or REST responses, NEVER broadcast
 * - No Agora SDK imports — this is pure transport
 *
 * Event names match backend call.constants.js SOCKET_EVENTS exactly.
 */

import { getSocket } from "../../lib/socket";
import type { Socket } from "socket.io-client";
import type {
  CallType,
  CallSession,
  CallSocketAck,
  CallStartData,
  CallAcceptData,
  CallRejectData,
  CallCancelData,
  CallEndData,
  CallJoinData,
  CallLeaveData,
  CallHeartbeatData,
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

// ── Socket event name constants (matching backend call.constants.js) ────────

/** Client → Server events */
export const CALL_EVENTS = {
  START: "call:start",
  ACCEPT: "call:accept",
  REJECT: "call:reject",
  CANCEL: "call:cancel",
  END: "call:end",
  JOIN: "call:join",
  LEAVE: "call:leave",
  HEARTBEAT: "call:heartbeat",
} as const;

/** Server → Client events */
export const CALL_LISTEN_EVENTS = {
  INCOMING: "call:incoming",
  RINGING: "call:ringing",
  ACCEPTED: "call:accepted",
  REJECTED: "call:rejected",
  CANCELLED: "call:cancelled",
  ENDED: "call:ended",
  MISSED: "call:missed",
  PARTICIPANT_JOINED: "call:participant-joined",
  PARTICIPANT_LEFT: "call:participant-left",
  PARTICIPANT_DISCONNECTED: "call:participant-disconnected",
  PARTICIPANT_RECONNECTED: "call:participant-reconnected",
  STATE_UPDATED: "call:state-updated",
  BUSY: "call:busy",
  ERROR: "call:error",
} as const;

// ── Helper ─────────────────────────────────────────────────────────────────

function getActiveSocket(): Socket {
  return getSocket();
}

// ── Client → Server emitters (with ack callbacks) ──────────────────────────

/**
 * Start a new call via socket.
 * Returns the ack response from the server which includes token + callSession.
 */
export function emitCallStart(
  conversationId: string,
  callType: CallType,
): Promise<CallSocketAck> {
  return new Promise((resolve, reject) => {
    const socket = getActiveSocket();
    const data: CallStartData = { conversationId, callType };

    socket.emit(CALL_EVENTS.START, data, (ack: CallSocketAck) => {
      if (ack?.ok) {
        resolve(ack);
      } else {
        reject(new CallSocketError(ack?.error || "Failed to start call", ack));
      }
    });

    // Timeout safety net
    setTimeout(() => {
      reject(new CallSocketError("call:start timed out"));
    }, 15000);
  });
}

/**
 * Accept an incoming call via socket.
 * Returns ack with token + updated callSession.
 */
export function emitCallAccept(callId: string): Promise<CallSocketAck> {
  return new Promise((resolve, reject) => {
    const socket = getActiveSocket();
    const data: CallAcceptData = { callId };

    socket.emit(CALL_EVENTS.ACCEPT, data, (ack: CallSocketAck) => {
      if (ack?.ok) {
        resolve(ack);
      } else {
        reject(new CallSocketError(ack?.error || "Failed to accept call", ack));
      }
    });

    setTimeout(() => {
      reject(new CallSocketError("call:accept timed out"));
    }, 15000);
  });
}

/**
 * Reject an incoming call via socket.
 */
export function emitCallReject(callId: string): Promise<CallSocketAck> {
  return new Promise((resolve, reject) => {
    const socket = getActiveSocket();
    const data: CallRejectData = { callId };

    socket.emit(CALL_EVENTS.REJECT, data, (ack: CallSocketAck) => {
      if (ack?.ok) {
        resolve(ack);
      } else {
        reject(new CallSocketError(ack?.error || "Failed to reject call", ack));
      }
    });

    setTimeout(() => {
      reject(new CallSocketError("call:reject timed out"));
    }, 15000);
  });
}

/**
 * Cancel a ringing call (initiator only) via socket.
 */
export function emitCallCancel(callId: string): Promise<CallSocketAck> {
  return new Promise((resolve, reject) => {
    const socket = getActiveSocket();
    const data: CallCancelData = { callId };

    socket.emit(CALL_EVENTS.CANCEL, data, (ack: CallSocketAck) => {
      if (ack?.ok) {
        resolve(ack);
      } else {
        reject(new CallSocketError(ack?.error || "Failed to cancel call", ack));
      }
    });

    setTimeout(() => {
      reject(new CallSocketError("call:cancel timed out"));
    }, 15000);
  });
}

/**
 * End an active call via socket.
 */
export function emitCallEnd(callId: string): Promise<CallSocketAck> {
  return new Promise((resolve, reject) => {
    const socket = getActiveSocket();
    const data: CallEndData = { callId };

    socket.emit(CALL_EVENTS.END, data, (ack: CallSocketAck) => {
      if (ack?.ok) {
        resolve(ack);
      } else {
        reject(new CallSocketError(ack?.error || "Failed to end call", ack));
      }
    });

    setTimeout(() => {
      reject(new CallSocketError("call:end timed out"));
    }, 15000);
  });
}

/**
 * Join an existing group call (late join) via socket.
 * Returns ack with token + updated callSession.
 */
export function emitCallJoin(callId: string): Promise<CallSocketAck> {
  return new Promise((resolve, reject) => {
    const socket = getActiveSocket();
    const data: CallJoinData = { callId };

    socket.emit(CALL_EVENTS.JOIN, data, (ack: CallSocketAck) => {
      if (ack?.ok) {
        resolve(ack);
      } else {
        reject(new CallSocketError(ack?.error || "Failed to join call", ack));
      }
    });

    setTimeout(() => {
      reject(new CallSocketError("call:join timed out"));
    }, 15000);
  });
}

/**
 * Leave an active group call via socket.
 */
export function emitCallLeave(callId: string): Promise<CallSocketAck> {
  return new Promise((resolve, reject) => {
    const socket = getActiveSocket();
    const data: CallLeaveData = { callId };

    socket.emit(CALL_EVENTS.LEAVE, data, (ack: CallSocketAck) => {
      if (ack?.ok) {
        resolve(ack);
      } else {
        reject(new CallSocketError(ack?.error || "Failed to leave call", ack));
      }
    });

    setTimeout(() => {
      reject(new CallSocketError("call:leave timed out"));
    }, 15000);
  });
}

/**
 * Send heartbeat to keep reconnect grace timer alive.
 * Fire-and-forget — no ack expected.
 */
export function emitCallHeartbeat(callId: string): void {
  const socket = getActiveSocket();
  const data: CallHeartbeatData = { callId };
  socket.emit(CALL_EVENTS.HEARTBEAT, data);
}

// ── Server → Client listener registration ──────────────────────────────────

export interface CallEventHandlers {
  onIncoming?: (payload: CallIncomingPayload) => void;
  onRinging?: (payload: CallRingingPayload) => void;
  onAccepted?: (payload: CallAcceptedPayload) => void;
  onRejected?: (payload: CallRejectedPayload) => void;
  onCancelled?: (payload: CallCancelledPayload) => void;
  onEnded?: (payload: CallEndedPayload) => void;
  onMissed?: (payload: CallMissedPayload) => void;
  onParticipantJoined?: (payload: CallParticipantJoinedPayload) => void;
  onParticipantLeft?: (payload: CallParticipantLeftPayload) => void;
  onParticipantDisconnected?: (payload: CallParticipantDisconnectedPayload) => void;
  onParticipantReconnected?: (payload: CallParticipantReconnectedPayload) => void;
  onStateUpdated?: (payload: CallStateUpdatedPayload) => void;
  onBusy?: (payload: CallBusyPayload) => void;
  onError?: (payload: CallErrorPayload) => void;
}

/**
 * Register all server→client call event listeners on the socket.
 * Returns a cleanup function that removes all listeners.
 *
 * Usage:
 *   const cleanup = registerCallListeners({ onIncoming: ..., onEnded: ... });
 *   // Later:
 *   cleanup();
 */
export function registerCallListeners(handlers: CallEventHandlers): () => void {
  const socket = getActiveSocket();

  const entries: Array<[string, ((...args: any[]) => void) | undefined]> = [
    [CALL_LISTEN_EVENTS.INCOMING, handlers.onIncoming],
    [CALL_LISTEN_EVENTS.RINGING, handlers.onRinging],
    [CALL_LISTEN_EVENTS.ACCEPTED, handlers.onAccepted],
    [CALL_LISTEN_EVENTS.REJECTED, handlers.onRejected],
    [CALL_LISTEN_EVENTS.CANCELLED, handlers.onCancelled],
    [CALL_LISTEN_EVENTS.ENDED, handlers.onEnded],
    [CALL_LISTEN_EVENTS.MISSED, handlers.onMissed],
    [CALL_LISTEN_EVENTS.PARTICIPANT_JOINED, handlers.onParticipantJoined],
    [CALL_LISTEN_EVENTS.PARTICIPANT_LEFT, handlers.onParticipantLeft],
    [CALL_LISTEN_EVENTS.PARTICIPANT_DISCONNECTED, handlers.onParticipantDisconnected],
    [CALL_LISTEN_EVENTS.PARTICIPANT_RECONNECTED, handlers.onParticipantReconnected],
    [CALL_LISTEN_EVENTS.STATE_UPDATED, handlers.onStateUpdated],
    [CALL_LISTEN_EVENTS.BUSY, handlers.onBusy],
    [CALL_LISTEN_EVENTS.ERROR, handlers.onError],
  ];

  for (const [event, handler] of entries) {
    if (handler) {
      socket.on(event, handler as (...args: any[]) => void);
    }
  }

  // Return cleanup function
  return () => {
    for (const [event, handler] of entries) {
      if (handler) {
        socket.off(event, handler as (...args: any[]) => void);
      }
    }
  };
}

// ── Custom error class ─────────────────────────────────────────────────────

export class CallSocketError extends Error {
  ack?: CallSocketAck;

  constructor(message: string, ack?: CallSocketAck) {
    super(message);
    this.name = "CallSocketError";
    this.ack = ack;
  }
}
