"use client";

import { useCallback, useState } from "react";
import { useAuth as useAuthContext } from "../../../contexts/AuthContext";
import {
  authRequest,
  updateProfile as updateProfileApi,
  changePassword as changePasswordApi,
  sendEmailOTP,
  verifyEmailOTP,
  sendPhoneOTP,
  verifyPhoneOTP,
} from "../api";
import type { UpdateProfilePayload, ChangePasswordPayload } from "../api";

export function useAuthSession() {
  const auth = useAuthContext();
  return {
    user: auth.user,
    isAuthenticated: auth.isAuthenticated,
    isLoading: auth.isLoading,
    error: auth.error,
    login: auth.login,
    register: auth.register,
    logout: auth.logout,
    updateUser: auth.updateUser,
  };
}

export function useAuthForm() {
  const { form, setForm, errors, clearErrors } = useAuthContext();

  const updateField = useCallback(
    (field: string, value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    [setForm]
  );

  const resetForm = useCallback(() => {
    setForm({
      username: "",
      password: "",
      confirmPassword: "",
      email: "",
      phone: "",
      fullName: "",
    });
    clearErrors();
  }, [setForm, clearErrors]);

  return {
    form,
    updateField,
    errors,
    clearErrors,
    resetForm,
  };
}

export function useAuthActions() {
  const { login, register, setError } = useAuthContext();

  const handleLogin = useCallback(
    async (e: React.FormEvent) => {
      await login(e);
    },
    [login]
  );

  const handleRegister = useCallback(
    async (e: React.FormEvent) => {
      await register(e);
    },
    [register]
  );

  return {
    login: handleLogin,
    register: handleRegister,
    setError,
  };
}

export function useProfile() {
  const { user, updateUser } = useAuthContext();
  const [isLoading, setIsLoading] = useState(false);

  const updateProfile = useCallback(
    async (payload: UpdateProfilePayload) => {
      setIsLoading(true);
      try {
        const result = await updateProfileApi(payload);
        if (result.user) {
          updateUser({
            displayName: payload.displayName,
            email: payload.email,
            phone: payload.phone,
          });
        }
        return result;
      } finally {
        setIsLoading(false);
      }
    },
    [updateUser]
  );

  const changePassword = useCallback(async (payload: ChangePasswordPayload) => {
    return changePasswordApi(payload);
  }, []);

  return {
    user,
    updateProfile,
    changePassword,
    isLoading,
  };
}

export function useVerification() {
  const [step, setStep] = useState<"idle" | "sending" | "verifying" | "success">("idle");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const sendOTP = useCallback(async (type: "email" | "phone", value: string) => {
    setIsLoading(true);
    setError(null);
    setStep("sending");
    try {
      if (type === "email") {
        await sendEmailOTP(value);
      } else {
        await sendPhoneOTP(value);
      }
      setStep("verifying");
    } catch (err: any) {
      setStep("idle");
      setError(err.message || "Gửi mã thất bại");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const verifyOTP = useCallback(
    async (type: "email" | "phone", value: string) => {
      setIsLoading(true);
      setError(null);
      try {
        if (type === "email") {
          await verifyEmailOTP({ email: value, otp });
        } else {
          await verifyPhoneOTP({ phone: value, otp });
        }
        setStep("success");
      } catch (err: any) {
        setError(err.message || "Mã xác thực không đúng");
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [otp]
  );

  const reset = useCallback(() => {
    setStep("idle");
    setOtp("");
    setError(null);
  }, []);

  return {
    step,
    otp,
    setOtp,
    error,
    isLoading,
    sendOTP,
    verifyOTP,
    reset,
  };
}
