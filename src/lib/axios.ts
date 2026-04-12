import axios from "axios";
import type { AuthUser } from "../types";

const AUTH_STORAGE_KEY = "ott_auth_user";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

function getToken(): string | null {
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (stored) {
      const user: AuthUser = JSON.parse(stored);
      return user.token || null;
    }
  } catch {
    // ignore
  }
  return null;
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
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      localStorage.removeItem(AUTH_STORAGE_KEY);
      window.location.href = "/login";
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
  }
);

export { apiClient, API_BASE };
export default apiClient;
