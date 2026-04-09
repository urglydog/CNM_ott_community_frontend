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
  Shield,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  Send,
  Lock,
  Bell,
} from "lucide-react";
import { AuthUser } from "../../types";
import { useToast } from "../../contexts/ToastContext";
import {
  updateProfile,
  changePassword,
  sendEmailOTP,
  verifyEmailOTP,
  sendPhoneOTP,
  verifyPhoneOTP,
} from "../../api/client";

interface ProfileOverlayProps {
  activeView: "chat" | "profile";
  authUser: AuthUser;
  onClose: () => void;
  onLogout: () => void;
  onUpdateUser?: (updatedUser: Partial<AuthUser>) => void;
}

type VerificationStep = "idle" | "sending" | "verifying" | "success";
type VerificationType = "email" | "phone" | null;

export default function ProfileOverlay({
  activeView,
  authUser,
  onClose,
  onLogout,
  onUpdateUser,
}: ProfileOverlayProps) {
  const { addToast } = useToast();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [editForm, setEditForm] = useState({
    displayName: authUser.displayName || "",
    email: authUser.email || "",
    phone: authUser.phone || "",
  });
  const [editLoading, setEditLoading] = useState(false);

  // Change password state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Verification state
  const [verification, setVerification] = useState<{
    type: VerificationType;
    value: string;
    step: VerificationStep;
    otp: string;
    otpSent: boolean;
    expiresIn: number;
    error: string | null;
  }>({
    type: null,
    value: "",
    step: "idle",
    otp: "",
    otpSent: false,
    expiresIn: 0,
    error: null,
  });

  if (activeView !== "profile") return null;

  // ── Profile Edit Functions ─────────────────────────────────────────────────────

  const handleSave = async () => {
    setEditLoading(true);
    try {
      if (onUpdateUser) {
        onUpdateUser({
          displayName: editForm.displayName,
          email: editForm.email,
          phone: editForm.phone,
        });
      }
      setIsEditing(false);
      addToast("Cập nhật hồ sơ thành công!", "success");
    } catch (err) {
      addToast("Cập nhật hồ sơ thất bại", "error");
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

  // ── Change Password Functions ──────────────────────────────────────────────────

  const handleChangePassword = async () => {
    setPasswordError(null);

    if (!passwordForm.currentPassword) {
      setPasswordError("Vui lòng nhập mật khẩu hiện tại");
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      setPasswordError("Mật khẩu mới phải có ít nhất 8 ký tự");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("Mật khẩu xác nhận không khớp");
      return;
    }

    setPasswordLoading(true);
    try {
      await changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setShowChangePassword(false);
      addToast("Đổi mật khẩu thành công!", "success");
    } catch (err: any) {
      setPasswordError(err.message || "Đổi mật khẩu thất bại");
    } finally {
      setPasswordLoading(false);
    }
  };

  // ── Verification Functions ─────────────────────────────────────────────────────

  const startVerification = (type: VerificationType, value: string) => {
    setVerification({
      type,
      value,
      step: "sending",
      otp: "",
      otpSent: false,
      expiresIn: 0,
      error: null,
    });
    sendVerificationOTP(type, value);
  };

  const sendVerificationOTP = async (type: VerificationType, value: string) => {
    try {
      if (type === "email") {
        await sendEmailOTP(value);
      } else if (type === "phone") {
        await sendPhoneOTP(value);
      }
      setVerification((prev) => ({
        ...prev,
        step: "verifying",
        otpSent: true,
        expiresIn: 300, // 5 minutes
      }));
      addToast(`Mã xác thực đã được gửi đến ${type === "email" ? "email" : "số điện thoại"} của bạn`, "info");
    } catch (err: any) {
      setVerification((prev) => ({
        ...prev,
        step: "idle",
        error: err.message || "Gửi mã xác thực thất bại",
      }));
      addToast(err.message || "Gửi mã xác thực thất bại", "error");
    }
  };

  const verifyOTP = async () => {
    if (!verification.otp || verification.otp.length < 6) {
      setVerification((prev) => ({
        ...prev,
        error: "Vui lòng nhập đầy đủ mã xác thực 6 số",
      }));
      return;
    }

    setVerification((prev) => ({ ...prev, error: null }));
    try {
      if (verification.type === "email") {
        await verifyEmailOTP({ email: verification.value, otp: verification.otp });
      } else if (verification.type === "phone") {
        await verifyPhoneOTP({ phone: verification.value, otp: verification.otp });
      }
      setVerification((prev) => ({ ...prev, step: "success" }));
      addToast("Xác thực thành công!", "success");

      // Update user data
      if (onUpdateUser) {
        if (verification.type === "email") {
          onUpdateUser({ email: verification.value });
        } else if (verification.type === "phone") {
          onUpdateUser({ phone: verification.value });
        }
      }

      // Close verification modal after success
      setTimeout(() => {
        setVerification({
          type: null,
          value: "",
          step: "idle",
          otp: "",
          otpSent: false,
          expiresIn: 0,
          error: null,
        });
      }, 1500);
    } catch (err: any) {
      setVerification((prev) => ({
        ...prev,
        error: err.message || "Mã xác thực không đúng",
      }));
    }
  };

  const cancelVerification = () => {
    setVerification({
      type: null,
      value: "",
      step: "idle",
      otp: "",
      otpSent: false,
      expiresIn: 0,
      error: null,
    });
  };

  const handleLogoutConfirm = () => {
    setShowLogoutConfirm(false);
    onLogout();
  };

  return (
    <>
      {/* Verification Modal */}
      {verification.step !== "idle" && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-800">
                  Xác thực {verification.type === "email" ? "Email" : "Số điện thoại"}
                </h3>
                <button
                  onClick={cancelVerification}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              {verification.step === "sending" && (
                <div className="text-center py-6">
                  <Loader2 className="w-10 h-10 mx-auto text-blue-500 animate-spin mb-3" />
                  <p className="text-sm text-slate-600">Đang gửi mã xác thực...</p>
                </div>
              )}

              {verification.step === "verifying" && (
                <>
                  <p className="text-sm text-slate-600 mb-4">
                    Nhập mã xác thực 6 số đã được gửi đến{" "}
                    <span className="font-semibold">
                      {verification.type === "email" ? verification.value : `***${verification.value.slice(-3)}`}
                    </span>
                  </p>
                  <input
                    type="text"
                    placeholder="Nhập mã OTP"
                    maxLength={6}
                    className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-center text-lg tracking-widest focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 mb-3"
                    value={verification.otp}
                    onChange={(e) =>
                      setVerification((prev) => ({
                        ...prev,
                        otp: e.target.value.replace(/\D/g, ""),
                        error: null,
                      }))
                    }
                  />
                  {verification.error && (
                    <p className="text-sm text-red-500 mb-3 flex items-center gap-1">
                      <XCircle className="w-4 h-4" />
                      {verification.error}
                    </p>
                  )}
                  <button
                    onClick={verifyOTP}
                    className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Xác thực
                  </button>
                  <button
                    onClick={() => sendVerificationOTP(verification.type, verification.value)}
                    className="w-full mt-2 py-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Gửi lại mã
                  </button>
                </>
              )}

              {verification.step === "success" && (
                <div className="text-center py-6">
                  <CheckCircle className="w-16 h-16 mx-auto text-green-500 mb-3" />
                  <p className="text-lg font-semibold text-slate-800">Xác thực thành công!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showChangePassword && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-800">Đổi mật khẩu</h3>
                <button
                  onClick={() => setShowChangePassword(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Mật khẩu hiện tại
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type={showPasswords.current ? "text" : "password"}
                      className="w-full border-2 border-slate-200 rounded-xl pl-11 pr-10 py-2.5 text-sm focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                    >
                      {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Mật khẩu mới
                  </label>
                  <div className="relative">
                    <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type={showPasswords.new ? "text" : "password"}
                      className="w-full border-2 border-slate-200 rounded-xl pl-11 pr-10 py-2.5 text-sm focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                    >
                      {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Xác nhận mật khẩu mới
                  </label>
                  <div className="relative">
                    <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type={showPasswords.confirm ? "text" : "password"}
                      className="w-full border-2 border-slate-200 rounded-xl pl-11 pr-10 py-2.5 text-sm focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                    >
                      {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {passwordError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <p className="text-sm text-red-600">{passwordError}</p>
                  </div>
                )}

                <button
                  onClick={handleChangePassword}
                  disabled={passwordLoading}
                  className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {passwordLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Đang xử lý...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Xác nhận đổi mật khẩu
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[300px] mx-4 overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-14 h-14 mx-auto bg-red-50 rounded-full flex items-center justify-center mb-4">
                <LogOut className="w-7 h-7 text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Đăng xuất</h3>
              <p className="text-sm text-slate-600">
                Bạn có chắc muốn đăng xuất khỏi tài khoản này không?
              </p>
            </div>
            <div className="flex border-t border-slate-100">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-3.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Huỷ
              </button>
              <button
                onClick={handleLogoutConfirm}
                className="flex-1 py-3.5 text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors border-l border-slate-100"
              >
                Đăng xuất
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Overlay */}
      <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/30 backdrop-blur-sm px-4">
        <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[95vh] overflow-y-auto">
          {/* Header with gradient */}
          <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 p-6 pt-12 pb-24 relative">
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

            {/* Back button */}
            <button
              onClick={onClose}
              className="absolute top-4 left-4 w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors backdrop-blur-sm"
            >
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>

            {/* Logout button in header */}
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="absolute top-4 right-4 w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors backdrop-blur-sm"
            >
              <LogOut className="w-5 h-5 text-white" />
            </button>

            {/* Avatar */}
            <div className="text-center">
              <div className="relative inline-block">
                <div className="w-28 h-28 rounded-full bg-gradient-to-br from-white/30 to-white/10 backdrop-blur-sm flex items-center justify-center mx-auto mb-4 shadow-2xl border-4 border-white/20">
                  <span className="text-white font-bold text-4xl">
                    {(authUser.displayName || authUser.username).charAt(0).toUpperCase()}
                  </span>
                </div>
                {!isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="absolute bottom-1 right-1 w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-xl hover:bg-slate-50 transition-colors border-2 border-slate-100"
                  >
                    <Camera className="w-5 h-5 text-blue-600" />
                  </button>
                )}
              </div>

              {/* Display Name */}
              {isEditing ? (
                <input
                  type="text"
                  value={editForm.displayName}
                  onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                  className="bg-white/20 text-white text-center text-xl font-bold border-0 border-b-2 border-white/40 focus:border-white focus:outline-none placeholder-white/60 w-full py-2"
                  placeholder="Tên hiển thị"
                />
              ) : (
                <h2 className="text-white text-2xl font-bold drop-shadow-sm">
                  {authUser.displayName || authUser.username}
                </h2>
              )}
              <p className="text-white/70 text-sm mt-1 font-medium">@{authUser.username}</p>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 -mt-16 pb-6">
            {/* Edit actions */}
            {isEditing ? (
              <div className="bg-white rounded-2xl shadow-lg p-4 mb-4">
                <div className="flex gap-3">
                  <button
                    onClick={handleCancelEdit}
                    className="flex-1 py-3 text-sm font-semibold text-slate-600 border-2 border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                  >
                    Huỷ
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={editLoading}
                    className="flex-1 py-3 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {editLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Đang lưu...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        Lưu thay đổi
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors border-2 border-blue-100"
                >
                  <Edit3 className="w-4 h-4" />
                  Chỉnh sửa
                </button>
                <button
                  onClick={() => setShowChangePassword(true)}
                  className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors border-2 border-slate-100"
                >
                  <Shield className="w-4 h-4" />
                  Đổi mật khẩu
                </button>
              </div>
            )}

            {/* Profile Info Card */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-4">
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-500" />
                  Thông tin cá nhân
                </h3>
              </div>

              {/* Email */}
              <div className="px-5 py-4 flex items-center gap-4 border-b border-slate-50">
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Mail className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-400 font-medium">Email</p>
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        className="flex-1 text-sm text-slate-800 border-2 border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        placeholder="Nhập email"
                      />
                      {editForm.email && (
                        <button
                          onClick={() => startVerification("email", editForm.email)}
                          className="px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 flex items-center gap-1"
                        >
                          <Send className="w-3 h-3" />
                          Xác thực
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-slate-800 truncate flex-1">
                        {authUser.email || "Chưa cập nhật"}
                      </p>
                      {authUser.email && (
                        <span className="px-2 py-0.5 text-xs font-medium text-green-600 bg-green-50 rounded-full flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Đã xác thực
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Phone */}
              <div className="px-5 py-4 flex items-center gap-4 border-b border-slate-50">
                <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Phone className="w-5 h-5 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-400 font-medium">Số điện thoại</p>
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="tel"
                        value={editForm.phone}
                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                        className="flex-1 text-sm text-slate-800 border-2 border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        placeholder="Nhập số điện thoại"
                      />
                      {editForm.phone && (
                        <button
                          onClick={() => startVerification("phone", editForm.phone)}
                          className="px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 flex items-center gap-1"
                        >
                          <Send className="w-3 h-3" />
                          Xác thực
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-slate-800 flex-1">
                        {authUser.phone || "Chưa cập nhật"}
                      </p>
                      {authUser.phone && (
                        <span className="px-2 py-0.5 text-xs font-medium text-green-600 bg-green-50 rounded-full flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Đã xác thực
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* User ID */}
              <div className="px-5 py-4 flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Bell className="w-5 h-5 text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-400 font-medium">ID người dùng</p>
                  <p className="text-sm text-slate-800 font-mono font-semibold">#{authUser.id}</p>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-4">
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-sm font-bold text-slate-700">Thao tác nhanh</h3>
              </div>
              <button
                onClick={() => setShowChangePassword(true)}
                className="w-full px-5 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors border-b border-slate-50"
              >
                <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                  <Lock className="w-5 h-5 text-purple-600" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold text-slate-800">Đổi mật khẩu</p>
                  <p className="text-xs text-slate-500">Cập nhật mật khẩu mới</p>
                </div>
                <ChevronLeft className="w-5 h-5 text-slate-400 rotate-180" />
              </button>
              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="w-full px-5 py-4 flex items-center gap-4 hover:bg-red-50/50 transition-colors"
              >
                <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
                  <LogOut className="w-5 h-5 text-red-500" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold text-red-600">Đăng xuất</p>
                  <p className="text-xs text-red-400/70">Thoát khỏi tài khoản</p>
                </div>
                <ChevronLeft className="w-5 h-5 text-red-300 rotate-180" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
