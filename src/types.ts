export type Group = {
  groupId: string | number;
  name: string;
  description?: string;
  topic?: string;
};

export type Channel = {
  id: string | number;
  groupId: string | number;
  name: string;
  type: "text_chat" | "voice_room";
};

export type MessageItem = {
  id: string | number;
  conversationId: string;
  senderId: string | number;
  contentType: string;
  content: string;
  createdAt: string;
};

export type AuthUser = {
  id: string | number;
  userId?: string;
  username: string;
  displayName: string;
  email?: string;
  /** Access token — gửi kèm Bearer cho API được bảo vệ */
  token: string;
  refreshToken: string;
};

// ── Friend System Types ─────────────────────────────────────────────────────────

export type FriendshipStatus = "pending" | "accepted" | "rejected";

export interface FriendRequestItem {
  id: number;
  sender_id: number;
  receiver_id: number;
  status: FriendshipStatus;
  created_at: string;
  updated_at: string;
  sender_display_name: string;
  sender_username: string;
  sender_avatar_url: string | null;
}

export interface FriendRequestPayload {
  receiverId: string | number;
}

export interface AcceptRejectPayload {
  requestId: string | number;
}

export interface PendingResponse {
  message: string;
  data: FriendRequestItem[];
  count: number;
}

export interface FriendSocketPayload {
  type: "new_friend_request" | "friend_request_accepted";
  sender?: {
    id: number;
    display_name: string;
    username: string;
    avatar_url: string | null;
  };
  receiver?: {
    id: number;
    display_name: string;
    username: string;
    avatar_url: string | null;
  };
  timestamp: string;
}

export interface SearchUser {
  id: number;
  userId?: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  email?: string;
  /** Số điện thoại (nếu backend có trả về) */
  phone_number?: string | null;
}

export interface FriendItem {
  friendshipId: string;
  friend_id: string;
  status: "accepted";
  updated_at: string;
  friend_display_name: string;
  friend_username: string;
  friend_avatar_url: string | null;
}

export interface FriendsListResponse {
  message: string;
  data: FriendItem[];
  count: number;
}

// ── Direct Message Types ────────────────────────────────────────────────────────

export interface DirectMessageItem {
  id: number;
  conversationId: string;
  senderId: string | number;
  contentType: string;
  content: string;
  createdAt: string;
}

export interface DirectMessagesResponse {
  message: string;
  data: DirectMessageItem[];
  count: number;
}
