"use client";

import { Minus, MoreHorizontal, Phone, Search, Square, ThumbsUp, UserPlus, Video, X, Smile, Image, Paperclip, Link as LinkIcon, MapPin, Contact, CheckSquare, Type, SmilePlus, AtSign, Gift } from "lucide-react";
import { Group, MessageItem } from "../../types";

interface ChatWindowProps {
  selectedGroup: Group | null;
  messages: MessageItem[];
}

export default function ChatWindow({ selectedGroup, messages }: ChatWindowProps) {
  return (
    <div className="flex-1 bg-[#f3f5f6] flex flex-col relative min-w-0">
      <div className="absolute top-0 right-0 flex z-50">
        <div className="w-11 h-8 hover:bg-gray-200 flex items-center justify-center cursor-pointer text-gray-500 transition-colors">
          <Minus className="w-4 h-4" />
        </div>
        <div className="w-11 h-8 hover:bg-gray-200 flex items-center justify-center cursor-pointer text-gray-500 transition-colors">
          <Square className="w-3 h-3" />
        </div>
        <div className="w-11 h-8 hover:bg-red-500 hover:text-white flex items-center justify-center cursor-pointer text-gray-500 transition-colors">
          <X className="w-4 h-4" />
        </div>
      </div>

      <div className="h-[68px] bg-white border-b border-gray-200 flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-purple-200 flex items-center justify-center text-purple-700 font-semibold text-xl relative">
            {(selectedGroup?.name || "K").trim().charAt(0).toUpperCase()}
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
          </div>
          <div>
            <h2 className="font-semibold text-gray-900 text-base leading-tight">
              {selectedGroup?.name || "Chọn một cộng đồng"}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {selectedGroup ? "Nhóm cộng đồng trong OTT Community" : "Truy cập 18 phút trước"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 pr-32">
          <div className="p-2 hover:bg-gray-100 rounded-md cursor-pointer text-gray-600 transition-colors" title="Thêm bạn">
            <UserPlus className="w-5 h-5" />
          </div>
          <div className="p-2 hover:bg-gray-100 rounded-md cursor-pointer text-gray-600 transition-colors" title="Gọi thoại">
            <Phone className="w-5 h-5" />
          </div>
          <div className="p-2 hover:bg-gray-100 rounded-md cursor-pointer text-gray-600 transition-colors" title="Gọi video">
            <Video className="w-5 h-5" />
          </div>
          <div className="w-px h-5 bg-gray-300 mx-1"></div>
          <div className="p-2 hover:bg-gray-100 rounded-md cursor-pointer text-gray-600 transition-colors" title="Tìm kiếm">
            <Search className="w-5 h-5" />
          </div>
          <div className="p-2 hover:bg-gray-100 rounded-md cursor-pointer text-gray-600 transition-colors" title="Cài đặt khác">
            <MoreHorizontal className="w-5 h-5" />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {selectedGroup &&
          messages.map((msg) => (
            <div key={msg.id} className="flex justify-start items-end gap-2">
              <div className="bg-white text-gray-800 px-3 py-2 rounded-2xl rounded-bl-sm max-w-[70%] shadow-sm border border-gray-200 text-[14px]">
                <div className="text-xs text-gray-500 mb-0.5">Người gửi #{msg.senderId}</div>
                <div>{msg.content || "[Không có nội dung]"}</div>
                <div className="mt-1 text-[10px] text-gray-400">
                  {new Date(msg.createdAt).toLocaleString("vi-VN")}
                </div>
              </div>
            </div>
          ))}
      </div>

      <div className="bg-white border-t border-gray-200 flex flex-col flex-shrink-0">
        <div className="flex items-center gap-4 px-4 py-2.5 border-b border-gray-100">
          <Smile className="w-5 h-5 text-gray-500 cursor-pointer" />
          <Image className="w-5 h-5 text-gray-500 cursor-pointer" />
          <Paperclip className="w-5 h-5 text-gray-500" />
          <LinkIcon className="w-5 h-5 text-gray-500" />
          <MapPin className="w-5 h-5 text-gray-500" />
          <Contact className="w-5 h-5 text-gray-500" />
          <CheckSquare className="w-5 h-5 text-gray-500" />
          <Type className="w-5 h-5 text-gray-500" />
          <MoreHorizontal className="w-5 h-5 text-gray-500" />
        </div>
        <div className="flex items-end px-4 py-3 gap-2">
          <textarea
            placeholder={selectedGroup ? `Nhập tin nhắn tới ${selectedGroup.name}` : "Nhập tin nhắn vào cuộc trò chuyện"}
            className="flex-1 resize-none h-11 max-h-32 focus:outline-none text-[15px] pt-2.5"
            rows={1}
          ></textarea>
          <div className="flex items-center gap-3 pb-1">
            <SmilePlus className="w-6 h-6 text-gray-400" />
            <AtSign className="w-5 h-5 text-gray-400" />
            <Gift className="w-5 h-5 text-gray-400" />
            <div className="w-9 h-9 rounded-md text-blue-500 flex items-center justify-center cursor-pointer hover:bg-blue-50">
              <ThumbsUp className="w-6 h-6" fill="currentColor" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
