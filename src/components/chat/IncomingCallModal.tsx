"use client";

import React from "react";
import { PhoneOff, Video } from "lucide-react";
import type { CallSignalPayload } from "../../contexts/SocketContext";

interface IncomingCallModalProps {
  callData: CallSignalPayload;
  onAccept: () => void;
  onDecline: () => void;
}

export default function IncomingCallModal({
  callData,
  onAccept,
  onDecline,
}: IncomingCallModalProps) {
  const callerName = callData.callerName || "Nguoi dung";
  const avatarChar = callerName.charAt(0).toUpperCase();

  return (
    <div className="fixed inset-0 z-10000 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 w-full max-w-80 flex flex-col items-center shadow-2xl">
        <div className="w-24 h-24 rounded-full bg-blue-100 flex items-center justify-center mb-4 ring-4 ring-blue-50">
          <span className="text-3xl font-bold text-blue-600">{avatarChar}</span>
        </div>
        <h3 className="text-xl font-bold text-gray-800 mb-1">{callerName}</h3>
        <p className="text-gray-500 mb-8 animate-pulse">Dang goi video...</p>

        <div className="flex gap-10">
          <button
            onClick={onDecline}
            className="w-14 h-14 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-transform hover:scale-110 shadow-lg"
            aria-label="Tu choi cuoc goi"
          >
            <PhoneOff className="text-white w-6 h-6" />
          </button>
          <button
            onClick={onAccept}
            className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center hover:bg-green-600 transition-transform hover:scale-110 shadow-lg"
            aria-label="Nhan cuoc goi"
          >
            <Video className="text-white w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
}
