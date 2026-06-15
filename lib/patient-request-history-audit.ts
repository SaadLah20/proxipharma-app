import { isPatientCancelReasonCode, PATIENT_CANCEL_REASON_LABELS } from "@/lib/patient-flow-reasons";

/** Préfixe stocké dans `request_status_history.reason` pour événements structurés côté patient. */
export const HISTORY_AUDIT_V1_PREFIX = "audit_v1:";

/** Nom produit optionnel après `|`, ex. `counter_outcome:picked_up|Doliprane`. */
export function counterOutcomeReasonProductName(reason: string | null | undefined): string | null {
  const r = (reason ?? "").trim();
  const pipe = r.indexOf("|");
  if (pipe < 0) return null;
  const name = r.slice(pipe + 1).trim();
  return name || null;
}

/** Partie technique du motif comptoir (sans le nom produit). */
export function counterOutcomeReasonPayload(reason: string | null | undefined): string {
  const r = (reason ?? "").trim();
  if (!r.startsWith("counter_outcome:")) return r;
  const after = r.slice("counter_outcome:".length);
  const pipe = after.indexOf("|");
  const payload = pipe >= 0 ? after.slice(0, pipe).trim() : after.trim();
  return `counter_outcome:${payload}`;
}

export function formatCounterOutcomeHistoryReason(
  outcome: string,
  productName: string,
  cancelReason?: string | null
): string {
  const nm = productName.trim();
  const suffix = nm ? `|${nm}` : "";
  if (outcome === "cancelled_at_counter" && cancelReason) {
    return `counter_outcome:cancelled_at_counter:${cancelReason}${suffix}`;
  }
  return `counter_outcome:${outcome}${suffix}`;
}

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
  if (audit.lines.length === 0) return "Mise à jour sur votre commande";
  return "La pharmacie a ajusté votre commande validée";
}

/** Détail historique : une phrase = un fait (pas de « · » ni « — »). */
export function patientHistoryAuditDetailLines(
  audit: PharmaConfirmAdjustmentAudit,
  audience: "patient" | "pharmacist" = "patient"
): string[] {
  const ph = audience === "pharmacist";
  const out: string[] = [];
  for (const L of audit.lines) {
    out.push(`Produit : ${L.productName}`);
    const qtyChanged = L.oldAvailQty !== L.newAvailQty;
    const availChanged = (L.oldAvailabilityStatus ?? "").trim() !== (L.newAvailabilityStatus ?? "").trim();
    if (qtyChanged) {
      out.push(
        ph
          ? `Quantité : ${L.oldAvailQty ?? "—"} → ${L.newAvailQty}`
          : `Quantité : ${L.oldAvailQty ?? "—"} → ${L.newAvailQty}`
      );
    }
    if (availChanged) {
      const ol = L.oldAvailLabelFr ?? L.oldAvailabilityStatus ?? "—";
      const nl = L.newAvailLabelFr ?? L.newAvailabilityStatus ?? "—";
      out.push(`Disponibilité : ${ol} → ${nl}`);
    }
    if (!qtyChanged && !availChanged) {
      out.push(ph ? "Modification enregistrée." : "Mise à jour enregistrée.");
    }
  }
  return out;
}

