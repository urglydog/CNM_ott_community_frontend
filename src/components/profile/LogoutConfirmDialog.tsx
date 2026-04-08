"use client";

interface LogoutConfirmDialogProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export default function LogoutConfirmDialog({ onConfirm, onCancel }: LogoutConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-fadeIn">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-sm mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden animate-scaleIn">
        {/* Top color bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-red-400 to-red-600" />

        {/* Icon */}
        <div className="flex justify-center pt-6 pb-3">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pb-2 text-center">
          <h2 className="text-lg font-bold text-gray-900">Xác nhận đăng xuất</h2>
          <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">
            Bạn có chắc muốn đăng xuất khỏi tài khoản này không?
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-5 py-5">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 active:scale-[0.98] transition-all"
          >
            Huỷ bỏ
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white text-sm font-semibold shadow-sm hover:shadow-md hover:from-red-600 hover:to-red-700 active:scale-[0.98] transition-all"
          >
            Đăng xuất
          </button>
        </div>
      </div>

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out forwards;
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.92) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-scaleIn {
          animation: scaleIn 0.25s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
