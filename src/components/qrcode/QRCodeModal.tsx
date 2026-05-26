"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { QrCode, Camera, CameraOff, RefreshCw, X, Loader2, Check, UserPlus } from "lucide-react";
import QRCode from "qrcode";
import { Scanner } from "@yudiel/react-qr-scanner";
import { getQRInfo, sendFriendRequestByQR } from "../../api/client";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import type { QRInfoResponse } from "../../api/client";

type Tab = "my-qr" | "scan-qr";

interface ScannedUser {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  qrData: string;
}

interface ScanResultOverlayProps {
  user: ScannedUser;
  onClose: () => void;
  onSendRequest: () => void;
  sending: boolean;
  sent: boolean;
  alreadyFriend?: boolean;
  self?: boolean;
}

function ScanResultOverlay({ user, onClose, onSendRequest, sending, sent, alreadyFriend, self }: ScanResultOverlayProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[340px] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-[#005ae0] to-[#0047b3]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center overflow-hidden">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.displayName} className="w-full h-full object-cover" />
              ) : (
                <span className="text-white font-bold text-xl">{user.displayName.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div>
              <h3 className="text-white font-semibold text-base leading-tight">{user.displayName}</h3>
              <p className="text-white/60 text-xs">Quét thành công</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 text-center">
          {self ? (
            <div className="py-4">
              <div className="w-16 h-16 rounded-full bg-yellow-100 flex items-center justify-center mx-auto mb-3">
                <QrCode className="w-8 h-8 text-yellow-600" />
              </div>
              <p className="text-base font-semibold text-gray-800 mb-1">Đây là mã QR của bạn</p>
              <p className="text-sm text-gray-500">Không thể kết bạn với chính mình</p>
            </div>
          ) : alreadyFriend ? (
            <div className="py-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-base font-semibold text-gray-800 mb-1">Đã là bạn bè</p>
              <p className="text-sm text-gray-500">Hai bạn đã kết nối với nhau</p>
            </div>
          ) : sent ? (
            <div className="py-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-base font-semibold text-gray-800 mb-1">Đã gửi lời mời kết bạn</p>
              <p className="text-sm text-gray-500">Chờ {user.displayName} chấp nhận</p>
            </div>
          ) : (
            <div className="py-4">
              <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-3">
                <UserPlus className="w-8 h-8 text-blue-600" />
              </div>
              <p className="text-base font-semibold text-gray-800 mb-1">Tìm thấy người dùng</p>
              <p className="text-sm text-gray-500 mb-4">Gửi lời mời kết bạn đến {user.displayName}?</p>
              <button
                onClick={onSendRequest}
                disabled={sending}
                className="w-full py-3 bg-[#005ae0] text-white font-semibold rounded-xl hover:bg-[#0047b3] disabled:opacity-60 flex items-center justify-center gap-2 transition-colors"
              >
                {sending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Đang gửi...</>
                ) : (
                  <><UserPlus className="w-4 h-4" /> Gửi lời mời kết bạn</>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {!self && !alreadyFriend && !sent && (
          <div className="px-5 pb-5">
            <button
              onClick={onClose}
              className="w-full py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
            >
              Đóng
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function QRCodeModal({ isOpen, onClose }: QRCodeModalProps) {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [tab, setTab] = useState<Tab>("my-qr");
  const [qrInfo, setQrInfo] = useState<QRInfoResponse | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [loadingQR, setLoadingQR] = useState(false);

  // Scanner state
  const [scanning, setScanning] = useState(false);
  const [scannedUser, setScannedUser] = useState<ScannedUser | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [alreadyFriend, setAlreadyFriend] = useState(false);
  const [selfScan, setSelfScan] = useState(false);

  // Prevent body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  // Load QR info when modal opens on "my-qr" tab
  useEffect(() => {
    if (!isOpen || tab !== "my-qr") return;
    loadMyQR();
  }, [isOpen, tab]);

  const loadMyQR = useCallback(async () => {
    if (!user) return;
    const uid = user.userId ?? String(user.id);
    setLoadingQR(true);
    try {
      const info = await getQRInfo(uid);
      setQrInfo(info);
      const dataUrl = await QRCode.toDataURL(info.qrData, {
        width: 220,
        margin: 2,
        color: {
          dark: "#000000ff",
          light: "#ffffffff",
        },
        errorCorrectionLevel: "H",
      });
      setQrDataUrl(dataUrl);
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : "Không tải được mã QR", "error");
    } finally {
      setLoadingQR(false);
    }
  }, [user, addToast]);

  const handleScan = useCallback(
    async (detectedCodes: unknown[]) => {
      if (!detectedCodes || detectedCodes.length === 0) return;

      const rawCode = (detectedCodes[0] as { rawValue?: string })?.rawValue;
      if (!rawCode || rawCode === qrInfo?.qrData) return;

      const parts = rawCode.split("|");
      if (parts.length !== 3) return;

      const [type, version, scannedUserId] = parts;
      if (type !== "OTT_FR" || version !== "1") return;

      setScanning(false); // pause scanner
      const currentUserId = user?.userId ?? String(user?.id ?? "");
      const isSelf = scannedUserId === currentUserId;
      setSelfScan(isSelf);

      try {
        const scannedInfo = await getQRInfo(scannedUserId);
        setScannedUser({
          userId: scannedInfo.userId,
          displayName: scannedInfo.displayName,
          avatarUrl: scannedInfo.avatarUrl,
          qrData: rawCode,
        });
      } catch {
        setScannedUser({
          userId: scannedUserId,
          displayName: "Người dùng OTT",
          avatarUrl: null,
          qrData: rawCode,
        });
      }
    },
    [qrInfo, user]
  );

  const handleScanError = useCallback((error: unknown) => {
    console.warn("QR Scan error:", error);
  }, []);

  const handleSendRequest = async () => {
    if (!scannedUser?.qrData) return;
    setSending(true);
    try {
      const result = await sendFriendRequestByQR(scannedUser.qrData);
      if (result.data?.receiver?.displayName) {
        setScannedUser((prev) =>
          prev ? { ...prev, displayName: result.data.receiver.displayName, avatarUrl: result.data.receiver.avatarUrl ?? null } : prev
        );
      }
      setSent(true);
      addToast(result.message || "Đã gửi lời mời kết bạn", "success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gửi lời mời thất bại";
      if (msg.includes("đã là bạn bè")) {
        setAlreadyFriend(true);
      } else {
        addToast(msg, "error");
        setScanning(true);
        setScannedUser(null);
      }
    } finally {
      setSending(false);
    }
  };

  const handleCloseResult = () => {
    setScannedUser(null);
    setSent(false);
    setSending(false);
    setAlreadyFriend(false);
    setSelfScan(false);
    setScanning(true);
  };

  const switchToScan = () => {
    setTab("scan-qr");
    setScanning(true);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

        {/* Modal */}
        <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-[380px] overflow-hidden flex flex-col max-h-[85vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-[#005ae0] to-[#0047b3] shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                <QrCode className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-white font-bold text-base leading-tight">Kết bạn qua QR</h2>
                <p className="text-white/60 text-xs">Quét hoặc chia sẻ mã QR của bạn</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
              aria-label="Đóng"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Tab switcher */}
          <div className="flex bg-gray-100 p-1 shrink-0">
            <button
              onClick={() => { setTab("my-qr"); setScannedUser(null); setSent(false); setSending(false); setAlreadyFriend(false); setSelfScan(false); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                tab === "my-qr" ? "bg-white text-[#005ae0] shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <QrCode className="w-4 h-4" />
              Mã của tôi
            </button>
            <button
              onClick={switchToScan}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                tab === "scan-qr" ? "bg-white text-[#005ae0] shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Camera className="w-4 h-4" />
              Quét QR
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">

            {/* ── MY QR TAB ── */}
            {tab === "my-qr" && (
              <div className="flex flex-col items-center px-5 py-6">
                {loadingQR ? (
                  <div className="flex flex-col items-center py-12">
                    <Loader2 className="w-10 h-10 text-blue-400 animate-spin mb-3" />
                    <p className="text-sm text-gray-400">Đang tải mã QR...</p>
                  </div>
                ) : qrDataUrl ? (
                  <>
                    {/* QR Card */}
                    <div className="bg-gradient-to-br from-[#f0f4ff] to-[#e8f0fe] rounded-2xl p-6 flex flex-col items-center w-full border border-blue-100">
                      {/* Avatar + Name */}
                      <div className="flex flex-col items-center mb-4">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#005ae0] to-[#0047b3] flex items-center justify-center shadow-md mb-2 overflow-hidden">
                          {qrInfo?.avatarUrl ? (
                            <img src={qrInfo.avatarUrl} alt={qrInfo.displayName} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-white font-bold text-2xl">
                              {qrInfo?.displayName?.charAt(0)?.toUpperCase() ?? "?"}
                            </span>
                          )}
                        </div>
                        <p className="text-base font-bold text-gray-800">{qrInfo?.displayName}</p>
                        <p className="text-xs text-gray-400">#{qrInfo?.userId}</p>
                      </div>

                      {/* QR Code image */}
                      <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={qrDataUrl}
                          alt="Mã QR của tôi"
                          className="w-[200px] h-[200px] object-contain"
                        />
                      </div>

                      <p className="text-xs text-gray-400 mt-3 text-center">
                        Đưa mã QR này cho bạn bè quét để kết bạn
                      </p>
                    </div>

                    {/* Instructions */}
                    <div className="mt-4 w-full space-y-2">
                      <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-blue-600 text-xs font-bold">1</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-700">Chia sẻ mã QR của bạn</p>
                          <p className="text-xs text-gray-400 mt-0.5">Bạn bè quét mã để gửi lời mời kết bạn</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-blue-600 text-xs font-bold">2</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-700">Nhận lời mời kết bạn</p>
                          <p className="text-xs text-gray-400 mt-0.5">Lời mời sẽ xuất hiện trong mục Lời mời kết bạn</p>
                        </div>
                      </div>
                    </div>

                    {/* Scan QR button */}
                    <button
                      onClick={switchToScan}
                      className="mt-5 w-full flex items-center justify-center gap-2 py-3 bg-[#005ae0] text-white font-semibold rounded-xl hover:bg-[#0047b3] transition-colors shadow-sm"
                    >
                      <Camera className="w-4 h-4" />
                      Quét mã QR của bạn bè
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col items-center py-12">
                    <p className="text-sm text-gray-400 mb-3">Không thể tải mã QR</p>
                    <button
                      onClick={loadMyQR}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Thử lại
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── SCAN QR TAB ── */}
            {tab === "scan-qr" && (
              <div className="flex flex-col items-center px-5 py-6">
                {/* Scanner view */}
                <div className="relative w-full flex flex-col items-center">
                  {/* Camera status */}
                  {!scanning && !scannedUser && (
                    <div className="w-full aspect-square max-w-[280px] bg-gray-900 rounded-2xl flex flex-col items-center justify-center overflow-hidden relative">
                      <CameraOff className="w-12 h-12 text-gray-500 mb-3" />
                      <p className="text-gray-400 text-sm font-medium mb-1">Camera đang tắt</p>
                      <p className="text-gray-600 text-xs">Nhấn nút bên dưới để bật camera</p>
                    </div>
                  )}

                  {scanning && (
                    <div className="w-full max-w-[280px] aspect-square rounded-2xl overflow-hidden border-2 border-[#005ae0] shadow-lg">
                      <Scanner
                        onScan={(codes) => handleScan(codes)}
                        onError={handleScanError}
                        formats={["qr_code"]}
                        sound={true}
                        scanDelay={2000}
                        styles={{
                          container: { width: "100%", height: "100%" },
                          video: { width: "100%", height: "100%", objectFit: "cover" },
                        }}
                      />
                    </div>
                  )}

                  {/* Scanning frame overlay hint */}
                  {scanning && (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                      <div className="w-[220px] h-[220px] border-2 border-white/60 rounded-2xl" />
                    </div>
                  )}
                </div>

                {/* Instructions */}
                <div className="mt-4 text-center">
                  {scanning ? (
                    <p className="text-sm text-gray-500">Đưa mã QR vào khung hình để quét</p>
                  ) : (
                    <p className="text-sm text-gray-500">Bật camera để quét mã QR</p>
                  )}
                </div>

                {/* Toggle camera */}
                <button
                  onClick={() => {
                    if (scanning) {
                      setScanning(false);
                    } else {
                      setScannedUser(null);
                      setSent(false);
                      setSending(false);
                      setAlreadyFriend(false);
                      setSelfScan(false);
                      setScanning(true);
                    }
                  }}
                  className={`mt-4 flex items-center gap-2 px-6 py-3 font-semibold rounded-xl transition-colors shadow-sm ${
                    scanning
                      ? "bg-red-50 text-red-500 hover:bg-red-100"
                      : "bg-[#005ae0] text-white hover:bg-[#0047b3]"
                  }`}
                >
                  {scanning ? (
                    <>
                      <CameraOff className="w-4 h-4" />
                      Tắt camera
                    </>
                  ) : (
                    <>
                      <Camera className="w-4 h-4" />
                      Bật camera
                    </>
                  )}
                </button>

                {/* Manual entry */}
                <div className="mt-4 w-full text-center">
                  <p className="text-xs text-gray-400">Hoặc tìm bạn bè qua số điện thoại</p>
                  <p className="text-xs text-gray-400 mt-0.5">trong mục Thêm bạn</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Scan result overlay */}
      {scannedUser && (
        <ScanResultOverlay
          user={scannedUser}
          onClose={handleCloseResult}
          onSendRequest={handleSendRequest}
          sending={sending}
          sent={sent}
          alreadyFriend={alreadyFriend}
          self={selfScan}
        />
      )}
    </>
  );
}
