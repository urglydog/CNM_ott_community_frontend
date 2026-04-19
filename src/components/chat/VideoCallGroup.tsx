"use client";

import React from "react";
import { ZegoUIKitPrebuilt } from "@zegocloud/zego-uikit-prebuilt";
import ZegoBaseRoom from "./ZegoBaseRoom";

type ZegoBaseRoomProps = React.ComponentProps<typeof ZegoBaseRoom>;

export default function VideoCallGroup(
  props: Omit<ZegoBaseRoomProps, "scenarioMode">,
) {
  return (
    <ZegoBaseRoom
      {...props}
      scenarioMode={ZegoUIKitPrebuilt.GroupCall}
    />
  );
}
