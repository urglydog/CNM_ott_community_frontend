"use client";

import { useAuth } from "../../../contexts/AuthContext";
import { useChatStore } from "../../../features/chat/store/chatStore";
import ChatListPanel from "../../../features/chat/components/ChatListPanel";
import ChatWindow from "../../../features/chat/components/ChatWindow";

export default function ChatPage() {
  const { user } = useAuth();
  const { clearUnread } = useChatStore();

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen w-full bg-gray-100 overflow-hidden font-sans text-sm relative">
      <ChatListPanel
        authUser={user}
        onActiveViewChange={() => {}}
      />
      <ChatWindow authUser={user} />
    </div>
  );
}