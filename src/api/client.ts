import { AuthUser, Channel, Group, MessageItem } from "../types";
import type {
  FriendRequestItem,
  FriendRequestPayload,
  AcceptRejectPayload,
  PendingResponse,
  SearchUser,
  FriendItem,
  FriendsListResponse,
  DirectMessageItem,
  DirectMessagesResponse,
} from "../types";

// Cho phép cấu hình qua biến môi trường, fallback localhost
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

export type AuthMode = "login" | "register";

export interface AuthResponse {
  user: any;
  token: string;
}

async function handleJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    const message = errData?.message || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export async function authRequest(
  mode: AuthMode,
  body: {
    username: string;
    password: string;
    email?: string;
    fullName?: string;
    phone?: string;
  },
): Promise<AuthResponse> {
  const endpoint =
    mode === "login" ? "/api/users/login" : "/api/users/register";

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return handleJson<AuthResponse>(res);
}

export async function fetchGroups(): Promise<Group[]> {
  const res = await fetch(`${API_BASE}/api/groups`);
  const data = await handleJson<any[]>(res);
  return Array.isArray(data) ? (data as Group[]) : [];
}

export async function fetchChannelsByGroup(
  groupId: string | number,
): Promise<Channel[]> {
  const res = await fetch(`${API_BASE}/api/channels/group/${groupId}`);
  const data = await handleJson<any[]>(res);
  return Array.isArray(data) ? (data as Channel[]) : [];
}

export async function fetchMessagesByChannel(
  channelId: string | number,
): Promise<MessageItem[]> {
  const res = await fetch(`${API_BASE}/api/messages/channel/${channelId}`);
  const data = await handleJson<any[]>(res);
  return Array.isArray(data) ? (data as MessageItem[]) : [];
}

// ── Auth token helper (lấy token từ localStorage) ──────────────────────────────

function getAuthHeaders(): Record<string, string> {
  try {
    const stored = localStorage.getItem("ott_auth_user");
    if (stored) {
      const user: AuthUser = JSON.parse(stored);
      return { Authorization: `Bearer ${user.token}` };
    }
  } catch {
    // ignore
  }
  return {};
}

function authFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const headers = getAuthHeaders();
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...headers,
      ...options.headers,
    },
  });
}

// ── Friend Request API ───────────────────────────────────────────────────────────

/**
 * Lấy danh sách lời mời kết bạn đang chờ
 */
export async function fetchPendingFriendRequests(): Promise<FriendRequestItem[]> {
  const res = await authFetch(`${API_BASE}/api/friends/pending`);
  const data: PendingResponse = await handleJson<PendingResponse>(res);
  return Array.isArray(data.data) ? data.data : [];
}

/**
 * Lấy danh sách bạn bè đã chấp nhận
 */
export async function getFriendsList(): Promise<FriendItem[]> {
  const res = await authFetch(`${API_BASE}/api/friends`);
  const data: FriendsListResponse = await handleJson<FriendsListResponse>(res);
  return Array.isArray(data.data) ? data.data : [];
}

/**
 * Lấy tin nhắn cho một cuộc trò chuyện trực tiếp (DM)
 * @param conversationId - Format: dm:{friendId}
 */
export async function getDirectMessages(conversationId: string): Promise<DirectMessageItem[]> {
  const res = await authFetch(`${API_BASE}/api/messages/conversations/${encodeURIComponent(conversationId)}`);
  const data: DirectMessageItem[] = await handleJson<DirectMessageItem[]>(res);
  return Array.isArray(data) ? data : [];
}

/**
 * Lấy danh sách tất cả người dùng (để tìm bạn)
 */
export async function listUsers(): Promise<SearchUser[]> {
  const res = await authFetch(`${API_BASE}/api/users/`);
  const data: any[] = await handleJson<any[]>(res);
  return Array.isArray(data) ? (data as SearchUser[]) : [];
}

/**
 * Gửi lời mời kết bạn
 */
export async function sendFriendRequest(
  payload: FriendRequestPayload,
): Promise<void> {
  const res = await authFetch(`${API_BASE}/api/friends/request`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  await handleJson<{ message: string }>(res);
}

/**
 * Chấp nhận lời mời kết bạn
 */
export async function acceptFriendRequest(
  payload: AcceptRejectPayload,
): Promise<void> {
  const res = await authFetch(`${API_BASE}/api/friends/accept`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  await handleJson<{ message: string }>(res);
}

/**
 * Từ chối lời mời kết bạn
 */
export async function rejectFriendRequest(
  payload: AcceptRejectPayload,
): Promise<void> {
  const res = await authFetch(`${API_BASE}/api/friends/reject`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  await handleJson<{ message: string }>(res);
}

// ── Profile Management API ─────────────────────────────────────────────────────

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

/**
 * Cập nhật thông tin profile
 */
export async function updateProfile(
  payload: UpdateProfilePayload,
): Promise<{ user: any; message: string }> {
  const res = await authFetch(`${API_BASE}/api/users/profile`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return handleJson<{ user: any; message: string }>(res);
}

/**
 * Gửi OTP xác thực email
 */
export async function sendEmailOTP(email: string): Promise<SendOTPResponse> {
  const res = await authFetch(`${API_BASE}/api/users/verify/email/send`, {
    method: "POST",
    body: JSON.stringify({ email }),
  });
  return handleJson<SendOTPResponse>(res);
}

/**
 * Xác thực email bằng OTP
 */
export async function verifyEmailOTP(
  payload: VerifyEmailPayload,
): Promise<{ message: string }> {
  const res = await authFetch(`${API_BASE}/api/users/verify/email/confirm`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return handleJson<{ message: string }>(res);
}

/**
 * Gửi OTP xác thực số điện thoại
 */
export async function sendPhoneOTP(phone: string): Promise<SendOTPResponse> {
  const res = await authFetch(`${API_BASE}/api/users/verify/phone/send`, {
    method: "POST",
    body: JSON.stringify({ phone }),
  });
  return handleJson<SendOTPResponse>(res);
}

/**
 * Xác thực số điện thoại bằng OTP
 */
export async function verifyPhoneOTP(
  payload: VerifyPhonePayload,
): Promise<{ message: string }> {
  const res = await authFetch(`${API_BASE}/api/users/verify/phone/confirm`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return handleJson<{ message: string }>(res);
}

/**
 * Đổi mật khẩu
 */
export async function changePassword(
  payload: ChangePasswordPayload,
): Promise<{ message: string }> {
  const res = await authFetch(`${API_BASE}/api/users/change-password`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return handleJson<{ message: string }>(res);
}

/**
 * Lấy thông tin profile hiện tại
 */
export async function getCurrentProfile(): Promise<any> {
  const res = await authFetch(`${API_BASE}/api/users/me`);
  return handleJson<any>(res);
}
