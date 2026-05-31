/**
 * BroadcastChannel communication layer between the main chat page
 * and the pop-out call window.
 *
 * Uses the BroadcastChannel API (same-origin, same browser) so both
 * windows share real-time messages without a server round-trip.
 *
 * Fallback: localStorage "storage" event for older browsers.
 *
 * Message protocol:
 *  - call-window:opened   — call window sends after it mounts and joins Agora
 *  - call-window:closed   — call window sends before it unmounts / beforeunload
 *  - call-window:status   — call window sends status updates (phase, duration)
 *  - main:leave-request   — main page asks call window to leave (logout / force end)
 *  - main:token-payload   — main page sends token payload to call window
 *  - main:call-info       — main page sends call metadata to call window
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

const CHANNEL_NAME = "ott-call-window";

// ── Message types ────────────────────────────────────────────────────────

export interface CallWindowOpenedMsg {
  type: "call-window:opened";
  callId: string;
}

export interface CallWindowClosedMsg {
  type: "call-window:closed";
  callId: string;
}

export interface CallWindowStatusMsg {
  type: "call-window:status";
  callId: string;
  phase: string;
  duration: number;
}

export interface MainLeaveRequestMsg {
  type: "main:leave-request";
  callId: string;
}

export interface MainTokenPayloadMsg {
  type: "main:token-payload";
  payload: {
    appId: string;
    channelName: string;
    token: string;
    uid: number;
  };
  enableVideo: boolean;
}

export interface MainCallInfoMsg {
  type: "main:call-info";
  callId: string;
  callType: "audio" | "video";
  remoteName: string;
  isInitiator: boolean;
}

export interface MainCallEndedMsg {
  type: "main:call-ended";
  callId: string;
  reason: string;
}

export interface MainCallAcceptedMsg {
  type: "main:call-accepted";
  callId: string;
}

export interface CallWindowAcceptingMsg {
  type: "call-window:accepting";
  callId: string;
}

export interface CallWindowAcceptedMsg {
  type: "call-window:accepted";
  callId: string;
}

export interface CallWindowRejectedMsg {
  type: "call-window:rejected";
  callId: string;
}

// ── Group call messages ──────────────────────────────────────────────────

export interface MainGroupCredentialsMsg {
  type: "main:group-credentials";
  callId: string;
  credentials: {
    appId: string;
    token: string;
    uid: number;
    channelName: string;
  };
}

export interface MainGroupParticipantJoinedMsg {
  type: "main:group-participant-joined";
  callId: string;
  userId: string;
  displayName?: string;
}

export interface MainGroupParticipantLeftMsg {
  type: "main:group-participant-left";
  callId: string;
  userId: string;
}

export interface MainGroupEndedMsg {
  type: "main:group-ended";
  callId: string;
  reason: string;
}

export interface MainGroupStateMsg {
  type: "main:group-state";
  callId: string;
  participants: any[];
}

export type CallWindowMessage =
  | CallWindowOpenedMsg
  | CallWindowClosedMsg
  | CallWindowStatusMsg
  | MainLeaveRequestMsg
  | MainTokenPayloadMsg
  | MainCallInfoMsg
  | MainCallEndedMsg
  | MainCallAcceptedMsg
  | CallWindowAcceptingMsg
  | CallWindowAcceptedMsg
  | CallWindowRejectedMsg
  | MainGroupCredentialsMsg
  | MainGroupParticipantJoinedMsg
  | MainGroupParticipantLeftMsg
  | MainGroupEndedMsg
  | MainGroupStateMsg;

// ── Channel singleton (per browser tab/window) ───────────────────────────

let _channel: BroadcastChannel | null = null;
let _useFallback = false;

function getChannel(): BroadcastChannel | null {
  if (_channel) return _channel;
  try {
    _channel = new BroadcastChannel(CHANNEL_NAME);
    return _channel;
  } catch {
    // BroadcastChannel not supported — use localStorage fallback
    _useFallback = true;
    return null;
  }
}

// ── Send ─────────────────────────────────────────────────────────────────

/**
 * Send a message to the other window (main page ↔ call window).
 * Safe to call from either side.
 */
export function sendMessage(msg: CallWindowMessage): void {
  const ch = getChannel();
  if (ch) {
    try {
      ch.postMessage(msg);
    } catch {
      // Message might not be cloneable — ignore
    }
  } else if (_useFallback) {
    try {
      localStorage.setItem(`__call_channel_${msg.type}`, JSON.stringify(msg));
      // Remove immediately to trigger storage event
      localStorage.removeItem(`__call_channel_${msg.type}`);
    } catch {
      // localStorage full or unavailable
    }
  }
}

// ── Listen ───────────────────────────────────────────────────────────────

type MessageHandler = (msg: CallWindowMessage) => void;

/**
 * Subscribe to messages from the other window.
 * @returns Unsubscribe function.
 */
export function onMessage(handler: MessageHandler): () => void {
  const ch = getChannel();

  if (ch) {
    const listener = (event: MessageEvent) => {
      if (event.data && typeof event.data === "object" && "type" in event.data) {
        handler(event.data as CallWindowMessage);
      }
    };
    ch.addEventListener("message", listener);
    return () => ch.removeEventListener("message", listener);
  }

  if (_useFallback) {
    const storageHandler = (event: StorageEvent) => {
      if (event.key?.startsWith("__call_channel_") && event.newValue) {
        try {
          const msg = JSON.parse(event.newValue) as CallWindowMessage;
          handler(msg);
        } catch {
          // ignore parse errors
        }
      }
    };
    window.addEventListener("storage", storageHandler);
    return () => window.removeEventListener("storage", storageHandler);
  }

  return () => {};
}

// ── Cleanup ──────────────────────────────────────────────────────────────

/**
 * Close the BroadcastChannel. Call on unmount if needed.
 */
export function closeChannel(): void {
  if (_channel) {
    _channel.close();
    _channel = null;
  }
}
