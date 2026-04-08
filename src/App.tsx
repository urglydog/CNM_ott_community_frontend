"use client";

import { useCallback, useEffect, useState } from "react";

import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { SocketProvider, useSocket } from "./contexts/SocketContext";
import { ToastProvider, useToast } from "./contexts/ToastContext";
import { useFriendSocket } from "./hooks/useFriendSocket";
import { useJoinFriendDmRooms } from "./hooks/useJoinFriendDmRooms";
import { friendIdFromConversationId, type DmActivityPayload } from "./hooks/useDirectMessage";
import AuthScreen from "./components/auth/AuthScreen";
import Sidebar from "./components/layout/Sidebar";
import ChatListPanel from "./components/chat/ChatListPanel";
import type { ConversationPreview } from "./components/chat/ChatListPanel";
import ChatWindow from "./components/chat/ChatWindow";
import ProfileOverlay from "./components/profile/ProfileOverlay";
import ToastContainer from "./components/common/ToastContainer";
import { fetchPendingFriendRequests, getFriendsList } from "./api/client";
import type { FriendItem } from "./types";

function AppInner() {
  const { user, isAuthenticated, logout, updateUser } = useAuth();
  const { addToast } = useToast();
  const { socket, onReceiveMessage } = useSocket();

  const [pendingFriendCount, setPendingFriendCount] = useState(0);

  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [friendsError, setFriendsError] = useState<string | null>(null);

  const [selectedFriend, setSelectedFriend] = useState<FriendItem | null>(null);
  const [conversationPreview, setConversationPreview] = useState<Record<string, ConversationPreview>>({});
  /** Số tin nhắn chưa đọc theo friend_id */
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  const [activeView, setActiveView] = useState<"chat" | "profile">("chat");

  const loadFriends = useCallback(async () => {
    try {
      setLoadingFriends(true);
      setFriendsError(null);
      const list = await getFriendsList();
      setFriends(list);
    } catch (err: unknown) {
      setFriendsError(err instanceof Error ? err.message : "Không tải được danh sách bạn bè");
      setFriends([]);
    } finally {
      setLoadingFriends(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    async function loadPendingCount() {
      try {
        const list = await fetchPendingFriendRequests();
        setPendingFriendCount(list.length);
      } catch {
        // badge phụ — bỏ qua lỗi
      }
    }

    loadPendingCount();
    loadFriends();
  }, [isAuthenticated, loadFriends]);

  useJoinFriendDmRooms(isAuthenticated ? friends : null, user?.id);

  useEffect(() => {
    if (!socket || !isAuthenticated) return;

    const off = onReceiveMessage((msg) => {
      const cid = msg.conversationId;
      const friendId = friendIdFromConversationId(cid);
      if (!friendId) return;

      // Cập nhật preview
      setConversationPreview((prev) => ({
        ...prev,
        [friendId]: { content: msg.content, createdAt: msg.createdAt },
      }));

      // Tăng badge chỉ khi KHÔNG đang mở cuộc trò chuyện này
      if (selectedFriend?.friend_id !== friendId) {
        setUnreadCounts((prev) => ({
          ...prev,
          [friendId]: (prev[friendId] || 0) + 1,
        }));
      }
    });

    return off;
  }, [socket, isAuthenticated, onReceiveMessage, selectedFriend]);

  const handleDmActivity = useCallback((payload: DmActivityPayload) => {
    const friendId = friendIdFromConversationId(payload.conversationId);
    if (!friendId) return;
    setConversationPreview((prev) => ({
      ...prev,
      [friendId]: { content: payload.content, createdAt: payload.createdAt },
    }));
  }, []);

  useFriendSocket(
    (sender) => {
      if (!sender) return;
      setPendingFriendCount((prev) => prev + 1);
      addToast(`${sender.display_name} vừa gửi cho bạn một lời mời kết bạn`, "friend_request");
    },
    (receiver) => {
      if (!receiver) return;
      addToast(`${receiver.display_name} đã chấp nhận lời mời kết bạn của bạn`, "friend_accepted");
      loadFriends();
    }
  );

  function handleLogout() {
    logout();
    setActiveView("chat");
    setPendingFriendCount(0);
    setSelectedFriend(null);
    setFriends([]);
    setConversationPreview({});
    setUnreadCounts({});
  }

  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  return (
    <div className="flex h-screen w-full bg-gray-100 overflow-hidden font-sans text-sm relative">
      <Sidebar
        pendingFriendCount={pendingFriendCount}
        onPendingCountChange={(delta) => setPendingFriendCount((prev) => Math.max(0, prev + delta))}
        onOpenDmChat={(friend) => {
          setSelectedFriend(friend);
          setActiveView("chat");
        }}
      />
      <ChatListPanel
        authUser={user!}
        friends={friends}
        loadingFriends={loadingFriends}
        friendsError={friendsError}
        selectedFriend={selectedFriend}
        onSelectFriend={(friend) => {
          setSelectedFriend(friend);
          // Xóa badge khi mở cuộc trò chuyện
          setUnreadCounts((prev) => ({ ...prev, [friend.friend_id]: 0 }));
        }}
        conversationPreview={conversationPreview}
        unreadCounts={unreadCounts}
        onActiveViewChange={setActiveView}
      />
      <ChatWindow selectedFriend={selectedFriend} authUser={user!} onDmActivity={handleDmActivity} />
      <ProfileOverlay
        activeView={activeView}
        authUser={user!}
        onClose={() => setActiveView("chat")}
        onLogout={handleLogout}
        onUpdateUser={updateUser}
      />
      <ToastContainer />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <ToastProvider>
          <AppInner />
        </ToastProvider>
      </SocketProvider>
    </AuthProvider>
  );
}
