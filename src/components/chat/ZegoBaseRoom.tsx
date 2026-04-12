"use client";

import React, { useEffect, useRef } from "react";

export default function ZegoBaseRoom({
  roomId,
  token,
  userId,
  userName,
  appId,
  scenarioMode,
  onLeave,
}: any) {
  const zpRef = useRef<any>(null);

  const myMeeting = (element: HTMLDivElement | null) => {
    if (!element) return;
    if (zpRef.current) return;

    const initMeeting = async () => {
      try {
        // Keep this import inside the callback so it never runs on server.
        const { ZegoUIKitPrebuilt } = await import(
          "@zegocloud/zego-uikit-prebuilt"
        );

        const kitToken = ZegoUIKitPrebuilt.generateKitTokenForProduction(
          appId,
          token,
          roomId,
          String(userId),
          userName,
        );

        const zp = ZegoUIKitPrebuilt.create(kitToken);
        zpRef.current = zp;

        zp.joinRoom({
          container: element,
          scenario: { mode: scenarioMode },
          showPreJoinView: false,
          onLeaveRoom: () => {
            if (zpRef.current) {
              zpRef.current.destroy();
              zpRef.current = null;
            }
            onLeave();
          },
        });
      } catch (error) {
        console.error("Loi Zego Base:", error);
      }
    };

    void initMeeting();
  };

  useEffect(() => {
    return () => {
      if (zpRef.current) {
        zpRef.current.destroy();
        zpRef.current = null;
      }
    };
  }, []);

  return <div ref={myMeeting} className="fixed inset-0 z-10000 bg-black w-full h-full" />;
}
