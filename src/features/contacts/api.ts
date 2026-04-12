import apiClient from "../../lib/axios";
import type {
  FriendRequestItem,
  FriendItem,
  SearchUser,
  FriendsListResponse,
  PendingResponse,
} from "../../types";

export async function fetchPendingFriendRequests(): Promise<FriendRequestItem[]> {
  const response = await apiClient.get<PendingResponse>("/api/friends/pending");
  return response.data.data || [];
}

export async function getFriendsList(): Promise<FriendItem[]> {
  const response = await apiClient.get<FriendsListResponse>("/api/friends");
  return response.data.data || [];
}

export async function listUsers(): Promise<SearchUser[]> {
  const response = await apiClient.get<SearchUser[]>("/api/users/");
  return response.data || [];
}

export async function sendFriendRequest(
  payload: { receiverId: string | number }
): Promise<void> {
  await apiClient.post("/api/friends/request", payload);
}

export async function acceptFriendRequest(
  payload: { requestId: string | number }
): Promise<void> {
  await apiClient.put("/api/friends/accept", payload);
}

export async function rejectFriendRequest(
  payload: { requestId: string | number }
): Promise<void> {
  await apiClient.put("/api/friends/reject", payload);
}