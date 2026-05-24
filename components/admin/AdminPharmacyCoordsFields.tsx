"use client";

import { MapPin } from "lucide-react";
import {
  MOROCCO_LAT_MAX,
  MOROCCO_LAT_MIN,
  MOROCCO_LNG_MAX,
  MOROCCO_LNG_MIN,
  openGoogleMapsPreview,
  parseAdminPharmacyCoords,
} from "@/lib/pharmacy-coords-morocco";

type Props = {
  latitude: string;
  longitude: string;
  onLatitudeChange: (value: string) => void;
  onLongitudeChange: (value: string) => void;
  required?: boolean;
};

export function AdminPharmacyCoordsFields({
  latitude,
  longitude,
  onLatitudeChange,
  onLongitudeChange,
  required = true,
}: Props) {
  const parsed = parseAdminPharmacyCoords(latitude, longitude, { required });
  const canPreview = parsed.ok && parsed.latitude !== null && parsed.longitude !== null;

  return (
    <div className="md:col-span-2 grid gap-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-gray-800">Position GPS (Maroc)</p>
          <p className="mt-0.5 text-xs text-gray-600">
            Copiez latitude et longitude depuis Google Maps (clic droit sur l&apos;épingle → coordonnées).
            {required ? " Obligatoire." : " Facultatif."}
          </p>
        </div>
        <button
          type="button"
          disabled={!canPreview}
          onClick={() => {
            if (canPreview && parsed.latitude != null && parsed.longitude != null) {
              openGoogleMapsPreview(parsed.latitude, parsed.longitude);
            }
          }}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-teal-300 bg-white px-3 py-2 text-xs font-semibold text-teal-900 transition hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <MapPin className="size-3.5" aria-hidden />
          Vérifier sur la carte
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-xs font-medium text-gray-700">
          Latitude
          <input
            className="rounded-lg border bg-white p-3 font-mono text-sm"
            placeholder="ex. 33.573110"
            value={latitude}
            onChange={(e) => onLatitudeChange(e.target.value)}
            inputMode="decimal"
            required={required}
            min={MOROCCO_LAT_MIN}
            max={MOROCCO_LAT_MAX}
            step="any"
          />
        </label>
        <label className="grid gap-1 text-xs font-medium text-gray-700">
          Longitude
          <input
            className="rounded-lg border bg-white p-3 font-mono text-sm"
            placeholder="ex. -7.589843"
            value={longitude}
            onChange={(e) => onLongitudeChange(e.target.value)}
            inputMode="decimal"
            required={required}
            min={MOROCCO_LNG_MIN}
            max={MOROCCO_LNG_MAX}
            step="any"
          />
        </label>
      </div>

      <p className="text-[11px] text-gray-500">
        Zone acceptée : latitude {MOROCCO_LAT_MIN} à {MOROCCO_LAT_MAX}, longitude {MOROCCO_LNG_MIN} à{" "}
        {MOROCCO_LNG_MAX}. Vérifiez l&apos;épingle sur la carte avant de créer l&apos;officine.
      </p>

      {latitude.trim() || longitude.trim() ? (
        parsed.ok && parsed.latitude != null ? (
          <p className="rounded-md bg-emerald-50 px-2 py-1.5 text-xs text-emerald-900">
            Position valide : {parsed.latitude}, {parsed.longitude}
          </p>
        ) : !parsed.ok ? (
          <p className="rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-950">{parsed.error}</p>
        ) : null
      ) : null}
    </div>
  );
}

/** Validation côté formulaire avant envoi API. */
export function validateAdminPharmacyCoordsForSubmit(
  latitude: string,
  longitude: string,
  required = true
): string | null {
  const parsed = parseAdminPharmacyCoords(latitude, longitude, { required });
  if (!parsed.ok) return parsed.error;
  if (required && (parsed.latitude === null || parsed.longitude === null)) {
    return "Latitude et longitude sont requises.";
  }
  return null;
}
