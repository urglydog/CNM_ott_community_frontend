"use client";

import { useEffect } from "react";
import { useSocket } from "../contexts/SocketContext";
import type { FriendItem } from "../types";

function dmConversationId(userId: string | number, friendId: string | number): string {
  const ids = [Number(userId), Number(friendId)].sort((a, b) => a - b);
  return `dm:${ids[0]}:${ids[1]}`;
}

/**
 * Tham gia mọi phòng dm cho từng bạn bè,
 * giúp cập nhật danh sách hội thoại bên trái khi có tin mới.
 * Dùng deterministic conversationId để đảm bảo cả 2 user cùng dùng 1 phòng.
 */
export function useJoinFriendDmRooms(
  friends: FriendItem[] | null,
  authUserId?: string | number
) {
  const { emitJoinRoom, emitLeaveRoom } = useSocket();

  useEffect(() => {
    if (!friends?.length || !authUserId) return;

    const roomIds = friends.map((f) =>
      dmConversationId(authUserId, f.friend_id)
    );
    roomIds.forEach((roomId) => emitJoinRoom(roomId));

    return () => {
      roomIds.forEach((roomId) => emitLeaveRoom(roomId));
    };
  }, [friends, authUserId, emitJoinRoom, emitLeaveRoom]);
}
