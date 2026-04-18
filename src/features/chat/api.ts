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
