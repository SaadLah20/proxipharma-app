/**
 * Hub patient « demandes produits » — regroupement métier du tableau de bord.
 */

import type { PatientRequestRow } from "@/components/requests/demande-hub-ui";
import { summarizeRequestForPatientCard, type PatientRequestItemRow } from "@/lib/patient-request-list-summary";
import { formatDateTimeShort24hFr } from "@/lib/datetime-fr";

export type PatientProductHubSectionId = "action_required" | "at_pharmacy" | "archives";

export type PatientProductHubSection = {
  id: PatientProductHubSectionId;
  title: string;
  subtitle: string;
  statuses: readonly string[];
};

/** Aperçu par bloc sur le tableau de bord patient. */
export const PATIENT_PRODUCT_HUB_DASHBOARD_PREVIEW = 3;

export const PATIENT_PRODUCT_HUB_SECTIONS: PatientProductHubSection[] = [
  {
    id: "action_required",
    title: "À votre action",
    subtitle: "Répondue à valider ou passage en officine prévu",
    statuses: ["responded", "treated"],
  },
  {
    id: "at_pharmacy",
    title: "Chez la pharmacie",
    subtitle: "Envoyée ou validée — l’officine traite votre dossier",
    statuses: ["submitted", "in_review", "confirmed"],
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

const ACTIVE_STATUSES = new Set<string>([
  "responded",
  "treated",
  "submitted",
  "in_review",
  "confirmed",
]);

export function patientProductHubSectionForStatus(status: string): PatientProductHubSectionId | null {
  for (const s of PATIENT_PRODUCT_HUB_SECTIONS) {
    if ((s.statuses as readonly string[]).includes(status)) return s.id;
  }
  return null;
}

export function rowsInPatientProductHubSection<T extends PatientRequestRow>(
  rows: T[],
  sectionId: PatientProductHubSectionId
): T[] {
  const section = PATIENT_PRODUCT_HUB_SECTIONS.find((s) => s.id === sectionId);
  if (!section) return [];
  const allow = new Set(section.statuses);
  return rows.filter((r) => allow.has(r.status));
}

export function countInPatientProductHubSection<T extends PatientRequestRow>(
  rows: T[],
  sectionId: PatientProductHubSectionId
): number {
  return rowsInPatientProductHubSection(rows, sectionId).length;
}

/** Filtre liste : statut (bloc tableau de bord) et regroupement métier peuvent se cumuler (intersection). */
export function filterPatientProductHubListRows<T extends PatientRequestRow>(
  rows: T[],
  opts: {
    bucketStatuses?: readonly string[] | null;
    sectionId?: PatientProductHubSectionId | null;
  }
): T[] {
  let list = rows;
  if (opts.bucketStatuses?.length) {
    const allow = new Set(opts.bucketStatuses);
    list = list.filter((r) => allow.has(r.status));
  }
  if (opts.sectionId) {
    list = rowsInPatientProductHubSection(list, opts.sectionId);
  }
  return list;
}

export function patientProductHubListHref(
  basePath: string,
  opts: { sectionId?: PatientProductHubSectionId; statutKey?: string }
): string {
  const next = new URLSearchParams();
  next.set("vue", "liste");
  if (opts.sectionId) next.set("section", opts.sectionId);
  if (opts.statutKey) next.set("statut", opts.statutKey);
  const q = next.toString();
  return q ? `${basePath}?${q}` : basePath;
}

/** 3 à 5 dossiers « récemment actifs » (hors archives). */
export function pickRecentActiveProductRequests(
  rows: PatientRequestRow[],
  unreadById: Record<string, boolean>,
  limit = 5
): PatientRequestRow[] {
  const cap = Math.min(5, Math.max(3, limit));
  const candidates = rows.filter((r) => ACTIVE_STATUSES.has(r.status));
  const scored = candidates.map((row) => {
    let score = new Date(row.updated_at ?? row.created_at).getTime();
    if (unreadById[row.id]) score += 1e15;
    if (row.status === "responded") score += 5e14;
    if (row.status === "treated") score += 4e14;
    if (row.status === "confirmed") score += 2e14;
    return { row, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, cap).map((s) => s.row);
}

export type PatientProductHubCardContext = {
  primaryLine: string;
  secondaryLine?: string;
  emphasis?: "urgent" | "info" | "muted" | "success";
};

function itemsOf(row: PatientRequestRow): PatientRequestItemRow[] {
  const raw = row.request_items;
  return (Array.isArray(raw) ? raw : []) as PatientRequestItemRow[];
}

export function patientProductHubCardContextFr(row: PatientRequestRow): PatientProductHubCardContext {
  const items = itemsOf(row);
  const summary = summarizeRequestForPatientCard(items.length ? items : null, row.status);
  const n = summary.lineCount;
  const retained = summary.selectedPrincipalCount + summary.selectedProposedCount + summary.selectedAlternativesCount;
  const when = formatDateTimeShort24hFr(row.updated_at ?? row.submitted_at ?? row.created_at);

  switch (row.status) {
    case "responded": {
      const total =
        summary.totalSelectedDh != null
          ? ` · env. ${summary.totalSelectedDh.toFixed(2)} MAD si tout est retenu`
          : "";
      return {
        primaryLine: `${n} produit${n !== 1 ? "s" : ""} — validez votre choix`,
        secondaryLine: `Réponse officine · à confirmer sous 24 h${total}`,
        emphasis: "urgent",
      };
    }
    case "treated": {
      const wait = summary.selectedPendingPickupCount;
      return {
        primaryLine:
          wait > 0
            ? `${wait} produit${wait !== 1 ? "s" : ""} en attente de votre passage`
            : `${retained} produit${retained !== 1 ? "s" : ""} retenu${retained !== 1 ? "s" : ""}`,
        secondaryLine: "Préparation terminée — retrait ou suivi au comptoir",
        emphasis: "info",
      };
    }
    case "submitted":
    case "in_review":
      return {
        primaryLine: `${n} produit${n !== 1 ? "s" : ""} demandé${n !== 1 ? "s" : ""}`,
        secondaryLine:
          summary.totalInitialDh != null
            ? `En attente de réponse · env. ${summary.totalInitialDh.toFixed(2)} MAD`
            : "En attente de réponse de l’officine",
        emphasis: "info",
      };
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
      return {
        primaryLine: "Délai de validation dépassé",
        secondaryLine: `${n} produit${n !== 1 ? "s" : ""} — vous pouvez renvoyer une demande`,
        emphasis: "muted",
      };
    case "abandoned":
      return {
        primaryLine: "Dossier abandonné",
        secondaryLine: `MAJ ${when}`,
        emphasis: "muted",
      };
    case "cancelled":
      return {
        primaryLine: "Demande annulée",
        secondaryLine: `MAJ ${when}`,
        emphasis: "muted",
      };
    default:
      return {
        primaryLine: `${n} ligne${n !== 1 ? "s" : ""}`,
        secondaryLine: when ? `MAJ ${when}` : undefined,
        emphasis: "muted",
      };
  }
}
