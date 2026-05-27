import { useState, useEffect, useCallback } from "react";
import { useSocket } from "../../../contexts/SocketContext";
import { useToast } from "../../../contexts/ToastContext";
import type { GroupChatMessage } from "../hooks/useGroupChat";

export function usePinnedMessages(activeConversationId: string | null, initialPinned: any[] = []) {
  const { socket } = useSocket();
  const { addToast } = useToast();
  const [pinnedMessages, setPinnedMessages] = useState<any[]>(initialPinned);

  // Sync with initialPinned when it changes
  useEffect(() => {
    setPinnedMessages(initialPinned || []);
  }, [initialPinned]);

  // Listen for pinned messages updates
  useEffect(() => {
    if (!socket || !activeConversationId) return;

    const handlePinnedUpdate = (data: { roomId: string; pinnedMessages: any[] }) => {
      if (String(data.roomId) === String(activeConversationId)) {
        setPinnedMessages(data.pinnedMessages);
      }
    };

    socket.on("message_pinned_updated", handlePinnedUpdate);
    return () => {
      socket.off("message_pinned_updated", handlePinnedUpdate);
    };
  }, [socket, activeConversationId]);

  const handlePinMessage = useCallback(async (msg: GroupChatMessage, currentUserId: string) => {
    if (!socket || !activeConversationId) return;
    
    const pinData = {
      id: msg.id,
      content: msg.content,
      contentType: msg.contentType,
      senderId: msg.senderId,
      senderName: msg.senderDisplayName || (Number(msg.senderId) === Number(currentUserId) ? "Bạn" : "Người dùng"),
      createdAt: msg.createdAt,
    };

    socket.emit("pin_message", { roomId: activeConversationId, message: pinData }, (res: any) => {
      if (res.ok) {
        addToast("Đã ghim tin nhắn", "success");
      } else {
        addToast(res.error || "Không thể ghim tin nhắn", "error");
      }
    });
  }, [socket, activeConversationId, addToast]);

  const handleUnpinMessage = useCallback(async (messageId: string | number) => {
    if (!socket || !activeConversationId) return;
    
    socket.emit("unpin_message", { roomId: activeConversationId, messageId: String(messageId) }, (res: any) => {
      if (res.ok) {
        addToast("Đã bỏ ghim tin nhắn", "success");
      } else {
        addToast(res.error || "Không thể bỏ ghim tin nhắn", "error");
      }
    });
  }, [socket, activeConversationId, addToast]);

  return {
    pinnedMessages,
    handlePinMessage,
    handleUnpinMessage,
  };
}
