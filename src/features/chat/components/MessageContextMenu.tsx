"use client";

import { useEffect, useRef, useState } from "react";
import {
  Loader2,
  MoreHorizontal,
  RotateCcw,
  Share2,
  Smile,
  Trash2,
  Pin,
} from "lucide-react";

interface MessageContextMenuProps {
  x: number;
  y: number;
  canRevoke: boolean;
  isOwn: boolean;
  onRevoke: () => void;
  onDeleteForMe: () => void;
  onForward: () => void;
  onPin?: () => void;
  isDeleting: boolean;
  onClose: () => void;
}


export function MessageContextMenu({
  x,
  y,
  canRevoke,
  isOwn,
  onRevoke,
  onDeleteForMe,
  onForward,
  onPin,
  isDeleting,

  onClose,
}: MessageContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Đóng khi click ra ngoài hoặc scroll
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleScroll() {
      onClose();
    }
    document.addEventListener("mousedown", handleOutside);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [onClose]);

  // Đảm bảo menu không bị tràn ngoài viewport
  const [adjustedX, setAdjustedX] = useState(x);
  const [adjustedY, setAdjustedY] = useState(y);

  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const rect = menu.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    setAdjustedX(Math.min(x, vw - rect.width - 8));
    setAdjustedY(Math.min(y, vh - rect.height - 8));
  }, [x, y]);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white rounded-xl shadow-xl border border-gray-200 py-1 min-w-40 animate-in fade-in zoom-in-95 duration-100"
      style={{ top: adjustedY, left: adjustedX }}
    >
      {/* Nút Xóa với tôi — hiện cho MỌI tin nhắn (kể cả của mình) */}
      <button
        type="button"
        onClick={() => {
          onDeleteForMe();
          onClose();
        }}
        disabled={isDeleting}
        className="w-full px-3 py-2.5 flex items-center gap-2.5 text-left hover:bg-orange-50 transition-colors text-orange-600 group disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="w-6 h-6 rounded-full bg-orange-50 group-hover:bg-orange-100 flex items-center justify-center transition-colors">
          {isDeleting ? (
            <Loader2 className="w-3.5 h-3.5 text-orange-500 animate-spin" />
          ) : (
            <Trash2 className="w-3.5 h-3.5 text-orange-500" />
          )}
        </span>
        <span className="text-sm font-medium text-orange-600">
          {isDeleting ? "Đang xóa..." : "Xóa với tôi"}
        </span>
      </button>

      {/* Nút Thu hồi — chỉ hiện nếu là tin nhắn của chính mình */}
      {canRevoke && (
        <button
          type="button"
          onClick={() => {
            onRevoke();
            onClose();
          }}
          className="w-full px-3 py-2.5 flex items-center gap-2.5 text-left hover:bg-red-50 transition-colors text-red-600 group"
        >
          <span className="w-6 h-6 rounded-full bg-red-50 group-hover:bg-red-100 flex items-center justify-center transition-colors">
            <RotateCcw className="w-3.5 h-3.5 text-red-500" />
          </span>
          <span className="text-sm font-medium text-red-600">Thu hồi</span>
        </button>
      )}

      {/* Nút Ghim tin nhắn */}
      <button
        type="button"
        onClick={() => {
          onPin?.();
          onClose();
        }}
        className="w-full px-3 py-2.5 flex items-center gap-2.5 text-left hover:bg-blue-50 transition-colors text-blue-600 group"
      >
        <span className="w-6 h-6 rounded-full bg-blue-50 group-hover:bg-blue-100 flex items-center justify-center transition-colors">
          <Pin className="w-3.5 h-3.5 text-blue-500 fill-blue-500" />
        </span>
        <span className="text-sm font-medium text-blue-600">Ghim tin nhắn</span>
      </button>

      {/* Nút Chuyển tiếp — hiện cho MỌI tin nhắn (kể cả đã thu hồi trên Zalo UX) */}

      <button
        type="button"
        onClick={() => {
          onForward();
          onClose();
        }}
        className="w-full px-3 py-2.5 flex items-center gap-2.5 text-left hover:bg-blue-50 transition-colors text-blue-600 group"
      >
        <span className="w-6 h-6 rounded-full bg-blue-50 group-hover:bg-blue-100 flex items-center justify-center transition-colors">
          <Share2 className="w-3.5 h-3.5 text-blue-500" />
        </span>
        <span className="text-sm font-medium text-blue-600">Chuyển tiếp</span>
      </button>

      {/* Tùy chọn khác cho tin nhắn người khác */}
      {!canRevoke && (
        <>
          <button
            type="button"
            className="w-full px-3 py-2.5 flex items-center gap-2.5 text-left hover:bg-gray-50 transition-colors text-gray-700"
          >
            <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
              <Smile className="w-3.5 h-3.5 text-gray-500" />
            </span>
            <span className="text-sm">Thả cảm xúc</span>
          </button>
          <button
            type="button"
            className="w-full px-3 py-2.5 flex items-center gap-2.5 text-left hover:bg-gray-50 transition-colors text-gray-700"
          >
            <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
              <MoreHorizontal className="w-3.5 h-3.5 text-gray-500" />
            </span>
            <span className="text-sm">Xem thêm</span>
          </button>
        </>
      )}
    </div>
  );
}
