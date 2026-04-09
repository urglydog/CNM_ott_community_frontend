"use client";

import { useEffect, useRef, useState } from "react";
import { ZegoUIKitPrebuilt } from "@zegocloud/zego-uikit-prebuilt";

interface VideoCallRoomProps {
  roomID: string;
  userID: string;
  userName: string;
  onLeaveCall: () => void;
}

const CALL_API_BASE_URL =
  process.env.NEXT_PUBLIC_CALL_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:5000";

export default function VideoCallRoom({
  roomID,
  userID,
  userName,
  onLeaveCall,
}: VideoCallRoomProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const zegoInstanceRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unmounted = false;

    async function initVideoRoom() {
      try {
        setError(null);

        if (!roomID || !userID || !containerRef.current) {
          return;
        }

        // Goi API backend de lay token ZEGOCLOUD theo user dang nhap.
        const tokenRes = await fetch(
          `${CALL_API_BASE_URL}/api/calls/token?userID=${encodeURIComponent(userID)}`,
          {
            method: "GET",
          }
        );

        if (!tokenRes.ok) {
          throw new Error(`Khong lay duoc token (${tokenRes.status})`);
        }

        const tokenData = await tokenRes.json();
        const appID = Number(tokenData?.appID);
        const token = tokenData?.token as string;

        if (!appID || !token) {
          throw new Error("Du lieu token khong hop le");
        }

        // Tao kit token va khoi tao prebuilt instance.
        const kitToken = ZegoUIKitPrebuilt.generateKitTokenForProduction(
          appID,
          token,
          roomID,
          userID,
          userName
        );

        const zp = ZegoUIKitPrebuilt.create(kitToken);
        zegoInstanceRef.current = zp;

        if (unmounted || !containerRef.current) {
          return;
        }

        // Join room theo che do 1-1 call, bo qua man pre-join.
        zp.joinRoom({
          container: containerRef.current,
          scenario: {
            mode: ZegoUIKitPrebuilt.OneONoneCall,
          },
          showPreJoinView: false,
          onLeaveRoom: () => {
            onLeaveCall();
          },
        });
      } catch (err: any) {
        setError(err?.message || "Khoi tao cuoc goi that bai");
      }
    }

    initVideoRoom();

    return () => {
      unmounted = true;
      if (zegoInstanceRef.current) {
        zegoInstanceRef.current.destroy();
        zegoInstanceRef.current = null;
      }
    };
  }, [roomID, userID, userName, onLeaveCall]);

  return (
    <div className="h-screen w-full bg-black relative">
      {error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-4 py-2 rounded-md text-sm">
          {error}
        </div>
      )}
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
