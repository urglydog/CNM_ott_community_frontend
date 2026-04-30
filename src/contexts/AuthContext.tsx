"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  FormEvent,
} from "react";
import { AuthUser } from "../types";
import { authRequest, AuthMode } from "../api/client";
import { useToast } from "./ToastContext";

const AUTH_STORAGE_KEY = "ott_auth_user";

function getAuthStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage;
}

// ── Validation Patterns ─────────────────────────────────────────────────────────
export const VALIDATION_PATTERNS = {
  username: /^[a-zA-Z0-9_]{3,30}$/,
  password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^(0[3-9])[0-9]{8}$/,
  fullName: /^.{2,50}$/,
};

export const VALIDATION_MESSAGES = {
  username: "Tên đăng nhập phải từ 3-30 ký tự (chỉ chứa chữ, số và dấu gạch dưới)",
  password: "Mật khẩu phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường và số",
  email: "Email không hợp lệ. Vui lòng nhập đúng định dạng (ví dụ: name@example.com)",
  phone: "Số điện thoại phải có 10 số, bắt đầu bằng 03, 05, 07, 08 hoặc 09 (ví dụ: 0912345678)",
  fullName: "Họ tên phải từ 2-50 ký tự",
  confirmPassword: "Mật khẩu xác nhận không khớp",
};

interface FormErrors {
  username?: string;
  password?: string;
  confirmPassword?: string;
  email?: string;
  phone?: string;
  fullName?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  login: (e: FormEvent) => Promise<void>;
  register: (e: FormEvent) => Promise<void>;
  logout: () => void;
  updateUser: (updates: Partial<AuthUser>) => void;
  setError: (err: string | null) => void;
  form: {
    username: string;
    password: string;
    confirmPassword: string;
    email: string;
    phone: string;
    fullName: string;
  };
  setForm: React.Dispatch<
    React.SetStateAction<{
      username: string;
      password: string;
      confirmPassword: string;
      email: string;
      phone: string;
      fullName: string;
    }>
  >;
  validateForm: () => boolean;
  errors: FormErrors;
  clearErrors: () => void;
  clearSuccess: () => void;
  authSuccess: { type: "login" | "register" | null; message: string };
}

const AuthContext = createContext<AuthContextValue | null>(null);

