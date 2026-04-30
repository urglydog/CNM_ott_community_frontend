"use client";

import { useCallback, useState } from "react";
import {
  X,
  Mail,
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
  resetPasswordWithRecovery,
  startPasswordRecovery,
  verifyPasswordRecoveryOTP,
} from "../../api/client";

type VerificationStep = "enter" | "verifying" | "reset" | "done";

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
  const [step, setStep] = useState<VerificationStep>("enter");
  const [identifier, setIdentifier] = useState("");
  const [recoveryToken, setRecoveryToken] = useState("");
  const [recoveryChannel, setRecoveryChannel] = useState<"email" | "phone" | null>(null);
  const [recoveryTarget, setRecoveryTarget] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validateNewPassword = (pw: string): string | null => {
    if (pw.length < 8) return "Mật khẩu phải có ít nhất 8 ký tự";
    if (!/[A-Z]/.test(pw)) return "Phải có ít nhất 1 chữ hoa (A-Z)";
    if (!/[a-z]/.test(pw)) return "Phải có ít nhất 1 chữ thường (a-z)";
    if (!/\d/.test(pw)) return "Phải có ít nhất 1 chữ số (0-9)";
    return null;
  };

  const resetForm = useCallback(() => {
    setStep("enter");
    setIdentifier("");
    setRecoveryToken("");
    setRecoveryChannel(null);
    setRecoveryTarget("");
    setOtp("");
    setNewPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirm(false);
    setError(null);
    setLoading(false);
  }, []);

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleFinish = () => {
    resetForm();
    onSuccess?.();
    onClose();
  };

  const handleStartRecovery = async () => {
    setError(null);

    const trimmed = identifier.trim();
    if (!trimmed) {
      setError("Vui lòng nhập email hoặc số điện thoại");
      return;
    }

    const isPhone = VALIDATION_PATTERNS.phone.test(trimmed);
    const isEmail = VALIDATION_PATTERNS.email.test(trimmed);
    if (!isPhone && !isEmail) {
      setError("Email hoặc số điện thoại không hợp lệ");
      return;
    }

    setLoading(true);
    try {
      const result = await startPasswordRecovery({ identifier: trimmed });
      setRecoveryToken(result.recoveryToken);
      setRecoveryChannel(result.channel);
      setRecoveryTarget(result.target);
      setStep("verifying");
    } catch (err: any) {
      setError(err.message || "Khởi tạo xác thực thất bại");
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
      await verifyPasswordRecoveryOTP({ recoveryToken, otp });
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
      await resetPasswordWithRecovery({ recoveryToken, newPassword });
      setStep("done");
      onSuccess?.();
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
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Quên mật khẩu</h3>
            <p className="text-xs text-slate-500">Xác thực tài khoản rồi mới đặt lại mật khẩu</p>
          </div>
          <button
            onClick={handleClose}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-6">
          {step === "enter" && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Nhập đúng email hoặc số điện thoại đã đăng ký để bắt đầu xác thực:
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
                  placeholder="Email hoặc 0912345678"
                />
              </div>
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}
              <button
                onClick={handleStartRecovery}
                disabled={loading}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Đang kiểm tra...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Xác thực tài khoản
                  </>
                )}
              </button>
            </div>
          )}

          {step === "verifying" && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Nhập mã 6 số đã gửi đến{" "}
                <span className="font-semibold">{recoveryTarget}</span>
                {recoveryChannel ? (
                  <span className="ml-1 text-slate-400">
                    ({recoveryChannel === "email" ? "email" : "số điện thoại"})
                  </span>
                ) : null}
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
                    Xác thực OTP
                  </>
                )}
              </button>
              <button
                onClick={handleStartRecovery}
                disabled={loading}
                className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 font-medium text-center"
              >
                Gửi lại mã xác thực
              </button>
              <button
                onClick={() => setStep("enter")}
                className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 font-medium text-center"
              >
                ← Quay lại
              </button>
            </div>
          )}

          {step === "reset" && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Mã xác thực đúng. Nhập mật khẩu mới:
              </p>

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

          {step === "done" && (
            <div className="text-center py-8 space-y-3">
              <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-green-500" />
              </div>
              <h4 className="text-lg font-bold text-slate-800">Đổi mật khẩu thành công!</h4>
              <p className="text-sm text-slate-500">
                Bạn có thể đăng nhập bằng mật khẩu mới.
              </p>
              <button
                onClick={handleFinish}
                className="mt-2 w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700"
              >
                Quay lại đăng nhập
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
