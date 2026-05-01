"use client";

import React, { useEffect, useRef, useState } from "react";
import type { LiveLocationEntry } from "../../hooks/useLiveLocation";

// ─── Kiểu dữ liệu ────────────────────────────────────────────────────────────

interface LiveLocationMapProps {
  /**
   * Map từ senderId → LiveLocationEntry (lat, lng của người đang chia sẻ).
   * Nhận từ useLiveLocation().liveLocations
   */
  liveLocations: Map<string, LiveLocationEntry>;
  /**
   * Vị trí của bản thân (isSharing === true) để hiển thị trên bản đồ nếu muốn.
   * Tuỳ chọn — nếu không truyền thì chỉ hiển thị vị trí người khác.
   */
  myLocation?: { lat: number; lng: number } | null;
  /** ID người dùng hiện tại (để phân biệt marker của mình với người khác) */
  currentUserId?: string | number;
  /** Chiều cao bản đồ - mặc định 400px */
  height?: number | string;
  /** Chiều rộng bản đồ - mặc định "100%" */
  width?: number | string;
  /** Google Maps API Key */
  apiKey?: string;
}

/**
 * LiveLocationMap — Bản đồ tương tác hiển thị vị trí realtime.
 *
 * Chiến lược render:
 *  - Dùng Google Maps JavaScript API (tải qua script tag động).
 *  - Mỗi LiveLocationEntry sẽ có 1 Marker riêng (AdvancedMarkerElement nếu Maps API v3.55+,
 *    fallback về Marker cũ nếu chưa có).
 *  - Khi liveLocations thay đổi (socket event update_live_location), hook animates
 *    marker đến vị trí mới bằng cách set marker.position = new LatLng(lat, lng).
 *  - Cleanup: tất cả marker bị xóa khi component unmount.
 *
 * IMPORTANT:
 *  - Cần thêm NEXT_PUBLIC_GOOGLE_MAPS_API_KEY vào .env.local
 *  - Cần enable "Maps JavaScript API" trong Google Cloud Console
 *  - Cần enable "Maps Embed API" nếu dùng iframe fallback
 */
