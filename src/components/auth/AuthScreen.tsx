"use client";

import React, { FormEvent, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import {
  User,
  Shield,
  Mail,
  LogIn,
  UserPlus,
  Loader2,
} from "lucide-react";

export type AuthMode = "login" | "register";

export type AuthFormState = {
  username: string;
  password: string;
  email: string;
  displayName: string;
};

export default function AuthScreen() {
  const { login, register, isLoading, error, form, setForm } = useAuth();
  const [authMode, setAuthMode] = useState<AuthMode>("login");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (authMode === "login") {
      login(e);
    } else {
      register(e);
    }
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 font-sans">
      <div className="w-full max-w-[380px] mx-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto bg-[#005ae0] rounded-2xl flex items-center justify-center shadow-lg mb-4">
            <span className="text-white font-bold text-3xl">Z</span>
          </div>
          <h1 className="text-xl font-semibold text-gray-800">OTT Community</h1>
          <p className="text-sm text-gray-500 mt-1">
            {authMode === "login" ? "Đăng nhập để tiếp tục" : "Tạo tài khoản mới"}
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          {/* Tab buttons */}
          <div className="flex bg-gray-100 rounded-lg p-1 mb-6">
            <button
              type="button"
              onClick={() => {
                setAuthMode("login");
              }}
              className={`flex-1 py-2.5 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                authMode === "login"
                  ? "bg-white text-[#005ae0] shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <LogIn className="w-4 h-4" />
              Đăng nhập
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode("register");
              }}
              className={`flex-1 py-2.5 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                authMode === "register"
                  ? "bg-white text-[#005ae0] shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <UserPlus className="w-4 h-4" />
              Đăng ký
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Tên đăng nhập
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Nhập tên đăng nhập"
                  className="w-full border border-gray-200 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#005ae0] focus:border-transparent transition-all placeholder-gray-400"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Mật khẩu
              </label>
              <div className="relative">
                <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="password"
                  placeholder="Nhập mật khẩu"
                  className="w-full border border-gray-200 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#005ae0] focus:border-transparent transition-all placeholder-gray-400"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                />
              </div>
            </div>

            {/* Register fields */}
            {authMode === "register" && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    Email <span className="text-gray-400">(tuỳ chọn)</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="email"
                      placeholder="Nhập email của bạn"
                      className="w-full border border-gray-200 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#005ae0] focus:border-transparent transition-all placeholder-gray-400"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    Tên hiển thị <span className="text-gray-400">(tuỳ chọn)</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Tên bạn hiển thị với mọi người"
                      className="w-full border border-gray-200 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#005ae0] focus:border-transparent transition-all placeholder-gray-400"
                      value={form.displayName}
                      onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Error message */}
            {error && (
              <div className="bg-red-50 text-red-600 text-xs px-3 py-2 rounded-lg">
                {error}
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              className="w-full mt-2 bg-[#005ae0] text-white rounded-lg py-3 text-sm font-medium hover:bg-[#004bc7] active:bg-[#003da8] transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Đang xử lý...
                </>
              ) : authMode === "login" ? (
                "Đăng nhập"
              ) : (
                "Tạo tài khoản"
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-6">
          Đề tài: OTT cho Cộng đồng & Nhóm xã hội
        </p>
      </div>
    </div>
  );
}
