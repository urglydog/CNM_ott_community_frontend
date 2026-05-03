"use client";
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
// Đừng quên import store để tự unmount UI
import { useCallStore } from "../store/callStore";

export interface VideoCallRoomHandle {
  gracefulLeave: () => Promise<void>;
}

interface VideoCallRoomProps {
  roomId: string;
  isGroupCall: boolean;
  token: string;
  appId: number;
  callType?: string;
  currentUser: {
    userId: string;
    userName: string;
  };
  onLeave?: () => void;
}

const VideoCallRoom = forwardRef<VideoCallRoomHandle, VideoCallRoomProps>(
  ({ roomId, isGroupCall, token, appId, callType, currentUser, onLeave }, ref) => {
    const zpRef = useRef<any>(null);
    const zegoNodeRef = useRef<HTMLDivElement | null>(null);
    const isDestroyedRef = useRef(false);
    const cancelInitRef = useRef<(() => void) | null>(null);
    const [isMounted, setIsMounted] = useState(false);

    // Cờ nhận biết user đã tự bấm nút tắt màu đỏ trên UI của Zego chưa
    const isNativeLeaveRef = useRef(false);

    const onLeaveRef = useRef(onLeave);
    useEffect(() => {
      onLeaveRef.current = onLeave;
    }, [onLeave]);

    const setupRef = useRef({
      token,
      appId,
      callType,
      isGroupCall,
      userId: currentUser?.userId,
      userName: currentUser?.userName,
    });

    // Hàm dọn dẹp dành cho bên BỊ ĐỘNG (người nhận tín hiệu tắt từ socket)
    const gracefulLeave = useCallback(async () => {
      if (isDestroyedRef.current) return;
      isDestroyedRef.current = true;

      // Safety timeout — nếu không hoàn thành trong 5s thì force null để tránh leak
      const timeoutId = setTimeout(() => {
        zegoNodeRef.current = null;
        zpRef.current = null;
      }, 5000);

      try {
        if (cancelInitRef.current) {
          cancelInitRef.current();
          cancelInitRef.current = null;
        }

        const node = zegoNodeRef.current;
        if (node) {
          // Ẩn UI mượt mà, không cắt ngang luồng render ngầm của Zego
          node.style.opacity = "0";
          node.style.pointerEvents = "none";
        }

        const zp = zpRef.current;
        zpRef.current = null;

        // Cho Zego nghỉ 300ms để nó hoàn tất sự kiện 'onUserLeave' nội bộ
        await new Promise((resolve) => setTimeout(resolve, 300));

        // CHỈ gọi destroy() nếu user CHƯA tự bấm nút Leave
        if (zp && !isNativeLeaveRef.current) {
          try { zp.destroy(); } catch (destroyErr) {
            console.warn("[VideoCallRoom] Zego destroy error:", destroyErr);
          }
        }

        // Chờ thêm 1000ms để OpenTelemetry dọn dẹp log ngầm an toàn
        await new Promise((resolve) => setTimeout(resolve, 1000));

        if (node && node.parentElement && document.body.contains(node)) {
          try { document.body.removeChild(node); } catch (removeErr) {}
        }
        zegoNodeRef.current = null;
      } finally {
        clearTimeout(timeoutId);
      }
    }, []);

    useImperativeHandle(ref, () => ({ gracefulLeave }), [gracefulLeave]);

    // Bẫy lỗi toàn cục (Bắt cả Error thường lẫn Promise Rejection)
    useEffect(() => {
      const disableZegoCrash = (e: ErrorEvent) => {
        const msg = e.message || "";
        const errMsg = e.error?.message || "";
        if (msg.includes("createSpan") || errMsg.includes("createSpan")) {
          e.stopImmediatePropagation();
          e.preventDefault();
          return true;
        }
        return false;
      };

      const disableZegoPromiseCrash = (e: PromiseRejectionEvent) => {
        const msg = e.reason?.message || String(e.reason) || "";
        if (msg.includes("createSpan")) {
          e.stopImmediatePropagation();
          e.preventDefault();
          return true;
        }
        return false;
      };

      window.addEventListener("error", disableZegoCrash, true);
      window.addEventListener("unhandledrejection", disableZegoPromiseCrash, true);
      
      return () => {
        window.removeEventListener("error", disableZegoCrash, true);
        window.removeEventListener("unhandledrejection", disableZegoPromiseCrash, true);
      };
    }, []);

    useEffect(() => {
      setIsMounted(true);
      return () => setIsMounted(false);
    }, []);

    useEffect(() => {
      if (!isMounted) return;

      isDestroyedRef.current = false;
      let isCancelled = false;

      const containerId = `zego-video-container-${roomId}`;
      document.getElementById(containerId)?.remove();

      const zegoNode = document.createElement("div");
      zegoNode.id = containerId;
      Object.assign(zegoNode.style, {
        width: "100vw",
        height: "100vh",
        position: "fixed",
        top: "0",
        left: "0",
        zIndex: "10001",
        backgroundColor: "#1e1e1e",
      });
      document.body.appendChild(zegoNode);
      zegoNodeRef.current = zegoNode;

      const initZego = async () => {
        if (isCancelled || isDestroyedRef.current) return;

        try {
          const module = await import("@zegocloud/zego-uikit-prebuilt");
          const ZegoUIKitPrebuilt =
            module.ZegoUIKitPrebuilt ||
            module.default?.ZegoUIKitPrebuilt ||
            module.default;

          if (!ZegoUIKitPrebuilt?.generateKitTokenForProduction) return;
          if (isCancelled || isDestroyedRef.current) return;

          const { appId: currentAppId, token: currentToken, userId, userName, isGroupCall: currentIsGroup, callType: currentCallType } = setupRef.current;
          const numericAppId = Number(currentAppId);
          if (!numericAppId || isNaN(numericAppId) || numericAppId <= 0) return;
          if (isCancelled || isDestroyedRef.current) return;

          const kitToken = ZegoUIKitPrebuilt.generateKitTokenForProduction(numericAppId, currentToken, roomId, userId, userName);
          const zp = ZegoUIKitPrebuilt.create(kitToken);

          if (isCancelled || isDestroyedRef.current) {
            try { zp.destroy(); } catch (_) {}
            return;
          }

          zpRef.current = zp;
          const isAudioOnly = currentCallType === "audio";

          zp.joinRoom({
            container: zegoNode,
            turnOnMicrophoneWhenJoining: true,
            turnOnCameraWhenJoining: !isAudioOnly,
            showMyCameraToggleButton: !isAudioOnly,
            showAudioVideoSettingsButton: !isAudioOnly,
            scenario: {
              mode: currentIsGroup ? ZegoUIKitPrebuilt.GroupCall : ZegoUIKitPrebuilt.OneONoneCall,
            },
            showPreJoinView: false,
            // ================================================================
            // ✅ Flow 1: User chủ động bấm nút đỏ nội bộ của Zego
            // Socket.io: báo server → server broadcast 'call-ended' cho đối phương
            // Zego: tự dọn UI sau khi user bấm nút
            // ================================================================
            onLeaveRoom: () => {
              isNativeLeaveRef.current = true;

              // Báo Socket lên Server ngay (server sẽ emit call-ended cho đối phương)
              onLeaveRef.current?.();

              if (zegoNodeRef.current) {
                zegoNodeRef.current.style.opacity = "0";
                zegoNodeRef.current.style.pointerEvents = "none";
              }

              // 2000ms: chờ Zego gọi API chốt sổ nội bộ
              setTimeout(() => {
                const zp = zpRef.current;
                zpRef.current = null;

                if (zp) {
                  try { zp.destroy(); } catch (_) {}
                }

                if (zegoNodeRef.current && document.body.contains(zegoNodeRef.current)) {
                  try { document.body.removeChild(zegoNodeRef.current); } catch (_) {}
                }
                zegoNodeRef.current = null;

                // Báo React unmount VideoCallRoom
                useCallStore.getState().setActiveCall(null);
              }, 2000);
            },

            // ================================================================
            // ✅ Flow 2: Đối phương tắt / rớt mạng / đóng tab
            // - Group Call: Zego tự cập nhật UI → bỏ qua
            // - 1-1 Call: Đối phương rời → mình thoát luôn
            // KHÔNG gọi onLeaveRef — đối phương đã tự tắt, không cần báo server
            // ================================================================
            onUserLeave: (_users) => {
              if (currentIsGroup) return;

              isNativeLeaveRef.current = true;

              if (zegoNodeRef.current) {
                zegoNodeRef.current.style.opacity = "0";
                zegoNodeRef.current.style.pointerEvents = "none";
              }

              // 2000ms: chờ Zego dọn internal state
              setTimeout(() => {
                const zp = zpRef.current;
                zpRef.current = null;

                if (zp) {
                  try { zp.destroy(); } catch (_) {}
                }

                if (zegoNodeRef.current && document.body.contains(zegoNodeRef.current)) {
                  try { document.body.removeChild(zegoNodeRef.current); } catch (_) {}
                }
                zegoNodeRef.current = null;

                // Báo React unmount VideoCallRoom
                useCallStore.getState().setActiveCall(null);
              }, 2000);
            },
          });
        } catch (err) {}
      };

      const timeoutId = setTimeout(() => {
        cancelInitRef.current = null;
        initZego();
      }, 300);

      cancelInitRef.current = () => {
        clearTimeout(timeoutId);
        isCancelled = true;
      };

      return () => {
        isCancelled = true;
        cancelInitRef.current = null;
        clearTimeout(timeoutId);

        // ================================================================
        // ✅ Flow 4: Dọn Ghost Instance khi Strict Mode / Unmount đột ngột
        // Nếu isDestroyedRef chưa được bật bởi luồng tắt máy nào
        // → component bị unmount không qua gracefulLeave → cần destroy tay
        // ================================================================
        if (!isDestroyedRef.current && zpRef.current) {
          try { zpRef.current.destroy(); } catch (e) {}
          zpRef.current = null;
        }
      };
    }, [isMounted, roomId]);

    if (!isMounted) return null;
    return null;
  }
);

VideoCallRoom.displayName = "VideoCallRoom";
export default VideoCallRoom;
