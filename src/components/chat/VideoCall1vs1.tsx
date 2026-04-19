"use client";

import React from "react";
import dynamic from "next/dynamic";

const ZegoBaseRoom = dynamic(() => import("./ZegoBaseRoom"), { ssr: false });

export default function VideoCall1vs1(props: any) {
  return (
    <ZegoBaseRoom
      {...props}
      scenarioMode={0}
    />
  );
}
