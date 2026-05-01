export type Group = {
  groupId: string | number;
  name: string;
  description?: string;
  topic?: string;
  inviteCode?: string;
  ownerId?: string;
  memberCount?: number;
  createdAt?: string;
  avatarUrl?: string | null;
  isApprovalRequired?: boolean;
  allowSendLinks?: 'ALL' | 'ADMINS_ONLY';
  spamFilterLevel?: number;
};

export type GroupRole = 'OWNER' | 'DEPUTY' | 'MEMBER';

export interface GroupMember {
  userId: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  role: GroupRole;
  joinedAt?: string;
}

export interface InviteInfo {
  groupId: string | number;
  inviteCode: string;
  inviteLink: string;
  expiresAt?: string;
}

export interface GroupJoinRequest {
  userId: string;
  status: string;
  createdAt: string;
  displayName: string;
  avatarUrl: string | null;
}
