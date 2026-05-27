import { useState, useEffect } from "react";
import { useSocket } from "../../../contexts/SocketContext";
import { getChatBackground } from "../../../api/client";

export function useChatBackground(friendshipId: string | null) {
  const { socket } = useSocket();
  const [chatBgUrl, setChatBgUrl] = useState<string | null>(null);

  // Load background when friendshipId changes
  useEffect(() => {
    if (!friendshipId) {
      setChatBgUrl(null);
      return;
    }
    getChatBackground(friendshipId)
      .then(res => setChatBgUrl(res.chatBgUrl))
      .catch(() => setChatBgUrl(null));
  }, [friendshipId]);

  // Listen for real-time background updates via socket
  useEffect(() => {
    if (!socket || !friendshipId) return;

    const handleBgUpdate = (data: { friendshipId: string; bgUrl: string | null }) => {
      if (String(data.friendshipId) === String(friendshipId)) {
        setChatBgUrl(data.bgUrl);
      }
    };

    socket.on("chat_background_updated", handleBgUpdate);
    return () => {
      socket.off("chat_background_updated", handleBgUpdate);
    };
  }, [socket, friendshipId]);

  return {
    chatBgUrl,
    setChatBgUrl,
  };
}
