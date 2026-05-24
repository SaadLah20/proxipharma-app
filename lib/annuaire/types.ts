import type { PharmacyOpenSnapshot } from "@/lib/annuaire/schedule-bundle";

export type AnnuairePharmacyRow = {
  id: string;
  nom: string;
  ville: string;
  adresse: string;
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
};

export type AnnuairePharmacyEnriched = AnnuairePharmacyRow & {
  open: PharmacyOpenSnapshot;
  distanceKm: number | null;
  hasValidLocation: boolean;
};

export const ANNUAIRE_PAGE_SIZE = 8;
