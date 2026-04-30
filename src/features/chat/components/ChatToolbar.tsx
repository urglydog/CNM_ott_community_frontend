"use client";

import { Image, Link as LinkIcon, MapPin, MoreHorizontal, Paperclip, Smile, Contact, CheckSquare, Type } from "lucide-react";

interface ChatToolbarProps {
  isConnected: boolean;
  isSending: boolean;
  isUploading: boolean;
  isPickerOpen: boolean;
  onTogglePicker: () => void;
  onImageClick: () => void;
  onFileClick: () => void;
  children?: React.ReactNode;
}

export function ChatToolbar({
  isConnected,
  isSending,
  isUploading,
  isPickerOpen,
  onTogglePicker,
  onImageClick,
  onFileClick,
  children,
}: ChatToolbarProps) {
  return (
    <div className="relative border-b border-gray-100">
      <div className="flex items-center gap-4 px-4 py-2.5">
        <button
          type="button"
          onClick={onTogglePicker}
          className={`text-gray-500 hover:text-gray-700 ${isPickerOpen ? "text-blue-500" : ""}`}
          title="Biểu tượng cảm xúc & Sticker"
        >
          <Smile className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={onImageClick}
          disabled={!isConnected || isSending || isUploading}
          className="text-gray-500 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
          title="Gửi ảnh"
        >
          <Image className="w-5 h-5 cursor-pointer" />
        </button>
        <button
          type="button"
          onClick={onFileClick}
          disabled={!isConnected || isSending || isUploading}
          className="text-gray-500 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
          title="Gửi tệp"
        >
          <Paperclip className="w-5 h-5 cursor-pointer" />
        </button>
        <LinkIcon className="w-5 h-5 text-gray-500 cursor-pointer hover:text-gray-700" />
        <MapPin className="w-5 h-5 text-gray-500 cursor-pointer hover:text-gray-700" />
        <Contact className="w-5 h-5 text-gray-500 cursor-pointer hover:text-gray-700" />
        <CheckSquare className="w-5 h-5 text-gray-500 cursor-pointer hover:text-gray-700" />
        <Type className="w-5 h-5 text-gray-500 cursor-pointer hover:text-gray-700" />
        <MoreHorizontal className="w-5 h-5 text-gray-500 cursor-pointer hover:text-gray-700" />
        {children}
      </div>
    </div>
  );
}
