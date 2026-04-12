import apiClient from "../../lib/axios";
import type {
  AuthUser,
  FriendRequestItem,
  FriendItem,
  SearchUser,
  DirectMessageItem,
} from "../../types";

export type AuthMode = "login" | "register";

export interface AuthResponse {
  user: any;
  token: string;
}

export interface UpdateProfilePayload {
  displayName?: string;
  email?: string;
  phone?: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export interface VerifyEmailPayload {
  email: string;
  otp: string;
}

export interface VerifyPhonePayload {
  phone: string;
  otp: string;
}

export interface SendOTPResponse {
  message: string;
  expiresIn: number;
}

// ── Auth API ────────────────────────────────────────────────────────────

export async function authRequest(
  mode: AuthMode,
  body: {
    username: string;
    password: string;
    email?: string;
    fullName?: string;
    phone?: string;
  }
): Promise<AuthResponse> {
  const endpoint = mode === "login" ? "/api/users/login" : "/api/users/register";
  const response = await apiClient.post<AuthResponse>(endpoint, body);
  return response.data;
}

// ── Profile Management ──────────────────────────────────────────────────

export async function updateProfile(
  payload: UpdateProfilePayload
): Promise<{ user: any; message: string }> {
  const response = await apiClient.put<{ user: any; message: string }>(
    "/api/users/profile",
    payload
  );
  return response.data;
}

export async function getCurrentProfile(): Promise<any> {
  const response = await apiClient.get("/api/users/me");
  return response.data;
}

export async function changePassword(
  payload: ChangePasswordPayload
): Promise<{ message: string }> {
  const response = await apiClient.post<{ message: string }>(
    "/api/users/change-password",
    payload
  );
  return response.data;
}

// ── OTP Verification ─────────────────────────────────────────────────────

export async function sendEmailOTP(
  email: string
): Promise<SendOTPResponse> {
  const response = await apiClient.post<SendOTPResponse>(
    "/api/users/verify/email/send",
    { email }
  );
  return response.data;
}

export async function verifyEmailOTP(
  payload: VerifyEmailPayload
): Promise<{ message: string }> {
  const response = await apiClient.post<{ message: string }>(
    "/api/users/verify/email/confirm",
    payload
  );
  return response.data;
}

export async function sendPhoneOTP(
  phone: string
): Promise<SendOTPResponse> {
  const response = await apiClient.post<SendOTPResponse>(
    "/api/users/verify/phone/send",
    { phone }
  );
  return response.data;
}

export async function verifyPhoneOTP(
  payload: VerifyPhonePayload
): Promise<{ message: string }> {
  const response = await apiClient.post<{ message: string }>(
    "/api/users/verify/phone/confirm",
    payload
  );
  return response.data;
}

// ── Friend API ───────────────────────────────────────────────────────────

export async function fetchPendingFriendRequests(): Promise<FriendRequestItem[]> {
  const response = await apiClient.get<{ message: string; data: FriendRequestItem[]; count: number }>(
    "/api/friends/pending"
  );
  return response.data.data || [];
}

export async function getFriendsList(): Promise<FriendItem[]> {
  const response = await apiClient.get<{ message: string; data: FriendItem[]; count: number }>(
    "/api/friends"
  );
  return response.data.data || [];
}

export async function sendFriendRequest(
  receiverId: string | number
): Promise<void> {
  await apiClient.post("/api/friends/request", { receiverId });
}

export async function acceptFriendRequest(
  requestId: string | number
): Promise<void> {
  await apiClient.put("/api/friends/accept", { requestId });
}

export async function rejectFriendRequest(
  requestId: string | number
): Promise<void> {
  await apiClient.put("/api/friends/reject", { requestId });
}

export async function listUsers(): Promise<SearchUser[]> {
  const response = await apiClient.get<SearchUser[]>("/api/users/");
  return response.data || [];
}

// ── Messages API ─────────────────────────────────────────────────────────

export async function getDirectMessages(
  conversationId: string
): Promise<DirectMessageItem[]> {
  const response = await apiClient.get<DirectMessageItem[]>(
    `/api/messages/conversations/${encodeURIComponent(conversationId)}`
  );
  return response.data || [];
}

// ── Group/Channel API (giữ nguyên từ client.ts cũ) ──────────────────────

export async function fetchGroups(): Promise<any[]> {
  const response = await apiClient.get<any[]>("/api/groups");
  return response.data || [];
}

export async function fetchChannelsByGroup(
  groupId: string | number
): Promise<any[]> {
  const response = await apiClient.get<any[]>(`/api/channels/group/${groupId}`);
  return response.data || [];
}

export async function fetchMessagesByChannel(
  channelId: string | number
): Promise<any[]> {
  const response = await apiClient.get<any[]>(`/api/messages/channel/${channelId}`);
  return response.data || [];
}