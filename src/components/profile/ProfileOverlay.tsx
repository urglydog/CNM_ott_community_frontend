"use client";

import { useState } from "react";
import {
  X,
  ChevronLeft,
  LogOut,
  Camera,
  Check,
  Edit3,
  Mail,
  Phone,
  User,
  Loader2,
} from "lucide-react";
import { AuthUser } from "../../types";

interface ProfileOverlayProps {
  activeView: "chat" | "profile";
  authUser: AuthUser;
  onClose: () => void;
  onLogout: () => void;
  onUpdateUser?: (updatedUser: Partial<AuthUser>) => void;
}

export default function ProfileOverlay({
  activeView,
  authUser,
  onClose,
  onLogout,
  onUpdateUser,
}: ProfileOverlayProps) {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    displayName: authUser.displayName || "",
    email: authUser.email || "",
    phone: authUser.phone || "",
  });
  const [editLoading, setEditLoading] = useState(false);

  if (activeView !== "profile") return null;

  const handleSave = async () => {
    setEditLoading(true);
    try {
      // Cập nhật local state trước
      if (onUpdateUser) {
        onUpdateUser({
          displayName: editForm.displayName,
          email: editForm.email,
          phone: editForm.phone,
        });
      }
      setIsEditing(false);
    } finally {
      setEditLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setEditForm({
      displayName: authUser.displayName || "",
      email: authUser.email || "",
      phone: authUser.phone || "",
    });
    setIsEditing(false);
  };

  const handleLogoutConfirm = () => {
    setShowLogoutConfirm(false);
    onLogout();
  };

  return (
    <>
      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[300px] mx-4 overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-14 h-14 mx-auto bg-red-50 rounded-full flex items-center justify-center mb-4">
                <LogOut className="w-7 h-7 text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Đăng xuất</h3>
              <p className="text-sm text-gray-500">
                Bạn có chắc muốn đăng xuất khỏi tài khoản này không?
              </p>
            </div>
            <div className="flex border-t border-gray-100">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-3.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Huỷ
              </button>
              <button
                onClick={handleLogoutConfirm}
                className="flex-1 py-3.5 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors border-l border-gray-100"
              >
                Đăng xuất
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Overlay */}
      <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/30 px-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
          {/* Header with gradient */}
          <div className="bg-gradient-to-br from-[#005ae0] to-[#004bc7] p-6 pt-10 pb-20 relative">
            {/* Back button */}
            <button
              onClick={onClose}
              className="absolute top-4 left-4 w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>

            {/* Logout button in header */}
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="absolute top-4 right-4 w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
            >
              <LogOut className="w-4 h-4 text-white" />
            </button>

            {/* Avatar */}
            <div className="text-center">
              <div className="relative inline-block">
                <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3">
                  <span className="text-white font-bold text-2xl">
                    {(authUser.displayName || authUser.username).charAt(0).toUpperCase()}
                  </span>
                </div>
                {!isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="absolute bottom-0 right-0 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg hover:bg-gray-50 transition-colors"
                  >
                    <Camera className="w-4 h-4 text-[#005ae0]" />
                  </button>
                )}
              </div>

              {/* Display Name */}
              {isEditing ? (
                <input
                  type="text"
                  value={editForm.displayName}
                  onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                  className="bg-white/20 text-white text-center text-lg font-semibold border-0 border-b-2 border-white/40 focus:border-white focus:outline-none placeholder-white/60 w-full py-1"
                  placeholder="Tên hiển thị"
                />
              ) : (
                <h2 className="text-white text-xl font-semibold">
                  {authUser.displayName || authUser.username}
                </h2>
              )}
              <p className="text-white/70 text-sm mt-1">@{authUser.username}</p>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 -mt-12 pb-6">
            {/* Edit actions */}
            {isEditing ? (
              <div className="bg-white rounded-xl shadow-lg p-4 mb-4">
                <div className="flex gap-2">
                  <button
                    onClick={handleCancelEdit}
                    className="flex-1 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Huỷ
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={editLoading}
                    className="flex-1 py-2.5 text-sm font-medium text-white bg-[#005ae0] rounded-lg hover:bg-[#004bc7] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {editLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Đang lưu...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        Lưu
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-lg p-4 mb-4">
                <button
                  onClick={() => setIsEditing(true)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-[#005ae0] hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Edit3 className="w-4 h-4" />
                  Chỉnh sửa hồ sơ
                </button>
              </div>
            )}

            {/* Profile Info */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700">Thông tin cá nhân</h3>
              </div>

              {/* Email */}
              <div className="px-4 py-3.5 flex items-center gap-3 border-b border-gray-50">
                <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Mail className="w-4 h-4 text-[#005ae0]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400">Email</p>
                  {isEditing ? (
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      className="w-full text-sm text-gray-800 border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#005ae0]"
                      placeholder="Nhập email"
                    />
                  ) : (
                    <p className="text-sm text-gray-800 truncate">
                      {authUser.email || "Chưa cập nhật"}
                    </p>
                  )}
                </div>
              </div>

              {/* Phone */}
              <div className="px-4 py-3.5 flex items-center gap-3 border-b border-gray-50">
                <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Phone className="w-4 h-4 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400">Số điện thoại</p>
                  {isEditing ? (
                    <input
                      type="tel"
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      className="w-full text-sm text-gray-800 border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#005ae0]"
                      placeholder="Nhập số điện thoại"
                    />
                  ) : (
                    <p className="text-sm text-gray-800">
                      {authUser.phone || "Chưa cập nhật"}
                    </p>
                  )}
                </div>
              </div>

              {/* User ID */}
              <div className="px-4 py-3.5 flex items-center gap-3">
                <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400">ID người dùng</p>
                  <p className="text-sm text-gray-800 font-mono">#{authUser.id}</p>
                </div>
              </div>
            </div>

            {/* Logout button */}
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="w-full mt-4 py-3 text-sm font-medium text-red-500 bg-red-50 hover:bg-red-100 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Đăng xuất
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
