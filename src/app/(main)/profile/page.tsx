"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  CheckCircle,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  LogOut,
  Mail,
  Phone,
  Save,
  Send,
  Shield,
  User,
  XCircle,
} from "lucide-react";
import { useAuth, VALIDATION_MESSAGES, VALIDATION_PATTERNS } from "../../../contexts/AuthContext";
import { useToast } from "../../../contexts/ToastContext";
import {
  changePassword,
  getCurrentProfile,
  getPresignedUploadUrl,
  getPresignedViewUrl,
  sendEmailOTP,
  sendPhoneOTP,
  uploadFileDirect,
  uploadFileToPresignedUrl,
  updateProfile,
  verifyEmailOTP,
  verifyPhoneOTP,
} from "../../../api/client";
import ForgotPasswordModal from "../../../components/auth/ForgotPasswordModal";

type OptionKey = "profile" | "password";
type VerifyType = "email" | "phone" | null;

export default function ProfilePage() {
  const router = useRouter();
  const { user, updateUser, logout } = useAuth();
  const { addToast } = useToast();

  const [activeOption, setActiveOption] = useState<OptionKey>("profile");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showAvatarPreview, setShowAvatarPreview] = useState(false);
  const [resolvedAvatarUrl, setResolvedAvatarUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [profileForm, setProfileForm] = useState({
    displayName: user?.displayName ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    avatarUrl: user?.avatarUrl ?? null,
  });
  const [profileErrors, setProfileErrors] = useState<{ email?: string; phone?: string; displayName?: string }>({});

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState({ current: false, next: false, confirm: false });
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [verification, setVerification] = useState({
    type: null as VerifyType,
    target: "",
    otp: "",
    loading: false,
    step: "idle" as "idle" | "otp",
    error: "",
  });

  const passwordStrength = useMemo(() => {
    const v = passwordForm.newPassword;
    return [v.length >= 8, /[A-Z]/.test(v), /[a-z]/.test(v), /\d/.test(v)].filter(Boolean).length;
  }, [passwordForm.newPassword]);

  if (!user) return null;

  const profileAvatarUrl = resolvedAvatarUrl || profileForm.avatarUrl || user.avatarUrl || null;

  const mapProfileToUser = (raw: any) => ({
    displayName: raw.display_name || raw.displayName || raw.fullName || user?.displayName || "",
    email: raw.email ?? undefined,
    phone: raw.phone_number ?? raw.phone ?? raw.phoneNumber ?? undefined,
    avatarUrl: raw.avatar_url || raw.avatarUrl || null,
    emailVerified: Boolean(raw.email_verified ?? raw.emailVerified ?? false),
    phoneVerified: Boolean(raw.phone_verified ?? raw.phoneVerified ?? false),
  });

  useEffect(() => {
    let mounted = true;
    async function syncProfile() {
      try {
        const data = await getCurrentProfile();
        if (!mounted) return;
        const mapped = mapProfileToUser(data || {});
        updateUser(mapped);
        setProfileForm((prev) => ({
          ...prev,
          displayName: mapped.displayName ?? prev.displayName,
          email: mapped.email ?? prev.email,
          phone: mapped.phone ?? prev.phone,
          avatarUrl: mapped.avatarUrl ?? prev.avatarUrl,
        }));
      } catch {
        // giữ nguyên dữ liệu local nếu gọi me thất bại
      }
    }
    syncProfile();
    return () => {
      mounted = false;
    };
  }, [updateUser]);

  useEffect(() => {
    let mounted = true;

    async function resolveAvatar() {
      const rawUrl = profileForm.avatarUrl || user?.avatarUrl || null;
      if (!rawUrl) {
        if (mounted) setResolvedAvatarUrl(null);
        return;
      }

      try {
        if (!/\.amazonaws\.com/i.test(rawUrl)) {
          if (mounted) setResolvedAvatarUrl(rawUrl);
          return;
        }

        const signed = await getPresignedViewUrl({ url: rawUrl });
        if (mounted) {
          setResolvedAvatarUrl(signed.viewUrl || rawUrl);
        }
      } catch {
        if (mounted) {
          setResolvedAvatarUrl(rawUrl);
        }
      }
    }

    resolveAvatar();
    return () => {
      mounted = false;
    };
  }, [profileForm.avatarUrl, user?.avatarUrl]);

  const buildPublicS3Url = (key: string, bucket: string) => {
    const customBase = String(process.env.NEXT_PUBLIC_S3_PUBLIC_BASE_URL || "").trim();
    if (customBase) {
      if (/^https?:\/\//i.test(customBase)) {
        return `${customBase.replace(/\/$/, "")}/${key}`;
      }
      if (/^[a-z0-9.-]+$/i.test(customBase) && !customBase.includes("/")) {
        const region = process.env.NEXT_PUBLIC_AWS_REGION || "ap-southeast-2";
        return `https://${customBase}.s3.${region}.amazonaws.com/${key}`;
      }
      return `https://${customBase.replace(/\/$/, "")}/${key}`;
    }
    const region = process.env.NEXT_PUBLIC_AWS_REGION || "ap-southeast-2";
    return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  };

  const handleAvatarPick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      addToast("Vui lòng chọn tệp ảnh hợp lệ", "error");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      addToast("Ảnh đại diện phải nhỏ hơn 5MB", "error");
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const keyPrefix = `avatars/${user.id}`;
      let publicUrl = "";

      try {
        const presigned = await getPresignedUploadUrl({
          keyPrefix,
          contentType: file.type,
        });
        await uploadFileToPresignedUrl(presigned.uploadUrl, file);
        publicUrl = buildPublicS3Url(presigned.key, presigned.bucket);
      } catch (uploadError: unknown) {
        // Fallback an toàn khi browser bị chặn CORS/network với presigned URL.
        const direct = await uploadFileDirect(file, keyPrefix);
        publicUrl = /^https?:\/\//i.test(String(direct.url || ""))
          ? direct.url
          : buildPublicS3Url(direct.key, direct.bucket);
        if (!publicUrl) {
          throw uploadError;
        }
      }

      await updateProfile({ avatarUrl: publicUrl });

      setProfileForm((prev) => ({ ...prev, avatarUrl: publicUrl }));
      updateUser({ avatarUrl: publicUrl });
      setResolvedAvatarUrl(publicUrl);
      addToast("Cập nhật ảnh đại diện thành công", "success");
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : "Tải ảnh đại diện thất bại", "error");
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const validateProfileForm = () => {
    const errors: { email?: string; phone?: string; displayName?: string } = {};

    if (!profileForm.displayName.trim()) {
      errors.displayName = "Vui lòng nhập tên hiển thị";
    } else if (!VALIDATION_PATTERNS.fullName.test(profileForm.displayName.trim())) {
      errors.displayName = VALIDATION_MESSAGES.fullName;
    }

    if (profileForm.email.trim() && !VALIDATION_PATTERNS.email.test(profileForm.email.trim())) {
      errors.email = VALIDATION_MESSAGES.email;
    }

    if (!profileForm.phone.trim()) {
      errors.phone = "Số điện thoại là bắt buộc";
    } else if (!VALIDATION_PATTERNS.phone.test(profileForm.phone.trim())) {
      errors.phone = VALIDATION_MESSAGES.phone;
    }

    setProfileErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveProfile = async () => {
    if (!validateProfileForm()) return;

    setIsSaving(true);
    try {
      await updateProfile({
        displayName: profileForm.displayName.trim(),
        email: profileForm.email.trim() || undefined,
        phone: profileForm.phone.trim(),
      });

      updateUser({
        displayName: profileForm.displayName.trim(),
        email: profileForm.email.trim() || undefined,
        phone: profileForm.phone.trim(),
        avatarUrl: profileForm.avatarUrl,
      });

      addToast("Cập nhật hồ sơ thành công", "success");
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : "Cập nhật hồ sơ thất bại", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const startVerify = async (type: VerifyType) => {
    const target = type === "email" ? profileForm.email.trim() : profileForm.phone.trim();
    if (!target) {
      addToast(type === "email" ? "Vui lòng nhập email trước" : "Vui lòng nhập số điện thoại trước", "error");
      return;
    }

    if (type === "email" && !VALIDATION_PATTERNS.email.test(target)) {
      addToast(VALIDATION_MESSAGES.email, "error");
      return;
    }

    if (type === "phone" && !VALIDATION_PATTERNS.phone.test(target)) {
      addToast(VALIDATION_MESSAGES.phone, "error");
      return;
    }

    setVerification({ type, target, otp: "", loading: true, step: "idle", error: "" });
    try {
      if (type === "email") {
        await sendEmailOTP(target);
      } else {
        await sendPhoneOTP(target);
      }
      setVerification({ type, target, otp: "", loading: false, step: "otp", error: "" });
      addToast("Đã gửi mã xác thực", "success");
    } catch (err: unknown) {
      setVerification({ type: null, target: "", otp: "", loading: false, step: "idle", error: "" });
      addToast(err instanceof Error ? err.message : "Không gửi được mã xác thực", "error");
    }
  };

  const confirmVerify = async () => {
    if (verification.otp.length < 6 || !verification.type) {
      setVerification((prev) => ({ ...prev, error: "Vui lòng nhập mã OTP 6 số" }));
      return;
    }

    setVerification((prev) => ({ ...prev, loading: true, error: "" }));
    try {
      if (verification.type === "email") {
        await verifyEmailOTP({ email: verification.target, otp: verification.otp });
        updateUser({ email: verification.target, emailVerified: true });
      } else {
        await verifyPhoneOTP({ phone: verification.target, otp: verification.otp });
        updateUser({ phone: verification.target, phoneVerified: true });
      }
      addToast("Xác thực thành công", "success");
      setVerification({ type: null, target: "", otp: "", loading: false, step: "idle", error: "" });
    } catch (err: unknown) {
      setVerification((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : "Mã xác thực không hợp lệ",
      }));
    }
  };

  const handleChangePassword = async () => {
    setPasswordError(null);

    if (!passwordForm.currentPassword) {
      setPasswordError("Vui lòng nhập mật khẩu hiện tại");
      return;
    }

    if (!VALIDATION_PATTERNS.password.test(passwordForm.newPassword)) {
      setPasswordError(VALIDATION_MESSAGES.password);
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError(VALIDATION_MESSAGES.confirmPassword);
      return;
    }

    setIsChangingPassword(true);
    try {
      await changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      addToast("Đổi mật khẩu thành công. Hệ thống sẽ đăng xuất để đăng nhập lại", "success");
      setTimeout(() => {
        logout();
        router.replace("/login");
      }, 1500);
    } catch (err: unknown) {
      setPasswordError(err instanceof Error ? err.message : "Đổi mật khẩu thất bại");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleLogoutConfirmed = () => {
    setShowLogoutConfirm(false);
    logout();
    router.replace("/login");
  };

  return (
    <div className="flex-1 h-screen overflow-y-auto bg-[#f2f5fa] px-6 py-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-5 rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-blue-100 text-2xl font-bold text-blue-600">
                {profileAvatarUrl ? (
                  <button
                    type="button"
                    onClick={() => setShowAvatarPreview(true)}
                    className="h-full w-full"
                    title="Xem ảnh đại diện"
                  >
                    <img src={profileAvatarUrl} alt="avatar" className="h-full w-full object-cover" />
                  </button>
                ) : (
                  (user.displayName || user.username).charAt(0).toUpperCase()
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingAvatar}
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                title="Đổi ảnh đại diện"
              >
                {isUploadingAvatar ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarPick}
                className="hidden"
              />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Hồ sơ tài khoản</h1>
              <p className="text-sm text-slate-500">@{user.username} • ID: {user.id}</p>
              <div className="mt-1 flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${user.emailVerified ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
                  {user.emailVerified ? "Email đã xác thực" : "Email chưa xác thực"}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${user.phoneVerified ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
                  {user.phoneVerified ? "SĐT đã xác thực" : "SĐT chưa xác thực"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px,1fr]">
          <aside className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="mb-3 px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Tùy chọn</p>
            <button
              onClick={() => setActiveOption("profile")}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm font-semibold transition ${
                activeOption === "profile" ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span className="flex items-center gap-2"><User className="h-4 w-4" /> Cập nhật thông tin</span>
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => setActiveOption("password")}
              className={`mt-1 flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm font-semibold transition ${
                activeOption === "password" ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span className="flex items-center gap-2"><Shield className="h-4 w-4" /> Đổi mật khẩu</span>
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => setShowForgotModal(true)}
              className="mt-1 flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <span className="flex items-center gap-2"><Lock className="h-4 w-4" /> Quên mật khẩu</span>
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="mt-4 w-full rounded-xl border border-red-200 px-3 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
            >
              Đăng xuất
            </button>
          </aside>

          <section className="rounded-2xl bg-white p-6 shadow-sm">
            {activeOption === "profile" && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-slate-900">Thông tin cá nhân</h2>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Tên hiển thị</label>
                  <input
                    value={profileForm.displayName}
                    onChange={(e) => {
                      setProfileForm((prev) => ({ ...prev, displayName: e.target.value }));
                      setProfileErrors((prev) => ({ ...prev, displayName: undefined }));
                    }}
                    className="w-full rounded-xl border-2 border-slate-200 px-3 py-2.5 text-sm focus:border-blue-400 focus:outline-none"
                    placeholder="Nhập tên hiển thị"
                  />
                  {profileErrors.displayName && <p className="mt-1 text-xs text-red-500">{profileErrors.displayName}</p>}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Email (tùy chọn)</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        value={profileForm.email}
                        onChange={(e) => {
                          setProfileForm((prev) => ({ ...prev, email: e.target.value }));
                          setProfileErrors((prev) => ({ ...prev, email: undefined }));
                        }}
                        className="w-full rounded-xl border-2 border-slate-200 py-2.5 pl-9 pr-3 text-sm focus:border-blue-400 focus:outline-none"
                        placeholder="you@example.com"
                      />
                    </div>
                    <button
                      onClick={() => startVerify("email")}
                      className="rounded-xl border border-blue-200 px-3 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                    >
                      <span className="inline-flex items-center gap-1"><Send className="h-4 w-4" /> Xác thực</span>
                    </button>
                  </div>
                  {user.emailVerified && <p className="mt-1 text-xs text-green-600">Email đã được xác thực</p>}
                  {profileErrors.email && <p className="mt-1 text-xs text-red-500">{profileErrors.email}</p>}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Số điện thoại</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        value={profileForm.phone}
                        onChange={(e) => {
                          setProfileForm((prev) => ({ ...prev, phone: e.target.value }));
                          setProfileErrors((prev) => ({ ...prev, phone: undefined }));
                        }}
                        className="w-full rounded-xl border-2 border-slate-200 py-2.5 pl-9 pr-3 text-sm focus:border-blue-400 focus:outline-none"
                        placeholder="0912345678"
                      />
                    </div>
                    <button
                      onClick={() => startVerify("phone")}
                      className="rounded-xl border border-blue-200 px-3 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                    >
                      <span className="inline-flex items-center gap-1"><Send className="h-4 w-4" /> Xác thực</span>
                    </button>
                  </div>
                  {user.phoneVerified && <p className="mt-1 text-xs text-green-600">Số điện thoại đã được xác thực</p>}
                  {profileErrors.phone && <p className="mt-1 text-xs text-red-500">{profileErrors.phone}</p>}
                </div>

                {verification.step === "otp" && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="mb-2 text-sm text-slate-700">
                      Nhập OTP đã gửi đến {verification.type === "email" ? verification.target : `***${verification.target.slice(-3)}`}
                    </p>
                    <div className="flex gap-2">
                      <input
                        value={verification.otp}
                        onChange={(e) => setVerification((prev) => ({ ...prev, otp: e.target.value.replace(/\D/g, "") }))}
                        maxLength={6}
                        className="flex-1 rounded-xl border-2 border-slate-200 px-3 py-2.5 text-sm tracking-widest focus:border-blue-400 focus:outline-none"
                        placeholder="_ _ _ _ _ _"
                      />
                      <button
                        onClick={confirmVerify}
                        disabled={verification.loading}
                        className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                      >
                        {verification.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Xác nhận"}
                      </button>
                    </div>
                    {verification.error && <p className="mt-2 text-xs text-red-500">{verification.error}</p>}
                  </div>
                )}

                <button
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Lưu thay đổi
                </button>
              </div>
            )}

            {activeOption === "password" && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-slate-900">Đổi mật khẩu</h2>

                <PasswordInput
                  label="Mật khẩu hiện tại"
                  value={passwordForm.currentPassword}
                  onChange={(v) => setPasswordForm((p) => ({ ...p, currentPassword: v }))}
                  visible={showPassword.current}
                  onToggle={() => setShowPassword((s) => ({ ...s, current: !s.current }))}
                />
                <PasswordInput
                  label="Mật khẩu mới"
                  value={passwordForm.newPassword}
                  onChange={(v) => setPasswordForm((p) => ({ ...p, newPassword: v }))}
                  visible={showPassword.next}
                  onToggle={() => setShowPassword((s) => ({ ...s, next: !s.next }))}
                />

                <div className="flex gap-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className={`h-1.5 flex-1 rounded-full ${passwordStrength >= i ? "bg-green-400" : "bg-slate-200"}`} />
                  ))}
                </div>
                <p className="text-xs text-slate-500">Mật khẩu mạnh cần tối thiểu 8 ký tự gồm chữ hoa, chữ thường và số.</p>

                <PasswordInput
                  label="Xác nhận mật khẩu mới"
                  value={passwordForm.confirmPassword}
                  onChange={(v) => setPasswordForm((p) => ({ ...p, confirmPassword: v }))}
                  visible={showPassword.confirm}
                  onToggle={() => setShowPassword((s) => ({ ...s, confirm: !s.confirm }))}
                />

                {passwordError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                    {passwordError}
                  </div>
                )}

                <button
                  onClick={handleChangePassword}
                  disabled={isChangingPassword}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {isChangingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />} Xác nhận đổi mật khẩu
                </button>
              </div>
            )}
          </section>
        </div>
      </div>

      <ForgotPasswordModal
        isOpen={showForgotModal}
        onClose={() => setShowForgotModal(false)}
        onSuccess={() => {
          setShowForgotModal(false);
          addToast("Đặt lại mật khẩu thành công, vui lòng đăng nhập lại", "success");
          logout();
          router.replace("/login");
        }}
      />

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl">
            <div className="p-6 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
                <LogOut className="h-7 w-7 text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Đăng xuất</h3>
              <p className="mt-2 text-sm text-slate-600">Bạn có chắc chắn muốn đăng xuất không?</p>
            </div>
            <div className="flex border-t border-slate-100">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-3.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
              >
                Huỷ
              </button>
              <button
                onClick={handleLogoutConfirmed}
                className="flex-1 border-l border-slate-100 py-3.5 text-sm font-semibold text-red-500 transition-colors hover:bg-red-50"
              >
                Đăng xuất
              </button>
            </div>
          </div>
        </div>
      )}

      {showAvatarPreview && profileAvatarUrl && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/75 px-4"
          onClick={() => setShowAvatarPreview(false)}
        >
          <div className="relative max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setShowAvatarPreview(false)}
              className="absolute -right-3 -top-3 rounded-full bg-white p-1.5 text-slate-700 shadow"
              title="Đóng"
            >
              <XCircle className="h-5 w-5" />
            </button>
            <img
              src={profileAvatarUrl}
              alt="Ảnh đại diện"
              className="max-h-[90vh] max-w-[90vw] rounded-2xl object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}

interface PasswordInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
}

function PasswordInput({ label, value, onChange, visible, onToggle }: PasswordInputProps) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-slate-600">{label}</label>
      <div className="relative">
        <Shield className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border-2 border-slate-200 py-2.5 pl-9 pr-10 text-sm focus:border-blue-400 focus:outline-none"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
