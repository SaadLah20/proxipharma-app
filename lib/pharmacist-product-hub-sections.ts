/**
 * Hub pharmacien « demandes produits » — regroupement indicatif du tableau de bord uniquement.
 */

import type { PharmacistRequestRow } from "@/components/requests/demande-hub-ui";
import { summarizeRequestForPatientCard, type PatientRequestItemRow } from "@/lib/patient-request-list-summary";
import { formatDateTimeShort24hFr } from "@/lib/datetime-fr";

export type PharmacistProductHubSectionId =
  | "action_required"
  | "awaiting_patient_validation"
  | "awaiting_patient"
  | "archives";

export type PharmacistProductHubSection = {
  id: PharmacistProductHubSectionId;
  title: string;
  subtitle: string;
  statuses: readonly string[];
};

export const PHARMACIST_PRODUCT_HUB_DASHBOARD_PREVIEW = 3;

export const PHARMACIST_PRODUCT_HUB_SECTIONS: PharmacistProductHubSection[] = [
  {
    id: "action_required",
    title: "À traiter en priorité",
    subtitle: "Demandes envoyées ou validées par le patient — réponse ou préparation",
    statuses: ["submitted", "in_review", "confirmed"],
  },
  {
    id: "awaiting_patient_validation",
    title: "En attente du patient",
    subtitle: "Réponse publiée — le patient doit valider sous 24 h (alerte ~1 h avant expiration)",
    statuses: ["responded"],
  },
  {
    id: "awaiting_patient",
    title: "Passage patient / comptoir",
    subtitle: "Préparation traitée — retrait comptoir ; clôture auto si passage manqué + 24 h",
    statuses: ["treated"],
  },
  {
    id: "archives",
    title: "Archives",
    subtitle: "Clôturées, expirées, abandonnées ou annulées",
    statuses: [
      "completed",
      "partially_collected",
      "fully_collected",
      "expired",
      "abandoned",
      "cancelled",
      "draft",
    ],
  },
];

export function pharmacistProductHubSectionForStatus(status: string): PharmacistProductHubSectionId | null {
  for (const s of PHARMACIST_PRODUCT_HUB_SECTIONS) {
    if ((s.statuses as readonly string[]).includes(status)) return s.id;
  }
  return null;
}

export function rowsInPharmacistProductHubSection<T extends PharmacistRequestRow>(
  rows: T[],
  sectionId: PharmacistProductHubSectionId
): T[] {
  const section = PHARMACIST_PRODUCT_HUB_SECTIONS.find((s) => s.id === sectionId);
  if (!section) return [];
  const allow = new Set(section.statuses);
  return rows.filter((r) => allow.has(r.status));
}

export function countInPharmacistProductHubSection<T extends PharmacistRequestRow>(
  rows: T[],
  sectionId: PharmacistProductHubSectionId
): number {
  return rowsInPharmacistProductHubSection(rows, sectionId).length;
}

export function filterPharmacistProductHubListRows<T extends PharmacistRequestRow>(
  rows: T[],
  opts: { bucketStatuses?: readonly string[] | null }
): T[] {
  if (!opts.bucketStatuses?.length) return rows;
  const allow = new Set(opts.bucketStatuses);
  return rows.filter((r) => allow.has(r.status));
}

export function pharmacistProductHubListHref(basePath: string, opts?: { statutKey?: string }): string {
  const next = new URLSearchParams();
  next.set("vue", "liste");
  if (opts?.statutKey) next.set("statut", opts.statutKey);
  return `${basePath}?${next.toString()}`;
}

