"use client";
import React, { useEffect, useRef, useState } from "react";

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
  onLeave: () => void;
}

const VideoCallRoom: React.FC<VideoCallRoomProps> = ({
  roomId,
  isGroupCall,
  token,
  appId,
  callType,
  currentUser,
  onLeave,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const zpRef = useRef<any>(null);
  const [isMounted, setIsMounted] = useState(false);

  // B1: Đợi React mount xong hoàn toàn
  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  // B2: Khởi tạo Zego
  useEffect(() => {
    if (!isMounted || !containerRef.current) return;

    let isCancelled = false;

    const initZego = async () => {
      try {
        const module = await import("@zegocloud/zego-uikit-prebuilt");
        const ZegoUIKitPrebuilt = module.ZegoUIKitPrebuilt || module.default?.ZegoUIKitPrebuilt || module.default;

        if (!ZegoUIKitPrebuilt || typeof ZegoUIKitPrebuilt.generateKitTokenForProduction !== "function") {
          console.error("[Zego] Module not found");
          return;
        }

        if (isCancelled || !containerRef.current) return;

        const numericAppId = Number(appId);
        if (!numericAppId || isNaN(numericAppId) || numericAppId <= 0) {
          console.error("[Zego] Invalid appId:", appId);
          return;
        }

        const kitToken = ZegoUIKitPrebuilt.generateKitTokenForProduction(
          numericAppId, token, roomId, currentUser.userId, currentUser.userName
        );

        const zp = ZegoUIKitPrebuilt.create(kitToken);
        zpRef.current = zp;

        if (isCancelled || !containerRef.current) {
          zp.destroy();
          zpRef.current = null;
          return;
        }

        const isAudioOnly = callType === "audio";

        zp.joinRoom({
          container: containerRef.current,
          turnOnMicrophoneWhenJoining: true,
          turnOnCameraWhenJoining: !isAudioOnly,
          showMyCameraToggleButton: !isAudioOnly,
          showAudioVideoSettingsButton: !isAudioOnly,
          scenario: {
            mode: isGroupCall ? ZegoUIKitPrebuilt.GroupCall : ZegoUIKitPrebuilt.OneONoneCall,
          },
          showPreJoinView: false,
          onLeaveRoom: () => {
            if (zpRef.current) {
              zpRef.current.destroy();
              zpRef.current = null;
            }
            onLeave();
          },
        });
      } catch (err) {
        console.error("[Zego] Init error:", err);
      }
    };

    requestAnimationFrame(() => {
      initZego();
    });

    return () => {
      isCancelled = true;
    };
  }, [isMounted, roomId, isGroupCall, token, appId, callType, currentUser, onLeave]);

  if (!isMounted) return null;

  return (
    <div
      ref={containerRef}
      style={{
        width: "100vw", height: "100vh", position: "fixed",
        top: 0, left: 0, zIndex: 10001, backgroundColor: "#1e1e1e",
      }}
    />
  );
};

export default VideoCallRoom;
