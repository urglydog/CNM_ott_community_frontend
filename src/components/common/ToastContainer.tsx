"use client";

import { X } from "lucide-react";
import { useToast, type Toast, type ToastType } from "../../contexts/ToastContext";

function getToastStyles(type: ToastType): {
  container: string;
  icon: string;
  borderColor: string;
} {
  switch (type) {
    case "success":
      return {
        container: "bg-green-50 border-green-400",
        icon: "text-green-500",
        borderColor: "border-l-4 border-green-400",
      };
    case "error":
      return {
        container: "bg-red-50 border-red-400",
        icon: "text-red-500",
        borderColor: "border-l-4 border-red-400",
      };
    case "friend_request":
      return {
        container: "bg-blue-50 border-blue-400",
        icon: "text-blue-500",
        borderColor: "border-l-4 border-blue-400",
      };
    case "friend_accepted":
      return {
        container: "bg-pink-50 border-pink-400",
        icon: "text-pink-500",
        borderColor: "border-l-4 border-pink-400",
      };
    default:
      return {
        container: "bg-gray-50 border-gray-300",
        icon: "text-gray-500",
        borderColor: "border-l-4 border-gray-300",
      };
  }
}

function getToastIcon(type: ToastType): React.ReactNode {
  switch (type) {
    case "success": return (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    );
    case "error": return (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    );
    case "friend_request": return (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    );
    case "friend_accepted": return (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    );
    default: return (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }
}

function ToastItem({ toast }: { toast: Toast }) {
  const { removeToast } = useToast();
  const styles = getToastStyles(toast.type);

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3.5 rounded-xl shadow-xl min-w-[300px] max-w-sm ${styles.container} ${styles.borderColor} animate-slideIn`}
      role="alert"
    >
      <span className={`${styles.icon} flex-shrink-0`}>
        {getToastIcon(toast.type)}
      </span>
      <p className="flex-1 text-sm text-gray-800 leading-snug">{toast.message}</p>
      <button
        onClick={() => removeToast(toast.id)}
        className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer ml-1 p-1 rounded-full hover:bg-gray-100"
        aria-label="Đóng thông báo"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const { toasts } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-label="Thông báo"
      className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 items-end"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
