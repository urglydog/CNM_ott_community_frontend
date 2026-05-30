"use client";

import { useState, useRef, useEffect } from "react";
import { Image, Link as LinkIcon, MapPin, MoreHorizontal, Paperclip, Smile, Contact, CalendarClock, BarChart2 } from "lucide-react";

interface ChatToolbarProps {
  isConnected: boolean;
  isSending: boolean;
  isUploading: boolean;
  isPickerOpen: boolean;
  onTogglePicker: () => void;
  onImageClick: () => void;
  onFileClick: () => void;
  /** Callback khi nhấn nút Chia sẻ vị trí */
  onLocationClick?: () => void;
  /** Callback khi nhấn nút Tạo bình chọn */
  onCreatePollClick?: () => void;
  onCreateReminderClick?: () => void;
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
  onLocationClick,
  onCreatePollClick,
  onCreateReminderClick,
  children,
}: ChatToolbarProps) {
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMoreMenuOpen(false);
      }
    }
    if (moreMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [moreMenuOpen]);

  const handlePollClick = () => {
    setMoreMenuOpen(false);
    onCreatePollClick?.();
  };

  const handleReminderClick = () => {
    setMoreMenuOpen(false);
    onCreateReminderClick?.();
  };

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
        <button
          type="button"
          onClick={onLocationClick}
          disabled={!isConnected}
          className="text-gray-500 hover:text-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="Chia sẻ vị trí"
        >
          <MapPin className="w-5 h-5" />
        </button>
        <Contact className="w-5 h-5 text-gray-500 cursor-pointer hover:text-gray-700" />

        {/* More Menu with Poll option */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMoreMenuOpen(!moreMenuOpen)}
            className={`text-gray-500 hover:text-gray-700 ${moreMenuOpen ? "text-blue-500" : ""}`}
            title="Thêm"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>

          {/* Dropdown Menu */}
          {moreMenuOpen && (
            <div className="absolute bottom-full left-0 mb-2 w-52 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 z-50 animate-fadeIn">
              <button
                type="button"
                onClick={handlePollClick}
                disabled={!isConnected}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-left hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                  <BarChart2 className="w-4 h-4 text-blue-500" />
                </div>
                <div>
                  <div className="text-[13px] font-medium text-gray-800">Tạo bình chọn</div>
                  <div className="text-[11px] text-gray-400">Tạo cuộc khảo sát nhanh</div>
                </div>
              </button>

              <div className="h-px bg-gray-100 my-1.5" />

              <button
                type="button"
                onClick={handleReminderClick}
                disabled={!isConnected}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-left hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                  <CalendarClock className="w-4 h-4 text-gray-500" />
                </div>
                <div>
                  <div className="text-[13px] font-medium text-gray-800">Tạo nhắc hẹn</div>
                  <div className="text-[11px] text-gray-400">Sắp xếp cuộc hẹn</div>
                </div>
              </button>
            </div>
          )}
        </div>

        {children}
      </div>
    </div>
  );
}
