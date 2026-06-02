"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "../../contexts/AuthContext";
import { useSocket } from "../../contexts/SocketContext";
import { useToast } from "../../contexts/ToastContext";
import { useChatStore } from "../../features/chat/store/chatStore";
import { useContactsStore } from "../../features/contacts/store/contactsStore";
import { useGroupsStore } from "../../features/groups/store/groupsStore";
import { useMyGroups } from "../../features/groups/hooks/useGroupsHooks";
import { useGroupSocket } from "../../features/groups/hooks/useGroupSocket";
import { useJoinFriendDmRooms, friendIdFromConversationId } from "../../features/chat/hooks/useChatHooks";
import { useFriendSocket } from "../../hooks/useFriendSocket";
import { usePushNotifications } from "../../hooks/usePushNotifications";
import { useCallRecovery } from "../../features/call";
import { useCallRtcLifecycle } from "../../features/call/hooks/useCallRtcLifecycle";
import { IncomingCallModal } from "../../features/call/components/IncomingCallModal";
import { OutgoingCallModal } from "../../features/call/components/OutgoingCallModal";
import { DirectCallScreen } from "../../features/call/components/DirectCallScreen";
import { useGroupCallSocketListener } from "../../features/group-call/useGroupCallSocketListener";
import { useGroupCallPopupSync } from "../../features/group-call/useGroupCallPopupSync";
import { GroupIncomingCallModal } from "../../features/group-call/components/GroupIncomingCallModal";
import { isGroupConversation } from "../../features/chat/hooks/useGroupChat";
import { fetchPendingFriendRequests, getFriendsList } from "../../features/contacts/api";
import MainSidebar from "./components/MainSidebar";
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

  // ── Call recovery: check for active calls on startup & foreground resume ──
  useCallRecovery(isAuthenticated);

  // ── Call RTC lifecycle: join/leave Agora based on callStore phase ──
  useCallRtcLifecycle(isAuthenticated);

  // ── Group call socket listener: bridge group:call:* events to groupCallStore ──
  useGroupCallSocketListener(
    isAuthenticated ? String(user?.id ?? "") : null,
    socket,
  );

  useGroupCallPopupSync();

  const [pendingFriendCount, setPendingFriendCount] = useState(0);

  const {
    friends,
    setFriends,
    setIsLoadingFriends,
    setFriendsError,
    selectedFriend,
    selectedGroup,
    setSelectedFriend,
    setConversationPreview,
    incrementUnread,
    incrementGroupUnread,
    setGroupConversationPreview,
    chatMode,
    reset: resetChatStore,
    setCurrentUserId,
  } = useChatStore();

  const { resetPending: resetContactsStore } = useContactsStore();
  const { reset: resetGroupsStore } = useGroupsStore();

  // Hook để load và quản lý groups
  const { myGroups, loadMyGroups } = useMyGroups();

  // ── KHỞI TẠO SOCKET CHO GROUPS ──────────────────────────────────────────
  // Quan trọng: useGroupSocket cần được gọi ngay sau khi myGroups được load
  // Hook này sẽ tự động join tất cả các group rooms
  useGroupSocket();

  usePushNotifications();

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

  // Sync current user ID with chat store for scoped localStorage persistence
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      setCurrentUserId(String(user.id));
    } else {
      setCurrentUserId(null);
    }
  }, [isAuthenticated, user?.id, setCurrentUserId]);

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
    loadMyGroups(); // Load danh sách groups khi đăng nhập
  }, [isInitialized, isAuthenticated, loadFriends, loadMyGroups, setPendingFriendCount]);

  // Handle incoming messages
  useEffect(() => {
    if (!socket || !isAuthenticated) return;

    const off = onReceiveMessage((msg) => {
      const cid = msg.conversationId;

      // ── Xử lý DM ──────────────────────────────────────────────
      if (!isGroupConversation(cid)) {
        const friendId = friendIdFromConversationId(cid, user?.id);
        if (!friendId) return;

        setConversationPreview(friendId, {
          content: msg.content,
          createdAt: msg.createdAt,
        });

        // Bỏ qua nếu đang chat với người gửi
        const isChattingWithSender = selectedFriend?.friend_id === friendId;
        if (isChattingWithSender) return;

        incrementUnread(friendId);
        const friendItem = friends.find(f => String(f.friend_id) === String(friendId));
        const senderName = friendItem?.friend_display_name || "Người lạ";
        const previewContent = msg.content.length > 50
          ? msg.content.substring(0, 50) + '...'
          : msg.content;
        if (document.visibilityState === "visible") {
          addToast(`${senderName}: ${previewContent}`, "message");
        }
        return;
      }

      // ── Xử lý nhóm ────────────────────────────────────────────
      // Bỏ qua nếu đang xem nhóm này
      const isViewingGroup =
        chatMode === "GROUP" &&
        selectedGroup &&
        String(selectedGroup.groupId) === cid;
      if (isViewingGroup) return;

      setGroupConversationPreview(cid, {
        content: msg.content,
        createdAt: msg.createdAt,
      });
      incrementGroupUnread(cid);
      const senderName = msg.senderDisplayName || "Ai đó";
      const previewContent = msg.content.length > 50
        ? msg.content.substring(0, 50) + '...'
        : msg.content;
      if (document.visibilityState === "visible") {
        addToast(`${senderName} ở nhóm: ${previewContent}`, "message");
      }
    });

    return off;
  }, [socket, isAuthenticated, onReceiveMessage, selectedFriend, selectedGroup, setConversationPreview, incrementUnread, incrementGroupUnread, setGroupConversationPreview, addToast, friends, chatMode]);

  useEffect(() => {
    if (!socket || !isAuthenticated) return;

    const handleReminderDue = (payload: any) => {
      const content =
        payload?.reminder?.content ||
        payload?.message?.content?.split("\n")?.[1] ||
        "Nhắc hẹn";
      addToast(`Đến giờ nhắc hẹn: ${content}`, "message", 6000);
    };

    socket.on("reminder:due", handleReminderDue);
    return () => {
      socket.off("reminder:due", handleReminderDue);
    };
  }, [socket, isAuthenticated, addToast]);

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

  useEffect(() => {
    const handleAuthLogout = () => {
      logout();
      resetContactsStore();
      resetChatStore();
      resetGroupsStore();
      router.replace("/login");
    };

    window.addEventListener("auth:logout", handleAuthLogout);
    return () => window.removeEventListener("auth:logout", handleAuthLogout);
  }, [logout, resetContactsStore, resetChatStore, resetGroupsStore, router]);

  const handleLogout = () => {
    logout();
    resetContactsStore();
    resetChatStore();
    resetGroupsStore();
    router.push("/login");
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
      />
      {children}
      {/* Global call UI overlay — renders only when call phase is active */}
      <IncomingCallModal />
      <OutgoingCallModal />
      <DirectCallScreen />
      {/* Group incoming call modal — no Agora, just notification */}
      <GroupIncomingCallModal />
      <ToastContainer />
    </div>
  );
}
