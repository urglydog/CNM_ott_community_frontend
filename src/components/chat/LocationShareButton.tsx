"use client";

import React, { useState, useRef, useCallback } from "react";
import type { LocationData } from "../../types";

// ─── Env ─────────────────────────────────────────────────────────────────────
const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

interface LocationShareButtonProps {
  /** ID của cuộc trò chuyện đang mở */
  conversationId: string;
  /** JWT token để gọi API backend */
  token: string;
  /** Callback thông báo cho component cha khi đang chia sẻ live location */
  onLiveSharingChange?: (isSharing: boolean) => void;
  /** Emit socket events cho live location (từ useLiveLocation hook) */
  onStartLiveLocation?: () => void;
  onStopLiveLocation?: () => void;
  isLiveSharing?: boolean;
  /** Callback khi gửi vị trí tĩnh thành công */
  onCurrentLocationSent?: (locationData: LocationData) => void;
  /** Style tùy chỉnh */
  style?: React.CSSProperties;
}

type LocationShareMode = "idle" | "loadingCurrent" | "liveSharing";

/**
 * LocationShareButton — Nút chia sẻ vị trí trong chat input bar.
 *
 * Chế độ hoạt động:
 *  - Click 1 lần → Dropdown menu với 2 lựa chọn:
 *     1. "Vị trí hiện tại" → getCurrentPosition() → POST /api/messages/location
 *     2. "Vị trí trực tiếp" → start_live_location + watchPosition (qua useLiveLocation)
 *  - Khi đang chia sẻ live → nút đổi thành "Dừng chia sẻ" màu đỏ
 */
