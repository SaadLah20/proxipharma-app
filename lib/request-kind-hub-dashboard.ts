import type { DemandeStatBucket } from "@/lib/demandes-hub-buckets";
import { countInBucket } from "@/lib/demandes-hub-buckets";
import {
  PATIENT_PRODUCT_HUB_SECTIONS,
  type PatientProductHubSection,
  type PatientProductHubSectionId,
} from "@/lib/patient-product-hub-sections";
import {
  PHARMACIST_PRODUCT_HUB_SECTIONS,
  type PharmacistProductHubSection,
  type PharmacistProductHubSectionId,
} from "@/lib/pharmacist-product-hub-sections";

export const HUB_DASHBOARD_PREVIEW = 3;

type HubRowBase = {
  id: string;
  status: string;
  created_at: string;
  updated_at?: string | null;
};

/** Jusqu’à 5 dossiers récents (priorité messages non lus + statuts actifs). */
export function pickRecentActiveHubRows<T extends HubRowBase>(
  rows: T[],
  unreadById: Record<string, boolean>,
  limit = 5,
  role: "patient" | "pharmacien" = "patient"
): T[] {
  const cap = Math.min(5, Math.max(1, limit));
  const scored = rows.map((row) => {
    let score = new Date(row.updated_at ?? row.created_at).getTime();
    if (unreadById[row.id]) score += 1e15;
    if (role === "pharmacien") {
      if (row.status === "submitted" || row.status === "in_review") score += 6e14;
      if (row.status === "confirmed") score += 5e14;
      if (row.status === "treated") score += 4e14;
      if (row.status === "responded") score += 2e14;
    } else {
      if (row.status === "responded") score += 5e14;
      if (row.status === "treated") score += 4e14;
      if (row.status === "submitted" || row.status === "in_review") score += 3e14;
      if (row.status === "confirmed") score += 2e14;
    }
    return { row, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, cap).map((s) => s.row);
}

export function hubDashboardQuickStats(
  rows: HubRowBase[],
  buckets: DemandeStatBucket[],
  unreadById: Record<string, boolean>
): { total: number; active: number; unread: number } {
  const total = rows.length;
  const unread = rows.filter((r) => unreadById[r.id] === true).length;
  const archiveKeys = new Set(["cloturees", "abandonnees", "expirees", "annulees"]);
  const archiveCount = buckets
    .filter((b) => archiveKeys.has(b.key))
    .reduce((sum, b) => sum + countInBucket(rows, b), 0);
  return { total, active: Math.max(0, total - archiveCount), unread };
}

export function patientHubSections(): PatientProductHubSection[] {
  return PATIENT_PRODUCT_HUB_SECTIONS;
}

export function pharmacistHubSections(): PharmacistProductHubSection[] {
  return PHARMACIST_PRODUCT_HUB_SECTIONS;
}

/** Dossiers les plus récents en tête (aperçu sections / reprise rapide). */
export function sortHubRowsByRecency<T extends HubRowBase>(rows: T[]): T[] {
  return [...rows].sort(
    (a, b) =>
      new Date(b.updated_at ?? b.created_at).getTime() -
      new Date(a.updated_at ?? a.created_at).getTime()
  );
}

export type PatientHubSectionId = PatientProductHubSectionId;
export type PharmacistHubSectionId = PharmacistProductHubSectionId;
