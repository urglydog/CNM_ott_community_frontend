"use client";

import { X } from "lucide-react";
import { AuthUser } from "../../types";

interface ProfileOverlayProps {
  activeView: "chat" | "profile";
  authUser: AuthUser;
  onClose: () => void;
  onLogout: () => void;
}

export default function ProfileOverlay({
  activeView,
  authUser,
  onClose,
  onLogout
}: ProfileOverlayProps) {
  if (activeView !== "profile") return null;

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/10 px-4">
      <div className="w-full max-w-lg bg-white rounded-xl shadow-lg border border-gray-200 p-6 relative">
        <X
          className="absolute top-4 right-4 cursor-pointer text-gray-400 hover:text-gray-600"
          onClick={onClose}
        />
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Hồ sơ cá nhân</h2>
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold text-xl">
            {(authUser.displayName || authUser.username).charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="text-sm text-gray-500">Tên hiển thị</div>
            <div className="text-base font-semibold text-gray-900">{authUser.displayName}</div>
            <div className="mt-1 text-xs text-gray-500">@{authUser.username}</div>
          </div>
        </div>
        <div className="space-y-2 text-sm text-gray-700 mb-4 border-t pt-4">
          <div className="flex justify-between">
            <span className="text-gray-500">ID người dùng</span>
            <span>{authUser.id}</span>
          </div>
          {authUser.email && (
            <div className="flex justify-between">
              <span className="text-gray-500">Email</span>
              <span className="truncate max-w-[260px] text-right">{authUser.email}</span>
            </div>
          )}
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onLogout}
            className="px-3 py-1.5 text-xs rounded-md border border-red-300 text-red-600 hover:bg-red-50"
          >
            Đăng xuất
          </button>
        </div>
      </div>
    </div>
  );
}
