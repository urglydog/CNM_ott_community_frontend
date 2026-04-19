import apiClient from "../../lib/axios";
import type { DirectMessageItem } from "../../types";

export interface GenerateCallTokenParams {
  callerId: string | number;
  receiverId: string | number;
  roomId?: string;
  expiredInSeconds?: number;
}

interface GenerateCallTokenApiResponse {
  appID: number;
  token: string;
  userID: string;
  expiredIn: number;
}

export interface GenerateCallTokenResult {
  appId: number;
  token: string;
  roomId: string;
  userId: string;
  expiredIn: number;
}

export function buildOneToOneCallRoomId(
  callerId: string | number,
  receiverId: string | number,
): string {
  const sorted = [String(callerId), String(receiverId)].sort();
  return `call_dm_${sorted[0]}_${sorted[1]}`;
}

export async function generateCallToken(
  params: GenerateCallTokenParams,
): Promise<GenerateCallTokenResult> {
  const response = await apiClient.get<GenerateCallTokenApiResponse>(
    "/api/calls/token",
    {
      params: {
        userID: String(params.callerId),
        roomId: params.roomId,
        expired_ts: params.expiredInSeconds,
      },
    },
  );

  const data = response.data;

  return {
    appId: Number(data.appID),
    token: String(data.token),
    roomId: buildOneToOneCallRoomId(params.callerId, params.receiverId),
    userId: String(data.userID),
    expiredIn: Number(data.expiredIn),
  };
}

export async function getDirectMessages(
  conversationId: string,
): Promise<DirectMessageItem[]> {
  const response = await apiClient.get<DirectMessageItem[]>(
    `/api/messages/conversations/${encodeURIComponent(conversationId)}`,
  );
  return response.data || [];
}

export async function fetchMessagesByChannel(
  channelId: string | number,
): Promise<any[]> {
  const response = await apiClient.get<any[]>(
    `/api/messages/channel/${channelId}`,
  );
  return response.data || [];
}

export async function fetchGroups(): Promise<any[]> {
  const response = await apiClient.get<any[]>("/api/groups");
  return response.data || [];
}

export async function fetchChannelsByGroup(
  groupId: string | number,
): Promise<any[]> {
  const response = await apiClient.get<any[]>(`/api/channels/group/${groupId}`);
  return response.data || [];
}

interface SendDirectFilePayload {
  file: File;
  senderId: string | number;
  receiverId: string | number;
}

interface SendGroupFilePayload {
  file: File;
  senderId: string | number;
  groupId: string | number;
}

interface SendDirectFileResponse {
  message: string;
  data: DirectMessageItem;
}

export async function sendDirectFileMessage(
  payload: SendDirectFilePayload,
): Promise<DirectMessageItem> {
  const formData = new FormData();
  formData.append("file", payload.file);
  formData.append("sender_id", String(payload.senderId));
  formData.append("receiver_id", String(payload.receiverId));

  const response = await apiClient.post<SendDirectFileResponse>(
    "/api/messages/file",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    },
  );

  return response.data?.data;
}

export async function sendGroupFileMessage(
  payload: SendGroupFilePayload,
): Promise<DirectMessageItem> {
  const formData = new FormData();
  formData.append("file", payload.file);
  formData.append("sender_id", String(payload.senderId));
  formData.append("channel_id", String(payload.groupId));

  const response = await apiClient.post<SendDirectFileResponse>(
    "/api/messages/file",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    },
  );

  return response.data?.data;
}

export interface BotChatResponse {
  sender: string;
  content: string;
}

export async function askBot(message: string): Promise<BotChatResponse> {
  const response = await apiClient.post<BotChatResponse>("/api/v1/bot/chat", {
    message,
  });
  return response.data;
}

/**
 * Lấy lịch sử tin nhắn nhóm.
 * Backend sử dụng conversationId = groupId nên dùng chung endpoint với DM.
 */
export async function getGroupMessages(
  groupId: string | number,
): Promise<DirectMessageItem[]> {
  const conversationId = String(groupId);
  const response = await apiClient.get<DirectMessageItem[]>(
    `/api/messages/conversations/${encodeURIComponent(conversationId)}`,
  );
  return response.data || [];
}

/**
 * Lấy danh sách thành viên nhóm để hiển thị avatar/tên người gửi trong chat nhóm.
 */
export async function getGroupMembers(groupId: string | number): Promise<
  Array<{
    userId: string;
    displayName: string;
    username: string;
    avatarUrl: string | null;
    role: string;
  }>
> {
  // Defensive normalization: prevent passing call-room ids like "group_call_xxx" to the members API.
  const normalizedGroupId = String(groupId)
    .replace(/^group_call_/, "")
    .trim();

  if (!normalizedGroupId) {
    throw new Error("groupId không hợp lệ khi gọi API lấy thành viên nhóm");
  }

  const response = await apiClient.get(
    `/api/groups/${encodeURIComponent(normalizedGroupId)}/members`,
  );
  return response.data || [];
}

// ── Message Revoke ──────────────────────────────────────────────────────────────

export interface RevokeMessagePayload {
  conversationId: string;
  messageId: string;
}

export interface RevokeMessageResponse {
  success: boolean;
  message: string;
  data: {
    conversationId: string;
    messageId: string;
    revokedAt: string;
    revokedBy: string;
  };
}

export async function revokeMessage(
  payload: RevokeMessagePayload,
): Promise<RevokeMessageResponse> {
  const response = await apiClient.put<RevokeMessageResponse>(
    "/api/messages-extension/revoke",
    payload,
  );
  return response.data;
}
