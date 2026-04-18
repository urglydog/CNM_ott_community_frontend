"use client";

import React from "react";
import { useSocket } from "../../contexts/SocketContext";
import VideoCall1vs1 from "./VideoCall1vs1";

export interface VideoCallRoomProps {
  roomId: string;
  token: string;
  appId: number;
  userId: string;
  userName: string;
  remoteUserId: string;
  conversationId: string;
  onLeave: () => void;
}

export default function VideoCallRoom({
  roomId,
  userId,
  userName,
  token,
  appId,
  remoteUserId,
  conversationId,
  onLeave,
}: VideoCallRoomProps) {
  const { emitEndCall } = useSocket();

  const handleLeave = () => {
    emitEndCall({
      conversationId,
      roomId,
      callerId: userId,
      callerName: userName,
      receiverId: remoteUserId,
      to: remoteUserId,
      from: userId,
    });
    onLeave();
  };

  return (
    <VideoCall1vs1
      roomId={roomId}
      userId={userId}
      userName={userName}
      token={token}
      appId={appId}
      onLeave={handleLeave}
    />
  );
}
