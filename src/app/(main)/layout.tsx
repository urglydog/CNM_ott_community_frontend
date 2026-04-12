"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "../../contexts/AuthContext";
import { useSocket } from "../../contexts/SocketContext";
import { useToast } from "../../contexts/ToastContext";
import { useChatStore } from "../../features/chat/store/chatStore";
import { useContactsStore } from "../../features/contacts/store/contactsStore";
import { useGroupsStore } from "../../features/groups/store/groupsStore";
import { useJoinFriendDmRooms, friendIdFromConversationId } from "../../features/chat/hooks/useChatHooks";
import { useFriendSocket } from "../../hooks/useFriendSocket";
import { fetchPendingFriendRequests, getFriendsList } from "../../features/contacts/api";
import MainSidebar from "./components/MainSidebar";
import ProfileSidebar from "../../components/profile/ProfileSidebar";
import ToastContainer from "../../components/common/ToastContainer";
import AuthScreen from "../../components/auth/AuthScreen";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, isInitialized, logout, updateUser } = useAuth();
  const { socket, onReceiveMessage } = useSocket();
  const { addToast } = useToast();
  const [profileOpen, setProfileOpen] = useState(false);

  const {
    friends,
    setFriends,
    setIsLoadingFriends,
    setFriendsError,
    selectedFriend,
    setSelectedFriend,
    setConversationPreview,
    incrementUnread,
    reset: resetChatStore,
  } = useChatStore();

  const { pendingFriendCount, setPendingFriendCount, resetPending } = useContactsStore();
  const { reset: resetGroupsStore } = useGroupsStore();

  // Load friends list
  const loadFriends = useCallback(async () => {
    try {
      setIsLoadingFriends(true);
      setFriendsError(null);
      const list = await getFriendsList();
      setFriends(list);
    } catch (err: unknown) {
      setFriendsError(err instanceof Error ? err.message : "Không tải được danh sách bạn bè");
    } finally {
      setIsLoadingFriends(false);
    }
  }, [setFriends, setIsLoadingFriends, setFriendsError]);

  // Join DM rooms for all friends
  useJoinFriendDmRooms(friends, user?.id);

  // Load pending friend count
  useEffect(() => {
    if (!isInitialized || !isAuthenticated) return;

    async function loadPendingCount() {
      try {
        const list = await fetchPendingFriendRequests();
        setPendingFriendCount(list.length);
      } catch {
        // ignore
      }
    }

    loadPendingCount();
    loadFriends();
  }, [isInitialized, isAuthenticated, loadFriends, setPendingFriendCount]);

  // Handle incoming messages
  useEffect(() => {
    if (!socket || !isAuthenticated) return;

    const off = onReceiveMessage((msg) => {
      const cid = msg.conversationId;
      const friendId = friendIdFromConversationId(cid, user?.id);
      if (!friendId) return;

      setConversationPreview(friendId, {
        content: msg.content,
        createdAt: msg.createdAt,
      });

      // Kiểm tra xem có đang chat với người này không
      const isChattingWithSender = selectedFriend?.friend_id === friendId;

      if (isChattingWithSender) {
        // Đang chat với người này → không hiện notification, không tăng unread
        return;
      }

      // Không đang chat với người này → tăng unread và hiện toast notification
      incrementUnread(friendId);
      
      // Tìm tên friend để hiển thị trong toast
      const friendItem = friends.find(f => String(f.friend_id) === String(friendId));
      const senderName = friendItem?.friend_display_name || "Người lạ";
      
      // Hiển thị toast với nội dung tin nhắn (cắt ngắn nếu quá dài)
      const previewContent = msg.content.length > 50 
        ? msg.content.substring(0, 50) + '...'
        : msg.content;
      addToast(`${senderName}: ${previewContent}`, "message");
    });

    return off;
  }, [socket, isAuthenticated, onReceiveMessage, selectedFriend, setConversationPreview, incrementUnread, addToast, friends]);

  // Handle friend socket events
  useFriendSocket(
    (sender) => {
      if (!sender) return;
      setPendingFriendCount(pendingFriendCount + 1);
      addToast(`${sender.display_name} vừa gửi cho bạn một lời mời kết bạn`, "friend_request");
    },
    (receiver) => {
      if (!receiver) return;
      addToast(`${receiver.display_name} đã chấp nhận lời mời kết bạn của bạn`, "friend_accepted");
      loadFriends();
    }
  );

  // Redirect if not initialized or not authenticated
  useEffect(() => {
    if (isInitialized && !isAuthenticated && pathname !== "/login") {
      router.replace("/login");
    }
  }, [isInitialized, isAuthenticated, pathname, router]);

  const handleLogout = () => {
    logout();
    setProfileOpen(false);
    resetPending();
    resetChatStore();
    resetGroupsStore();
  };

  if (!isInitialized) return null;

  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  return (
    <div className="flex h-screen w-full bg-gray-100 overflow-hidden font-sans text-sm relative">
      <MainSidebar
        pendingFriendCount={pendingFriendCount}
        onPendingCountChange={(delta) => setPendingFriendCount(Math.max(0, pendingFriendCount + delta))}
        onOpenDmChat={(friend) => setSelectedFriend(friend)}
        onOpenProfile={() => setProfileOpen(true)}
      />
      {children}
      <ProfileSidebar
        isOpen={profileOpen}
        authUser={user!}
        onClose={() => setProfileOpen(false)}
        onLogout={handleLogout}
        onUpdateUser={updateUser}
      />
      <ToastContainer />
    </div>
  );
}
