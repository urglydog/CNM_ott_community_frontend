"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSocket } from "../contexts/SocketContext";
import { useAuth } from "../contexts/AuthContext";
import type { LiveLocationUpdatedPayload, LiveLocationStartedPayload, LiveLocationStoppedPayload } from "../types";
import type { LiveLocationMessageStoppedPayload } from "../contexts/SocketContext";
import type { ChatMessage } from "./useDirectMessage";

// ── Kiểu dữ liệu trả về của hook ────────────────────────────────────────────

export interface LiveLocationEntry {
  senderId: string | number;
  senderDisplayName?: string | null;
  senderAvatarUrl?: string | null;
  lat: number;
  lng: number;
  updatedAt: string;
}

export interface UseLiveLocationReturn {
  /** Đang chia sẻ vị trí của mình hay không */
  isSharing: boolean;
  /** Tọa độ hiện tại của người dùng (null nếu chưa lấy được) */
  myLocation: { lat: number; lng: number } | null;
  /** Lỗi khi truy cập Geolocation API */
  geoError: string | null;
  /** Map từ senderId → vị trí hiện tại của họ (dành cho người nhận) */
  liveLocations: Map<string, LiveLocationEntry>;
  /** Bắt đầu chia sẻ vị trí trực tiếp */
  startSharing: () => void;
  /** Dừng chia sẻ vị trí trực tiếp */
  stopSharing: () => void;
  /**
   * Callback để hook cha (ChatWindow/useChatRoom) truyền vào.
   * Khi nhận live_location_message_stopped, hook sẽ gọi callback này
   * để cập nhật messages list mà không cần refetch.
   */
  onMessageUpdate?: (updater: (prev: ChatMessage[]) => ChatMessage[]) => void;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

/**
 * useLiveLocation — Quản lý toàn bộ logic Live Location.
 *
 * Luồng người GỬI:
 *   1. Gọi startSharing() → getCurrentPosition → POST /api/messages/location/live/start
 *      → lưu messageId → emit start_live_location qua socket
 *   2. watchPosition() liên tục → emit update_live_location với {lat, lng} mới
 *   3. Gọi stopSharing() → clearWatch → PATCH /api/messages/location/live/:id/stop
 *      → emit stop_live_location qua socket
 *
 * Luồng người NHẬN:
 *   1. Lắng nghe live_location_started → thêm entry vào liveLocations
 *   2. Lắng nghe live_location_updated → cập nhật tọa độ trong liveLocations
 *   3. Lắng nghe live_location_stopped → xóa entry khỏi liveLocations
 *   4. Lắng nghe live_location_message_stopped → cập nhật message bubble
 *
 * @param roomId - ID của room/conversation đang mở
 * @param onMessagesUpdate - callback để cập nhật danh sách tin nhắn
 */
export function useLiveLocation(
  roomId: string | null,
  onMessagesUpdate?: (updater: (prev: ChatMessage[]) => ChatMessage[]) => void
): UseLiveLocationReturn {
  const {
    emitStartLiveLocation,
    emitUpdateLiveLocation,
    emitStopLiveLocation,
    onLiveLocationStarted,
    onLiveLocationUpdated,
    onLiveLocationStopped,
    onLiveLocationMessageStopped,
  } = useSocket();

  const { user } = useAuth();

  const [isSharing, setIsSharing] = useState(false);
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [liveLocations, setLiveLocations] = useState<Map<string, LiveLocationEntry>>(new Map());

  // watchId từ navigator.geolocation.watchPosition — dùng để clearWatch khi dừng
  const watchIdRef = useRef<number | null>(null);
  // Lưu roomId hiện tại vào ref để dùng trong cleanup callback tránh stale closure
  const roomIdRef = useRef<string | null>(roomId);
  // Lưu isSharing vào ref để dùng trong cleanup mà không bị stale closure
  const isSharingRef = useRef<boolean>(false);
  // messageId của tin nhắn live location đang active (để stop sau)
  const liveMessageIdRef = useRef<string | null>(null);
  // Ref đến stopSharing để tránh stale closure trong startSharing callback
  const stopSharingRef = useRef<() => void>(() => {});

  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

  // ── Tạo live location message trên DB ────────────────────────────────────
  const createLiveMessage = useCallback(
    async (lat: number, lng: number): Promise<string | null> => {
      if (!roomIdRef.current || !user?.token) return null;
      try {
        const res = await fetch(`${BACKEND_URL}/api/messages/location/live/start`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user.token}`,
          },
          body: JSON.stringify({
            conversationId: roomIdRef.current,
            locationData: { lat, lng },
          }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data?.id ? String(data.id) : null;
      } catch {
        return null;
      }
    },
    [user?.token]
  );

  // ── Dừng live location message trên DB ───────────────────────────────────
  const stopLiveMessage = useCallback(
    async (msgId: string) => {
      if (!roomIdRef.current || !user?.token) return;
      try {
        await fetch(`${BACKEND_URL}/api/messages/location/live/${msgId}/stop`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user.token}`,
          },
          body: JSON.stringify({ conversationId: roomIdRef.current }),
        });
      } catch {
        // Ignore — socket event vẫn sẽ được gửi từ backend
      }
    },
    [user?.token]
  );

  // ── Bắt đầu chia sẻ vị trí ──────────────────────────────────────────────
  const startSharing = useCallback(() => {
    if (!roomIdRef.current) return;
    if (!navigator.geolocation) {
      setGeoError("Trình duyệt không hỗ trợ Geolocation API");
      return;
    }

    setGeoError(null);

    // Lấy vị trí ban đầu để tạo message ngay lập tức
    navigator.geolocation.getCurrentPosition(
      async (initialPos) => {
        const { latitude: lat, longitude: lng } = initialPos.coords;
        setMyLocation({ lat, lng });

        // 1. Tạo message live location trong DB, lấy messageId
        const msgId = await createLiveMessage(lat, lng);
        if (msgId) {
          liveMessageIdRef.current = msgId;
        }

        // 2. Thông báo socket cho các thành viên khác
        if (roomIdRef.current) {
          emitStartLiveLocation(roomIdRef.current);
        }

        setIsSharing(true);
        isSharingRef.current = true;

        // 3. Bắt đầu theo dõi vị trí liên tục
        watchIdRef.current = navigator.geolocation.watchPosition(
          (position) => {
            const { latitude: lat2, longitude: lng2 } = position.coords;
            setMyLocation({ lat: lat2, lng: lng2 });
            if (roomIdRef.current) {
              emitUpdateLiveLocation(roomIdRef.current, lat2, lng2);
            }
          },
          (err) => {
            setGeoError(`Không thể lấy vị trí: ${err.message}`);
            stopSharingRef.current();
          },
          {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 10000,
          }
        );
      },
      (err) => {
        setGeoError(`Không thể lấy vị trí: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emitStartLiveLocation, emitUpdateLiveLocation, createLiveMessage]);

  // ── Dừng chia sẻ vị trí ─────────────────────────────────────────────────
  const stopSharing = useCallback(() => {
    // Dọn dẹp watchPosition để tránh memory leak và tiêu hao pin
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    // Thông báo socket cho các thành viên khác biết ta đã dừng
    if (roomIdRef.current) {
      emitStopLiveLocation(roomIdRef.current);
    }

    // Cập nhật DB: đánh dấu isLive = false, liveUntil = now
    const msgId = liveMessageIdRef.current;
    if (msgId) {
      stopLiveMessage(msgId);
      liveMessageIdRef.current = null;
    }

    setIsSharing(false);
    isSharingRef.current = false;
    setMyLocation(null);
  }, [emitStopLiveLocation, stopLiveMessage]);

  // Cập nhật stopSharingRef mỗi khi stopSharing thay đổi
  useEffect(() => {
    stopSharingRef.current = stopSharing;
  }, [stopSharing]);

  // ── Cleanup khi component unmount hoặc roomId thay đổi ──────────────────
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      // Dùng isSharingRef thay vì isSharing để tránh stale closure
      if (roomIdRef.current && isSharingRef.current) {
        emitStopLiveLocation(roomIdRef.current);
        const msgId = liveMessageIdRef.current;
        if (msgId) {
          stopLiveMessage(msgId);
          liveMessageIdRef.current = null;
        }
        isSharingRef.current = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emitStopLiveLocation, stopLiveMessage]);

  // ── Lắng nghe live location từ người khác trong room ────────────────────
  useEffect(() => {
    if (!roomId) return;

    // Khi ai đó bắt đầu chia sẻ → thêm entry với vị trí chưa biết (0,0) để hiển thị badge
    const unsubStarted = onLiveLocationStarted((data: LiveLocationStartedPayload) => {
      if (data.roomId !== roomId) return;
      const key = String(data.senderId);
      setLiveLocations((prev) => {
        const next = new Map(prev);
        next.set(key, {
          senderId: data.senderId,
          senderDisplayName: data.senderDisplayName,
          senderAvatarUrl: data.senderAvatarUrl,
          lat: 0,
          lng: 0,
          updatedAt: data.startedAt,
        });
        return next;
      });
    });

    // Mỗi lần nhận tọa độ mới → cập nhật vị trí Marker trên bản đồ
    const unsubUpdated = onLiveLocationUpdated((data: LiveLocationUpdatedPayload) => {
      if (data.roomId !== roomId) return;
      const key = String(data.senderId);
      setLiveLocations((prev) => {
        const next = new Map(prev);
        const existing = next.get(key);
        next.set(key, {
          ...existing,
          senderId: data.senderId,
          lat: data.lat,
          lng: data.lng,
          updatedAt: data.updatedAt,
        } as LiveLocationEntry);
        return next;
      });
    });

    // Khi người chia sẻ dừng → xóa marker khỏi bản đồ
    const unsubStopped = onLiveLocationStopped((data: LiveLocationStoppedPayload) => {
      if (data.roomId !== roomId) return;
      const key = String(data.senderId);
      setLiveLocations((prev) => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
    });

    // Khi message live location được dừng (từ PATCH API) → cập nhật message bubble
    const unsubMsgStopped = onLiveLocationMessageStopped((data: LiveLocationMessageStoppedPayload) => {
      if (data.conversationId !== roomId) return;
      if (!onMessagesUpdate) return;
      onMessagesUpdate((prev) =>
        prev.map((m) => {
          if (String(m.id) !== String(data.messageId)) return m;
          return {
            ...m,
            locationData: data.locationData,
          };
        })
      );
    });

    // Cleanup: hủy đăng ký khi roomId thay đổi hoặc component unmount
    return () => {
      unsubStarted();
      unsubUpdated();
      unsubStopped();
      unsubMsgStopped();
      // Xóa tất cả live location khi rời room
      setLiveLocations(new Map());
    };
  }, [roomId, onLiveLocationStarted, onLiveLocationUpdated, onLiveLocationStopped, onLiveLocationMessageStopped, onMessagesUpdate]);

  return {
    isSharing,
    myLocation,
    geoError,
    liveLocations,
    startSharing,
    stopSharing,
  };
}
