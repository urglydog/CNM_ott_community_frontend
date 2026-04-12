"use client";

import React, { useEffect, useRef } from "react";
import { ZegoUIKitPrebuilt } from "@zegocloud/zego-uikit-prebuilt";

export default function ZegoBaseRoom({
  roomId,
  token,
  userId,
  userName,
  appId,
  scenarioMode,
  onLeave,
}: any) {
  const containerRef = useRef<HTMLDivElement>(null);
  const zpRef = useRef<any>(null);

  useEffect(() => {
    // 1. Nếu không có thẻ div, không làm gì cả
    if (!containerRef.current) return;

    let isMounted = true;

    const initZego = async () => {
      try {
        const kitToken = ZegoUIKitPrebuilt.generateKitTokenForProduction(
          appId,
          token,
          roomId,
          String(userId),
          userName
        );

        const zp = ZegoUIKitPrebuilt.create(kitToken);
        zpRef.current = zp;

        // 2. KIỂM TRA LẠI LẦN NỮA: Trước khi joinRoom, thẻ div có còn ở đó không?
        if (isMounted && containerRef.current) {
          zp.joinRoom({
            container: containerRef.current,
            scenario: { mode: scenarioMode },
            showPreJoinView: false,
            onLeaveRoom: () => {
              destroyZego();
              onLeave();
            },
          });
        }
      } catch (error) {
        console.error("Zego Init Error:", error);
      }
    };

    const destroyZego = () => {
      if (zpRef.current) {
        try {
          zpRef.current.destroy();
        } catch (e) {
          console.warn("Zego destroy warning:", e);
        }
        zpRef.current = null;
      }
    };

    initZego();

    // 3. CLEANUP: Khi component bị unmount, phải dọn dẹp ngay lập tức
    return () => {
      isMounted = false;
      destroyZego();
    };
  }, [roomId, token, userId, userName, appId, scenarioMode]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-10000 bg-black w-full h-full"
      id="zego-container"
    />
  );
}
