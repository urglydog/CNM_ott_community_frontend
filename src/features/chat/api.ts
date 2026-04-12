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
export async function getGroupMembers(
  groupId: string | number,
): Promise<Array<{
  userId: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  role: string;
}>> {
  const response = await apiClient.get(
    `/api/groups/${groupId}/members`,
  );
  return response.data || [];
}
