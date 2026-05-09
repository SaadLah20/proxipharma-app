/** Préfixe stocké dans `request_status_history.reason` pour événements structurés côté patient. */
export const HISTORY_AUDIT_V1_PREFIX = "audit_v1:";

/** Ajustements enregistrés après validation patient (`confirmed`). */
export type PharmaConfirmAdjustmentLine = {
  productName: string;
  validatedQty: number;
  oldAvailQty: number | null;
  newAvailQty: number;
  oldAvailabilityStatus: string | null;
  newAvailabilityStatus: string;
  /** Libellés français déjà résolus au moment du log */
  oldAvailLabelFr?: string | null;
  newAvailLabelFr?: string | null;
};

export type PharmaConfirmAdjustmentAudit = {
  v: 1;
  kind: "pharma_adjust_confirmed";
  lines: PharmaConfirmAdjustmentLine[];
};

export function stringifyPharmaConfirmAudit(audit: PharmaConfirmAdjustmentAudit): string {
  return `${HISTORY_AUDIT_V1_PREFIX}${JSON.stringify(audit)}`;
}

export function tryParsePatientHistoryAudit(reason: string | null | undefined): PharmaConfirmAdjustmentAudit | null {
  if (!reason || !reason.startsWith(HISTORY_AUDIT_V1_PREFIX)) return null;
  try {
    const raw = JSON.parse(reason.slice(HISTORY_AUDIT_V1_PREFIX.length).trim()) as unknown;
    if (!raw || typeof raw !== "object") return null;
    const obj = raw as Record<string, unknown>;
    if (obj.v !== 1 || obj.kind !== "pharma_adjust_confirmed") return null;
    const lines = obj.lines;
    if (!Array.isArray(lines)) return null;
    return { v: 1, kind: "pharma_adjust_confirmed", lines: lines as PharmaConfirmAdjustmentLine[] };
  } catch {
    return null;
  }
}

/** Titre carte historique patient. */
export function patientHistoryAuditTitle(audit: PharmaConfirmAdjustmentAudit): string {
  if (audit.lines.length === 0) return "Mise à jour du dossier";
  return "Préparation pharmacie mise à jour";
}

/** Détail lisible patient (une entrée par ligne modifiée). */
export function patientHistoryAuditDetailLines(audit: PharmaConfirmAdjustmentAudit): string[] {
  return audit.lines.map((L) => {
    const parts: string[] = [];
    const qtyChanged = L.oldAvailQty !== L.newAvailQty;
    const availChanged = (L.oldAvailabilityStatus ?? "").trim() !== (L.newAvailabilityStatus ?? "").trim();
    parts.push(`${L.productName} — votre validation : ${L.validatedQty} unité(s).`);
    if (qtyChanged) {
      parts.push(
        `Quantité suivie au comptoir/préparation : ${L.oldAvailQty ?? "?"} → ${L.newAvailQty}${L.newAvailQty > L.validatedQty ? " — la pharmacie a augmenté cette quantité (ex. rupture puis solution)." : ""}${L.newAvailQty < L.validatedQty ? " — la pharmacie propose moins pour cette ligne." : ""}`
      );
    }
    if (availChanged) {
      const ol = L.oldAvailLabelFr ?? L.oldAvailabilityStatus ?? "—";
      const nl = L.newAvailLabelFr ?? L.newAvailabilityStatus ?? "—";
      parts.push(`Disponibilité indiquée : ${ol} → ${nl}.`);
    }
    return parts.join(" ");
  });
}

/** Libellés courts pour les codes techniques stockés dans `request_status_history.reason`. */
const PATIENT_HISTORY_TECH_REASON_FR: Record<string, string> = {
  patient_confirm_after_response: "Vous avez validé votre choix et enregistré votre passage en pharmacie.",
  publication_disponibilites: "La pharmacie a publié sa réponse (disponibilités et prix).",
  pharmacien_ui: "Action enregistrée depuis l’espace pharmacien.",
  patient_planned_visit_updated: "Votre date ou heure de passage a été mise à jour.",
  pharmacist_response_updated: "La pharmacie a mis à jour sa réponse sur la demande.",
  auto_abandon_24h_after_response: "La demande a expiré : pas de validation de votre part dans les 24 h.",
  request_created_with_status: "Demande créée et transmise.",
  patient_abandon_request: "Vous avez annulé la demande.",
  patient_resubmit_product_request_after_response: "Vous avez renvoyé une liste de produits mise à jour.",
  pharmacist_ui_confirm_close: "La pharmacie a clôturé le dossier depuis son espace.",
};

/**
 * Texte lisible pour une entrée d’historique dossier (patient).
 * — blocs structurés `audit_v1:` ;
 * — motifs techniques connus ;
 * — sinon texte libre tel quel.
 */
export function patientDossierHistoryDetailParagraphsFr(reason: string | null | undefined): string[] {
  const audit = tryParsePatientHistoryAudit(reason);
  if (audit) return patientHistoryAuditDetailLines(audit);
  const r = (reason ?? "").trim();
  if (!r) return [];
  if (r.startsWith("pharmacist_cancel|")) {
    const motif = r.slice("pharmacist_cancel|".length).trim();
    return [motif ? `La pharmacie a annulé la demande. Précision : ${motif}.` : "La pharmacie a annulé la demande."];
  }
  if (r.startsWith("request_event:")) {
    const key = r.slice("request_event:".length).trim().toLowerCase();
    const mapped = PATIENT_HISTORY_TECH_REASON_FR[key];
    if (mapped) return [mapped];
    return ["Événement enregistré sur le dossier."];
  }
  if (/^[a-z][a-z0-9_]*$/i.test(r) && r.length < 120) {
    const mapped = PATIENT_HISTORY_TECH_REASON_FR[r.toLowerCase()];
    if (mapped) return [mapped];
    return ["Mise à jour enregistrée sur le dossier."];
  }
  return [r];
}