export default function LocationShareButton({
  conversationId,
  token,
  onLiveSharingChange,
  onStartLiveLocation,
  onStopLiveLocation,
  isLiveSharing = false,
  onCurrentLocationSent,
  style,
}: LocationShareButtonProps) {
  const [mode, setMode] = useState<LocationShareMode>("idle");
  const [showDropdown, setShowDropdown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // ── Gửi vị trí hiện tại (một lần, lưu vào DB) ───────────────────────────
  const handleSendCurrentLocation = useCallback(async () => {
    setShowDropdown(false);
    setError(null);

    if (!navigator.geolocation) {
      setError("Trình duyệt không hỗ trợ Geolocation");
      return;
    }

    setMode("loadingCurrent");

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });

      const locationData: LocationData = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };

      // Gọi API backend để lưu tin nhắn vị trí và broadcast qua socket
      const res = await fetch(`${BACKEND_URL}/api/messages/location`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ conversationId, locationData }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || "Gửi vị trí thất bại");
      }

      onCurrentLocationSent?.(locationData);
    } catch (err: unknown) {
      if (err instanceof GeolocationPositionError) {
        const msgs: Record<number, string> = {
          1: "Bạn đã từ chối quyền truy cập vị trí",
          2: "Không xác định được vị trí",
          3: "Hết thời gian chờ lấy vị trí",
        };
        setError(msgs[err.code] || "Lỗi Geolocation");
      } else {
        setError(err instanceof Error ? err.message : "Đã xảy ra lỗi");
      }
    } finally {
      setMode("idle");
    }
  }, [conversationId, token, onCurrentLocationSent]);

  // ── Bắt đầu / dừng chia sẻ live location ─────────────────────────────────
  const handleToggleLiveLocation = useCallback(() => {
    setShowDropdown(false);
    setError(null);

    if (isLiveSharing) {
      // Dừng chia sẻ
      onStopLiveLocation?.();
      onLiveSharingChange?.(false);
      setMode("idle");
    } else {
      // Bắt đầu chia sẻ
      onStartLiveLocation?.();
      onLiveSharingChange?.(true);
      setMode("liveSharing");
    }
  }, [isLiveSharing, onStartLiveLocation, onStopLiveLocation, onLiveSharingChange]);

  // Đóng dropdown khi click ra ngoài
  const handleOutsideClick = useCallback((e: React.MouseEvent) => {
    if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
      setShowDropdown(false);
    }
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  // Nếu đang chia sẻ live → hiển thị nút "Dừng chia sẻ" màu đỏ
  if (isLiveSharing) {
    return (
      <div style={{ position: "relative", ...style }}>
        <button
          onClick={handleToggleLiveLocation}
          title="Dừng chia sẻ vị trí trực tiếp"
          aria-label="Dừng chia sẻ vị trí"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px",
            background: "linear-gradient(135deg, #ef4444, #dc2626)",
            border: "none",
            borderRadius: 20,
            color: "#ffffff",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 0 0 0 rgba(239,68,68,0.4)",
            animation: "livePulse 1.5s ease-out infinite",
          }}
        >
          <style>{`
            @keyframes livePulse {
              0% { box-shadow: 0 0 0 0 rgba(239,68,68,0.6); }
              70% { box-shadow: 0 0 0 8px rgba(239,68,68,0); }
              100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
            }
          `}</style>
          <span>⏹</span>
          <span>Dừng chia sẻ</span>
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", ...style }} onClick={handleOutsideClick}>
      {/* Nút chính */}
      <button
        onClick={() => setShowDropdown((prev) => !prev)}
        disabled={mode === "loadingCurrent"}
        title="Chia sẻ vị trí"
        aria-label="Chia sẻ vị trí"
        aria-expanded={showDropdown}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 36,
          height: 36,
          borderRadius: "50%",
          border: "none",
          background: showDropdown
            ? "rgba(96,165,250,0.2)"
            : "rgba(255,255,255,0.06)",
          color: showDropdown ? "#60a5fa" : "#94a3b8",
          fontSize: 18,
          cursor: mode === "loadingCurrent" ? "not-allowed" : "pointer",
          transition: "all 0.15s ease",
          opacity: mode === "loadingCurrent" ? 0.6 : 1,
        }}
      >
        {mode === "loadingCurrent" ? (
          <span style={{ fontSize: 16, animation: "spin 0.8s linear infinite", display: "inline-block" }}>
            ⏳
          </span>
        ) : (
          "📍"
        )}
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </button>

      {/* Dropdown menu */}
      {showDropdown && (
        <div
          ref={dropdownRef}
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            left: 0,
            background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            overflow: "hidden",
            minWidth: 220,
            zIndex: 50,
            animation: "fadeInUp 0.15s ease",
          }}
        >
          <style>{`
            @keyframes fadeInUp {
              from { opacity: 0; transform: translateY(8px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>

          {/* Option 1: Vị trí hiện tại */}
          <button
            onClick={handleSendCurrentLocation}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              width: "100%",
              padding: "12px 16px",
              border: "none",
              background: "transparent",
              color: "#e2e8f0",
              cursor: "pointer",
              textAlign: "left",
              transition: "background 0.1s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(96,165,250,0.1)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            }}
          >
            <span
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "rgba(96,165,250,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                flexShrink: 0,
              }}
            >
              📍
            </span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Vị trí hiện tại</div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                Gửi vị trí một lần
              </div>
            </div>
          </button>

          {/* Divider */}
          <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "0 12px" }} />

          {/* Option 2: Chia sẻ vị trí trực tiếp */}
          <button
            onClick={handleToggleLiveLocation}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              width: "100%",
              padding: "12px 16px",
              border: "none",
              background: "transparent",
              color: "#e2e8f0",
              cursor: "pointer",
              textAlign: "left",
              transition: "background 0.1s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(74,222,128,0.1)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            }}
          >
            <span
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "rgba(74,222,128,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                flexShrink: 0,
              }}
            >
              🔴
            </span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#4ade80" }}>
                Chia sẻ vị trí trực tiếp
              </div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                Cập nhật liên tục cho đến khi dừng
              </div>
            </div>
          </button>
        </div>
      )}

      {/* Error toast */}
      {error && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            left: 0,
            background: "linear-gradient(135deg, #7f1d1d, #991b1b)",
            borderRadius: 8,
            padding: "8px 12px",
            fontSize: 12,
            color: "#fca5a5",
            maxWidth: 240,
            border: "1px solid rgba(239,68,68,0.3)",
            zIndex: 51,
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          }}
        >
          <span>⚠️ {error}</span>
          <button
            onClick={() => setError(null)}
            style={{
              marginLeft: 8,
              background: "none",
              border: "none",
              color: "#fca5a5",
              cursor: "pointer",
              fontSize: 14,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
