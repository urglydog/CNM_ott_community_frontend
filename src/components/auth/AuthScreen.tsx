"use client";

<<<<<<< Updated upstream
import React, { FormEvent } from "react";
import { useAuth } from "../../contexts/AuthContext";
=======
import React, { FormEvent, useState, useRef } from "react";
>>>>>>> Stashed changes

export type AuthMode = "login" | "register";

export type AuthFormState = {
  username: string;
  password: string;
  email: string;
  displayName: string;
};

<<<<<<< Updated upstream
export default function AuthScreen() {
  const { login, register, isLoading, error, form, setForm } = useAuth();
  const [authMode, setAuthMode] = React.useState<AuthMode>("login");

  function handleSubmit(e: FormEvent) {
    if (authMode === "login") {
      login(e as unknown as React.FormEvent);
    } else {
      register(e as unknown as React.FormEvent);
    }
  }

  return (
    <div suppressHydrationWarning className="flex h-screen w-full items-center justify-center bg-gray-100 font-sans">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-6 border border-gray-200">
        <h1 className="text-xl font-semibold text-gray-900 mb-1 text-center">
          OTT Community - Đăng nhập
        </h1>
        <p className="text-xs text-gray-500 mb-4 text-center">
          Đề tài: OTT cho Cộng đồng & Nhóm xã hội
        </p>
        <div className="flex justify-center mb-4 text-xs gap-2">
          <button
            type="button"
            className={`px-3 py-1 rounded-full border ${
              authMode === "login"
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-700 border-gray-300"
            }`}
            onClick={() => setAuthMode("login")}
          >
            Đăng nhập
          </button>
          <button
            type="button"
            className={`px-3 py-1 rounded-full border ${
              authMode === "register"
                ? "bg-blue-50 text-blue-700 border-blue-300"
                : "bg-white text-gray-700 border-gray-300"
            }`}
            onClick={() => setAuthMode("register")}
          >
            Đăng ký
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Tên đăng nhập
            </label>
            <input
              type="text"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Mật khẩu
            </label>
            <input
              type="password"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>
          {authMode === "register" && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Email (tuỳ chọn)
                </label>
                <input
                  type="email"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Tên hiển thị (tuỳ chọn)
                </label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={form.displayName}
                  onChange={(e) =>
                    setForm({ ...form, displayName: e.target.value })
                  }
                />
              </div>
            </>
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            type="submit"
            className="w-full mt-1 bg-blue-600 text-white rounded-md py-2 text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-60"
            disabled={isLoading}
          >
            {isLoading
              ? "Đang xử lý..."
              : authMode === "login"
              ? "Đăng nhập"
              : "Đăng ký"}
          </button>
        </form>
=======
interface FieldError {
  username?: string;
  password?: string;
  email?: string;
  displayName?: string;
}

interface AuthScreenProps {
  authMode: AuthMode;
  authForm: AuthFormState;
  authLoading: boolean;
  authError: string | null;
  onAuthModeChange: (mode: AuthMode) => void;
  onAuthFormChange: (form: AuthFormState) => void;
  onSubmit: (e: FormEvent) => void;
}

// ── Regex validators ──────────────────────────────────────────
const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/;
const PASSWORD_RE = /^.{6,}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DISPLAYNAME_RE = /^.{2,50}$/;

function validateForm(form: AuthFormState, mode: AuthMode): FieldError {
  const errors: FieldError = {};
  if (!USERNAME_RE.test(form.username.trim())) {
    errors.username = "3–30 ký tự (chữ, số, gạch dưới)";
  }
  if (!PASSWORD_RE.test(form.password)) {
    errors.password = "Tối thiểu 6 ký tự";
  }
  if (mode === "register") {
    if (form.email && !EMAIL_RE.test(form.email.trim())) {
      errors.email = "Email không hợp lệ";
    }
    if (form.displayName && !DISPLAYNAME_RE.test(form.displayName.trim())) {
      errors.displayName = "2–50 ký tự";
    }
  }
  return errors;
}

// ── Icons ───────────────────────────────────────────────────────
function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}

function LoadingSpinner() {
  return (
    <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  );
}

// ── Input component ───────────────────────────────────────────────
function FormInput({
  id,
  label,
  type,
  value,
  error,
  onChange,
  onBlur,
  autoComplete,
  icon,
}: {
  id: string;
  label: string;
  type: string;
  value: string;
  error?: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  autoComplete?: string;
  icon?: React.ReactNode;
}) {
  const [showPw, setShowPw] = useState(false);
  const inputType = type === "password" ? (showPw ? "text" : "password") : type;

  return (
    <div>
      <label htmlFor={id} className="block text-[13px] font-medium text-gray-500 mb-1.5">
        {label}
      </label>
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            {icon}
          </div>
        )}
        <input
          id={id}
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          autoComplete={autoComplete}
          className={`
            w-full ${icon ? "pl-9" : "pl-4"} ${type === "password" ? "pr-10" : "pr-4"}
            py-2.5 rounded-lg border text-sm text-gray-800
            placeholder-gray-400 bg-gray-50
            outline-none transition-all duration-150
            ${error
              ? "border-red-400 bg-red-50/40 focus:border-red-400 focus:ring-2 focus:ring-red-200"
              : "border-gray-200 focus:border-[#005ae0] focus:bg-white focus:ring-2 focus:ring-blue-200"
            }
          `}
          placeholder={label}
        />
        {type === "password" && value.length > 0 && (
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            onClick={() => setShowPw((p) => !p)}
            tabIndex={-1}
          >
            {showPw ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        )}
      </div>
      {error && (
        <p className="mt-1 text-[11px] text-red-500">{error}</p>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────
export default function AuthScreen({
  authMode,
  authForm,
  authLoading,
  authError,
  onAuthModeChange,
  onAuthFormChange,
  onSubmit,
}: AuthScreenProps) {
  const [fieldErrors, setFieldErrors] = useState<FieldError>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const formRef = useRef<HTMLFormElement>(null);

  const isRegister = authMode === "register";

  function handleChange(field: keyof AuthFormState, value: string) {
    const next = { ...authForm, [field]: value };
    onAuthFormChange(next);
    if (touched[field]) {
      setFieldErrors(validateForm(next, authMode));
    }
  }

  function handleBlur(field: keyof AuthFormState) {
    setTouched((prev) => ({ ...prev, [field]: true }));
    setFieldErrors(validateForm(authForm, authMode));
  }

  function handleModeSwitch(mode: AuthMode) {
    onAuthModeChange(mode);
    setFieldErrors({});
    setTouched({});
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched({ username: true, password: true, email: true, displayName: true });
    const errors = validateForm(authForm, authMode);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    onSubmit(e);
  }

  return (
    <div className="flex h-screen w-full">
      {/* ── Left panel (giống Zalo – nền xanh, logo) ─────────── */}
      <div className="hidden md:flex w-[45%] bg-[#005ae0] flex-col items-center justify-center p-10 relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute top-[-80px] right-[-80px] w-[320px] h-[320px] rounded-full bg-white/5" />
        <div className="absolute bottom-[-60px] left-[-60px] w-[240px] h-[240px] rounded-full bg-white/5" />
        <div className="absolute top-[30%] right-[10%] w-[120px] h-[120px] rounded-full bg-white/5" />

        {/* Logo */}
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-28 h-28 rounded-[28px] bg-white flex items-center justify-center shadow-2xl mb-6">
            <div className="flex items-center justify-center">
              <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
                <rect width="52" height="52" rx="14" fill="#005ae0"/>
                <path d="M10 16h32M10 26h20M10 36h14" stroke="white" strokeWidth="4" strokeLinecap="round"/>
                <circle cx="38" cy="36" r="7" fill="white"/>
                <path d="M35 36l2 2 4-4" stroke="#005ae0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
          <h1 className="text-white text-3xl font-bold tracking-tight mb-2">
            OTT Community
          </h1>
          <p className="text-white/70 text-sm text-center max-w-[260px] leading-relaxed">
            Kết nối cộng đồng của bạn,<br/>trò chuyện không giới hạn
          </p>
        </div>

        {/* Bottom features */}
        <div className="absolute bottom-10 left-0 right-0 px-10 z-10">
          <div className="space-y-3">
            {[
              { icon: "💬", text: "Trò chuyện nhóm tiện lợi" },
              { icon: "🔔", text: "Thông báo realtime" },
              { icon: "📁", text: "Chia sẻ file dễ dàng" },
            ].map((item) => (
              <div key={item.text} className="flex items-center gap-3 text-white/80">
                <span className="text-lg">{item.icon}</span>
                <span className="text-sm">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel (form) ────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center bg-gray-100 px-6">
        <div className="w-full max-w-[360px]">

          {/* Mobile logo */}
          <div className="flex md:hidden items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-[#005ae0] flex items-center justify-center shadow-md">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <rect width="28" height="28" rx="7" fill="white"/>
                <path d="M5 9h18M5 14h11M5 19h8" stroke="#005ae0" strokeWidth="2.5" strokeLinecap="round"/>
                <circle cx="20" cy="19" r="4" fill="#005ae0"/>
                <path d="M18.5 19l1 1 2-2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="text-xl font-bold text-gray-800">OTT Community</span>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-gray-900 mb-1">
            {isRegister ? "Đăng ký tài khoản" : "Đăng nhập"}
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            {isRegister
              ? "Tạo tài khoản để tham gia cộng đồng"
              : "Chào mừng bạn quay trở lại"}
          </p>

          {/* Tab switcher */}
          <div className="flex bg-gray-200 rounded-lg p-1 mb-6">
            <button
              type="button"
              onClick={() => handleModeSwitch("login")}
              className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all duration-200 ${
                !isRegister
                  ? "bg-white text-[#005ae0] shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Đăng nhập
            </button>
            <button
              type="button"
              onClick={() => handleModeSwitch("register")}
              className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all duration-200 ${
                isRegister
                  ? "bg-white text-[#005ae0] shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Đăng ký
            </button>
          </div>

          {/* Form card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-4">
              <FormInput
                id="username"
                label="Tên đăng nhập"
                type="text"
                value={authForm.username}
                error={touched.username ? fieldErrors.username : undefined}
                onChange={(v) => handleChange("username", v)}
                onBlur={() => handleBlur("username")}
                autoComplete="username"
                icon={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                }
              />

              <FormInput
                id="password"
                label="Mật khẩu"
                type="password"
                value={authForm.password}
                error={touched.password ? fieldErrors.password : undefined}
                onChange={(v) => handleChange("password", v)}
                onBlur={() => handleBlur("password")}
                autoComplete={isRegister ? "new-password" : "current-password"}
                icon={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                }
              />

              {/* Register-only fields */}
              {isRegister && (
                <>
                  <FormInput
                    id="displayName"
                    label="Tên hiển thị"
                    type="text"
                    value={authForm.displayName}
                    error={touched.displayName ? fieldErrors.displayName : undefined}
                    onChange={(v) => handleChange("displayName", v)}
                    onBlur={() => handleBlur("displayName")}
                    autoComplete="name"
                    icon={
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                      </svg>
                    }
                  />
                  <FormInput
                    id="email"
                    label="Email (tuỳ chọn)"
                    type="email"
                    value={authForm.email}
                    error={touched.email ? fieldErrors.email : undefined}
                    onChange={(v) => handleChange("email", v)}
                    onBlur={() => handleBlur("email")}
                    autoComplete="email"
                    icon={
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                        <polyline points="22,6 12,13 2,6"/>
                      </svg>
                    }
                  />
                </>
              )}

              {/* API error */}
              {authError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-lg px-4 py-2.5 text-sm text-red-600">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  {authError}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={authLoading}
                className="w-full mt-2 bg-[#005ae0] hover:bg-[#004ac0] active:scale-[0.98] text-white rounded-xl py-3 text-sm font-semibold shadow-md transition-all duration-150 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {authLoading ? (
                  <LoadingSpinner />
                ) : (
                  <>
                    {isRegister ? "Tạo tài khoản" : "Đăng nhập"}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Footer */}
          <p className="text-center text-[13px] text-gray-500 mt-5">
            {isRegister ? "Đã có tài khoản?" : "Chưa có tài khoản?"}{" "}
            <button
              type="button"
              className="text-[#005ae0] font-semibold hover:underline"
              onClick={() => handleModeSwitch(isRegister ? "login" : "register")}
            >
              {isRegister ? "Đăng nhập" : "Đăng ký ngay"}
            </button>
          </p>
        </div>
>>>>>>> Stashed changes
      </div>
    </div>
  );
}