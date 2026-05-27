/**
 * Call state store (Zustand).
 * Provider-neutral call state — no Agora SDK imports.
 *
 * Holds the current call session, connection status, and UI flags.
 * Updated by callSocket event handlers and callApi responses.
 *
 * Token payloads are intentionally NOT stored here — they are
 * ephemeral and consumed immediately by the Agora RTC join layer.
 */

import { create } from "zustand";
import type {
  CallSession,
  CallStatus,
  CallMode,
  CallType,
  CallParticipant,
  ConnectionState,
} from "./types";

// ── Store shape ────────────────────────────────────────────────────────────

export type CallPhase =
  | "idle"          // No active call
  | "outgoing"      // Initiating call, waiting for acceptance
  | "incoming"      // Receiving an incoming call
  | "connecting"    // Accepted, joining Agora channel
  | "active"        // In an active call
  | "reconnecting"  // Temporarily disconnected, waiting to reconnect
  | "ended";        // Call just ended (brief state before reset)

interface CallState {
  // ── Core state ─────────────────────────────────────────────────────────
  /** Current call phase — drives UI rendering */
  phase: CallPhase;

  /** The full call session from the backend (public payload, no tokens) */
  callSession: CallSession | null;

  /** Current user's ID (set when call state is initialized) */
  currentUserId: string | null;

  /** Whether the local user is the initiator of the current call */
  isInitiator: boolean;

  /** The channel name for the Agora RTC session */
  channelName: string | null;

  // ── Call window (pop-out) state ─────────────────────────────────────────
  /** True while the pop-out call window is being opened (before "opened" confirmation) */
  callWindowOpening: boolean;

  /** True after the pop-out call window confirmed it joined Agora */
  callWindowJoined: boolean;

  /** Stored URL for manual open when popup was blocked by browser */
  pendingCallWindowUrl: string | null;

  // ── Error state ────────────────────────────────────────────────────────
  /** Last call error message (for UI display) */
  errorMessage: string | null;

  /** Last call error code (for programmatic handling) */
  errorCode: string | null;

  // ── Actions ────────────────────────────────────────────────────────────

  /** Set the current user ID (called once on auth) */
  setCurrentUserId: (userId: string | null) => void;

  /**
   * Mark an outgoing call as initiated.
   * Called after call:start ack succeeds.
   */
  setOutgoing: (callSession: CallSession) => void;

  /**
   * Mark an incoming call as received.
   * Called when call:incoming event fires.
   */
  setIncoming: (callSession: CallSession) => void;

  /**
   * Transition to connecting phase (after accept ack).
   * Updates the callSession with the latest state.
   */
  setConnecting: (callSession: CallSession) => void;

  /**
   * Mark the call as active.
   * Called when status transitions to "active" (first accept or state-updated).
   */
  setActive: (callSession: CallSession) => void;

  /**
   * Update the callSession from a server event.
   * Does NOT change phase unless status warrants it.
   * Used by: call:accepted, call:state-updated, call:participant-joined, etc.
   */
  updateSession: (callSession: CallSession) => void;

  /**
   * Mark the call as reconnecting (participant disconnected).
   */
  setReconnecting: (callSession: CallSession) => void;

  /**
   * Mark the call as ended.
   * Stores the ended session briefly for UI display.
   */
  setEnded: (callSession: CallSession) => void;

  /**
   * Set an error message and code.
   */
  setError: (message: string, code?: string) => void;

  /**
   * Clear error state.
   */
  clearError: () => void;

  /**
   * Reset to idle state.
   * Called after the ended state has been displayed or on explicit dismiss.
   */
  reset: () => void;

  // ── Call window actions ────────────────────────────────────────────────

  /** Set whether the pop-out call window is being opened */
  setCallWindowOpening: (opening: boolean) => void;

  /** Set whether the pop-out call window has confirmed Agora join */
  setCallWindowJoined: (joined: boolean) => void;

  /** Store a URL for manual popup open when browser blocked the initial attempt */
  setPendingCallWindowUrl: (url: string | null) => void;

  // ── Derived getters (convenience) ─────────────────────────────────────

