export type Group = {
  groupId: string | number;
  name: string;
  description?: string;
  topic?: string;
  inviteCode?: string;
  ownerId?: string;
  memberCount?: number;
  createdAt?: string;
};

export interface GroupMember {
  userId: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  role: "owner" | "admin" | "member";
  joinedAt?: string;
}

export interface InviteInfo {
  groupId: string | number;
  inviteCode: string;
  inviteLink: string;
  expiresAt?: string;
}
