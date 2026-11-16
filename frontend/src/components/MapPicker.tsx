"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const SURABAYA_CENTER: [number, number] = [-7.2575, 112.7521];

export default function MapPicker({
  lat,
  lng,
  onChange,
}: {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initialCenter: [number, number] =
      lat !== null && lng !== null ? [lat, lng] : SURABAYA_CENTER;

    const map = L.map(containerRef.current, {
      center: initialCenter,
      zoom: 14,
      scrollWheelZoom: false,
    });

    const tileUrl =
      process.env.NEXT_PUBLIC_MAP_TILE_URL || "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

    L.tileLayer(tileUrl, {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    map.on("click", (e: L.LeafletMouseEvent) => {
      const nextLat = Number(e.latlng.lat.toFixed(6));
      const nextLng = Number(e.latlng.lng.toFixed(6));
      onChange(nextLat, nextLng);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (lat !== null && lng !== null && !Number.isNaN(lat) && !Number.isNaN(lng)) {
      const pos: [number, number] = [lat, lng];
      if (!markerRef.current) {
        markerRef.current = L.circleMarker(pos, {
          radius: 10,
          color: "#1f1b16",
          weight: 3,
          fillColor: "#b8321e",
          fillOpacity: 0.95,
        }).addTo(map);
      } else {
        markerRef.current.setLatLng(pos);
      }
      map.panTo(pos);
    } else if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
  }, [lat, lng]);

  return (
    <div className="map-box">
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
