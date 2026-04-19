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
  const containerRef = useRef<HTMLDivElement>(null);
  const zpRef = useRef<any>(null);

  useEffect(() => {
    // 1. Cờ an toàn để kiểm tra component còn "sống" hay không
    let isMounted = true;

    const cleanUpZego = () => {
      if (zpRef.current) {
        try {
          zpRef.current.destroy();
        } catch (e) {
          console.warn("Zego destroy error:", e);
        }
        zpRef.current = null;
      }
    };

    const initZego = async () => {
      if (!containerRef.current) return;

      try {
        const { ZegoUIKitPrebuilt } = await import("@zegocloud/zego-uikit-prebuilt");

        // 2. Sau khi import xong, phải kiểm tra lại mount state và container
        if (!isMounted || !containerRef.current) return;

        const kitToken = ZegoUIKitPrebuilt.generateKitTokenForProduction(
          appId,
          token,
          roomId,
          String(userId),
          userName
        );

        const zp = ZegoUIKitPrebuilt.create(kitToken);
        zpRef.current = zp;

        // 3. Chỉ joinRoom khi chắc chắn containerRef vẫn tồn tại
        zp.joinRoom({
          container: containerRef.current,
          scenario: { mode: scenarioMode },
          showPreJoinView: false,
          onLeaveRoom: () => {
            cleanUpZego();
            onLeave();
          },
        });
      } catch (error) {
        console.error("Zego Error:", error);
      }
    };

    initZego();

    // 4. Cleanup function: chạy khi tắt cuộc gọi hoặc chuyển trang
    return () => {
      isMounted = false;
      cleanUpZego();
    };
  }, [roomId, token, userId, userName, appId, scenarioMode]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-10000 bg-black w-full h-full"
      key={roomId}
    />
  );
}
