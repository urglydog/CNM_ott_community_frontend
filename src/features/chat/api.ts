import apiClient from "../../lib/axios";
import type { DirectMessageItem } from "../../types";

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
