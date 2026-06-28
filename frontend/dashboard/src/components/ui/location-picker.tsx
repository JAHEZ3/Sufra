"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import mapboxgl, { Map as MapboxGLMap, Marker } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Loader2, MapPin, Navigation2, AlertCircle } from "lucide-react";

export interface PickedLocation {
  lat: number;
  lng: number;
  city: string;
  street: string;
  /** Mapbox's full-form address (place_name) — useful for display. */
  fullAddress?: string;
}

interface LocationPickerProps {
  value?: { lat: number; lng: number } | null;
  onChange: (loc: PickedLocation) => void;
  className?: string;
  /** Hide the inline city/street readout. The map still works. */
  hideAddressReadout?: boolean;
}

const FALLBACK_CENTER: [number, number] = [34.466, 31.5017]; // Gaza

/**
 * Reusable pin-on-map picker. Three input modes:
 *  - "use my location" button → navigator.geolocation
 *  - drag the pin
 *  - click anywhere on the map
 *
 * Every change triggers a Mapbox reverse-geocode to populate city + street.
 * Designed so the parent only needs to read the most recent onChange result.
 */
export function LocationPicker({
  value,
  onChange,
  className,
  hideAddressReadout = false,
}: LocationPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxGLMap | null>(null);
  const markerRef = useRef<Marker | null>(null);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  const [readout, setReadout] = useState<PickedLocation | null>(
    value
      ? { lat: value.lat, lng: value.lng, city: "", street: "" }
      : null,
  );
  const [geoLoading, setGeoLoading] = useState(false);
  const [geocodeLoading, setGeocodeLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep the latest onChange in a ref so the event handlers below don't need
  // to be re-bound when the parent's callback identity changes.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const reverseGeocode = useCallback(
    async (lng: number, lat: number): Promise<Omit<PickedLocation, "lat" | "lng">> => {
      if (!token) return { city: "", street: "" };
      try {
        setGeocodeLoading(true);
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&language=ar&types=address,locality,place,neighborhood,district`;
        const res = await fetch(url);
        if (!res.ok) return { city: "", street: "" };
        const json = (await res.json()) as {
          features?: Array<{
            place_name?: string;
            text?: string;
            place_type?: string[];
            context?: Array<{ id: string; text: string }>;
            properties?: { address?: string };
          }>;
        };
        const features = json.features ?? [];
        // Find the most specific address + the city/place.
        const address = features.find((f) => f.place_type?.includes("address")) ?? features[0];
        const placeFeature =
          features.find((f) => f.place_type?.includes("place")) ??
          features.find((f) => f.place_type?.includes("locality")) ??
          address;

        const city =
          placeFeature?.text ??
          address?.context?.find((c) => c.id.startsWith("place"))?.text ??
          "";
        const street = address?.text
          ? `${address.text}${address.properties?.address ? " " + address.properties.address : ""}`.trim()
          : "";
        return {
          city,
          street,
          fullAddress: address?.place_name,
        };
      } catch {
        return { city: "", street: "" };
      } finally {
        setGeocodeLoading(false);
      }
    },
    [token],
  );

  const commit = useCallback(
    async (lng: number, lat: number) => {
      const geo = await reverseGeocode(lng, lat);
      const next: PickedLocation = { lat, lng, ...geo };
      setReadout(next);
      onChangeRef.current(next);
    },
    [reverseGeocode],
  );

  // Init map once.
  useEffect(() => {
    if (!token || !containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = token;

    const initLngLat: [number, number] = value
      ? [value.lng, value.lat]
      : FALLBACK_CENTER;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: initLngLat,
      zoom: value ? 15 : 12,
    });
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: false }), "top-left");

    const marker = new mapboxgl.Marker({ color: "#1f8a5b", draggable: true })
      .setLngLat(initLngLat)
      .addTo(map);

    marker.on("dragend", () => {
      const { lng, lat } = marker.getLngLat();
      void commit(lng, lat);
    });

    map.on("click", (e) => {
      marker.setLngLat(e.lngLat);
      void commit(e.lngLat.lng, e.lngLat.lat);
    });

    mapRef.current = map;
    markerRef.current = marker;

    // If we got an initial value, fill the address readout via geocoding.
    if (value) void commit(value.lng, value.lat);

    return () => {
      marker.remove();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // External value updates (e.g. after "use my location") — keep marker in sync.
  useEffect(() => {
    if (!value || !mapRef.current || !markerRef.current) return;
    markerRef.current.setLngLat([value.lng, value.lat]);
    mapRef.current.flyTo({ center: [value.lng, value.lat], zoom: 15, duration: 600 });
  }, [value]);

  const useMyLocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setError("متصفحك لا يدعم خاصية تحديد الموقع.");
      return;
    }
    setError(null);
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLoading(false);
        const { latitude, longitude } = pos.coords;
        if (markerRef.current) markerRef.current.setLngLat([longitude, latitude]);
        if (mapRef.current) {
          mapRef.current.flyTo({ center: [longitude, latitude], zoom: 16, duration: 700 });
        }
        void commit(longitude, latitude);
      },
      (err) => {
        setGeoLoading(false);
        const msg =
          err.code === err.PERMISSION_DENIED
            ? "تم رفض الإذن للوصول إلى الموقع."
            : err.code === err.POSITION_UNAVAILABLE
              ? "تعذّر تحديد موقعك حالياً."
              : "انتهت مهلة تحديد الموقع.";
        setError(msg);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
  }, [commit]);

  const display = useMemo(() => {
    if (!readout) return null;
    return {
      coords: `${readout.lat.toFixed(5)}, ${readout.lng.toFixed(5)}`,
      city: readout.city || "—",
      street: readout.street || readout.fullAddress || "—",
    };
  }, [readout]);

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
        <code style={{ direction: "ltr", margin: "0 4px" }}>NEXT_PUBLIC_MAPBOX_TOKEN</code>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="relative w-full h-[360px] rounded-2xl overflow-hidden border border-gray-200 bg-white">
        <div ref={containerRef} className="w-full h-full" />
        <button
          type="button"
          onClick={useMyLocation}
          disabled={geoLoading}
          className="absolute top-3 right-3 z-10 inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white shadow-md border border-gray-200 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-60"
        >
          {geoLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Navigation2 className="w-4 h-4 text-[#1f8a5b]" />
          )}
          استخدم موقعي الحالي
        </button>
      </div>

      {error && (
        <div className="mt-2 flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {!hideAddressReadout && display && (
        <div className="mt-3 rounded-xl border border-gray-200 bg-white p-3 space-y-1.5 text-xs">
          <div className="flex items-center gap-2 text-gray-500">
            <MapPin className="w-3.5 h-3.5 text-[#1f8a5b]" />
            <span className="font-semibold text-gray-700">العنوان المكتشف</span>
            {geocodeLoading && <Loader2 className="w-3 h-3 animate-spin text-gray-400" />}
          </div>
          <p className="text-gray-700">
            <span className="text-gray-500">المدينة:</span> {display.city}
          </p>
          <p className="text-gray-700">
            <span className="text-gray-500">الشارع/الحي:</span> {display.street}
          </p>
          <p className="text-gray-400 font-mono" dir="ltr">
            {display.coords}
          </p>
        </div>
      )}
    </div>
  );
}
