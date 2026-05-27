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
  formData.append("group_id", String(payload.groupId));

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

// ── Message Forward ──────────────────────────────────────────────────────────────

export interface ForwardMessagePayload {
  originalMessageId: string | number;
  sourceConversationId: string;
  targetConversationIds: string[];
}

export interface ForwardedMessage {
  id: number;
  senderId: string;
  content: string;
  contentType: string;
  attachments: unknown;
  isForwarded: boolean;
  originalSenderId: string | null;
  originalMessageId: string | null;
  originalConversationId: string | null;
  createdAt: string;
  senderDisplayName: string;
  senderAvatarUrl: string | null;
}

export interface ForwardResult {
  targetConversationId: string;
  forwardedMessage: ForwardedMessage;
}

export interface ForwardMessageResponse {
  success: boolean;
  message: string;
  data: {
    forwardedCount: number;
    results: ForwardResult[];
    skipped: string[];
    errors: Array<{ targetConversationId: string; error: string }>;
  };
}

export async function forwardMessage(
  payload: ForwardMessagePayload,
): Promise<ForwardMessageResponse> {
  const response = await apiClient.post<ForwardMessageResponse>(
    "/api/messages-extension/forward",
    payload,
  );
  return response.data;
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

// ── Message Delete For Me ───────────────────────────────────────────────────────

export interface DeleteForMePayload {
  conversationId: string;
  messageId: string;
}

export interface DeleteForMeResponse {
  success: boolean;
  message: string;
  data: {
    conversationId: string;
    messageId: string;
    deletedFor: string[];
    deletedForMeAt: string;
  };
}

export async function deleteMessageForMe(
  payload: DeleteForMePayload,
): Promise<DeleteForMeResponse> {
  const response = await apiClient.delete<DeleteForMeResponse>(
    `/api/messages-extension/delete-for-me/${encodeURIComponent(payload.conversationId)}/${encodeURIComponent(payload.messageId)}`,
  );
  return response.data;
}

// ── Read Receipts ───────────────────────────────────────────────────────────

export interface ReadReceiptReader {
  userId: string;
  readerName: string;
  readerAvatar: string | null;
  readAt: string;
}

export interface GetReadReceiptsResponse {
  messageId: string;
  conversationId: string;
  readCount: number;
  readers: ReadReceiptReader[];
}

export interface ReadStatusEntry {
  isRead: boolean;
  readers: ReadReceiptReader[];
}

export interface GetReadStatusForMessagesResponse {
  conversationId: string;
  statuses: Record<string, ReadStatusEntry>;
}

export interface GetLastReadPositionResponse {
  conversationId: string;
  hasReadMessages: boolean;
  lastReadMessageId: string | null;
  lastReadAt: string | null;
}

export interface MarkAsReadResponse {
  success: boolean;
  receipt: {
    conversationId: string;
    messageId: string;
    userId: string;
    readerName: string | null;
    readerAvatar: string | null;
    readAt: string;
  };
}

/**
 * Get read receipts for a specific message
 * GET /api/messages/read-receipts/:conversationId/:messageId
 */
export async function getReadReceipts(
  conversationId: string,
  messageId: string,
): Promise<GetReadReceiptsResponse> {
  const response = await apiClient.get<GetReadReceiptsResponse>(
    `/api/messages/read-receipts/${encodeURIComponent(conversationId)}/${encodeURIComponent(messageId)}`,
  );
  return response.data;
}

/**
 * Get read status for multiple messages in a conversation
 * GET /api/messages/read-receipts/conversation/:conversationId?messageIds=id1,id2
 */
export async function getReadStatusForMessages(
  conversationId: string,
  messageIds: string[],
): Promise<GetReadStatusForMessagesResponse> {
  const response = await apiClient.get<GetReadStatusForMessagesResponse>(
    `/api/messages/read-receipts/conversation/${encodeURIComponent(conversationId)}`,
    {
      params: { messageIds: messageIds.join(",") },
    },
  );
  return response.data;
}

/**
 * Get user's last read position in a conversation
 * GET /api/messages/read-receipts/last-read/:conversationId
 */
export async function getLastReadPosition(
  conversationId: string,
): Promise<GetLastReadPositionResponse> {
  const response = await apiClient.get<GetLastReadPositionResponse>(
    `/api/messages/read-receipts/last-read/${encodeURIComponent(conversationId)}`,
  );
  return response.data;
}

/**
 * Mark a message as read (via HTTP API)
 * POST /api/messages/read-receipts
 */
export async function markAsRead(
  conversationId: string,
  messageId: string,
): Promise<MarkAsReadResponse> {
  const response = await apiClient.post<MarkAsReadResponse>(
    "/api/messages/read-receipts",
    { conversationId, messageId },
  );
  return response.data;
}
