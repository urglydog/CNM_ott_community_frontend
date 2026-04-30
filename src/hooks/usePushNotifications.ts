"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  getNotificationConfig,
  registerNotificationDeviceToken,
} from "../api/client";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

export function usePushNotifications() {
  const { user, isAuthenticated } = useAuth();
  const lastRegisteredTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !user?.token) return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("Notification" in window)) return;

    let cancelled = false;

    async function setupPush() {
      try {
        const config = await getNotificationConfig();
        if (!config.enabled) return;

        if (Notification.permission === "default") {
          const permission = await Notification.requestPermission();
          if (permission !== "granted") return;
        }

        if (Notification.permission !== "granted") return;

        const [{ initializeApp, getApps, getApp }, { getMessaging, getToken }] =
          await Promise.all([import("firebase/app"), import("firebase/messaging")]);

        const app = getApps().length > 0 ? getApp() : initializeApp({
          apiKey: config.apiKey,
          authDomain: config.authDomain,
          projectId: config.projectId,
          messagingSenderId: config.messagingSenderId,
          appId: config.appId,
          storageBucket: config.storageBucket,
          measurementId: config.measurementId,
        });

        const serviceWorkerUrl = `/firebase-messaging-sw.js?apiBase=${encodeURIComponent(API_BASE)}`;
        const registration = await navigator.serviceWorker.register(serviceWorkerUrl);
        const messaging = getMessaging(app);
        const token = await getToken(messaging, {
          vapidKey: config.vapidKey,
          serviceWorkerRegistration: registration,
        });

        if (!token || token === lastRegisteredTokenRef.current || cancelled) {
          return;
        }

        await registerNotificationDeviceToken({
          token,
          platform: "web",
          deviceName: navigator.userAgent,
        });

        lastRegisteredTokenRef.current = token;
      } catch {
        // Push notifications are optional; failure must not break auth/chat.
      }
    }

    setupPush();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user?.token]);
}