/** Coordonnées plausibles au Maroc (élargi pour territoires couverts). */
export function isPlausibleMoroccoCoords(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  return lat >= 20.5 && lat <= 36.5 && lng >= -17.5 && lng <= -0.5;
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistanceKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

export type UserLocationResult =
  | { ok: true; lat: number; lng: number }
  | { ok: false; code: "denied" | "unavailable" | "timeout" | "unsupported" };

export function requestUserLocation(timeoutMs = 12000): Promise<UserLocationResult> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve({ ok: false, code: "unsupported" });
      return;
    }
    const timer = window.setTimeout(() => resolve({ ok: false, code: "timeout" }), timeoutMs);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        window.clearTimeout(timer);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        if (!isPlausibleMoroccoCoords(lat, lng)) {
          resolve({ ok: false, code: "unavailable" });
          return;
        }
        resolve({ ok: true, lat, lng });
      },
      (err) => {
        window.clearTimeout(timer);
        if (err.code === err.PERMISSION_DENIED) resolve({ ok: false, code: "denied" });
        else resolve({ ok: false, code: "unavailable" });
      },
      { enableHighAccuracy: false, timeout: timeoutMs - 500, maximumAge: 60_000 }
    );
  });
}
