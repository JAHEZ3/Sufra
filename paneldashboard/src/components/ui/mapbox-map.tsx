"use client";

import { useEffect, useMemo, useRef } from "react";
import mapboxgl, { LngLatLike, Map as MapboxGLMap, Marker } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

export interface MapPin {
  /** Stable key used by the map page when grouping pins by layer. */
  id?: string;
  lat: number;
  lng: number;
  label?: string;
  color?: string;
  popupHtml?: string;
}

interface MapboxMapProps {
  pins: MapPin[];
  center?: { lat: number; lng: number };
  zoom?: number;
  className?: string;
  style?: "streets" | "satellite-streets" | "light" | "dark";
  /** Auto-fit the viewport to include every pin (defaults to true). */
  fitBounds?: boolean;
  /** When true, reuse markers across renders so live pins (driver) move smoothly. */
  animate?: boolean;
}

const STYLE_URLS: Record<NonNullable<MapboxMapProps["style"]>, string> = {
  streets: "mapbox://styles/mapbox/streets-v12",
  "satellite-streets": "mapbox://styles/mapbox/satellite-streets-v12",
  light: "mapbox://styles/mapbox/light-v11",
  dark: "mapbox://styles/mapbox/dark-v11",
};

/**
 * Thin wrapper around mapbox-gl-js. We use the imperative SDK instead of
 * react-map-gl because the latter's wrappers add overhead we don't need
 * for the simple "show some pins" use case.
 *
 * The token comes from NEXT_PUBLIC_MAPBOX_TOKEN — when missing, the
 * component renders a plain-text placeholder so the surrounding UI still
 * works in dev environments without a token configured.
 */
export function MapboxMap({
  pins,
  center,
  zoom = 13,
  className,
  style = "streets",
  fitBounds = true,
  animate = false,
}: MapboxMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxGLMap | null>(null);
  // Map keyed by pin.id (or array index when not provided) so we can move an
  // existing marker instead of recreating it — that's what makes the driver
  // pin slide smoothly between location updates.
  const markersRef = useRef<Map<string, Marker>>(new Map());

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  const safePins = useMemo(
    () =>
      pins.filter(
        (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng),
      ),
    [pins],
  );

  const initialCenter: LngLatLike = useMemo(() => {
    if (center) return [center.lng, center.lat];
    if (safePins[0]) return [safePins[0].lng, safePins[0].lat];
    // Fallback to Gaza, Palestine.
    return [34.466, 31.5017];
  }, [center, safePins]);

  useEffect(() => {
    if (!token || !containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: STYLE_URLS[style],
      center: initialCenter,
      zoom,
      attributionControl: true,
    });
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: false }), "top-left");
    mapRef.current = map;

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
    // We only want to initialize once — subsequent prop changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const seenKeys = new Set<string>();
    safePins.forEach((p, i) => {
      const key = p.id ?? `idx:${i}`;
      seenKeys.add(key);
      const existing = markersRef.current.get(key);
      if (existing && animate) {
        existing.setLngLat([p.lng, p.lat]);
        if (p.popupHtml || p.label) {
          existing.setPopup(
            new mapboxgl.Popup({ offset: 24, closeButton: false }).setHTML(
              p.popupHtml ??
                `<div style="font-family: inherit; font-size: 13px;">${escapeHtml(p.label ?? "")}</div>`,
            ),
          );
        }
      } else {
        existing?.remove();
        const marker = new mapboxgl.Marker({ color: p.color ?? "#1f8a5b" })
          .setLngLat([p.lng, p.lat]);
        if (p.popupHtml || p.label) {
          marker.setPopup(
            new mapboxgl.Popup({ offset: 24, closeButton: false }).setHTML(
              p.popupHtml ??
                `<div style="font-family: inherit; font-size: 13px;">${escapeHtml(p.label ?? "")}</div>`,
            ),
          );
        }
        marker.addTo(map);
        markersRef.current.set(key, marker);
      }
    });

    // Remove markers that aren't in the latest pins set.
    markersRef.current.forEach((marker, key) => {
      if (!seenKeys.has(key)) {
        marker.remove();
        markersRef.current.delete(key);
      }
    });

    if (fitBounds && safePins.length > 1) {
      const bounds = new mapboxgl.LngLatBounds();
      safePins.forEach((p) => bounds.extend([p.lng, p.lat]));
      map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 400 });
    } else if (safePins.length === 1 && !animate) {
      // In animate mode we intentionally don't re-center on every update —
      // otherwise the map would jerk back when the driver pin moves.
      map.flyTo({ center: [safePins[0].lng, safePins[0].lat], zoom, duration: 400 });
    }
  }, [safePins, fitBounds, zoom, animate]);

  if (!token) {
    return (
      <div
        className={className}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#e6f2ec",
          color: "#145c3c",
          fontSize: 13,
          padding: 24,
          borderRadius: 12,
          textAlign: "center",
        }}
      >
        لم يتم إعداد رمز Mapbox. أضِف{" "}
        <code style={{ direction: "ltr", margin: "0 4px" }}>
          NEXT_PUBLIC_MAPBOX_TOKEN
        </code>{" "}
        في ملف .env.local.
      </div>
    );
  }

  return <div ref={containerRef} className={className} style={{ width: "100%", height: "100%" }} />;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      case "'": return "&#39;";
      default: return c;
    }
  });
}
