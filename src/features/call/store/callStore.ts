import { create } from "zustand";

export type IncomingCallState = {
  roomId: string;
  conversationId?: string;
  callerId: string;
  callerName: string;
  receiverId?: string;
  isGroupCall?: boolean;
  callType?: "video" | "audio";
};

export type ActiveCallState = {
  roomId: string;
  conversationId: string;
  remoteUserId: string;
  remoteUserName: string;
  isGroupCall?: boolean;
  callType?: "video" | "audio";
  // Optional: token/appId từ backend (1-on-1 calls); group calls sẽ bổ sung sau)
  token?: string;
  appId?: number;
  // Thời lượng cuộc gọi (tính bằng giây) — được gửi từ backend khi call-ended
  duration?: number;
};

export type OutgoingCallState = {
  roomId: string;
  conversationId: string;
  receiverId: string;
  receiverName: string;
  isGroupCall: boolean;
  callType?: "video" | "audio";
};

interface CallState {
  incomingCall: IncomingCallState | null;
  activeCall: ActiveCallState | null;
  outgoingCall: OutgoingCallState | null;
  isCallEnding: boolean;
  lastEndedCallDuration: number; // seconds — lưu sau khi cuộc gọi kết thúc
  setLastEndedCallDuration: (seconds: number) => void;
  setIncomingCall: (call: IncomingCallState | null) => void;
  setActiveCall: (call: ActiveCallState | null) => void;
  setOutgoingCall: (call: OutgoingCallState | null) => void;
  setIsCallEnding: (status: boolean) => void;
  clearCallState: () => void;
  reset: () => void;
}

export const useCallStore = create<CallState>((set) => ({
  incomingCall: null,
  activeCall: null,
  outgoingCall: null,
  isCallEnding: false,
  lastEndedCallDuration: 0,

  setIncomingCall: (call) => set({ incomingCall: call }),
  setActiveCall: (call) =>
    set({ activeCall: call, incomingCall: null, outgoingCall: null, isCallEnding: false }),
  setOutgoingCall: (call) => set({ outgoingCall: call }),
  setIsCallEnding: (status) => set({ isCallEnding: status }),
  clearCallState: () =>
    set({ incomingCall: null, activeCall: null, outgoingCall: null, isCallEnding: false }),
  setLastEndedCallDuration: (seconds: number) => set({ lastEndedCallDuration: seconds }),

  reset: () =>
    set({
      incomingCall: null,
      activeCall: null,
      outgoingCall: null,
      isCallEnding: false,
      lastEndedCallDuration: 0,
    }),
}));
