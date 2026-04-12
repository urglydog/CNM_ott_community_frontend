"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../contexts/AuthContext";
import AuthScreen from "../../../components/auth/AuthScreen";

export default function LoginPage() {
  const { isAuthenticated, isInitialized } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Nếu đã check xong localstorage và có đăng nhập -> dùng router để ko bị F5 trang
    if (isInitialized && isAuthenticated) {
      router.replace("/chat");
    }
  }, [isInitialized, isAuthenticated, router]);

  // Đang load localStorage hoặc Đã đăng nhập rồi thì ko render màn Login
  if (!isInitialized || isAuthenticated) {
    return null;
  }

  return <AuthScreen />;
}