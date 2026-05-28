import { formatDateTimeShort24hFr } from "@/lib/datetime-fr";
import {
  counterOutcomeReasonPayload,
  patientDossierHistoryDetailParagraphsFr,
  pharmacistDossierHistoryDetailParagraphsFr,
  patientHistoryAuditDetailLines,
  patientHistoryAuditTitle,
  tryParsePatientHistoryAudit,
} from "@/lib/patient-request-history-audit";
import {
  requestHistoryPatientHeadline,
  requestHistoryPharmacistHeadline,
} from "@/lib/request-display";

export type HistoryViewerRole = "patient" | "pharmacien";
export type HistoryActorTone = "patient" | "pharmacy" | "system";

export type FormattedHistoryEventFr = {
  id: string;
  atIso: string;
  atLabel: string;
  headline: string;
  detailLines: string[];
  actorLabel: string;
  actorTone: HistoryActorTone;
  isStatusChange: boolean;
};

const UUID_RE =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;

/** Retire identifiants techniques et préfixes stockés en base. */
export function sanitizeHistoryDisplayText(text: string): string {
  let s = text.trim();
  if (!s) return "";
  if (s.startsWith("audit_v1:")) return "";
  s = s.replace(UUID_RE, "").replace(/\brequest_item[s]?\b/gi, "produit");
  s = s.replace(/\s{2,}/g, " ").replace(/\s+([.,;:!?])/g, "$1").trim();
  return s;
}

export function historyActorToneFromReason(
  reason: string | null | undefined,
  viewerRole: HistoryViewerRole
): HistoryActorTone {
  const r = (reason ?? "").trim().toLowerCase();
  if (!r) return "system";
  if (r.startsWith("audit_v1:")) return "pharmacy";
  if (
    r.startsWith("patient_") ||
    r.startsWith("patient_abandon") ||
    r.includes("patient_confirm") ||
    r.includes("patient_planned") ||
    r.includes("patient_resubmit")
  ) {
    return "patient";
  }
  if (
    r.startsWith("pharmacist_") ||
    r.startsWith("pharmacy_") ||
    r.startsWith("pharma_") ||
    r.startsWith("counter_") ||
    r.startsWith("publication_") ||
    r.includes("pharmacien_ui") ||
    r.includes("counter_outcome") ||
    r.includes("supply_amendments")
  ) {
    return "pharmacy";
  }
  if (r.startsWith("auto_") || r.startsWith("expire_") || r === "request_created_with_status") {
    return "system";
  }
  if (viewerRole === "patient") {
    if (r.includes("patient")) return "patient";
    if (r.includes("pharmac")) return "pharmacy";
  } else {
    if (r.includes("patient")) return "patient";
    if (r.includes("pharmac")) return "pharmacy";
  }
  return "system";
}

export function historyActorLabelFr(
  reason: string | null | undefined,
  viewerRole: HistoryViewerRole
): string {
  const tone = historyActorToneFromReason(reason, viewerRole);
  if (tone === "patient") return viewerRole === "patient" ? "Vous" : "Le patient";
  if (tone === "pharmacy") return viewerRole === "patient" ? "La pharmacie" : "Vous";
  return "Automatique";
}

function headlineForSameStatusReason(
  reason: string | null | undefined,
  viewerRole: HistoryViewerRole
): string | null {
  const r = (reason ?? "").trim();
  if (!r) return null;
  const audit = tryParsePatientHistoryAudit(reason);
  if (audit) {
    return viewerRole === "patient"
      ? patientHistoryAuditTitle(audit)
      : "Modification après validation patient";
  }
  if (r.startsWith("counter_outcome:")) {
    const rest = counterOutcomeReasonPayload(r).slice("counter_outcome:".length);
    if (rest === "picked_up") return "Retrait au comptoir enregistré";
    if (rest === "unset") return "Suivi comptoir remis en attente";
    if (rest.startsWith("cancelled_at_counter")) return "Produit non retiré au comptoir";
    return "Mise à jour du comptoir";
  }
  if (r === "pharmacist_adjustments_after_confirmation") {
    return viewerRole === "patient"
      ? "La pharmacie a ajusté votre commande validée"
      : "Ajustement enregistré après validation patient";
  }
  if (r.startsWith("pharmacist_supply_amendments_saved")) {
    return viewerRole === "patient"
      ? "La pharmacie a mis à jour des produits de votre commande"
      : "Modifications supply enregistrées";
  }
  if (r === "counter_product_added") return "Produit ajouté au comptoir";
  if (r === "counter_alternative_added") return "Alternative ajoutée";
  if (r === "counter_alternative_removed") return "Alternative retirée";
  if (r === "pharmacist_proposed_line_removed") return "Proposition de produit retirée";
  if (r === "pharmacist_response_updated") {
    return viewerRole === "patient" ? "La pharmacie a modifié sa réponse" : "Réponse mise à jour";
  }
  if (r === "pharmacien_ui" || r === "pharmacist_ui_confirm_close") {
    return viewerRole === "patient" ? "Mise à jour par la pharmacie" : "Action enregistrée";
  }
  return null;
}

export function formatDossierHistoryHeadline(
  oldStatus: string | null,
  newStatus: string,
  reason: string | null | undefined,
  viewerRole: HistoryViewerRole
): string {
  const o = oldStatus?.trim() || null;
  const n = newStatus.trim();
  if (o === n || (!o && n)) {
    const same = headlineForSameStatusReason(reason, viewerRole);
    if (same) return same;
  }
  return viewerRole === "patient"
    ? requestHistoryPatientHeadline(o, n)
    : requestHistoryPharmacistHeadline(o, n);
}

export function formatDossierHistoryDetailLines(
  reason: string | null | undefined,
  viewerRole: HistoryViewerRole
): string[] {
  const audit = tryParsePatientHistoryAudit(reason);
  if (audit) {
    return patientHistoryAuditDetailLines(audit, viewerRole === "pharmacien" ? "pharmacist" : "patient")
      .map(sanitizeHistoryDisplayText)
      .filter(Boolean);
  }
  const paras =
    viewerRole === "patient"
      ? patientDossierHistoryDetailParagraphsFr(reason)
      : pharmacistDossierHistoryDetailParagraphsFr(reason);
  const cleaned = paras.map(sanitizeHistoryDisplayText).filter(Boolean);
  if (cleaned.length > 0) return cleaned;
  const r = (reason ?? "").trim();
  if (!r || r.startsWith("audit_v1:")) return [];
  if (/^[a-z][a-z0-9_|:.-]{0,80}$/i.test(r)) {
    return [viewerRole === "patient" ? "Une mise à jour a été enregistrée." : "Action enregistrée sur le dossier."];
  }
  return [sanitizeHistoryDisplayText(r)];
}

export function formatDossierHistoryRow(
  row: {
    id: string;
    created_at: string;
    old_status: string | null;
    new_status: string;
    reason: string | null;
  },
  viewerRole: HistoryViewerRole
): FormattedHistoryEventFr {
  const reason = row.reason;
  const headline = formatDossierHistoryHeadline(row.old_status, row.new_status, reason, viewerRole);
  const detailLines = formatDossierHistoryDetailLines(reason, viewerRole);
  const actorTone = historyActorToneFromReason(reason, viewerRole);
  const o = row.old_status?.trim() || null;
  const n = row.new_status.trim();
  return {
    id: row.id,
    atIso: row.created_at,
    atLabel: formatDateTimeShort24hFr(row.created_at),
    headline,
    detailLines,
    actorLabel: historyActorLabelFr(reason, viewerRole),
    actorTone,
    isStatusChange: Boolean(o && o !== n),
  };
}