/** Jusqu’à 5 dossiers récents ou consultés (tous statuts, priorité messages non lus). */
export function pickRecentActivePharmacistProductRequests(
  rows: PharmacistRequestRow[],
  unreadById: Record<string, boolean>,
  limit = 5
): PharmacistRequestRow[] {
  const cap = Math.min(5, Math.max(1, limit));
  const scored = rows.map((row) => {
    let score = new Date(row.updated_at ?? row.created_at).getTime();
    if (unreadById[row.id]) score += 1e15;
    if (row.status === "submitted" || row.status === "in_review") score += 6e14;
    if (row.status === "confirmed") score += 5e14;
    if (row.status === "treated") score += 4e14;
    if (row.status === "responded") score += 2e14;
    return { row, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, cap).map((s) => s.row);
}

export type PharmacistProductHubCardContext = {
  primaryLine: string;
  secondaryLine?: string;
  emphasis?: "urgent" | "info" | "muted" | "success";
};

function itemsOf(row: PharmacistRequestRow): PatientRequestItemRow[] {
  const raw = row.request_items;
  return (Array.isArray(raw) ? raw : []) as PatientRequestItemRow[];
}

export function pharmacistProductHubCardContextFr(row: PharmacistRequestRow): PharmacistProductHubCardContext {
  const items = itemsOf(row);
  const summary = summarizeRequestForPatientCard(items.length ? items : null, row.status);
  const n = summary.lineCount;
  const retained = summary.selectedPrincipalCount + summary.selectedProposedCount + summary.selectedAlternativesCount;
  const when = formatDateTimeShort24hFr(row.updated_at ?? row.submitted_at ?? row.created_at);
  const patientName = row.patient_full_name?.trim();

  switch (row.status) {
    case "submitted":
    case "in_review":
      if (row.request_type === "prescription") {
        return {
          primaryLine: patientName
            ? `${patientName} — ordonnance à saisir`
            : "Ordonnance à saisir depuis le scan",
          secondaryLine:
            n > 0
              ? `${n} produit${n !== 1 ? "s" : ""} saisi${n !== 1 ? "s" : ""} — compléter puis publier`
              : "Ouvrir le scan, saisir les produits, publier la réponse",
          emphasis: "urgent",
        };
      }
      if (row.request_type === "free_consultation") {
        return {
          primaryLine: patientName ? `${patientName} — consultation à lire` : "Consultation à lire",
          secondaryLine:
            n > 0
              ? `${n} produit${n !== 1 ? "s" : ""} proposé${n !== 1 ? "s" : ""} — compléter puis publier`
              : "Échanger avec le patient, proposer des produits, publier la réponse",
          emphasis: "urgent",
        };
      }
      return {
        primaryLine: patientName ? `${patientName} — ${n} ligne${n !== 1 ? "s" : ""}` : `${n} ligne${n !== 1 ? "s" : ""} à traiter`,
        secondaryLine: "Répondre au patient ou compléter la saisie",
        emphasis: "urgent",
      };
    case "responded":
      return {
        primaryLine: "En attente de validation patient",
        secondaryLine: `${n} produit${n !== 1 ? "s" : ""} proposé${n !== 1 ? "s" : ""} · expire sous 24 h`,
        emphasis: "info",
      };
    case "treated": {
      const wait = summary.selectedPendingPickupCount;
      return {
        primaryLine:
          wait > 0
            ? `En attente du passage patient · ${wait} retrait${wait !== 1 ? "s" : ""} prévu${wait !== 1 ? "s" : ""}`
            : "Passage patient — prêt à clôturer le dossier",
        secondaryLine:
          wait > 0
            ? "Préparation déclarée — marquez les retraits ; clôture auto si passage manqué + 24 h"
            : "Marquez les retraits puis clôturez le dossier",
        emphasis: "info",
      };
    }
    case "confirmed": {
      const parts: string[] = [];
      if (summary.hasExecutionProgress) {
        if (summary.selectedToOrderPendingCount > 0) {
          parts.push(`${summary.selectedToOrderPendingCount} à commander`);
        }
        const reserved = retained - summary.selectedToOrderPendingCount;
        if (reserved > 0) parts.push(`${reserved} à réserver`);
      }
      return {
        primaryLine: `${retained} produit${retained !== 1 ? "s" : ""} retenu${retained !== 1 ? "s" : ""}`,
        secondaryLine: parts.length > 0 ? `Préparation · ${parts.join(" · ")}` : "Validée — préparation en cours",
        emphasis: "info",
      };
    }
    case "completed":
    case "partially_collected":
    case "fully_collected": {
      const picked = summary.selectedPickedUpCount;
      return {
        primaryLine: `${picked} récupéré${picked !== 1 ? "s" : ""} sur ${retained} retenu${retained !== 1 ? "s" : ""}`,
        secondaryLine: `Clôturée · MAJ ${when}`,
        emphasis: "success",
      };
    }
    case "expired":
      return { primaryLine: "Délai patient dépassé", secondaryLine: `MAJ ${when}`, emphasis: "muted" };
    case "abandoned":
      return { primaryLine: "Dossier abandonné", secondaryLine: `MAJ ${when}`, emphasis: "muted" };
    case "cancelled":
      return { primaryLine: "Demande annulée", secondaryLine: `MAJ ${when}`, emphasis: "muted" };
    default:
      return {
        primaryLine: `${n} ligne${n !== 1 ? "s" : ""}`,
        secondaryLine: when ? `MAJ ${when}` : undefined,
        emphasis: "muted",
      };
  }
}
