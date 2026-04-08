"use client";

import { useState, FormEvent } from "react";
import { AuthUser } from "../../types";

interface ProfilePageProps {
  user: AuthUser;
  onBack: () => void;
  onLogout: () => void;
  onUserUpdate: (updated: AuthUser) => void;
}

interface EditForm {
  displayName: string;
  email: string;
}

export default function ProfilePage({ user, onBack, onLogout, onUserUpdate }: ProfilePageProps) {
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [form, setForm] = useState<EditForm>({
    displayName: user.displayName,
    email: user.email || "",
  });

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    await new Promise((r) => setTimeout(r, 500));

    const updated: AuthUser = {
      ...user,
      displayName: form.displayName.trim() || user.username,
      email: form.email.trim() || undefined,
    };
    onUserUpdate(updated);
    setEditMode(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
    setSaving(false);
  }

  function handleCancel() {
    setForm({ displayName: user.displayName, email: user.email || "" });
    setEditMode(false);
    setSaveError(null);
  }

  return (
    <div className="flex-1 bg-[#f3f5f6] flex flex-col min-w-0">

      {/* ── Header bar (giống ChatWindow) ─────────────────────── */}
      <div className="h-[68px] bg-white border-b border-gray-200 flex items-center px-4 flex-shrink-0">
        <button
          onClick={onBack}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors mr-1"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <span className="font-semibold text-gray-900 text-base">Hồ sơ của tôi</span>
      </div>

      {/* ── Body scrollable ──────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">

        {/* Avatar + tên */}
        <div className="bg-white rounded-xl px-4 py-5 flex flex-col items-center shadow-sm border border-gray-200">
          <div className="w-24 h-24 rounded-full bg-[#005ae0] text-white flex items-center justify-center font-bold text-4xl shadow-md mb-3">
            {(form.displayName || user.username).trim().charAt(0).toUpperCase()}
          </div>
          {editMode ? (
            <div className="w-full mt-1 space-y-2.5">
              <input
                type="text"
                value={form.displayName}
                onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                className="w-full text-center border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-all"
                placeholder="Tên hiển thị"
                maxLength={50}
              />
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full text-center border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-all"
                placeholder="Email"
              />
            </div>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-gray-900">{user.displayName}</h2>
              <p className="text-sm text-gray-500">@{user.username}</p>
            </>
          )}

          {editMode && (
            <div className="flex gap-2 mt-4 w-full">
              <button
                onClick={handleCancel}
                className="flex-1 py-2.5 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Huỷ
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 rounded-lg bg-[#005ae0] text-white text-sm font-semibold hover:bg-[#004ac0] transition-colors disabled:opacity-60"
              >
                {saving ? "Đang lưu..." : "Lưu"}
              </button>
            </div>
          )}

          {saveSuccess && (
            <div className="mt-2 text-xs text-green-600 font-medium">
              ✓ Lưu thành công
            </div>
          )}
          {saveError && (
            <div className="mt-2 text-xs text-red-500">{saveError}</div>
          )}
        </div>

        {/* Nút chỉnh sửa hồ sơ */}
        {!editMode && (
          <button
            onClick={() => setEditMode(true)}
            className="w-full bg-white rounded-xl py-3 text-center text-sm font-medium text-[#005ae0] hover:bg-blue-50 transition-colors shadow-sm border border-gray-200"
          >
            Chỉnh sửa hồ sơ
          </button>
        )}

        {/* Thông tin tài khoản */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Thông tin tài khoản
            </span>
          </div>
          <div className="divide-y divide-gray-100">
            <InfoItem label="Tên hiển thị" value={user.displayName} />
            <InfoItem label="Tên đăng nhập" value={`@${user.username}`} />
            <InfoItem label="Email" value={user.email || "—"} />
            <InfoItem label="ID người dùng" value={String(user.id)} />
          </div>
        </div>

        {/* Cài đặt tài khoản */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Cài đặt
            </span>
          </div>
          <div className="divide-y divide-gray-100">
            <MenuItem icon="lock" label="Đổi mật khẩu" arrow />
            <MenuItem icon="shield" label="Bảo mật 2 lớp" badge="Tắt" />
            <MenuItem icon="devices" label="Đăng nhập thiết bị khác" arrow />
          </div>
        </div>

        {/* Thống kê */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Thống kê
          </div>
          <div className="flex justify-around text-center">
            <div>
              <p className="text-2xl font-bold text-gray-900">0</p>
              <p className="text-xs text-gray-500 mt-0.5">Nhóm tham gia</p>
            </div>
            <div className="w-px bg-gray-200" />
            <div>
              <p className="text-2xl font-bold text-gray-900">0</p>
              <p className="text-xs text-gray-500 mt-0.5">Tin nhắn</p>
            </div>
            <div className="w-px bg-gray-200" />
            <div>
              <p className="text-2xl font-bold text-gray-900">—</p>
              <p className="text-xs text-gray-500 mt-0.5">Ngày tham gia</p>
            </div>
          </div>
        </div>

        {/* Nút đăng xuất */}
        <button
          onClick={onLogout}
          className="w-full bg-white rounded-xl py-3 text-center text-sm font-medium text-red-500 hover:bg-red-50 transition-colors shadow-sm border border-gray-200 flex items-center justify-center gap-2"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Đăng xuất
        </button>
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="text-sm text-gray-800 font-medium truncate ml-4 max-w-[200px]">{value}</span>
    </div>
  );
}

function MenuItem({
  icon,
  label,
  badge,
  arrow,
}: {
  icon: string;
  label: string;
  badge?: string;
  arrow?: boolean;
}) {
  const icons: Record<string, React.ReactNode> = {
    lock: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
    ),
    shield: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
    devices: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
        <line x1="8" y1="21" x2="16" y2="21"/>
        <line x1="12" y1="17" x2="12" y2="21"/>
      </svg>
    ),
  };

  return (
    <div className="flex items-center px-4 py-3 hover:bg-gray-50 cursor-pointer">
      <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#005ae0] flex items-center justify-center mr-3">
        {icons[icon]}
      </div>
      <span className="flex-1 text-sm font-medium text-gray-800">{label}</span>
      {badge && (
        <span className="text-xs text-gray-400 mr-2">{badge}</span>
      )}
      {arrow && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-300">
          <path d="M9 18l6-6-6-6"/>
        </svg>
      )}
    </div>
  );
}