/** Libellés courts pour les codes techniques stockés dans `request_status_history.reason`. */
const PATIENT_HISTORY_TECH_REASON_FR: Record<string, string> = {
  patient_confirm_after_response: "Vous avez validé votre choix et indiqué votre passage en pharmacie.",
  publication_disponibilites: "La pharmacie a publié sa réponse : produits, prix et disponibilités.",
  pharmacien_ui: "La pharmacie a enregistré une mise à jour sur le dossier.",
  patient_planned_visit_updated: "Vous avez modifié la date ou l'heure de passage prévu.",
  pharmacist_response_updated: "La pharmacie a modifié sa réponse avant votre validation.",
  pharmacist_adjustments_after_confirmation: "La pharmacie a ajusté un ou plusieurs produits après votre validation.",
  pharmacist_supply_amendments_saved: "La pharmacie a mis à jour des produits de votre commande validée.",
  pharmacist_proposed_line_removed: "La pharmacie a retiré une proposition de produit.",
  counter_product_added: "Un produit a été ajouté pour le suivi au comptoir.",
  counter_alternative_added: "Une alternative a été ajoutée sur une ligne.",
  counter_alternative_removed: "Une alternative a été retirée.",
  auto_expire_after_response_silence: "Sans réponse de votre part à temps, la demande a expiré.",
  auto_expire_24h_after_response: "Sans réponse de votre part à temps, la demande a expiré.",
  expire_overdue_requests: "Le délai du dossier est dépassé : la demande a expiré.",
  auto_abandon_24h_after_response: "Sans validation de votre part, la demande a été fermée automatiquement.",
  auto_abandon_after_pickup_window:
    "Vous n'êtes pas passé à la date prévue et le délai de 24 h est dépassé sans modification de date.",
  planned_visit_day_reminder: "Rappel envoyé : passage prévu aujourd'hui.",
  planned_visit_pre_passage_reminder: "Rappel envoyé : passage dans environ 2 h.",
  responded_expiry_reminder: "Rappel envoyé : validation en attente.",
  request_created_with_status: "Votre demande a été créée et envoyée à la pharmacie.",
  patient_abandon_request: "Vous avez abandonné la demande.",
  patient_resubmit_product_request_after_response: "Vous avez renvoyé une liste de produits mise à jour.",
  patient_prescription_updated: "Vous avez modifié le scan ou une précision sur votre ordonnance.",
  pharmacist_ui_confirm_close: "La pharmacie a clôturé le dossier après les retraits au comptoir.",
};

/** Libellés `request_event:*` / codes courts — vue officine (historique & résumés). */
const PHARMACIST_HISTORY_TECH_REASON_FR: Record<string, string> = {
  patient_confirm_after_response: "Le patient a validé sa sélection et son passage en pharmacie.",
  publication_disponibilites: "Réponse publiée au patient (prix et disponibilités).",
  pharmacien_ui: "Mise à jour enregistrée sur le dossier.",
  patient_planned_visit_updated: "Le patient a modifié la date ou l'heure de passage.",
  pharmacist_response_updated: "Réponse modifiée avant validation patient.",
  pharmacist_adjustments_after_confirmation: "Ajustements enregistrés après validation patient.",
  pharmacist_supply_amendments_saved: "Modifications supply enregistrées (accord patient).",
  pharmacist_proposed_line_removed: "Proposition de produit retirée du dossier.",
  counter_product_added: "Produit ajouté pour le suivi comptoir.",
  counter_alternative_added: "Alternative ajoutée sur une ligne.",
  counter_alternative_removed: "Alternative retirée.",
  auto_expire_after_response_silence: "Expiration automatique : pas de validation patient à temps.",
  auto_expire_24h_after_response: "Expiration automatique : pas de validation patient à temps.",
  expire_overdue_requests: "Délai dépassé : demande expirée.",
  auto_abandon_24h_after_response: "Fermeture automatique faute de validation patient.",
  auto_abandon_after_pickup_window: "Fermeture automatique : passage non effectué dans les délais.",
  responded_expiry_reminder: "Rappel envoyé : validation patient en attente.",
  responded_expiry_pharmacist_reminder: "Alerte : validation patient imminente (~1 h).",
  planned_visit_day_reminder: "Rappel envoyé au patient : passage prévu aujourd'hui.",
  planned_visit_pre_passage_reminder: "Rappel envoyé au patient : passage dans environ 2 h.",
  planned_visit_passed_no_pickup: "Passage patient non effectué à la date prévue.",
  request_created_with_status: "Demande reçue.",
  patient_abandon_request: "Le patient a abandonné la demande.",
  patient_resubmit_product_request_after_response: "Le patient a renvoyé une liste de produits mise à jour.",
  patient_prescription_updated: "Le patient a modifié le scan ou une précision sur l'ordonnance.",
  pharmacist_ui_confirm_close: "Dossier clôturé après comptoir.",
};

