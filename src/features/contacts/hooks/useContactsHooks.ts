"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../contexts/AuthContext";
import { useToast } from "../../../contexts/ToastContext";
import { useContactsStore } from "../store/contactsStore";
import { useChatStore } from "../../chat/store/chatStore";
import {
  fetchPendingFriendRequests,
  getFriendsList,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  listUsers,
} from "../api";
import type { FriendRequestItem, SearchUser } from "../../../types";

export function useFriendsList() {
  const {
    friends,
    setFriends,
    isLoadingFriends,
    setIsLoadingFriends,
    friendsError,
    setFriendsError,
  } = useChatStore();

  const loadFriends = useCallback(async () => {
    try {
      setIsLoadingFriends(true);
      setFriendsError(null);
      const list = await getFriendsList();
      setFriends(list);
    } catch (err: unknown) {
      setFriendsError(
        err instanceof Error ? err.message : "Không tải được danh sách bạn bè"
      );
    } finally {
      setIsLoadingFriends(false);
    }
  }, [setFriends, setIsLoadingFriends, setFriendsError]);

  return {
    friends,
    loadingFriends: isLoadingFriends,
    friendsError,
    loadFriends,
  };
}

export function useFriendRequests() {
  const { addToast } = useToast();
  const { pendingFriendCount, setPendingFriendCount, incrementPending, decrementPending } =
    useContactsStore();
  const { loadFriends } = useFriendsList();
  const [requests, setRequests] = useState<FriendRequestItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const list = await fetchPendingFriendRequests();
      setRequests(list);
      setPendingFriendCount(list.length);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Không tải được danh sách");
    } finally {
      setLoading(false);
    }
  }, [setPendingFriendCount]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleAccept = useCallback(
    async (requestId: number) => {
      try {
        await acceptFriendRequest({ requestId });
        setRequests((prev) => prev.filter((r) => r.id !== requestId));
        decrementPending();
        loadFriends();
        addToast("Đã đồng ý kết bạn", "success");
      } catch (err: unknown) {
        addToast(
          err instanceof Error ? err.message : "Không thể đồng ý",
          "error"
        );
      }
    },
    [decrementPending, loadFriends, addToast]
  );

  const handleReject = useCallback(
    async (requestId: number) => {
      try {
        await rejectFriendRequest({ requestId });
        setRequests((prev) => prev.filter((r) => r.id !== requestId));
        decrementPending();
        addToast("Đã từ chối lời mời", "info");
      } catch (err: unknown) {
        addToast(
          err instanceof Error ? err.message : "Không thể từ chối",
          "error"
        );
      }
    },
    [decrementPending, addToast]
  );

  return {
    requests,
    pendingCount: pendingFriendCount,
    loading,
    error,
    loadRequests,
    handleAccept,
    handleReject,
  };
}

export function useSearchUsers() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [users, setUsers] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const all = await listUsers();
      const currentId = String(user?.userId ?? user?.id);
      setUsers(all.filter((u) => String(u.userId ?? u.id) !== currentId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Không tải được danh sách");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleSendRequest = useCallback(
    async (receiverId: string | number) => {
      try {
        await sendFriendRequest({ receiverId });
        addToast("Đã gửi lời mời kết bạn", "success");
      } catch (err: unknown) {
        addToast(
          err instanceof Error ? err.message : "Không thể gửi lời mời",
          "error"
        );
      }
    },
    [addToast]
  );

  return {
    users,
    loading,
    error,
    loadUsers,
    handleSendRequest,
  };
}