export default function LiveLocationMap({
  liveLocations,
  myLocation,
  currentUserId,
  height = 400,
  width = "100%",
  apiKey,
}: LiveLocationMapProps) {
  const resolvedApiKey = apiKey || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  // Lưu references đến tất cả marker để update/remove mượt mà
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ── Load Google Maps JavaScript API ────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Tránh load script nhiều lần nếu đã có window.google.maps
    if ((window as any).google?.maps) {
      setIsMapLoaded(true);
      return;
    }

    if (!resolvedApiKey) {
      setLoadError("Thiếu NEXT_PUBLIC_GOOGLE_MAPS_API_KEY");
      return;
    }

    const scriptId = "google-maps-script";
    if (document.getElementById(scriptId)) {
      // Script đang được load bởi instance khác — đợi callback
      (window as any).__onGoogleMapsLoaded = () => setIsMapLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    // callback=__onGoogleMapsLoaded sẽ được gọi khi script load xong
    script.src = `https://maps.googleapis.com/maps/api/js?key=${resolvedApiKey}&callback=__onGoogleMapsLoaded&libraries=marker`;
    script.async = true;
    script.defer = true;

    (window as any).__onGoogleMapsLoaded = () => {
      setIsMapLoaded(true);
    };

    script.onerror = () => {
      setLoadError("Không thể tải Google Maps API. Kiểm tra API Key.");
    };

    document.head.appendChild(script);

    // Cleanup: không xóa script vì Maps API cần tồn tại toàn bộ session
    return () => {};
  }, [resolvedApiKey]);

  // ── Khởi tạo bản đồ sau khi Maps API đã load ────────────────────────────
  useEffect(() => {
    if (!isMapLoaded || !mapContainerRef.current || mapInstanceRef.current) return;

    // Tính center ban đầu: vị trí đầu tiên trong liveLocations hoặc Hà Nội
    const firstEntry = liveLocations.values().next().value;
    const initialCenter = firstEntry
      ? { lat: firstEntry.lat, lng: firstEntry.lng }
      : myLocation
      ? myLocation
      : { lat: 21.0285, lng: 105.8542 }; // Hà Nội mặc định

    mapInstanceRef.current = new google.maps.Map(mapContainerRef.current, {
      center: initialCenter,
      zoom: 15,
      // Tắt các control không cần thiết để UI gọn gàng hơn trong chat
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      zoomControl: true,
      styles: [
        // Dark mode style cho Maps để hòa hợp với giao diện tối của ứng dụng
        { elementType: "geometry", stylers: [{ color: "#1d2c4d" }] },
        { elementType: "labels.text.fill", stylers: [{ color: "#8ec3b9" }] },
        { elementType: "labels.text.stroke", stylers: [{ color: "#1a3646" }] },
        { featureType: "road", elementType: "geometry", stylers: [{ color: "#304a7d" }] },
        { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#98a5be" }] },
        { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e1626" }] },
        { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#4e6d70" }] },
        { featureType: "poi", stylers: [{ visibility: "off" }] },
      ],
    });
  }, [isMapLoaded, liveLocations, myLocation]);

  // ── Cập nhật markers mỗi khi liveLocations thay đổi ─────────────────────
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isMapLoaded) return;

    const currentIds = new Set(liveLocations.keys());

    // Xóa marker của những người đã dừng chia sẻ
    for (const [key, marker] of markersRef.current.entries()) {
      if (!currentIds.has(key)) {
        marker.setMap(null); // Tách marker khỏi bản đồ
        markersRef.current.delete(key);
      }
    }

    // Thêm mới hoặc cập nhật marker
    for (const [key, entry] of liveLocations.entries()) {
      const newLatLng = new google.maps.LatLng(entry.lat, entry.lng);

      if (markersRef.current.has(key)) {
        // Di chuyển marker đến vị trí mới — Maps API tự animate mượt mà
        const existingMarker = markersRef.current.get(key)!;
        existingMarker.setPosition(newLatLng);
      } else {
        // Tạo marker mới với label là tên người dùng
        const isMe = currentUserId && String(entry.senderId) === String(currentUserId);
        const label = entry.senderDisplayName
          ? entry.senderDisplayName.substring(0, 1).toUpperCase()
          : "?";

        const marker = new google.maps.Marker({
          position: newLatLng,
          map,
          title: entry.senderDisplayName || "Người dùng",
          // Icon khác nhau cho mình vs người khác
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 12,
            fillColor: isMe ? "#4ade80" : "#60a5fa",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
          },
          label: {
            text: label,
            color: "#ffffff",
            fontSize: "11px",
            fontWeight: "bold",
          },
          // Pulse animation bằng Animation.BOUNCE ngắn
          animation: google.maps.Animation.DROP,
        });

        // InfoWindow hiển thị tên và thời gian cập nhật khi click marker
        const infoWindow = new google.maps.InfoWindow({
          content: `
            <div style="font-family: sans-serif; padding: 4px;">
              <strong style="color: #1e293b;">${entry.senderDisplayName || "Người dùng"}</strong><br/>
              <small style="color: #64748b;">Đang chia sẻ vị trí trực tiếp</small>
            </div>
          `,
        });

        marker.addListener("click", () => {
          infoWindow.open({ map, anchor: marker });
        });

        markersRef.current.set(key, marker);
      }

      // Pan bản đồ đến vị trí marker mới nhất nếu chỉ có 1 người chia sẻ
      if (liveLocations.size === 1) {
        map.panTo(newLatLng);
      }
    }

    // Nếu có nhiều người chia sẻ, fitBounds để nhìn thấy tất cả
    if (liveLocations.size > 1) {
      const bounds = new google.maps.LatLngBounds();
      for (const entry of liveLocations.values()) {
        bounds.extend(new google.maps.LatLng(entry.lat, entry.lng));
      }
      if (myLocation) {
        bounds.extend(new google.maps.LatLng(myLocation.lat, myLocation.lng));
      }
      map.fitBounds(bounds, { top: 60, right: 20, bottom: 60, left: 20 });
    }
  }, [liveLocations, isMapLoaded, currentUserId, myLocation]);

  // ── Cleanup markers khi unmount ──────────────────────────────────────────
  useEffect(() => {
    return () => {
      // Tách tất cả marker khỏi bản đồ để tránh memory leak
      for (const marker of markersRef.current.values()) {
        marker.setMap(null);
      }
      markersRef.current.clear();
    };
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────

  if (loadError) {
    return (
      <div
        style={{
          width,
          height,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(255,255,255,0.04)",
          borderRadius: 12,
          gap: 8,
          color: "#f87171",
          border: "1px solid rgba(248,113,113,0.2)",
        }}
      >
        <span style={{ fontSize: 32 }}>⚠️</span>
        <span style={{ fontSize: 14, fontWeight: 500 }}>{loadError}</span>
        <span style={{ fontSize: 12, opacity: 0.7, textAlign: "center", maxWidth: 280 }}>
          Vui lòng thêm NEXT_PUBLIC_GOOGLE_MAPS_API_KEY vào .env.local
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "relative",
        width,
        height,
        borderRadius: 12,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.08)",
        background: "#1d2c4d",
      }}
    >
      {/* Container bản đồ */}
      <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />

      {/* Loading overlay */}
      {!isMapLoaded && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #1d2c4d 0%, #0e1626 100%)",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              border: "3px solid rgba(96,165,250,0.2)",
              borderTopColor: "#60a5fa",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }}
          />
          <span style={{ color: "#94a3b8", fontSize: 14 }}>Đang tải bản đồ...</span>
          {/* Inject CSS animation vào đây vì không có Tailwind */}
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Badge: số người đang chia sẻ */}
      {isMapLoaded && liveLocations.size > 0 && (
        <div
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            background: "rgba(15,23,42,0.85)",
            backdropFilter: "blur(8px)",
            borderRadius: 20,
            padding: "6px 12px",
            display: "flex",
            alignItems: "center",
            gap: 6,
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          {/* Pulse dot */}
          <span
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#4ade80",
              boxShadow: "0 0 0 0 rgba(74,222,128,0.4)",
              animation: "pulse 1.5s ease-out infinite",
            }}
          />
          <style>{`
            @keyframes pulse {
              0% { box-shadow: 0 0 0 0 rgba(74,222,128,0.6); }
              70% { box-shadow: 0 0 0 8px rgba(74,222,128,0); }
              100% { box-shadow: 0 0 0 0 rgba(74,222,128,0); }
            }
          `}</style>
          <span style={{ color: "#e2e8f0", fontSize: 12, fontWeight: 600 }}>
            {liveLocations.size} người đang chia sẻ
          </span>
        </div>
      )}

      {/* Trạng thái khi không có ai đang chia sẻ */}
      {isMapLoaded && liveLocations.size === 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(15,23,42,0.7)",
            backdropFilter: "blur(4px)",
            gap: 8,
          }}
        >
          <span style={{ fontSize: 36 }}>📍</span>
          <span style={{ color: "#94a3b8", fontSize: 14, fontWeight: 500 }}>
            Chưa có vị trí nào được chia sẻ
          </span>
          <span style={{ color: "#64748b", fontSize: 12 }}>
            Bản đồ sẽ cập nhật tự động khi có ai chia sẻ
          </span>
        </div>
      )}
    </div>
  );
}
