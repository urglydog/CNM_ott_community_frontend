"use client";

import { useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, isInitialized } = useAuth();

  useEffect(() => {
    if (!isInitialized) {
      return;
    }
    if (isAuthenticated) {
      router.replace("/chat");
    } else {
      router.replace("/login");
    }
  }, [isAuthenticated, isInitialized, router]);

  return null;
}