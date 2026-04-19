"use client";

import React, { useCallback, useRef } from "react";

export default function ZegoBaseRoom({
  roomId,
  token,
  userId,
  userName,
  appId,
  scenarioMode,
  onLeave,
}: any) {
  const isJoined = useRef(false);

  const myMeeting = useCallback(
    async (element: HTMLDivElement | null) => {
      if (!element || isJoined.current) return;
      isJoined.current = true;

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

        zp.joinRoom({
          container: element,
          scenario: { mode: scenarioMode },
          showPreJoinView: false,
          onLeaveRoom: () => {
            if (typeof onLeave === "function") {
              onLeave();
            }
          },
        });
      } catch (error) {
        console.error("Zego Initialization Error:", error);
      }
    },
    [roomId, token, userId, userName, appId, scenarioMode, onLeave]
  );

  return (
    <div
      ref={myMeeting}
      className="fixed inset-0 z-10000 bg-black w-full h-full"
      key={roomId}
    />
  );
}
