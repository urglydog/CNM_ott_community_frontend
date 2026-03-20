import { AuthUser, Channel, Group, MessageItem } from "../types";

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
    displayName?: string;
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