/** Corps après le préfixe `patient_abandon|` (ex. `no_longer_needed|détail`). */
export function formatPatientAbandonReasonForPharmacistFr(rest: string): string[] {
  const segs = rest.split("|").map((s) => s.trim());
  const code = segs[0] ?? "";
  const detail = segs.slice(1).filter(Boolean).join(" ").trim();
  const label =
    isPatientCancelReasonCode(code) ? PATIENT_CANCEL_REASON_LABELS[code] : code ? code.replace(/_/g, " ") : "";
  const lines = [label ? `Abandon côté patient : ${label}` : "Abandon côté patient"];
  if (detail) lines.push(`Précision : ${detail}`);
  return lines;
}

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
  if (r.startsWith("patient_abandon|")) {
    const rest = r.slice("patient_abandon|".length);
    const segs = rest.split("|").map((s) => s.trim());
    const code = segs[0] ?? "";
    const detail = segs.slice(1).filter(Boolean).join(" ").trim();
    const label =
      isPatientCancelReasonCode(code) ? PATIENT_CANCEL_REASON_LABELS[code] : code ? code.replace(/_/g, " ") : "";
    const lines = [label ? `Abandon enregistré : ${label}` : "Abandon enregistré"];
    if (detail) lines.push(`Précision : ${detail}`);
    return lines;
  }
  if (r.startsWith("pharmacist_cancel|")) {
    const motif = r.slice("pharmacist_cancel|".length).trim();
    return [motif ? `La pharmacie a annulé la demande. Précision : ${motif}.` : "La pharmacie a annulé la demande."];
  }
  if (r.startsWith("pharmacist_abandon|")) {
    const motif = r.slice("pharmacist_abandon|".length).trim();
    return [motif ? `La pharmacie a abandonné le dossier. Précision : ${motif}.` : "La pharmacie a abandonné le dossier."];
  }
  if (r.startsWith("pharmacist_abandon_no_pickup|")) {
    return ["La pharmacie a abandonné le dossier (aucun retrait au comptoir)."];
  }
  if (r.startsWith("planned_visit_day_reminder|")) {
    return [PATIENT_HISTORY_TECH_REASON_FR.planned_visit_day_reminder];
  }
  if (r.startsWith("planned_visit_pre_passage_reminder|")) {
    return [PATIENT_HISTORY_TECH_REASON_FR.planned_visit_pre_passage_reminder];
  }
  if (r.startsWith("planned_visit_passed_no_pickup|")) {
    return ["Passage prévu non effectué — le délai de clôture automatique est en cours."];
  }
  if (r.startsWith("counter_outcome:")) {
    const product = counterOutcomeReasonProductName(r);
    const rest = counterOutcomeReasonPayload(r).slice("counter_outcome:".length).trim();
    const productLine = product ? `Produit : ${product}.` : null;
    if (rest === "picked_up") {
      return [productLine, "Produit enregistré comme retiré au comptoir."].filter(Boolean) as string[];
    }
    if (rest === "unset") {
      return [productLine, "Suivi comptoir remis en attente sur cette ligne."].filter(Boolean) as string[];
    }
    if (rest.startsWith("cancelled_at_counter")) {
      const tail = rest.slice("cancelled_at_counter".length).replace(/^:/, "").trim();
      return [
        productLine,
        tail
          ? `Annulation au comptoir enregistrée. Motif : ${tail}.`
          : "Annulation au comptoir enregistrée sur cette ligne.",
      ].filter(Boolean) as string[];
    }
    return [productLine, "Mise à jour du suivi comptoir pour cette ligne."].filter(Boolean) as string[];
  }
  if (r.startsWith("pharmacist_supply_amendments_saved")) {
    return [PATIENT_HISTORY_TECH_REASON_FR.pharmacist_supply_amendments_saved];
  }
  if (r === "pharmacist_adjustments_after_confirmation") {
    return [PATIENT_HISTORY_TECH_REASON_FR.pharmacist_adjustments_after_confirmation];
  }
  if (r.startsWith("request_event:")) {
    const key = r.slice("request_event:".length).trim().toLowerCase();
    const mapped = PATIENT_HISTORY_TECH_REASON_FR[key];
    if (mapped) return [mapped];
    return ["Un événement a été enregistré sur le dossier."];
  }
  if (/^[a-z][a-z0-9_]*$/i.test(r) && r.length < 120) {
    const mapped = PATIENT_HISTORY_TECH_REASON_FR[r.toLowerCase()];
    if (mapped) return [mapped];
    return ["Une mise à jour a été enregistrée sur le dossier."];
  }
  if (/[a-z][a-z0-9_]{3,}/i.test(r)) {
    return ["Une mise à jour a été enregistrée sur le dossier."];
  }
  return [r];
}

/**
 * Texte lisible pour une entrée d’historique dossier (pharmacien) — pas de tutoiement « votre part »
 * pour les expirations ; codes `patient_abandon|…` traduits.
 */
