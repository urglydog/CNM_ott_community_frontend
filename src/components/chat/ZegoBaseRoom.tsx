"use client";

import React, { useCallback, useRef, useEffect } from "react";

export default function ZegoBaseRoom({
  roomId,
  token,
  userId,
  userName,
  appId,
  scenarioMode,
  callType,
  onLeave,
}: any) {
  console.log("👉 ZegoBaseRoom nhận được callType là:", callType);
  const isJoined = useRef(false);
  const zpRef = useRef<any>(null);
  const hasLeft = useRef(false);

  const myMeeting = useCallback(
    (element: HTMLDivElement | null) => {
      if (!element) {
        return;
      }
      
      if (isJoined.current) return;
      isJoined.current = true;

      void (async () => {
        try {
          const { ZegoUIKitPrebuilt } = await import(
            "@zegocloud/zego-uikit-prebuilt"
          );

          const kitToken = ZegoUIKitPrebuilt.generateKitTokenForProduction(
            appId,
            token,
            roomId,
            String(userId),
            userName
          );

          const zp = ZegoUIKitPrebuilt.create(kitToken);
          zpRef.current = zp;

          zp.joinRoom({
            container: element,
            scenario: { mode: scenarioMode },
            showRoomTimer: true,
            showPreJoinView: false,
            showLeavingView: false,
            turnOnCameraWhenJoining: callType !== "audio",
            showMyCameraToggleButton: callType !== "audio",
            showAudioVideoSettingsButton: callType !== "audio",
            showScreenSharingButton: callType !== "audio",
            onLeaveRoom: () => {
              hasLeft.current = true;
              if (typeof onLeave === "function") {
                onLeave();
              }
            },
          });
        } catch (error) {
          console.error("Zego Initialization Error:", error);
        }
      })();
    },
    [roomId, token, userId, userName, appId, scenarioMode, callType, onLeave]
  );

  useEffect(() => {
    return () => {
      if (zpRef.current) {
        try {
          zpRef.current.destroy();
        } catch (error) {
          console.warn("Lỗi khi destroy Zego:", error);
        }
        zpRef.current = null;
      }
      isJoined.current = false;
    };
  }, []);

  return (
    <div
      ref={myMeeting}
      className="fixed inset-0 z-10000 bg-black w-full h-full"
      key={roomId}
    />
  );
}
