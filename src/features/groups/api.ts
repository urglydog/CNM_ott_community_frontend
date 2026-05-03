import apiClient from "../../lib/axios";
import type { Group, InviteInfo } from "./types";
import type { AuthUser } from "../../types";

function getAuthStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage;
}

function getUserId(): string | null {
  try {
    const stored = getAuthStorage()?.getItem("ott_auth_user");
    if (stored) {
      const user: AuthUser = JSON.parse(stored);
      return String(user.id || user.userId);
    }
  } catch {
    // ignore
  }
  return null;
}

export interface CreateGroupPayload {
  name: string;
  description?: string;
  type?: string;
  allowSendLinks?: string;
  spamFilterLevel?: number;
}

export interface JoinGroupPayload {
  userId?: string | number;
}

export interface GroupsResponse {
  message?: string;
  data?: Group[];
  count?: number;
}

export interface GroupDetailResponse {
  groupId: string | number;
  name: string;
  description?: string;
  topic?: string;
  inviteCode?: string;
  ownerId?: string;
  memberCount?: number;
  createdAt?: string;
  members?: Array<{
    userId: string;
    displayName: string;
    username: string;
    avatarUrl: string | null;
    role: string;
  }>;
}

/**
 * Tạo nhóm mới
 * POST /api/groups
 * Header: Authorization: Bearer <token> (userId tự động lấy từ token)
 */
export async function createGroup(
  payload: CreateGroupPayload
): Promise<Group> {
  const response = await apiClient.post<Group>("/api/groups", payload);
  return response.data;
}

/**
 * Lấy danh sách tất cả nhóm (không cần auth)
 * GET /api/groups
 */
export async function fetchAllGroups(): Promise<Group[]> {
  const response = await apiClient.get<Group[]>("/api/groups");
  return response.data;
}

/**
 * Lấy chi tiết một nhóm
 * GET /api/groups/:groupId
 */
export async function fetchGroupById(
  groupId: string | number
): Promise<GroupDetailResponse> {
  const response = await apiClient.get<GroupDetailResponse>(
    `/api/groups/${groupId}`
  );
  return response.data;
}

/**
 * Lấy danh sách nhóm của tôi
 * GET /api/groups/user/:userId
 * userId được lấy tự động từ localStorage
 */
export async function fetchMyGroups(): Promise<Group[]> {
  const userId = getUserId();
  if (!userId) {
    return [];
  }
  const response = await apiClient.get<GroupsResponse>(`/api/groups/user/${userId}`);
  if (response.data?.data) {
    return response.data.data;
  }
  if (Array.isArray(response.data)) {
    return response.data as Group[];
  }
  return [];
}

/**
 * Tham gia nhóm bằng mã mời
 * POST /api/groups/join/:inviteCode
 * Header: Authorization: Bearer <token> (userId tự động lấy từ token)
 */
export async function joinGroupByCode(
  inviteCode: string
): Promise<{ message: string; group?: Group }> {
  const encodedCode = encodeURIComponent(inviteCode);
  const userId = getUserId();

  const response = await apiClient.post<{ message: string; group?: Group }>(
    `/api/groups/join/${encodedCode}`,
    { userId }
  );
  return response.data;
}

/**
 * Lấy mã mời của nhóm
 * GET /api/groups/:groupId/invite
 * Header: Authorization: Bearer <token>
 */
export async function fetchGroupInvite(
  groupId: string | number
): Promise<InviteInfo> {
  const response = await apiClient.get<InviteInfo>(
    `/api/groups/${groupId}/invite`
  );
  return response.data;
}

/**
 * Thêm thành viên vào nhóm
 * POST /api/groups/:groupId/members
 */
export async function addMemberToGroup(
  groupId: string | number,
  userId: string | number,
  role: string = "member"
): Promise<{ message: string }> {
  const response = await apiClient.post<{ message: string }>(
    `/api/groups/${groupId}/members`,
    { userId, role }
  );
  return response.data;
}

export async function addMembersToGroup(
  groupId: string | number,
  userIds: (string | number)[]
): Promise<any> {
  const response = await apiClient.post(`/api/groups/${groupId}/members`, { userIds });
  return response.data;
}

export async function removeMemberFromGroup(
  groupId: string | number,
  targetUserId: string | number
): Promise<any> {
  const response = await apiClient.delete(`/api/groups/${groupId}/members/${targetUserId}`);
  return response.data;
}

export async function updateMemberRole(
  groupId: string | number,
  targetUserId: string | number,
  newRole: string
): Promise<any> {
  const response = await apiClient.patch(`/api/groups/${groupId}/members/${targetUserId}/role`, { role: newRole });
  return response.data;
}

export async function leaveGroup(groupId: string | number, newOwnerId?: string | number): Promise<any> {
  const response = await apiClient.delete(`/api/groups/${groupId}/leave`, { data: { newOwnerId } });
  return response.data;
}

export async function disbandGroup(groupId: string | number): Promise<any> {
  const response = await apiClient.delete(`/api/groups/${groupId}/disband`);
  return response.data;
}

export async function getGroupMembers(groupId: string | number): Promise<any[]> {
  const response = await apiClient.get(`/api/groups/${groupId}/members`);
  return response.data;
}

export async function fetchPendingRequests(
  groupId: string | number
): Promise<any[]> {
  const response = await apiClient.get(`/api/groups/${groupId}/requests`);
  return response.data;
}

export async function handleJoinRequest(
  groupId: string | number,
  userId: string | number,
  action: "APPROVE" | "REJECT"
): Promise<{ message: string }> {
  const response = await apiClient.patch(
    `/api/groups/${groupId}/requests/${userId}`,
    { action }
  );
  return response.data;
}

export async function updateGroupSettings(
  groupId: string | number,
  settings: { isApprovalRequired?: boolean; allowSendLinks?: string; spamFilterLevel?: number }
): Promise<{ message: string }> {
  const response = await apiClient.patch(
    `/api/groups/${groupId}/settings`,
    settings
  );
  return response.data;
}