  /** Get the callId of the current call, or null */
  getCallId: () => string | null;

  /** Get the callType of the current call, or null */
  getCallType: () => CallType | null;

  /** Get the callMode of the current call, or null */
  getCallMode: () => CallMode | null;

  /** Get the current user's participant object, or null */
  getMyParticipant: () => CallParticipant | null;

  /** Get all participants except the current user */
  getRemoteParticipants: () => CallParticipant[];

  /** Check if the current user has accepted */
  hasAccepted: () => boolean;

  /** Check if the current user is disconnected */
  isDisconnected: () => boolean;
}

// ── Initial state ──────────────────────────────────────────────────────────

const initialState = {
  phase: "idle" as CallPhase,
  callSession: null as CallSession | null,
  currentUserId: null as string | null,
  isInitiator: false,
  channelName: null as string | null,
  errorMessage: null as string | null,
  errorCode: null as string | null,
  callWindowOpening: false,
  callWindowJoined: false,
  pendingCallWindowUrl: null as string | null,
};

// ── Store ──────────────────────────────────────────────────────────────────

export const useCallStore = create<CallState>((set, get) => ({
  ...initialState,

  setCurrentUserId: (userId) => set({ currentUserId: userId }),

  setOutgoing: (callSession) =>
    set({
      phase: "outgoing",
      callSession,
      isInitiator: true,
      channelName: callSession.channelName,
      errorMessage: null,
      errorCode: null,
    }),

  setIncoming: (callSession) =>
    set({
      phase: "incoming",
      callSession,
      isInitiator: false,
      channelName: callSession.channelName,
      errorMessage: null,
      errorCode: null,
    }),

  setConnecting: (callSession) =>
    set({
      phase: "connecting",
      callSession,
    }),

  setActive: (callSession) =>
    set({
      phase: "active",
      callSession,
    }),

  updateSession: (callSession) => {
    const { phase } = get();

    // Auto-transition phase based on call status
    if (callSession.status === "active" && (phase === "outgoing" || phase === "connecting" || phase === "incoming")) {
      set({ phase: "active", callSession });
      return;
    }

    if (callSession.status === "ended" || callSession.status === "missed" || callSession.status === "rejected" || callSession.status === "cancelled") {
      set({ phase: "ended", callSession });
      return;
    }

    // Otherwise just update the session
    set({ callSession });
  },

  setReconnecting: (callSession) =>
    set({
      phase: "reconnecting",
      callSession,
    }),

  setEnded: (callSession) =>
    set({
      phase: "ended",
      callSession,
    }),

  setError: (message, code) =>
    set({
      errorMessage: message,
      errorCode: code || null,
    }),

  clearError: () =>
    set({
      errorMessage: null,
      errorCode: null,
    }),

  reset: () =>
    set({
      ...initialState,
      callWindowOpening: false,
      callWindowJoined: false,
      pendingCallWindowUrl: null,
    }),

  setCallWindowOpening: (opening) => set({ callWindowOpening: opening }),
  setCallWindowJoined: (joined) => set({ callWindowJoined: joined }),
  setPendingCallWindowUrl: (url) => set({ pendingCallWindowUrl: url }),

  // ── Derived getters ────────────────────────────────────────────────────

  getCallId: () => get().callSession?.callId ?? null,

  getCallType: () => get().callSession?.callType ?? null,

  getCallMode: () => get().callSession?.callMode ?? null,

  getMyParticipant: () => {
    const { callSession, currentUserId } = get();
    if (!callSession || !currentUserId) return null;
    return (
      callSession.participants.find(
        (p) => String(p.userId) === String(currentUserId),
      ) ?? null
    );
  },

  getRemoteParticipants: () => {
    const { callSession, currentUserId } = get();
    if (!callSession || !currentUserId) return [];
    return callSession.participants.filter(
      (p) => String(p.userId) !== String(currentUserId),
    );
  },

  hasAccepted: () => {
    const me = get().getMyParticipant();
    return me?.status === "accepted";
  },

  isDisconnected: () => {
    const me = get().getMyParticipant();
    return me?.connectionState === "disconnected";
  },
}));
