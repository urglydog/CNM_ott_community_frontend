"use client";

import { LayoutGrid, MessageCircle, Newspaper, ScrollText, Settings, Users } from "lucide-react";

export default function Sidebar() {
  return (
    <div className="w-[64px] bg-[#005ae0] flex flex-col items-center py-4 justify-between z-20">
      <div className="flex flex-col items-center gap-4 w-full">
        <div className="w-10 h-10 bg-white text-[#005ae0] rounded-2xl flex items-center justify-center font-bold text-2xl mb-2 shadow-sm">
          Z
        </div>
        <div className="w-full flex justify-center py-3 bg-[#1a66e3] relative cursor-pointer">
          <MessageCircle className="text-white w-6 h-6" fill="currentColor" />
          <div className="absolute top-2 right-3 w-2.5 h-2.5 bg-red-500 border-2 border-[#1a66e3] rounded-full"></div>
        </div>
        <div className="w-full flex justify-center py-3 hover:bg-[#1a66e3] cursor-pointer relative">
          <Users className="text-white/90 w-6 h-6" />
          <div className="absolute top-2 right-3 w-2.5 h-2.5 bg-red-500 border-2 border-[#005ae0] rounded-full"></div>
        </div>
        <div className="w-full flex justify-center py-3 hover:bg-[#1a66e3] cursor-pointer">
          <LayoutGrid className="text-white/90 w-6 h-6" />
        </div>
        <div className="w-full flex justify-center py-3 hover:bg-[#1a66e3] cursor-pointer">
          <Newspaper className="text-white/90 w-6 h-6" />
        </div>
        <div className="w-full flex justify-center py-3 hover:bg-[#1a66e3] cursor-pointer">
          <ScrollText className="text-white/90 w-6 h-6" />
        </div>
      </div>
      <div className="flex flex-col items-center gap-4 w-full">
        <div className="w-full flex justify-center py-3 hover:bg-[#1a66e3] cursor-pointer">
          <Settings className="text-white/90 w-6 h-6" />
        </div>
      </div>
    </div>
  );
}
