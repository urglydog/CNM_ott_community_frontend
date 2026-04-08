"use client";

import React, { FormEvent } from "react";
import { useAuth } from "../../contexts/AuthContext";

export type AuthMode = "login" | "register";

export type AuthFormState = {
  username: string;
  password: string;
  email: string;
  displayName: string;
};

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
      </div>
    </div>
  );
}
