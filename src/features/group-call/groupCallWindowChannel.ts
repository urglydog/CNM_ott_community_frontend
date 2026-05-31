/**
 * BroadcastChannel communication layer between the main chat page
 * and the pop-out GROUP call window.
 *
 * ⚠️ SEPARATE from direct call channel (ott-call-window).
 * This channel uses "ott-group-call-window" so that
 * useCallRtcLifecycle never receives group popup messages.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

const CHANNEL_NAME = "ott-group-call-window";

// ── Message types ────────────────────────────────────────────────────────

export interface GroupCallWindowOpenedMsg {
  type: "group-call-window:opened";
  callId: string;
}

export interface GroupCallWindowClosedMsg {
  type: "group-call-window:closed";
  callId: string;
  reason?: string;
}

export interface GroupCallWindowAcceptedMsg {
  type: "group-call-window:accepted";
  callId: string;
}

export interface GroupCallWindowRejectedMsg {
  type: "group-call-window:rejected";
  callId: string;
}

export interface MainGroupCallEndedMsg {
  type: "main:group-call-ended";
  callId: string;
  reason: string;
}

export type GroupCallWindowMessage =
  | GroupCallWindowOpenedMsg
  | GroupCallWindowClosedMsg
  | GroupCallWindowAcceptedMsg
  | GroupCallWindowRejectedMsg
  | MainGroupCallEndedMsg;

// ── Channel singleton (per browser tab/window) ───────────────────────────

let _channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (_channel) return _channel;
  try {
    _channel = new BroadcastChannel(CHANNEL_NAME);
    return _channel;
  } catch {
    return null;
  }
}

// ── Send ─────────────────────────────────────────────────────────────────

export function sendGroupMessage(msg: GroupCallWindowMessage): void {
  const ch = getChannel();
  if (ch) {
    try {
      ch.postMessage(msg);
    } catch {
      // ignore
    }
  }
}

// ── Listen ───────────────────────────────────────────────────────────────

type GroupMessageHandler = (msg: GroupCallWindowMessage) => void;

export function onGroupMessage(handler: GroupMessageHandler): () => void {
  const ch = getChannel();
  if (!ch) return () => {};

  const listener = (event: MessageEvent) => {
    if (event.data && typeof event.data === "object" && "type" in event.data) {
      handler(event.data as GroupCallWindowMessage);
    }
  };
  ch.addEventListener("message", listener);
  return () => ch.removeEventListener("message", listener);
}

// ── Cleanup ──────────────────────────────────────────────────────────────

export function closeGroupChannel(): void {
  if (_channel) {
    _channel.close();
    _channel = null;
  }
}
