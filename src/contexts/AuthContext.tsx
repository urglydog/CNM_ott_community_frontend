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

const AUTH_STORAGE_KEY = "ott_auth_user";

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  login: (e: FormEvent) => Promise<void>;
  register: (e: FormEvent) => Promise<void>;
  logout: () => void;
  setError: (err: string | null) => void;
  form: {
    username: string;
    password: string;
    email: string;
    displayName: string;
  };
  setForm: React.Dispatch<
    React.SetStateAction<{
      username: string;
      password: string;
      email: string;
      displayName: string;
    }>
  >;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const defaultForm = {
  username: "",
  password: "",
  email: "",
  displayName: "",
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);

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

  const handleAuth = useCallback(
    async (mode: AuthMode, e: FormEvent) => {
      e.preventDefault();
      setIsLoading(true);
      setError(null);
      try {
        const body: Record<string, string> = {
          username: form.username,
          password: form.password,
        };
        if (mode === "register") {
          body.email = form.email || `${form.username}@example.com`;
          body.displayName = form.displayName || form.username;
        }
        const { user: u, token } = await authRequest(mode, body);
        const authUser: AuthUser = {
          id: u.id,
          username: u.username,
          displayName: u.display_name || u.displayName || u.username,
          email: u.email,
          token,
        };
        persistUser(authUser);
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : "Đăng nhập/Đăng ký thất bại"
        );
      } finally {
        setIsLoading(false);
      }
    },
    [form, persistUser]
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
        setError,
        form,
        setForm,
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
