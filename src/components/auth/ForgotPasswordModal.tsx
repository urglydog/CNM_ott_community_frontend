"use client";

import { useState, useCallback } from "react";
import {
  X,
  Mail,
  Phone,
  Send,
  Loader2,
  KeyRound,
  CheckCircle,
  XCircle,
  Shield,
  Eye,
  EyeOff,
} from "lucide-react";
import { VALIDATION_PATTERNS } from "../../contexts/AuthContext";
import {
  sendEmailOTP,
  verifyEmailOTP,
  sendPhoneOTP,
  verifyPhoneOTP,
} from "../../api/client";

type VerificationStep = "choose" | "sending" | "verifying" | "reset" | "done";
type VerificationType = "email" | "phone" | null;

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function ForgotPasswordModal({
  isOpen,
  onClose,
  onSuccess,
}: ForgotPasswordModalProps) {
  const [step, setStep] = useState<VerificationStep>("choose");
  const [type, setType] = useState<VerificationType>(null);
  const [identifier, setIdentifier] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [expiresIn, setExpiresIn] = useState(0);

  // Validate new password
  const validateNewPassword = (pw: string): string | null => {
    if (pw.length < 8) return "Mật khẩu phải có ít nhất 8 ký tự";
    if (!/[A-Z]/.test(pw)) return "Phải có ít nhất 1 chữ hoa (A-Z)";
    if (!/[a-z]/.test(pw)) return "Phải có ít nhất 1 chữ thường (a-z)";
    if (!/\d/.test(pw)) return "Phải có ít nhất 1 chữ số (0-9)";
    return null;
  };

  const resetForm = useCallback(() => {
    setStep("choose");
    setType(null);
    setIdentifier("");
    setOtp("");
    setNewPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirm(false);
    setError(null);
    setOtpSent(false);
    setExpiresIn(0);
  }, []);

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSendOTP = async () => {
    setError(null);
    if (!identifier.trim()) {
      setError("Vui lòng nhập email hoặc số điện thoại");
      return;
    }
    const trimmed = identifier.trim();
    const isEmail = VALIDATION_PATTERNS.email.test(trimmed);
    const isPhone = VALIDATION_PATTERNS.phone.test(trimmed);
    if (!isEmail && !isPhone) {
      setError("Định dạng email hoặc số điện thoại không hợp lệ");
      return;
    }
    setLoading(true);
    try {
      if (isEmail) {
        setType("email");
        await sendEmailOTP(trimmed);
      } else {
        setType("phone");
        await sendPhoneOTP(trimmed);
      }
      setStep("verifying");
      setOtpSent(true);
      setExpiresIn(300);
    } catch (err: any) {
      setError(err.message || "Gửi mã xác thực thất bại");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    setError(null);
    if (!otp || otp.length < 6) {
      setError("Vui lòng nhập đầy đủ mã 6 số");
      return;
    }
    setLoading(true);
    try {
      if (type === "email") {
        await verifyEmailOTP({ email: identifier.trim(), otp });
      } else if (type === "phone") {
        await verifyPhoneOTP({ phone: identifier.trim(), otp });
      }
      setStep("reset");
    } catch (err: any) {
      setError(err.message || "Mã xác thực không đúng");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setError(null);
    const pwErr = validateNewPassword(newPassword);
    if (pwErr) {
      setError(pwErr);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000"}/api/users/reset-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            identifier: identifier.trim(),
            newPassword,
            otp,
            type,
          }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Đặt lại mật khẩu thất bại");
      }
      setStep("done");
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message || "Đặt lại mật khẩu thất bại");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Quên mật khẩu</h3>
            <p className="text-xs text-slate-500">Đặt lại mật khẩu qua Email/SMS</p>
          </div>
          <button
            onClick={handleClose}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-6">
          {/* Step: Choose identifier */}
          {step === "choose" && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Nhập email hoặc số điện thoại đã đăng ký để nhận mã xác thực:
              </p>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    setError(null);
                  }}
                  className="w-full border-2 border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  placeholder="email@example.com hoặc 0912345678"
                />
              </div>
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}
              <button
                onClick={handleSendOTP}
                disabled={loading}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Đang gửi...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Gửi mã xác thực
                  </>
                )}
              </button>
            </div>
          )}

          {/* Step: Verify OTP */}
          {step === "verifying" && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Nhập mã 6 số đã gửi đến{" "}
                <span className="font-semibold">
                  {type === "email" ? identifier : `***${identifier.slice(-4)}`}
                </span>
              </p>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => {
                    setOtp(e.target.value.replace(/\D/g, ""));
                    setError(null);
                  }}
                  className="w-full border-2 border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-center text-lg tracking-widest focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  placeholder="_ _ _ _ _ _"
                />
              </div>
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}
              <button
                onClick={handleVerifyOTP}
                disabled={loading}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Đang xác thực...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Xác thực
                  </>
                )}
              </button>
              <button
                onClick={() => setStep("choose")}
                className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 font-medium text-center"
              >
                ← Quay lại
              </button>
            </div>
          )}

          {/* Step: Reset password */}
          {step === "reset" && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">Mã xác thực đúng. Nhập mật khẩu mới:</p>

              {/* New Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Mật khẩu mới
                </label>
                <div className="relative">
                  <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full border-2 border-slate-200 rounded-xl pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    placeholder="Ít nhất 8 ký tự, hoa, thường, số"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {newPassword && (
                  <div className="mt-1.5 flex gap-0.5">
                    <div className={`h-1 flex-1 rounded-full ${newPassword.length >= 8 ? "bg-green-400" : "bg-slate-200"}`} />
                    <div className={`h-1 flex-1 rounded-full ${/[A-Z]/.test(newPassword) ? "bg-green-400" : "bg-slate-200"}`} />
                    <div className={`h-1 flex-1 rounded-full ${/[a-z]/.test(newPassword) ? "bg-green-400" : "bg-slate-200"}`} />
                    <div className={`h-1 flex-1 rounded-full ${/\d/.test(newPassword) ? "bg-green-400" : "bg-slate-200"}`} />
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Xác nhận mật khẩu mới
                </label>
                <div className="relative">
                  <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full border-2 border-slate-200 rounded-xl pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    placeholder="Nhập lại mật khẩu mới"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <button
                onClick={handleResetPassword}
                disabled={loading}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Đang xử lý...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Đặt lại mật khẩu
                  </>
                )}
              </button>
            </div>
          )}

          {/* Step: Success */}
          {step === "done" && (
            <div className="text-center py-8 space-y-3">
              <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-green-500" />
              </div>
              <h4 className="text-lg font-bold text-slate-800">Đặt lại thành công!</h4>
              <p className="text-sm text-slate-500">
                Bạn có thể đăng nhập bằng mật khẩu mới.
              </p>
              <button
                onClick={handleClose}
                className="mt-2 w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700"
              >
                Đóng
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
