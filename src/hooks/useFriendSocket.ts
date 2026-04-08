"use client";

import { useEffect } from "react";
import { useSocket } from "../contexts/SocketContext";
import type { FriendSocketPayload } from "../types";

/**
 * Custom hook lắng nghe sự kiện Socket liên quan đến Friend Request.
 *
 * @param onNewFriendRequest - Callback khi nhận được lời mời kết bạn mới
 * @param onFriendAccepted - Callback khi lời mời kết bạn được chấp nhận
 * @returns void
 *
 * @example
 * ```tsx
 * useFriendSocket(
 *   (sender) => {
 *     addToast(`${sender.display_name} đã gửi lời mời kết bạn`, 'friend_request');
 *     setPendingCount((c) => c + 1);
 *   },
 *   (receiver) => {
 *     addToast(`${receiver.display_name} đã chấp nhận lời mời kết bạn`, 'friend_accepted');
 *   }
 * );
 * ```
 */
export function useFriendSocket(
  onNewFriendRequest?: (sender: FriendSocketPayload["sender"]) => void,
  onFriendAccepted?: (receiver: FriendSocketPayload["receiver"]) => void,
): void {
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    const handleNewFriendRequest = (payload: FriendSocketPayload) => {
      if (payload.type === "new_friend_request" && onNewFriendRequest) {
        onNewFriendRequest(payload.sender);
      }
    };

    const handleFriendAccepted = (payload: FriendSocketPayload) => {
      if (payload.type === "friend_request_accepted" && onFriendAccepted) {
        onFriendAccepted(payload.receiver);
      }
    };

    socket.on("new_friend_request", handleNewFriendRequest);
    socket.on("friend_request_accepted", handleFriendAccepted);

    return () => {
      socket.off("new_friend_request", handleNewFriendRequest);
      socket.off("friend_request_accepted", handleFriendAccepted);
    };
  }, [socket, onNewFriendRequest, onFriendAccepted]);
}
