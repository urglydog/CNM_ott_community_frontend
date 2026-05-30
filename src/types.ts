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
  stickerData?: StickerData;
  /** Dữ liệu vị trí — chỉ có khi contentType === "location" */
  locationData?: LocationData | null;
  /** Dữ liệu bình chọn — chỉ có khi contentType === "poll" */
  pollData?: PollData | null;
  attachments?: MessageAttachment[] | null;
  reactions?: unknown;
  replyTo?: string | number | null;
  replyToMessage?: ReplyToMessage | null;
  storyReply?: StoryReply | null;
  createdAt: string;
  senderDisplayName?: string | null;
  senderAvatarUrl?: string | null;
};

export interface MessageAttachment {
  url: string;
  type: "image" | "video" | "file" | string;
  size?: number;
  thumbnailUrl?: string | null;
  mimeType?: string | null;
  key?: string | null;
  name?: string | null;
}

export interface StoryReply {
  storyId: string;
  authorName: string;
  type: "image" | "text";
  text?: string;
  mediaUrl?: string | null;
}

/**
 * Thông tin cơ bản của tin nhắn gốc đang được trả lời.
 * Dùng để hiển thị preview trong UI.
 */
export interface ReplyToMessage {
  id: string | number;
  content: string;
  contentType: string;
  senderId: string | number;
  senderDisplayName?: string | null;
  senderAvatarUrl?: string | null;
  attachments?: MessageAttachment[] | null;
}

export interface StickerData {
  stickerId?: string;
  stickerUrl?: string;
  stickerPack?: string;
  stickerName?: string;
}

/**
 * Dữ liệu vị trí địa lý cho tin nhắn loại "location".
 * lat/lng là tọa độ GPS; label là tên địa điểm tuỳ chọn.
 */
export interface LocationData {
  lat: number;
  lng: number;
  label?: string | null;
  /** Nếu true: đây là tin nhắn live location (không phải static) */
  isLive?: boolean;
  /** ISO string – thời điểm kết thúc live location */
  liveUntil?: string | null;
}

/**
 * Một lựa chọn trong bình chọn.
 */
export interface PollOption {
  id: string;
  text: string;
  voterIds: (string | number)[];
}

/**
 * Cài đặt cho bình chọn.
 */
export interface PollSettings {
  /** Cho phép chọn nhiều đáp án cùng lúc */
  multipleChoice: boolean;
  /** Cho phép thêm đáp án mới */
  allowAddOption: boolean;
}

/**
 * Dữ liệu bình chọn cho tin nhắn loại "poll".
 */
export interface PollData {
  pollOptions: PollOption[];
  pollSettings: PollSettings;
}

/**
 * Payload cho sự kiện Live Location gửi qua Socket.io.
 * Không lưu vào DB — chỉ broadcast realtime trong room.
 */
export interface LiveLocationStartedPayload {
  roomId: string;
  senderId: string | number;
  senderDisplayName?: string | null;
  senderAvatarUrl?: string | null;
  startedAt: string;
}

export interface LiveLocationUpdatedPayload {
  roomId: string;
  senderId: string | number;
  lat: number;
  lng: number;
  updatedAt: string;
}

export interface LiveLocationStoppedPayload {
  roomId: string;
  senderId: string | number;
  stoppedAt: string;
}

export interface ReadReceiptReader {
  userId: string;
  readerName: string;
  readerAvatar?: string | null;
  readAt: string;
}

export type AuthUser = {
  id: string | number;
  userId?: string;
  username: string;
  displayName: string;
  email?: string;
  phone?: string;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  token: string;
  refreshToken?: string;
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

// ── QR Code Friend Types ─────────────────────────────────────────────────────────

export interface QRInfo {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  qrData: string;
}

export interface QRFriendRequestResult {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: FriendshipStatus;
  receiver: {
    userId: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

export interface FriendItem {
  friendshipId: string;
  friend_id: string;
  /** Numeric id if available (for compatibility with some code) */
  id?: string | number;
  /** DynamoDB userId string (for API calls) */
  userId?: string;
  status: "accepted";
  updated_at: string;
  friend_display_name: string;
  friend_original_name?: string;
  friend_username: string;
  friend_avatar_url: string | null;
  /** Nickname set by current user for this friend */
  nickname?: string | null;
  chatBgUrl?: string | null;
  pinnedMessages?: unknown[];
}

export interface FriendsListResponse {
  message: string;
  data: FriendItem[];
  count: number;
}

// ── Direct Message Types ────────────────────────────────────────────────────────

export interface DirectMessageItem {
  id: number | string;
  /** Alternative ID field returned by some backend endpoints */
  messageId?: number | string;
  conversationId: string;
  senderId: string | number;
  contentType: string;
  content: string;
  stickerData?: StickerData;
  locationData?: LocationData | null;
  /** Dữ liệu bình chọn — chỉ có khi contentType === "poll" */
  pollData?: PollData | null;
  attachments?: MessageAttachment[] | null;
  reactions?: unknown;
  /** ID của tin nhắn đang được trả lời */
  replyTo?: string | number | null;
  /** Thông tin đã populate của tin nhắn gốc (hiển thị preview) */
  replyToMessage?: ReplyToMessage | null;
  storyReply?: StoryReply | null;
  createdAt: string;
  /** Display name của người gửi, do backend enrich khi trả message */
  senderDisplayName?: string | null;
  senderAvatarUrl?: string | null;
}

export interface DirectMessagesResponse {
  message: string;
  data: DirectMessageItem[];
  count: number;
}

export interface NotificationConfig {
  enabled: boolean;
  apiKey: string;
  authDomain: string;
  projectId: string;
  messagingSenderId: string;
  appId: string;
  storageBucket?: string;
  measurementId?: string;
  vapidKey: string;
}

export interface SearchMessagesResponse<T = MessageItem | DirectMessageItem> {
  conversationId: string;
  keyword: string;
  filters: {
    senderId: string | null;
    fromDate: string | null;
    toDate: string | null;
    limit: number;
  };
  count: number;
  data: T[];
}

export interface SearchGlobalMessagesResponse<T = MessageItem | DirectMessageItem> {
  keyword: string;
  filters: {
    fromDate: string | null;
    toDate: string | null;
    limit: number;
  };
  count: number;
  data: T[];
}
