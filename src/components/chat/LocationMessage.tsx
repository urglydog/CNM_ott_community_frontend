"use client";

import React, { useState } from "react";
import type { LocationData } from "../../types";

const MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

interface LocationMessageProps {
  locationData: LocationData;
  isOwn?: boolean;
  /** Nếu true: đang chia sẻ live, hiện banner "Đang chia sẻ hành trình" */
  isLive?: boolean;
  /** Thời điểm kết thúc live (ISO string) – hiển thị trong banner */
  liveUntil?: string | null;
  /** Avatar URL của người gửi – hiển thị như pin trên bản đồ */
  senderAvatarUrl?: string | null;
  senderDisplayName?: string | null;
  mapWidth?: number;
  mapHeight?: number;
  zoom?: number;
}

export default function LocationMessage({
  locationData,
  isOwn = false,
  isLive = false,
  liveUntil,
  senderAvatarUrl,
  senderDisplayName,
  mapWidth = 260,
  mapHeight = 160,
  zoom = 15,
}: LocationMessageProps) {
  const { lat, lng, label } = locationData;
  const [imgError, setImgError] = useState(false);

  const googleMapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;

  // Static map URL – không có marker mặc định (ta sẽ overlay avatar bằng HTML)
  const staticMapUrl = MAPS_API_KEY
    ? `https://maps.googleapis.com/maps/api/staticmap` +
      `?center=${lat},${lng}` +
      `&zoom=${zoom}` +
      `&size=${mapWidth}x${mapHeight}` +
      `&scale=2` +
      `&style=feature:poi|visibility:off` +
      `&key=${MAPS_API_KEY}`
    : null;

  // Thời gian live (format HH:MM)
  const liveTimeLabel = liveUntil
    ? new Date(liveUntil).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
    : null;

  // Force re-render mỗi phút để cập nhật trạng thái "Đã dừng"
  const [, setTick] = useState(0);
  React.useEffect(() => {
    if (isLive && liveUntil) {
      const interval = setInterval(() => setTick((t) => t + 1), 60000); // Check mỗi phút
      return () => clearInterval(interval);
    }
  }, [isLive, liveUntil]);
  
  // Session chỉ được coi là đã dừng khi isLive=true VÀ liveUntil là một timestamp trong quá khứ.
  // liveUntil=null có nghĩa phiên vẫn đang chạy (chưa được cập nhật khi dừng).
  const isStopped = isLive && liveUntil != null && new Date(liveUntil).getTime() <= Date.now();

  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        borderRadius: "0.75rem", // rounded-xl
        overflow: "hidden",
        border: "1px solid rgba(0,0,0,0.1)",
        background: "#e8eaf0",
        cursor: "pointer",
      }}
      onClick={() => window.open(googleMapsUrl, "_blank", "noopener,noreferrer")}
    >
      {/* ── Phần bản đồ ── */}
      <div style={{ position: "relative", height: mapHeight, overflow: "hidden" }}>
        {staticMapUrl && !imgError ? (
          <img
            src={staticMapUrl}
            alt="Bản đồ vị trí"
            width={mapWidth}
            height={mapHeight}
            style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }}
            onError={() => setImgError(true)}
          />
        ) : (
          /* Fallback map placeholder */
          <div
            style={{
              width: "100%",
              height: "100%",
              background: "linear-gradient(135deg, #c5d5e8 0%, #a8c0d6 50%, #b8cfe0 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* Fake road lines */}
            <svg width={mapWidth} height={mapHeight} style={{ position: "absolute", top: 0, left: 0 }} xmlns="http://www.w3.org/2000/svg">
              <line x1="0" y1={mapHeight * 0.4} x2={mapWidth} y2={mapHeight * 0.45} stroke="#d4c9a8" strokeWidth="8" />
              <line x1="0" y1={mapHeight * 0.7} x2={mapWidth} y2={mapHeight * 0.65} stroke="#d4c9a8" strokeWidth="5" />
              <line x1={mapWidth * 0.35} y1="0" x2={mapWidth * 0.4} y2={mapHeight} stroke="#d4c9a8" strokeWidth="6" />
              <line x1={mapWidth * 0.7} y1="0" x2={mapWidth * 0.75} y2={mapHeight} stroke="#d4c9a8" strokeWidth="4" />
            </svg>
          </div>
        )}

        {/* Avatar pin ở giữa bản đồ */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -60%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            pointerEvents: "none",
          }}
        >
          {/* Avatar hình tròn với viền trắng */}
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              border: "3px solid #fff",
              boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
              overflow: "hidden",
              background: "#e0e0e0",
            }}
          >
            {senderAvatarUrl ? (
              <img
                src={senderAvatarUrl}
                alt={senderDisplayName || "Avatar"}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: isOwn ? "#1a73e8" : "#34a853",
                  color: "#fff",
                  fontSize: 18,
                  fontWeight: 700,
                }}
              >
                {(senderDisplayName || "U")[0].toUpperCase()}
              </div>
            )}
          </div>
          {/* Mũi tên nhỏ phía dưới avatar */}
          <div
            style={{
              width: 0,
              height: 0,
              borderLeft: "6px solid transparent",
              borderRight: "6px solid transparent",
              borderTop: "10px solid #fff",
              marginTop: -2,
              filter: "drop-shadow(0 2px 2px rgba(0,0,0,0.2))",
            }}
          />
        </div>

        {/* Nút "Maps" góc trên trái */}
        <div
          style={{
            position: "absolute",
            top: 10,
            left: 10,
            background: "#fff",
            borderRadius: 8,
            padding: "4px 10px",
            display: "flex",
            alignItems: "center",
            gap: 5,
            boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
            fontSize: 13,
            fontWeight: 600,
            color: "#1a73e8",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" stroke="#1a73e8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Maps
        </div>
      </div>

      {/* ── Banner dưới: Static hoặc Live ── */}
      {isLive ? (
        isStopped ? (
          /* Live location banner – Đã dừng (chấm xám) */
          <div
            style={{
              background: "#fff",
              padding: "10px 14px",
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
            }}
          >
            <div style={{ paddingTop: 3, flexShrink: 0 }}>
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: "#94a3b8",
                }}
              />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#64748b" }}>
                Đã dừng chia sẻ hành trình
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                {liveTimeLabel ? `Đã kết thúc lúc ${liveTimeLabel}` : "Đã kết thúc"}
              </div>
            </div>
          </div>
        ) : (
          /* Live location banner – Đang chia sẻ (màu trắng với chấm đỏ nhấp nháy) */
          <div
            style={{
              background: "#fff",
              padding: "10px 14px",
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
            }}
          >
            {/* Chấm đỏ nhấp nháy */}
            <div style={{ paddingTop: 3, flexShrink: 0 }}>
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: "#ea4335",
                  animation: "livePulse 1.5s ease-in-out infinite",
                }}
              />
              <style>{`
                @keyframes livePulse {
                  0%, 100% { opacity: 1; transform: scale(1); }
                  50% { opacity: 0.5; transform: scale(0.8); }
                }
              `}</style>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a" }}>
                Đang chia sẻ hành trình
              </div>
              <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>
                {liveTimeLabel ? `Cập nhật liên tục đến ${liveTimeLabel}` : "Cập nhật vị trí liên tục"}
              </div>
            </div>
          </div>
        )
      ) : (
        /* Static location banner */
        <div
          style={{
            background: "#fff",
            padding: "8px 14px",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ fontSize: 18, flexShrink: 0 }}>📍</span>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#1a1a1a",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {label || "Vị trí của bạn"}
            </div>
            <div style={{ fontSize: 11, color: "#888", marginTop: 1 }}>
              {lat.toFixed(5)}, {lng.toFixed(5)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
