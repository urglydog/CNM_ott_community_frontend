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
  username: string;
  displayName: string;
  email?: string;
  token: string;
};
