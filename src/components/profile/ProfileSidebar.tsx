"use client";

import { useState } from "react";
import {
  X,
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
  KeyRound,
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
import { VALIDATION_PATTERNS, VALIDATION_MESSAGES } from "../../contexts/AuthContext";
import ForgotPasswordModal from "../auth/ForgotPasswordModal";

interface ProfileSidebarProps {
  isOpen: boolean;
  authUser: AuthUser;
  onClose: () => void;
  onLogout: () => void;
  onUpdateUser?: (updatedUser: Partial<AuthUser>) => void;
}

type VerificationStep = "idle" | "sending" | "verifying" | "success";
type VerificationType = "email" | "phone" | null;
type Tab = "info" | "password";

export default function ProfileSidebar({
  isOpen,
  authUser,
  onClose,
  onLogout,
  onUpdateUser,
}: ProfileSidebarProps) {
  const { addToast } = useToast();
  const [tab, setTab] = useState<Tab>("info");
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    displayName: authUser.displayName || "",
    email: authUser.email || "",
    phone: authUser.phone || "",
  });
  const [editLoading, setEditLoading] = useState(false);

  // ── Password tab state ──────────────────────────────────────────────────────
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
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  // ── Verification state ─────────────────────────────────────────────────────
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

  // ── Forgot Password Modal ────────────────────────────────────────────────────
  const [showForgotModal, setShowForgotModal] = useState(false);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const validateNewPassword = (pw: string): string | null => {
    if (pw.length < 8) return "Mật khẩu phải có ít nhất 8 ký tự";
    if (!/[A-Z]/.test(pw)) return "Phải có ít nhất 1 chữ hoa (A-Z)";
    if (!/[a-z]/.test(pw)) return "Phải có ít nhất 1 chữ thường (a-z)";
    if (!/\d/.test(pw)) return "Phải có ít nhất 1 chữ số (0-9)";
    return null;
  };

  const newPwStrength = (pw: string) => {
    return [
      pw.length >= 8,
      /[A-Z]/.test(pw),
      /[a-z]/.test(pw),
      /\d/.test(pw),
    ].filter(Boolean).length;
  };

  // ── Profile edit ───────────────────────────────────────────────────────────
  const handleSave = async () => {
    setEditLoading(true);
    try {
      const result = await updateProfile({
        displayName: editForm.displayName,
        email: editForm.email,
        phone: editForm.phone,
      });
      if (onUpdateUser && result.user) {
        onUpdateUser({
          displayName: editForm.displayName,
          email: editForm.email,
          phone: editForm.phone,
        });
      }
      setIsEditing(false);
      addToast("Cập nhật hồ sơ thành công!", "success");
    } catch (err: any) {
      addToast(err.message || "Cập nhật hồ sơ thất bại", "error");
    } finally {
      setEditLoading(false);
    }
  };

  // ── Verification ──────────────────────────────────────────────────────────
  const startVerification = (type: VerificationType, value: string) => {
    setVerification({ type, value, step: "sending", otp: "", otpSent: false, expiresIn: 0, error: null });
    sendVerificationOTP(type, value);
  };

  const sendVerificationOTP = async (type: VerificationType, value: string) => {
    try {
      if (type === "email") await sendEmailOTP(value);
      else if (type === "phone") await sendPhoneOTP(value);
      setVerification((p) => ({ ...p, step: "verifying", otpSent: true, expiresIn: 300 }));
      addToast(`Mã xác thực đã gửi đến ${type === "email" ? "email" : "số điện thoại"}`, "info");
    } catch (err: any) {
      setVerification((p) => ({ ...p, step: "idle", error: err.message || "Gửi mã thất bại" }));
      addToast(err.message || "Gửi mã xác thực thất bại", "error");
    }
  };

  const verifyOTP = async () => {
    if (!verification.otp || verification.otp.length < 6) {
      setVerification((p) => ({ ...p, error: "Vui lòng nhập đầy đủ mã 6 số" }));
      return;
    }
    setVerification((p) => ({ ...p, error: null }));
    try {
      if (verification.type === "email") await verifyEmailOTP({ email: verification.value, otp: verification.otp });
      else if (verification.type === "phone") await verifyPhoneOTP({ phone: verification.value, otp: verification.otp });
      setVerification((p) => ({ ...p, step: "success" }));
      addToast("Xác thực thành công!", "success");
      if (onUpdateUser) {
        if (verification.type === "email") onUpdateUser({ email: verification.value });
        else if (verification.type === "phone") onUpdateUser({ phone: verification.value });
      }
      setTimeout(() => {
        setVerification({ type: null, value: "", step: "idle", otp: "", otpSent: false, expiresIn: 0, error: null });
      }, 1500);
    } catch (err: any) {
      setVerification((p) => ({ ...p, error: err.message || "Mã xác thực không đúng" }));
    }
  };

  // ── Change password ──────────────────────────────���─────────────────────────
  const handleChangePassword = async () => {
    setPasswordError(null);
    setPasswordSuccess(false);

    if (!passwordForm.currentPassword) {
      setPasswordError("Vui lòng nhập mật khẩu hiện tại");
      return;
    }
    const pwErr = validateNewPassword(passwordForm.newPassword);
    if (pwErr) {
      setPasswordError(pwErr);
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("Mật khẩu xác nhận không khớp");
      return;
    }

    setPasswordLoading(true);
    try {
      await changePassword({ currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setPasswordSuccess(true);
      setTimeout(() => setPasswordSuccess(false), 3000);
      addToast("Đổi mật khẩu thành công! Đang đăng xuất...", "success");

      // Auto logout after 2 seconds to require re-login with new password
      setTimeout(() => {
        onLogout();
      }, 2000);
    } catch (err: any) {
      setPasswordError(err.message || "Đổi mật khẩu thất bại");
    } finally {
      setPasswordLoading(false);
    }
  };

  // ── Forgot Password Modal ────────────────────────────────────────────────────
  const handleOpenForgotModal = () => setShowForgotModal(true);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm" onClick={onClose} />

      {/* Sidebar */}
      <div className="fixed top-0 right-0 h-full w-full max-w-[380px] bg-white z-40 shadow-2xl flex flex-col overflow-hidden animate-slideIn">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-blue-600 to-indigo-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-white font-bold text-base">Hồ sơ cá nhân</h2>
              <p className="text-white/60 text-xs">@{authUser.username}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 bg-slate-50 px-3 pt-3 gap-1">
          {(["info", "password"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setPasswordError(null); setPasswordSuccess(false); }}
              className={`flex-1 py-2.5 rounded-t-lg text-xs font-semibold transition-all ${
                tab === t
                  ? "bg-white text-blue-600 shadow-sm border border-slate-200 border-b-white"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {t === "info" ? "Thông tin" : "Đổi mk"}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Info tab ─────────────────────────────────────────────────── */}
          {tab === "info" && (
            <div className="p-5 space-y-4">
              {/* Avatar + display name */}
              <div className="flex flex-col items-center text-center">
                <div className="relative mb-3">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                    <span className="text-white font-bold text-3xl">{(authUser.displayName || authUser.username).charAt(0).toUpperCase()}</span>
                  </div>
                  {isEditing && (
                    <button onClick={() => setIsEditing(false)} className="absolute -bottom-1 -right-1 w-8 h-8 bg-white rounded-full shadow border-2 border-slate-100 flex items-center justify-center hover:bg-slate-50">
                      <Camera className="w-4 h-4 text-blue-600" />
                    </button>
                  )}
                </div>
                {isEditing ? (
                  <input
                    type="text"
                    value={editForm.displayName}
                    onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                    className="w-full border-2 border-blue-200 rounded-xl px-3 py-2 text-center font-semibold text-slate-800 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    placeholder="Tên hiển thị"
                  />
                ) : (
                  <h3 className="text-lg font-bold text-slate-800">{authUser.displayName || authUser.username}</h3>
                )}
                <p className="text-xs text-slate-400 mt-0.5">#{authUser.id}</p>
              </div>

              {/* Edit / Save actions */}
              <div className="flex gap-2">
                {isEditing ? (
                  <>
                    <button onClick={() => { setIsEditing(false); setEditForm({ displayName: authUser.displayName || "", email: authUser.email || "", phone: authUser.phone || "" }); }}
                      className="flex-1 py-2.5 text-sm font-semibold text-slate-600 border-2 border-slate-200 rounded-xl hover:bg-slate-50">
                      Huỷ
                    </button>
                    <button onClick={handleSave} disabled={editLoading}
                      className="flex-1 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
                      {editLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Đang lưu...</> : <><Check className="w-4 h-4" /> Lưu</>}
                    </button>
                  </>
                ) : (
                  <button onClick={() => setIsEditing(true)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-blue-600 bg-blue-50 border-2 border-blue-100 rounded-xl hover:bg-blue-100">
                    <Edit3 className="w-4 h-4" /> Chỉnh sửa
                  </button>
                )}
              </div>

              {/* Info cards */}
              <div className="space-y-3">
                {/* Email */}
                <div className="bg-slate-50 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Mail className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-400 font-medium">Email</p>
                      {isEditing ? (
                        <div className="space-y-2">
                          <input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                            className="w-full border-2 border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                            placeholder="Nhập email" />
                          {editForm.email && (
                            <button onClick={() => startVerification("email", editForm.email)}
                              className="px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 flex items-center gap-1">
                              <Send className="w-3 h-3" /> Xác thực email
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-slate-800 truncate">{authUser.email || "Chưa cập nhật"}</p>
                          {authUser.email && <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Phone */}
                <div className="bg-slate-50 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Phone className="w-4 h-4 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-400 font-medium">Số điện thoại</p>
                      {isEditing ? (
                        <div className="space-y-2">
                          <input type="tel" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                            className="w-full border-2 border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                            placeholder="Nhập số điện thoại" />
                          {editForm.phone && (
                            <button onClick={() => startVerification("phone", editForm.phone)}
                              className="px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 flex items-center gap-1">
                              <Send className="w-3 h-3" /> Xác thực SĐT
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-slate-800">{authUser.phone || "Chưa cập nhật"}</p>
                          {authUser.phone && <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Logout */}
              <button onClick={onLogout}
                className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold text-red-500 bg-red-50 border-2 border-red-100 rounded-xl hover:bg-red-100 mt-2">
                <LogOut className="w-4 h-4" /> Đăng xuất
              </button>
            </div>
          )}

          {/* ── Password tab ────────────────────────────────────────────── */}
          {tab === "password" && (
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Shield className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">Đổi mật khẩu</h3>
                  <p className="text-xs text-slate-500">Cập nhật mật khẩu mới</p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Mật khẩu hiện tại</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type={showPasswords.current ? "text" : "password"} value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                      className="w-full border-2 border-slate-200 rounded-xl pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                      placeholder="Nhập mật khẩu hiện tại" />
                    <button type="button" onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Mật khẩu mới</label>
                  <div className="relative">
                    <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type={showPasswords.new ? "text" : "password"} value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                      className="w-full border-2 border-slate-200 rounded-xl pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                      placeholder="Ít nhất 8 ký tự, hoa, thường, số" />
                    <button type="button" onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {passwordForm.newPassword && (
                    <div className="mt-1.5">
                      <div className="flex gap-0.5 mb-1">
                        <div className={`h-1 flex-1 rounded-full ${passwordForm.newPassword.length >= 8 ? "bg-green-400" : "bg-slate-200"}`} />
                        <div className={`h-1 flex-1 rounded-full ${/[A-Z]/.test(passwordForm.newPassword) ? "bg-green-400" : "bg-slate-200"}`} />
                        <div className={`h-1 flex-1 rounded-full ${/[a-z]/.test(passwordForm.newPassword) ? "bg-green-400" : "bg-slate-200"}`} />
                        <div className={`h-1 flex-1 rounded-full ${/\d/.test(passwordForm.newPassword) ? "bg-green-400" : "bg-slate-200"}`} />
                      </div>
                      <p className="text-xs text-slate-400">8 ký tự + hoa + thường + số</p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Xác nhận mật khẩu mới</label>
                  <div className="relative">
                    <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type={showPasswords.confirm ? "text" : "password"} value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                      className="w-full border-2 border-slate-200 rounded-xl pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                      placeholder="Nhập lại mật khẩu mới" />
                    <button type="button" onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {passwordError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-600">{passwordError}</p>
                </div>
              )}
              {passwordSuccess && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <p className="text-sm text-green-600">Đổi mật khẩu thành công!</p>
                </div>
              )}

              <button onClick={handleChangePassword} disabled={passwordLoading}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
                {passwordLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Đang xử lý...</> : <><CheckCircle className="w-4 h-4" /> Xác nhận đổi mật khẩu</>}
              </button>

              <button onClick={handleOpenForgotModal}
                className="w-full py-2 text-sm text-blue-600 hover:text-blue-700 font-medium text-center">
                Quên mật khẩu? Nhấn vào đây để đặt lại
              </button>
            </div>
          )}

          {/* ── Forgot Password Modal ─────────────────────────────────────────────── */}
          <ForgotPasswordModal
            isOpen={showForgotModal}
            onClose={() => setShowForgotModal(false)}
            onSuccess={() => {
              setShowForgotModal(false);
              addToast("Vui lòng đăng nhập lại với mật khẩu mới", "info");
              onLogout();
            }}
          />
        </div>
      </div>

      {/* OTP Verification Modal */}
      {verification.step !== "idle" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-800">
                  Xác thực {verification.type === "email" ? "Email" : "Số điện thoại"}
                </h3>
                <button onClick={() => setVerification({ type: null, value: "", step: "idle", otp: "", otpSent: false, expiresIn: 0, error: null })}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100">
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
                    Nhập mã 6 số gửi đến{" "}
                    <span className="font-semibold">{verification.type === "email" ? verification.value : `***${verification.value.slice(-4)}`}</span>
                  </p>
                  <input type="text" placeholder="_ _ _ _ _ _" maxLength={6} value={verification.otp}
                    onChange={(e) => setVerification((p) => ({ ...p, otp: e.target.value.replace(/\D/g, ""), error: null }))}
                    className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-center text-lg tracking-widest focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 mb-3" />
                  {verification.error && (
                    <p className="text-sm text-red-500 mb-3 flex items-center gap-1"><XCircle className="w-4 h-4" />{verification.error}</p>
                  )}
                  <button onClick={verifyOTP}
                    className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 flex items-center justify-center gap-2">
                    <CheckCircle className="w-4 h-4" />Xác thực
                  </button>
                  <button onClick={() => sendVerificationOTP(verification.type, verification.value)}
                    className="w-full mt-2 py-2 text-sm text-blue-600 hover:text-blue-700 font-medium">
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
    </>
  );
}
