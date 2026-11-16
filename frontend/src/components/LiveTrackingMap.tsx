"use client";
import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

export interface LatLngPoint {
  lat: number;
  lng: number;
}

interface LiveTrackingMapProps {
  storeLocation: { lat: number; lng: number; name?: string } | null;
  destinationLocation: LatLngPoint | null;
  courierLocation: { lat: number; lng: number; updated_at?: string | null; is_live?: boolean } | null;
  status: string;
  height?: number;
}

export default function LiveTrackingMap({
  storeLocation,
  destinationLocation,
  courierLocation,
  status,
  height = 310,
}: LiveTrackingMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const layersRef = useRef<{
    storeMarker?: any;
    destMarker?: any;
    courierMarker?: any;
    traveledLine?: any;
    remainingLine?: any;
  }>({});
  const fittedOnceRef = useRef(false);
  const hadCourierRef = useRef(false);
  const store = storeLocation || { lat: -7.2655, lng: 112.7485, name: "Mie Oke" };
  const dest = destinationLocation;
  const courier = courierLocation || null;
  const mapFocus = courier || store;

  useEffect(() => {
    let mounted = true;
    (async () => {
      const L = (await import("leaflet")).default;
      if (!mounted || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, {
        center: [mapFocus.lat, mapFocus.lng],
        zoom: 15,
        zoomControl: true,
        attributionControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;
      setMapReady(true);
    })();

    return () => {
      mounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layersRef.current = {};
        fittedOnceRef.current = false;
        hadCourierRef.current = false;
      }
    };
  }, []);

  // Update markers & polylines smoothly whenever coordinates change
  useEffect(() => {
    let active = true;
    (async () => {
      const L = (await import("leaflet")).default;
      const map = mapRef.current;
      if (!active || !mapReady || !map) return;

      const storeIcon = L.divIcon({
        className: "",
        html: `
          <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);">
            <div style="background:#1C1917;color:#FFFDF9;font-size:10px;font-weight:700;padding:2px 7px;border-radius:999px;white-space:nowrap;margin-bottom:3px;box-shadow:0 2px 6px rgba(0,0,0,0.2);">
              🍜 Outlet Mie Oke
            </div>
            <div style="width:28px;height:28px;border-radius:999px;background:#C84B11;border:2.5px solid #FFFFFF;box-shadow:0 3px 10px rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center;color:#fff;font-size:13px;">
              🏪
            </div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const destIcon = L.divIcon({
        className: "",
        html: `
          <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);">
            <div style="background:#1E40AF;color:#FFFFFF;font-size:10px;font-weight:700;padding:2px 7px;border-radius:999px;white-space:nowrap;margin-bottom:3px;box-shadow:0 2px 6px rgba(0,0,0,0.2);">
              📍 Lokasi Tujuan
            </div>
            <div style="width:28px;height:28px;border-radius:999px;background:#2563EB;border:2.5px solid #FFFFFF;box-shadow:0 3px 10px rgba(37,99,235,0.35);display:flex;align-items:center;justify-content:center;color:#fff;font-size:13px;">
              🏠
            </div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const isMoving = status === "on_delivery" && !!courier?.is_live;
      const courierBadgeText = courier?.is_live ? "🛵 Lokasi Kurir" : "Lokasi Terakhir";

      const courierIcon = L.divIcon({
        className: "",
        html: `
          <div style="position:relative;display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-92%);">
            <div style="background:#166534;color:#FFFFFF;font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px;white-space:nowrap;margin-bottom:4px;box-shadow:0 4px 12px rgba(22,101,52,0.35);border:1.5px solid #BBF7D0;">
              ${courierBadgeText}
            </div>
            <div style="position:relative;width:36px;height:36px;display:flex;align-items:center;justify-content:center;">
              ${
                isMoving
                  ? `<span style="position:absolute;inset:-6px;border-radius:999px;background:rgba(22,101,52,0.22);animation:ping 1.6s cubic-bezier(0,0,0.2,1) infinite;"></span>`
                  : ""
              }
              <div style="position:relative;width:34px;height:34px;border-radius:999px;background:#166534;border:3px solid #FFFFFF;box-shadow:0 4px 14px rgba(22,101,52,0.45);display:flex;align-items:center;justify-content:center;font-size:17px;">
                🛵
              </div>
            </div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const layers = layersRef.current;

      // 1. Store Marker
      if (!layers.storeMarker) {
        layers.storeMarker = L.marker([store.lat, store.lng], { icon: storeIcon }).addTo(map);
      } else {
        layers.storeMarker.setLatLng([store.lat, store.lng]);
        layers.storeMarker.setIcon(storeIcon);
      }

      // 2. Destination Marker
      if (dest) {
        if (!layers.destMarker) {
          layers.destMarker = L.marker([dest.lat, dest.lng], { icon: destIcon }).addTo(map);
        } else {
          layers.destMarker.setLatLng([dest.lat, dest.lng]);
          layers.destMarker.setIcon(destIcon);
        }
      } else if (layers.destMarker) {
        map.removeLayer(layers.destMarker);
        layers.destMarker = undefined;
      }

      // Marker kurir hanya muncul setelah koordinat GPS perangkat benar-benar diterima.
      if (courier) {
        if (!layers.courierMarker) {
          layers.courierMarker = L.marker([courier.lat, courier.lng], {
            icon: courierIcon,
            zIndexOffset: 1000,
          }).addTo(map);
        } else {
          layers.courierMarker.setLatLng([courier.lat, courier.lng]);
          layers.courierMarker.setIcon(courierIcon);
        }
      } else if (layers.courierMarker) {
        map.removeLayer(layers.courierMarker);
        layers.courierMarker = undefined;
      }

      // Garis menuju tujuan hanya berawal dari titik GPS nyata jika sudah tersedia.
      if (courier) {
        const traveledCoords: [number, number][] = [[store.lat, store.lng], [courier.lat, courier.lng]];
        if (!layers.traveledLine) {
          layers.traveledLine = L.polyline(traveledCoords, {
            color: "#A8A29E", weight: 4, dashArray: "6, 8", opacity: 0.85,
          }).addTo(map);
        } else {
          layers.traveledLine.setLatLngs(traveledCoords);
        }
      } else if (layers.traveledLine) {
        map.removeLayer(layers.traveledLine);
        layers.traveledLine = undefined;
      }

      if (dest) {
        const routeOrigin = courier || store;
        const remainingCoords: [number, number][] = [[routeOrigin.lat, routeOrigin.lng], [dest.lat, dest.lng]];
        if (!layers.remainingLine) {
          layers.remainingLine = L.polyline(remainingCoords, {
            color: courier ? "#166534" : "#A8A29E",
            weight: 4,
            dashArray: courier ? undefined : "5, 7",
            opacity: 0.9,
          }).addTo(map);
        } else {
          layers.remainingLine.setLatLngs(remainingCoords);
          layers.remainingLine.setStyle({ color: courier ? "#166534" : "#A8A29E", dashArray: courier ? undefined : "5, 7" });
        }
      } else if (layers.remainingLine) {
        map.removeLayer(layers.remainingLine);
        layers.remainingLine = undefined;
      }

      // Fit bounds to real points only; without GPS show outlet and customer destination.
      if (!fittedOnceRef.current) {
        const pts: [number, number][] = [[store.lat, store.lng]];
        if (courier) pts.push([courier.lat, courier.lng]);
        if (dest) pts.push([dest.lat, dest.lng]);
        if (pts.length >= 2) {
          const bounds = L.latLngBounds(pts);
          if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [46, 46], maxZoom: 16 });
          }
        }
        fittedOnceRef.current = true;
      }
      if (courier && !hadCourierRef.current) {
        const pts: [number, number][] = [[store.lat, store.lng], [courier.lat, courier.lng]];
        if (dest) pts.push([dest.lat, dest.lng]);
        const bounds = L.latLngBounds(pts);
        if (bounds.isValid()) map.fitBounds(bounds, { padding: [46, 46], maxZoom: 16 });
        hadCourierRef.current = true;
      } else if (courier && courier.is_live && status === "on_delivery") {
        map.panTo([courier.lat, courier.lng], { animate: true, duration: 0.4 });
      }
    })();
  }, [
    mapReady,
    store.lat,
    store.lng,
    dest?.lat,
    dest?.lng,
    courier?.lat,
    courier?.lng,
    courier?.is_live,
    status,
  ]);

  const handleRecenter = async () => {
    const L = (await import("leaflet")).default;
    const map = mapRef.current;
    if (!map) return;
    const pts: [number, number][] = [[store.lat, store.lng]];
    if (courier) pts.push([courier.lat, courier.lng]);
    if (dest) pts.push([dest.lat, dest.lng]);
    const bounds = L.latLngBounds(pts);
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [46, 46], maxZoom: 16 });
    }
  };

  return (
    <div style={{ position: "relative" }}>
      <style>{`
        @keyframes ping {
          75%, 100% {
            transform: scale(1.85);
            opacity: 0;
          }
        }
      `}</style>
      <div
        ref={containerRef}
        style={{
          height,
          width: "100%",
          borderRadius: 12,
          border: "1px solid var(--border)",
          overflow: "hidden",
          background: "#F2EDE4",
          cursor: "grab",
        }}
      />
      <button
        type="button"
        onClick={handleRecenter}
        style={{
          position: "absolute",
          right: 10,
          bottom: 10,
          zIndex: 500,
          background: "rgba(255, 253, 249, 0.94)",
          border: "1px solid var(--border-strong)",
          borderRadius: 999,
          padding: "5px 11px",
          fontSize: 11,
          fontWeight: 600,
          color: "var(--ink)",
          cursor: "pointer",
          boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
        }}
      >
        Fokus Peta
      </button>
    </div>
  );
}
