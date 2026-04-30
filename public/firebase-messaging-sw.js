/* global firebase */

async function loadFirebaseConfig() {
  const params = new URLSearchParams(self.location.search || "");
  const apiBase = params.get("apiBase") || "";

  if (!apiBase) {
    throw new Error("Missing apiBase for Firebase messaging service worker");
  }

  const response = await fetch(`${apiBase}/api/notifications/firebase-config`);
  if (!response.ok) {
    throw new Error(`Failed to load Firebase config (${response.status})`);
  }

  return response.json();
}

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

(async () => {
  try {
    importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
    importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");

    const config = await loadFirebaseConfig();
    if (!config || !config.enabled) {
      return;
    }

    firebase.initializeApp({
      apiKey: config.apiKey,
      authDomain: config.authDomain,
      projectId: config.projectId,
      messagingSenderId: config.messagingSenderId,
      appId: config.appId,
      storageBucket: config.storageBucket,
      measurementId: config.measurementId,
    });

    const messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
      const notificationTitle = payload?.notification?.title || "OTT Community";
      const notificationOptions = {
        body: payload?.notification?.body || "Tin nhắn mới",
        data: payload?.data || {},
      };

      self.registration.showNotification(notificationTitle, notificationOptions);
    });

    self.addEventListener("notificationclick", (event) => {
      const targetUrl = new URL("/", self.location.origin).toString();
      event.notification.close();
      event.waitUntil(self.clients.openWindow(targetUrl));
    });
  } catch (error) {
    console.warn("[firebase-messaging-sw] init skipped:", error?.message || error);
  }
})();