export function pharmacistDossierHistoryDetailParagraphsFr(reason: string | null | undefined): string[] {
  const audit = tryParsePatientHistoryAudit(reason);
  if (audit) return patientHistoryAuditDetailLines(audit, "pharmacist");
  const r = (reason ?? "").trim();
  if (!r) return [];
  if (r.startsWith("patient_abandon|")) {
    return formatPatientAbandonReasonForPharmacistFr(r.slice("patient_abandon|".length));
  }
  if (r.startsWith("pharmacist_cancel|")) {
    const motif = r.slice("pharmacist_cancel|".length).trim();
    return [motif ? `Annulation officine enregistrée. Précision : ${motif}.` : "Annulation officine enregistrée."];
  }
  if (r.startsWith("pharmacist_abandon|")) {
    const motif = r.slice("pharmacist_abandon|".length).trim();
    return [motif ? `Abandon officine enregistré. Précision : ${motif}.` : "Abandon officine enregistré."];
  }
  if (r.startsWith("pharmacist_abandon_no_pickup|")) {
    return ["Dossier abandonné : toutes les lignes retenues étaient écartées, sans retrait comptoir."];
  }
  if (r.startsWith("planned_visit_passed_no_pickup|")) {
    return [PHARMACIST_HISTORY_TECH_REASON_FR.planned_visit_passed_no_pickup];
  }
  if (r.startsWith("planned_visit_day_reminder|") || r.startsWith("planned_visit_pre_passage_reminder|")) {
    return ["Rappel passage patient enregistré sur le dossier."];
  }
  if (r === "responded_expiry_pharmacist_reminder") {
    return [PHARMACIST_HISTORY_TECH_REASON_FR.responded_expiry_pharmacist_reminder];
  }
  if (r.startsWith("counter_outcome:")) {
    const product = counterOutcomeReasonProductName(r);
    const rest = counterOutcomeReasonPayload(r).slice("counter_outcome:".length).trim();
    const productLine = product ? `Produit : ${product}.` : null;
    if (rest === "picked_up") {
      return [productLine, "Produit enregistré comme retiré au comptoir."].filter(Boolean) as string[];
    }
    if (rest === "unset") {
      return [productLine, "Suivi comptoir remis en attente sur cette ligne."].filter(Boolean) as string[];
    }
    if (rest.startsWith("cancelled_at_counter")) {
      const tail = rest.slice("cancelled_at_counter".length).replace(/^:/, "").trim();
      return [
        productLine,
        tail
          ? `Annulation au comptoir enregistrée. Motif : ${tail}.`
          : "Annulation au comptoir enregistrée sur cette ligne.",
      ].filter(Boolean) as string[];
    }
    return [productLine, "Mise à jour du suivi comptoir pour cette ligne."].filter(Boolean) as string[];
  }
  if (r.startsWith("pharmacist_supply_amendments_saved")) {
    return [PHARMACIST_HISTORY_TECH_REASON_FR.pharmacist_supply_amendments_saved];
  }
  if (r === "pharmacist_adjustments_after_confirmation") {
    return [PHARMACIST_HISTORY_TECH_REASON_FR.pharmacist_adjustments_after_confirmation];
  }
  if (r.startsWith("request_event:")) {
    const key = r.slice("request_event:".length).trim().toLowerCase();
    const mapped = PHARMACIST_HISTORY_TECH_REASON_FR[key];
    if (mapped) return [mapped];
    return ["Événement enregistré sur le dossier."];
  }
  if (/^[a-z][a-z0-9_]*$/i.test(r) && r.length < 120) {
    const mapped = PHARMACIST_HISTORY_TECH_REASON_FR[r.toLowerCase()];
    if (mapped) return [mapped];
    return ["Mise à jour enregistrée sur le dossier."];
  }
  if (/[a-z][a-z0-9_]{3,}/i.test(r)) {
    return ["Mise à jour enregistrée sur le dossier."];
  }
  return [r];
}

/** Résumé court pour bannière « sans suite » (motif brut issu de l’historique). */
export function pharmacistHardStopMotifSummaryFr(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim();
  if (!t) return null;
  if (t.startsWith("patient_abandon|")) {
    return formatPatientAbandonReasonForPharmacistFr(t.slice("patient_abandon|".length)).join(" ");
  }
  const paras = pharmacistDossierHistoryDetailParagraphsFr(t);
  if (paras.length > 0 && paras.some((p) => p.trim().length > 0)) {
    return paras.filter(Boolean).join(" ");
  }
  if (t.length > 280) return `${t.slice(0, 276)}…`;
  return t;
}
