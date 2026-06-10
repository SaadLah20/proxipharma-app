import type { PharmacyOpenSnapshot } from "@/lib/annuaire/schedule-bundle";

export type AnnuairePharmacyRow = {
  id: string;
  nom: string;
  nom_ar?: string | null;
  ville: string;
  adresse: string;
  adresse_ar?: string | null;
  telephone: string | null;
  whatsapp: string | null;
  statut: string;
  public_ref: string | null;
  cover_image_path: string | null;
  logo_url: string | null;
  latitude: number | null;
  longitude: number | null;
  maps_url: string | null;
  rating_avg: number | null;
  rating_count: number | null;
  /** Présent si la requête annuaire le sélectionne (filtre pilote). */
  public_listed?: boolean | null;
};

export type AnnuairePharmacyEnriched = AnnuairePharmacyRow & {
  open: PharmacyOpenSnapshot;
  distanceKm: number | null;
  hasValidLocation: boolean;
};

export const ANNUAIRE_PAGE_SIZE = 8;
