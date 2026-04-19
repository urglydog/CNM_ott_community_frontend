"use client";

import React, { FormEvent, useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useToast } from "../../contexts/ToastContext";
import {
  User,
  Shield,
  Mail,
  Phone,
  LogIn,
  UserPlus,
  Loader2,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  ArrowRight,
} from "lucide-react";
import { VALIDATION_PATTERNS, VALIDATION_MESSAGES } from "../../contexts/AuthContext";
import ForgotPasswordModal from "./ForgotPasswordModal";

export type AuthMode = "login" | "register";

export default function AuthScreen() {
  const { login, register, isLoading, error, form, setForm, errors, clearErrors, authSuccess, clearSuccess } = useAuth();
  const { addToast } = useToast();
  const router = useRouter();
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showForgotModal, setShowForgotModal] = useState(false);

  // Lắng nghe authSuccess từ context
  useEffect(() => {
    let redirectTimer: ReturnType<typeof setTimeout> | null = null;
    if (authSuccess.type) {
      setSuccessMessage(authSuccess.message);

      // Auto-redirect after delay for registration
      if (authSuccess.type === "register") {
        redirectTimer = setTimeout(() => {
          router.replace("/chat");
          clearSuccess();
        }, 2500);
      }
    }
    return () => {
      if (redirectTimer) {
        clearTimeout(redirectTimer);
      }
    };
  }, [authSuccess, clearSuccess, router]);

  // Clear errors và success khi chuyển auth mode
  useEffect(() => {
    clearErrors();
    setSuccessMessage(null);
  }, [authMode, clearErrors]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSuccessMessage(null);
    if (authMode === "login") {
      login(e);
    } else {
      register(e);
    }
  }

  const handleModeSwitch = (mode: AuthMode) => {
    setAuthMode(mode);
    setSuccessMessage(null);
    clearErrors();
  };

  const validateField = (field: string, value: string): string | undefined => {
    switch (field) {
      case "username":
        if (value && !VALIDATION_PATTERNS.username.test(value)) return VALIDATION_MESSAGES.username;
        break;
      case "password":
        if (value && !VALIDATION_PATTERNS.password.test(value)) return VALIDATION_MESSAGES.password;
        break;
      case "confirmPassword":
        if (value && value !== form.password) return VALIDATION_MESSAGES.confirmPassword;
        break;
      case "email":
        if (value && !VALIDATION_PATTERNS.email.test(value)) return VALIDATION_MESSAGES.email;
        break;
      case "phone":
        if (value && !VALIDATION_PATTERNS.phone.test(value)) return VALIDATION_MESSAGES.phone;
        break;
      case "fullName":
        if (value && !VALIDATION_PATTERNS.fullName.test(value)) return VALIDATION_MESSAGES.fullName;
        break;
    }
    return undefined;
  };

  const getFieldError = (field: string): string | undefined => {
    return (errors as any)[field];
  };

  const isFieldValid = (field: string, value: string): boolean => {
    if (!value) return false;
    return !validateField(field, value);
  };

  const isLogin = authMode === "login";

  return (
    <div className="flex h-screen w-full items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 font-sans relative overflow-hidden">
      {/* Decoration */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2 pointer-events-none" />

      {/* Left panel — logo (desktop only) */}
      <div className="hidden lg:flex flex-col justify-center w-1/2 pl-16 pr-8">
        <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-500/30 mb-6">
          <span className="text-white font-bold text-4xl">Z</span>
        </div>
        <h1 className="text-4xl font-bold text-white mb-3">OTT Community</h1>
        <p className="text-blue-200/80 text-base leading-relaxed max-w-sm">
          Kết nối cộng đồng, trò chuyện và chia sẻ cùng những người bạn yêu thích
        </p>
        <div className="mt-8 flex items-center gap-3 text-blue-200/50 text-xs">
          <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
            <Shield className="w-4 h-4" />
          </div>
          Bảo mật cao với mã hóa tin nhắn
        </div>
      </div>

      {/* Right panel — form */}
      <div className="w-full max-w-[420px] mx-6 relative z-10">
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden">

          {/* Card header */}
          <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 px-7 pt-8 pb-6 text-center">
            <div className="w-14 h-14 mx-auto bg-white/20 rounded-xl flex items-center justify-center mb-3">
              <span className="text-white font-bold text-2xl">Z</span>
            </div>
            <h2 className="text-white text-xl font-bold">
              {isLogin ? "Chào mừng bạn quay trở lại!" : "Tạo tài khoản mới"}
            </h2>
            <p className="text-white/60 text-sm mt-0.5">
              {isLogin ? "Đăng nhập để tiếp tục" : "Đăng ký nhanh chóng và dễ dàng"}
            </p>
          </div>

          {/* Tabs */}
          <div className="flex bg-slate-100 mx-6 -mt-4 rounded-xl p-1">
            <button
              type="button"
              onClick={() => handleModeSwitch("login")}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                isLogin ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <LogIn className="w-4 h-4" />
              Đăng nhập
            </button>
            <button
              type="button"
              onClick={() => handleModeSwitch("register")}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                !isLogin ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <UserPlus className="w-4 h-4" />
              Đăng ký
            </button>
          </div>

          {/* ★ FORM — button bên TRONG form để submit hoạt động */}
          <form
            onSubmit={handleSubmit}
            className="flex flex-col"
          >
            {/* Nội dung cuộn */}
            <div className="h-[420px] overflow-y-auto px-6 pt-4 space-y-3">

              {/* Username */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Tên đăng nhập <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Nhập tên đăng nhập"
                    className={`w-full border-2 rounded-xl pl-10 pr-9 py-2.5 text-sm transition-all placeholder-slate-400 focus:outline-none ${
                      getFieldError("username")
                        ? "border-red-300 bg-red-50 focus:border-red-400 focus:ring-2 focus:ring-red-100"
                        : isFieldValid("username", form.username)
                        ? "border-green-300 bg-green-50 focus:border-green-400 focus:ring-2 focus:ring-green-100"
                        : "border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    }`}
                    value={form.username}
                    onChange={(e) => {
                      setForm({ ...form, username: e.target.value });
                      if (errors.username) clearErrors();
                    }}
                    required
                  />
                  {form.username && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {isFieldValid("username", form.username) ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : getFieldError("username") ? (
                        <XCircle className="w-4 h-4 text-red-400" />
                      ) : null}
                    </div>
                  )}
                </div>
                {getFieldError("username") && (
                  <p className="mt-0.5 text-xs text-red-500">{getFieldError("username")}</p>
                )}
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Mật khẩu <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Nhập mật khẩu"
                    className={`w-full border-2 rounded-xl pl-10 pr-9 py-2.5 text-sm transition-all placeholder-slate-400 focus:outline-none ${
                      getFieldError("password")
                        ? "border-red-300 bg-red-50 focus:border-red-400 focus:ring-2 focus:ring-red-100"
                        : isFieldValid("password", form.password)
                        ? "border-green-300 bg-green-50 focus:border-green-400 focus:ring-2 focus:ring-green-100"
                        : "border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    }`}
                    value={form.password}
                    onChange={(e) => {
                      setForm({ ...form, password: e.target.value });
                      if (errors.password) clearErrors();
                    }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {getFieldError("password") && (
                  <p className="mt-0.5 text-xs text-red-500">{getFieldError("password")}</p>
                )}
                {/* Password strength — register only */}
                {!isLogin && form.password && (
                  <div className="mt-1.5">
                    <div className="flex gap-0.5">
                      <div className={`h-1 flex-1 rounded-full transition-colors ${form.password.length >= 8 ? "bg-green-400" : "bg-slate-200"}`} />
                      <div className={`h-1 flex-1 rounded-full transition-colors ${/[A-Z]/.test(form.password) ? "bg-green-400" : "bg-slate-200"}`} />
                      <div className={`h-1 flex-1 rounded-full transition-colors ${/[a-z]/.test(form.password) ? "bg-green-400" : "bg-slate-200"}`} />
                      <div className={`h-1 flex-1 rounded-full transition-colors ${/\d/.test(form.password) ? "bg-green-400" : "bg-slate-200"}`} />
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">Ít nhất 8 ký tự, hoa, thường và số</p>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              {!isLogin && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Xác nhận mật khẩu <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Nhập lại mật khẩu"
                      className={`w-full border-2 rounded-xl pl-10 pr-9 py-2.5 text-sm transition-all placeholder-slate-400 focus:outline-none ${
                        getFieldError("confirmPassword")
                          ? "border-red-300 bg-red-50 focus:border-red-400 focus:ring-2 focus:ring-red-100"
                          : isFieldValid("confirmPassword", form.confirmPassword)
                          ? "border-green-300 bg-green-50 focus:border-green-400 focus:ring-2 focus:ring-green-100"
                          : "border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                      }`}
                      value={form.confirmPassword}
                      onChange={(e) => {
                        setForm({ ...form, confirmPassword: e.target.value });
                        if (errors.confirmPassword) clearErrors();
                      }}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {getFieldError("confirmPassword") && (
                    <p className="mt-0.5 text-xs text-red-500">{getFieldError("confirmPassword")}</p>
                  )}
                </div>
              )}

              {/* Register-only fields */}
              {!isLogin && (
                <>
                  {/* Full Name */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Họ và tên <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Nhập họ và tên"
                        className={`w-full border-2 rounded-xl pl-10 pr-9 py-2.5 text-sm transition-all placeholder-slate-400 focus:outline-none ${
                          getFieldError("fullName")
                            ? "border-red-300 bg-red-50 focus:border-red-400 focus:ring-2 focus:ring-red-100"
                            : isFieldValid("fullName", form.fullName)
                            ? "border-green-300 bg-green-50 focus:border-green-400 focus:ring-2 focus:ring-green-100"
                            : "border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        }`}
                        value={form.fullName}
                        onChange={(e) => {
                          setForm({ ...form, fullName: e.target.value });
                          if (errors.fullName) clearErrors();
                        }}
                        required
                      />
                      {form.fullName && isFieldValid("fullName", form.fullName) && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        </div>
                      )}
                    </div>
                    {getFieldError("fullName") && (
                      <p className="mt-0.5 text-xs text-red-500">{getFieldError("fullName")}</p>
                    )}
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Email <span className="text-slate-400">(tùy chọn)</span>
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="email"
                        placeholder="Nhập email"
                        className={`w-full border-2 rounded-xl pl-10 pr-9 py-2.5 text-sm transition-all placeholder-slate-400 focus:outline-none ${
                          getFieldError("email")
                            ? "border-red-300 bg-red-50 focus:border-red-400 focus:ring-2 focus:ring-red-100"
                            : isFieldValid("email", form.email)
                            ? "border-green-300 bg-green-50 focus:border-green-400 focus:ring-2 focus:ring-green-100"
                            : "border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        }`}
                        value={form.email}
                        onChange={(e) => {
                          setForm({ ...form, email: e.target.value });
                          if (errors.email) clearErrors();
                        }}
                      />
                      {form.email && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          {isFieldValid("email", form.email) ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : getFieldError("email") ? (
                            <XCircle className="w-4 h-4 text-red-400" />
                          ) : null}
                        </div>
                      )}
                    </div>
                    {getFieldError("email") && (
                      <p className="mt-0.5 text-xs text-red-500">{getFieldError("email")}</p>
                    )}
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Số điện thoại <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="tel"
                        placeholder="VD: 0912345678"
                        className={`w-full border-2 rounded-xl pl-10 pr-9 py-2.5 text-sm transition-all placeholder-slate-400 focus:outline-none ${
                          getFieldError("phone")
                            ? "border-red-300 bg-red-50 focus:border-red-400 focus:ring-2 focus:ring-red-100"
                            : isFieldValid("phone", form.phone)
                            ? "border-green-300 bg-green-50 focus:border-green-400 focus:ring-2 focus:ring-green-100"
                            : "border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        }`}
                        value={form.phone}
                        onChange={(e) => {
                          setForm({ ...form, phone: e.target.value });
                          if (errors.phone) clearErrors();
                        }}
                        required
                      />
                      {form.phone && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          {isFieldValid("phone", form.phone) ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : getFieldError("phone") ? (
                            <XCircle className="w-4 h-4 text-red-400" />
                          ) : null}
                        </div>
                      )}
                    </div>
                    {getFieldError("phone") && (
                      <p className="mt-0.5 text-xs text-red-500">{getFieldError("phone")}</p>
                    )}
                  </div>
                </>
              )}

              {/* Error */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-xs px-3 py-2 rounded-xl flex items-center gap-2">
                  <XCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              {/* Success */}
              {successMessage && (
                <div className="bg-green-50 border border-green-200 text-green-700 text-xs px-3 py-2 rounded-xl flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  {successMessage}
                </div>
              )}
            </div>

            {/* Nút bấm — bên TRONG form, nằm dưới cùng */}
            <div className="px-6 pb-6 mt-auto pt-4">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl py-3.5 text-sm font-semibold hover:from-blue-700 hover:to-blue-800 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-blue-500/30"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang xử lý...</span>
                  </>
                ) : isLogin ? (
                  <>
                    <span>Đăng nhập</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    <span>Tạo tài khoản</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {isLogin && (
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  className="mx-auto mt-3 block text-center text-xs text-blue-600 hover:text-blue-700 hover:underline"
                >
                  Quên mật khẩu? Đặt lại bằng email hoặc số điện thoại
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        isOpen={showForgotModal}
        onClose={() => setShowForgotModal(false)}
        onSuccess={() => {
          setShowForgotModal(false);
          addToast("Vui lòng đăng nhập lại với mật khẩu mới", "info");
        }}
      />
    </div>
  );
}
