import axios from "axios";
import type { AuthUser } from "../types";

const AUTH_STORAGE_KEY = "ott_auth_user";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

function getAuthStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage;
}

function getToken(): string | null {
  try {
    const stored = getAuthStorage()?.getItem(AUTH_STORAGE_KEY);
    if (stored) {
      const user: AuthUser = JSON.parse(stored);
      return user.token || null;
    }
  } catch {
    // ignore
  }
  return null;
}

function getStoredAuth(): AuthUser | null {
  try {
    const stored = getAuthStorage()?.getItem(AUTH_STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as AuthUser;
  } catch {
    return null;
  }
}

function persistStoredAuth(user: AuthUser) {
  getAuthStorage()?.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const current = getStoredAuth();
    if (!current?.refreshToken) return null;

    try {
      const response = await axios.post<{
        token?: string;
        accessToken?: string;
        refreshToken?: string;
      }>(`${API_BASE}/api/auth/refresh`, {
        refreshToken: current.refreshToken,
      });

      const nextToken = response.data.token || response.data.accessToken;
      if (!nextToken) return null;

      persistStoredAuth({
        ...current,
        token: nextToken,
        refreshToken: response.data.refreshToken || current.refreshToken,
      });
      return nextToken;
    } catch {
      return null;
    }
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000,
});

apiClient.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as {
      _retry?: boolean;
      headers?: Record<string, string>;
      [key: string]: any;
    };

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const nextToken = await refreshAccessToken();
      if (nextToken) {
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${nextToken}`;
        return apiClient(originalRequest);
      }

      getAuthStorage()?.removeItem(AUTH_STORAGE_KEY);
      window.dispatchEvent(new Event("auth:logout"));
      return Promise.reject(new Error("SESSION_EXPIRED"));
    }

    // Normalize error message from various backend response formats
    let message = "Đã xảy ra lỗi. Vui lòng thử lại.";
    const data = error.response?.data;
    if (typeof data === "string" && data.trim()) {
      // Backend returned plain text HTML/error
      try {
        const parsed = JSON.parse(data);
        message = parsed?.message || parsed?.error || parsed?.msg || data;
      } catch {
        // It's plain text error like "SyntaxError: ..."
        message = data.substring(0, 200);
      }
    } else if (data && typeof data === "object") {
      message = data?.message || data?.error || data?.msg || message;
    }

    // Replace error with normalized one
    error.message = message;

    return Promise.reject(error);
  },
);

export { apiClient, API_BASE };
export default apiClient;
