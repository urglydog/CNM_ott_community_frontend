"use client";

import React from "react";
import type { IncomingCallState } from "@/features/call/store/callStore";

interface IncomingCallModalProps {
  callData: IncomingCallState;
  onAccept: (callData: IncomingCallState) => void;
  onDecline: () => void;
}

export default function IncomingCallModal({
  callData,
  onAccept,
  onDecline,
}: IncomingCallModalProps) {
  const callLabel = callData.callType === "audio" ? "thoai" : "video";

  return (
    <div className="fixed inset-0 z-10000 flex items-center justify-center bg-black/50">
      <div className="bg-white p-6 rounded-lg shadow-xl text-center">
        <h2 className="text-xl font-bold mb-4">
          {callData.callerName} dang goi {callLabel}...
        </h2>
        <div className="flex gap-4 justify-center">
          <button
            onClick={onDecline}
            className="px-4 py-2 bg-red-500 text-white rounded"
          >
            Tu choi
          </button>
          <button
            onClick={() => onAccept(callData)}
            className="px-4 py-2 bg-green-500 text-white rounded"
          >
            Nghe
          </button>
        </div>
      </div>
    </div>
  );
}
