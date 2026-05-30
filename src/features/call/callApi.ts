/**
 * Call REST API client.
 * Thin wrapper around apiClient for /api/calls/* endpoints.
 * Matches backend callController.js exactly.
 *
 * NOTE: This file contains NO Agora SDK imports.
 * Tokens are received from the backend and passed to the Agora RTC SDK
 * at a higher layer (UI hooks), not here.
 */

import apiClient from "../../lib/axios";
import type {
  CallType,
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
} from "./types";

// ── REST endpoints ─────────────────────────────────────────────────────────

/**
 * Start a new call.
 * POST /api/calls/start
 * Backend: callController.startCall → { call, token, recipientIds }
 */
export async function startCall(
  conversationId: string,
  callType: CallType,
): Promise<StartCallResponse> {
  const body: StartCallRequest = { conversationId, callType };
  const { data } = await apiClient.post<StartCallResponse>("/api/calls/start", body);
  return data;
}

/**
 * Get a fresh Agora token for an active/ringing call.
 * POST /api/calls/:callId/token
 * Backend: callController.getToken → TokenPayload
 */
export async function getCallToken(callId: string): Promise<GetTokenResponse> {
  const { data } = await apiClient.post<GetTokenResponse>(`/api/calls/${callId}/token`);
  return data;
}

/**
 * Accept an incoming call.
 * POST /api/calls/:callId/accept
 * Backend: callController.acceptCall → { call, token }
 */
export async function acceptCall(callId: string): Promise<AcceptCallResponse> {
  const { data } = await apiClient.post<AcceptCallResponse>(`/api/calls/${callId}/accept`);
  return data;
}

/**
 * Reject an incoming call.
 * POST /api/calls/:callId/reject
 * Backend: callController.rejectCall → { ended, call }
 */
export async function rejectCall(callId: string): Promise<RejectCallResponse> {
  const { data } = await apiClient.post<RejectCallResponse>(`/api/calls/${callId}/reject`);
  return data;
}

/**
 * Cancel a ringing call (initiator only).
 * POST /api/calls/:callId/cancel
 * Backend: callController.cancelCall → { ended, call }
 */
export async function cancelCall(callId: string): Promise<CancelCallResponse> {
  const { data } = await apiClient.post<CancelCallResponse>(`/api/calls/${callId}/cancel`);
  return data;
}

/**
 * End an active call.
 * POST /api/calls/:callId/end
 * Backend: callController.endCall → { ended, selfOnly, call }
 */
export async function endCall(callId: string): Promise<EndCallResponse> {
  const { data } = await apiClient.post<EndCallResponse>(`/api/calls/${callId}/end`);
  return data;
}

/**
 * Get the user's current active or ringing call (for crash/background recovery).
 * GET /api/calls/active
 * Backend: callController.getActiveCall → { call, token }
 */
export async function getActiveCall(): Promise<GetActiveCallResponse> {
  const { data } = await apiClient.get<GetActiveCallResponse>("/api/calls/active");
  return data;
}

/**
 * Get call history for a conversation.
 * GET /api/calls/history/:conversationId?limit=N&cursor=X
 * Backend: callController.getHistory → { items, nextCursor }
 */
export async function getCallHistory(
  conversationId: string,
  params?: { limit?: number; cursor?: string },
): Promise<GetCallHistoryResponse> {
  const { data } = await apiClient.get<GetCallHistoryResponse>(
    `/api/calls/history/${encodeURIComponent(conversationId)}`,
    { params },
  );
  return data;
}