const defaultForm = {
  username: "",
  password: "",
  confirmPassword: "",
  email: "",
  phone: "",
  fullName: "",
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [authSuccess, setAuthSuccess] = useState<{ type: "login" | "register" | null; message: string }>({ type: null, message: "" });

  const toastCtx = useToast();
  const addToast = (message: string, type = "info") => toastCtx.addToast(message, type as any);

  // Hydrate user từ localStorage khi component mount (tránh hydration mismatch)
  useEffect(() => {
    try {
      const storage = getAuthStorage();
      const stored = storage?.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        const parsed: AuthUser = JSON.parse(stored);
        if ((parsed.id || parsed.userId) && parsed.token) {
          setUser(parsed);
        }
      }
    } catch {
      getAuthStorage()?.removeItem(AUTH_STORAGE_KEY);
    }
    setIsInitialized(true);
  }, []);

  const persistUser = useCallback((authUser: AuthUser) => {
    getAuthStorage()?.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));
    setUser(authUser);
  }, []);

  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  const clearSuccess = useCallback(() => {
    setAuthSuccess((prev) => {
      if (prev.type === null && prev.message === "") {
        return prev;
      }
      return { type: null, message: "" };
    });
  }, []);

  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    // Validate username
    if (!VALIDATION_PATTERNS.username.test(form.username)) {
      newErrors.username = VALIDATION_MESSAGES.username;
    }

    // Validate password
    if (!VALIDATION_PATTERNS.password.test(form.password)) {
      newErrors.password = VALIDATION_MESSAGES.password;
    }

    // Validate email (bắt buộc khi đăng ký)
    if (form.email && !VALIDATION_PATTERNS.email.test(form.email)) {
      newErrors.email = VALIDATION_MESSAGES.email;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [form]);

  const handleAuth = useCallback(
    async (mode: AuthMode, e: FormEvent) => {
      e.preventDefault();
      setIsLoading(true);
      setError(null);
      clearSuccess();

      try {
        const body: Record<string, string> = {
          username: form.username,
          password: form.password,
        };

        if (mode === "register") {
          const newErrors: FormErrors = {};
          // Validate all required fields for registration
          if (!form.fullName.trim()) {
            newErrors.fullName = "Vui lòng nhập họ tên";
          }
          if (form.email.trim() && !VALIDATION_PATTERNS.email.test(form.email)) {
            newErrors.email = VALIDATION_MESSAGES.email;
          }
          if (!form.phone.trim()) {
            newErrors.phone = "Vui lòng nhập số điện thoại";
          } else if (!VALIDATION_PATTERNS.phone.test(form.phone)) {
            newErrors.phone = VALIDATION_MESSAGES.phone;
          }
          if (form.password !== form.confirmPassword) {
            newErrors.confirmPassword = VALIDATION_MESSAGES.confirmPassword;
          }

          if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            setIsLoading(false);
            return;
          }

          body.email = form.email;
          body.phone = form.phone;
          body.fullName = form.fullName;
        }

        const { user: u, token, accessToken, refreshToken } = await authRequest(mode, body as any);
        const resolvedToken = token || accessToken;
        if (!resolvedToken) {
          throw new Error("Không nhận được token đăng nhập từ máy chủ");
        }

        const resolvedDisplayName =
          u.display_name || u.displayName || u.fullName || u.full_name || u.username;
        const resolvedPhone =
          u.phone || u.phone_number || u.phoneNumber || form.phone || "";
        const resolvedAvatar =
          u.avatarUrl || u.avatar_url || null;
        const resolvedEmailVerified = Boolean(
          u.emailVerified ?? u.email_verified ?? false
        );
        const resolvedPhoneVerified = Boolean(
          u.phoneVerified ?? u.phone_verified ?? false
        );

        const authUser: AuthUser = {
          id: u.id ?? u.userId,
          userId: u.userId ? String(u.userId) : undefined,
          username: u.username,
          displayName: resolvedDisplayName,
          email: u.email,
          phone: resolvedPhone,
          avatarUrl: resolvedAvatar,
          emailVerified: resolvedEmailVerified,
          phoneVerified: resolvedPhoneVerified,
          token: resolvedToken,
          refreshToken,
        };
        persistUser(authUser);

        // Show success message with delay before redirect
        const successMsg = mode === "login"
          ? "Đăng nhập thành công!"
          : "Đăng ký thành công! Đang chuyển hướng...";
        setAuthSuccess({ type: mode, message: successMsg });

        // Add toast notification
        if (addToast) {
          addToast(successMsg, "success");
        }

      } catch (err: unknown) {
        const rawMessage = err instanceof Error ? err.message : "Đăng nhập/Đăng ký thất bại";
        const normalizedMessage =
          rawMessage === "User not found, please register"
            ? "Không tìm thấy tài khoản, vui lòng đăng ký trước"
            : rawMessage === "Invalid username or password"
            ? "Tên đăng nhập hoặc mật khẩu không đúng"
            : rawMessage;
        setError(normalizedMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [form, persistUser, addToast, clearSuccess]
  );

  const login = useCallback(
    (e: FormEvent) => handleAuth("login", e),
    [handleAuth]
  );

  const register = useCallback(
    (e: FormEvent) => handleAuth("register", e),
    [handleAuth]
  );

  const logout = useCallback(() => {
    getAuthStorage()?.removeItem(AUTH_STORAGE_KEY);
    setUser(null);
    setForm(defaultForm);
    setError(null);
    setErrors({});
    setAuthSuccess({ type: null, message: "" });
  }, []);

  const updateUser = useCallback((updates: Partial<AuthUser>) => {
    setUser((prev: AuthUser | null) => {
      if (!prev) return null;

      const safeUpdates = Object.fromEntries(
        Object.entries(updates).filter(([, value]) => value !== undefined)
      ) as Partial<AuthUser>;

      const updated = { ...prev, ...safeUpdates };
      getAuthStorage()?.setItem(AUTH_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        error,
        isAuthenticated: !!user,
        isInitialized,
        login,
        register,
        logout,
        updateUser,
        setError,
        form,
        setForm,
        validateForm,
        errors,
        clearErrors,
        clearSuccess,
        authSuccess,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return ctx;
}
