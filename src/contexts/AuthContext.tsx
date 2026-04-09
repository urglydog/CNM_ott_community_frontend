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
  email: "Email không hợp lệ",
  phone: "Số điện thoại phải c�� 10 số bắt đầu bằng 03, 05, 07, 08 hoặc 09",
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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);

  // Lấy toast context (có thể null nếu chưa được wrap trong ToastProvider)
  let addToast: ((message: string, type?: string) => void) | null = null;
  try {
    const toastCtx = useToast();
    addToast = (message: string, type = "info") => toastCtx.addToast(message, type as any);
  } catch {
    // ToastProvider chưa được mount
  }

  // Hydrate user từ localStorage khi component mount (tránh hydration mismatch)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        const parsed: AuthUser = JSON.parse(stored);
        if (parsed.id && parsed.token) {
          setUser(parsed);
        }
      }
    } catch {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }, []);

  const persistUser = useCallback((authUser: AuthUser) => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));
    setUser(authUser);
  }, []);

  const clearErrors = useCallback(() => {
    setErrors({});
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
      setAuthSuccess(null);

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
          if (!form.email.trim()) {
            newErrors.email = "Vui lòng nhập email";
          } else if (!VALIDATION_PATTERNS.email.test(form.email)) {
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

        const { user: u, token } = await authRequest(mode, body as any);
        const authUser: AuthUser = {
          id: u.id,
          username: u.username,
          displayName: u.display_name || u.displayName || u.fullName || u.username,
          email: u.email,
          phone: u.phone,
          token,
        };
        persistUser(authUser);

        // Show success toast
        if (addToast) {
          addToast(
            mode === "login" ? "Đăng nhập thành công!" : "Đăng ký thành công!",
            "success"
          );
        }
        setAuthSuccess(mode === "login" ? "login" : "register");
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : "Đăng nhập/Đăng ký thất bại"
        );
      } finally {
        setIsLoading(false);
      }
    },
    [form, persistUser, addToast]
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
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setUser(null);
    setForm(defaultForm);
    setError(null);
    setErrors({});
    setAuthSuccess(null);
  }, []);

  const updateUser = useCallback((updates: Partial<AuthUser>) => {
    setUser((prev: AuthUser | null) => {
      if (!prev) return null;
      const updated = { ...prev, ...updates };
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updated));
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
