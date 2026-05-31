/**
 * Group Call Store — Zustand store for group call state.
 *
 * ⚠️ SEPARATE FROM DIRECT CALL STORE.
 * This store does NOT touch the direct-call store (useCallStore).
 * Both stores can coexist without conflict.
 *
 * Stores:
 *  - Current group call session (from backend CallSession)
 *  - Agora credentials (appId, token, uid, channelName) — per-user, received via ack
 *  - Remote participants Map<number, RemoteParticipant> — multi-user rendering
 *  - UI lifecycle phase (idle → ringing → joining → active → ended)
 *  - Participant connection state overlay (disconnected/reconnected)
 */

import { create } from "zustand";
import type {
  CallSession,
  RemoteParticipant,
  GroupCallPhase,
} from "./groupCallTypes";

// ── Agora credentials (received from backend, passed to RTC SDK) ───────────

export interface GroupCallCredentials {
  appId: string;
  token: string;
  uid: number;
  channelName: string;
}

// ── Store shape ────────────────────────────────────────────────────────────

interface GroupCallState {
  // — Lifecycle phase —
  phase: GroupCallPhase;

  // — Call session from backend —
  callSession: CallSession | null;
  callId: string | null;
  callType: "audio" | "video" | null;

  // — Agora credentials (populated on start/accept/join ack) —
  credentials: GroupCallCredentials | null;

  // — Remote participants keyed by Agora numeric UID —
  remoteParticipants: Map<number, RemoteParticipant>;

  // — userId ↔ uid mapping (for socket event → track lookup) —
  uidToUserId: Map<number, string>;
  userIdToUid: Map<string, number>;

  // — Participant profile cache (agoraUid → { displayName, avatarUrl }) —
  participantProfiles: Map<number, { displayName: string; avatarUrl: string | null }>;

  // — Participant connection states (overlay on callSession) —
  disconnectedUserIds: Set<string>;

  // — Popup state —
  popupOpened: boolean;

  // — Error state —
  lastError: { code: string; message: string } | null;
}

interface GroupCallActions {
  // — Phase transitions —
  setPhase: (phase: GroupCallPhase) => void;

  // — Call session —
  setCallSession: (session: CallSession) => void;

  // — Credentials —
  setCredentials: (creds: GroupCallCredentials) => void;

  // — Remote participants —
  addRemoteParticipant: (p: RemoteParticipant) => void;
  updateRemoteParticipant: (
    uid: number,
    patch: Partial<Omit<RemoteParticipant, "uid" | "userId">>,
  ) => void;
  removeRemoteParticipant: (uid: number) => void;
  clearRemoteParticipants: () => void;

  // — UID ↔ userId mapping —
  setUidMapping: (uid: number, userId: string) => void;

  // — Participant profiles —
  setParticipantProfiles: (profiles: Map<number, { displayName: string; avatarUrl: string | null }>) => void;

  // — Disconnect tracking —
  markDisconnected: (userId: string) => void;
  markReconnected: (userId: string) => void;

  // — Popup —
  setPopupOpened: (opened: boolean) => void;

  // — Error —
  setError: (error: { code: string; message: string } | null) => void;

  // — Full reset (call ended) —
  reset: () => void;
}

// ── Initial state ──────────────────────────────────────────────────────────

const initialState: GroupCallState = {
  phase: "idle",
  callSession: null,
  callId: null,
  callType: null,
  credentials: null,
  remoteParticipants: new Map(),
  uidToUserId: new Map(),
  userIdToUid: new Map(),
  participantProfiles: new Map(),
  disconnectedUserIds: new Set(),
  popupOpened: false,
  lastError: null,
};

// ── Store ──────────────────────────────────────────────────────────────────

export const useGroupCallStore = create<GroupCallState & GroupCallActions>(
  (set, get) => ({
    ...initialState,

    setPhase: (phase) => set({ phase }),

    setCallSession: (session) =>
      set({
        callSession: session,
        callId: session.callId,
        callType: session.callType === "audio" ? "audio" : "video",
      }),

    setCredentials: (creds) => set({ credentials: creds }),

    // — Remote participants —

    addRemoteParticipant: (p) =>
      set((state) => {
        const next = new Map(state.remoteParticipants);
        next.set(p.uid, p);
        return { remoteParticipants: next };
      }),

    updateRemoteParticipant: (uid, patch) =>
      set((state) => {
        const existing = state.remoteParticipants.get(uid);
        if (!existing) return state;
        const next = new Map(state.remoteParticipants);
        next.set(uid, { ...existing, ...patch });
        return { remoteParticipants: next };
      }),

    removeRemoteParticipant: (uid) =>
      set((state) => {
        const next = new Map(state.remoteParticipants);
        next.delete(uid);

        // Also clean up UID mapping
        const uidToUserId = new Map(state.uidToUserId);
        const userIdToUid = new Map(state.userIdToUid);
        const userId = uidToUserId.get(uid);
        if (userId) {
          uidToUserId.delete(uid);
          userIdToUid.delete(userId);
        }

        return {
          remoteParticipants: next,
          uidToUserId,
          userIdToUid,
        };
      }),

    clearRemoteParticipants: () =>
      set({
        remoteParticipants: new Map(),
        uidToUserId: new Map(),
        userIdToUid: new Map(),
        participantProfiles: new Map(),
      }),

    // — UID ↔ userId mapping —

    setUidMapping: (uid, userId) =>
      set((state) => ({
        uidToUserId: new Map(state.uidToUserId).set(uid, userId),
        userIdToUid: new Map(state.userIdToUid).set(userId, uid),
      })),

    setParticipantProfiles: (profiles) => set({ participantProfiles: profiles }),

    // — Popup —

    setPopupOpened: (opened) => set({ popupOpened: opened }),

    // — Disconnect tracking —

    markDisconnected: (userId) =>
      set((state) => {
        const next = new Set(state.disconnectedUserIds);
        next.add(userId);
        return { disconnectedUserIds: next };
      }),

    markReconnected: (userId) =>
      set((state) => {
        const next = new Set(state.disconnectedUserIds);
        next.delete(userId);
        return { disconnectedUserIds: next };
      }),

    // — Error —

    setError: (error) => set({ lastError: error }),

    // — Full reset —

    reset: () => set(initialState),
  }),
);