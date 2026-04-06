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
        container: "bg-emerald-50 border-emerald-400",
        icon: "text-emerald-500",
        borderColor: "border-l-4 border-emerald-400",
      };
    default:
      return {
        container: "bg-gray-50 border-gray-300",
        icon: "text-gray-500",
        borderColor: "border-l-4 border-gray-300",
      };
  }
}

function getToastIcon(type: ToastType): string {
  switch (type) {
    case "success": return "✓";
    case "error": return "✕";
    case "friend_request": return "✉";
    case "friend_accepted": return "♥";
    default: return "ℹ";
  }
}

function ToastItem({ toast }: { toast: Toast }) {
  const { removeToast } = useToast();
  const styles = getToastStyles(toast.type);

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg min-w-[280px] max-w-sm ${styles.container} ${styles.borderColor} animate-slideIn`}
      role="alert"
    >
      <span className={`text-lg font-bold ${styles.icon}`}>
        {getToastIcon(toast.type)}
      </span>
      <p className="flex-1 text-sm text-gray-800 leading-snug">{toast.message}</p>
      <button
        onClick={() => removeToast(toast.id)}
        className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer ml-1"
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
