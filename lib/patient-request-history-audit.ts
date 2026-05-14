import { isPatientCancelReasonCode, PATIENT_CANCEL_REASON_LABELS } from "@/lib/patient-flow-reasons";

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
  if (audit.lines.length === 0) return "Mise à jour sur votre commande";
  return "La pharmacie a ajusté votre commande validée";
}

/** Détail lisible patient (une entrée par ligne modifiée). */
export function patientHistoryAuditDetailLines(audit: PharmaConfirmAdjustmentAudit): string[] {
  return audit.lines.map((L) => {
    const parts: string[] = [];
    const qtyChanged = L.oldAvailQty !== L.newAvailQty;
    const availChanged = (L.oldAvailabilityStatus ?? "").trim() !== (L.newAvailabilityStatus ?? "").trim();
    parts.push(`${L.productName} — quantité retenue à la validation : ${L.validatedQty} unité(s).`);
    if (qtyChanged) {
      parts.push(
        `Quantité suivie par la pharmacie : ${L.oldAvailQty ?? "?"} → ${L.newAvailQty}${L.newAvailQty > L.validatedQty ? " (la pharmacie propose plus, par exemple après une rupture puis une solution)." : ""}${L.newAvailQty < L.validatedQty ? " (la pharmacie propose moins sur cette ligne.)" : ""}`
      );
    }
    if (availChanged) {
      const ol = L.oldAvailLabelFr ?? L.oldAvailabilityStatus ?? "—";
      const nl = L.newAvailLabelFr ?? L.newAvailabilityStatus ?? "—";
      parts.push(`Disponibilité communiquée : ${ol} → ${nl}.`);
    }
    return parts.join(" ");
  });
}

/** Libellés courts pour les codes techniques stockés dans `request_status_history.reason`. */
const PATIENT_HISTORY_TECH_REASON_FR: Record<string, string> = {
  patient_confirm_after_response: "Vous avez validé votre choix et enregistré votre passage en pharmacie.",
  publication_disponibilites: "La pharmacie a publié sa réponse (prix et disponibilités).",
  pharmacien_ui: "Mise à jour enregistrée par la pharmacie.",
  patient_planned_visit_updated: "Votre date ou heure de passage a été modifiée.",
  pharmacist_response_updated: "La pharmacie a mis à jour sa réponse.",
  auto_expire_after_response_silence:
    "Sans validation de votre part dans le délai prévu, la demande a expiré.",
  auto_expire_24h_after_response:
    "Sans validation de votre part dans le délai prévu, la demande a expiré.",
  expire_overdue_requests: "La date limite du dossier est dépassée : la demande a expiré.",
  auto_abandon_24h_after_response: "Sans validation de votre part, la demande a été fermée automatiquement.",
  request_created_with_status: "Demande créée et envoyée.",
  patient_abandon_request: "Vous avez abandonné la demande.",
  patient_resubmit_product_request_after_response: "Vous avez renvoyé une liste de produits mise à jour.",
  pharmacist_ui_confirm_close: "La pharmacie a clôturé le dossier après le passage au comptoir.",
};

/** Libellés `request_event:*` / codes courts — vue officine (historique & résumés). */
const PHARMACIST_HISTORY_TECH_REASON_FR: Record<string, string> = {
  patient_confirm_after_response: "Le patient a validé son choix et enregistré son passage.",
  publication_disponibilites: "Réponse publiée (prix et disponibilités).",
  pharmacien_ui: "Mise à jour enregistrée.",
  patient_planned_visit_updated: "Date ou heure de passage modifiée par le patient.",
  pharmacist_response_updated: "Réponse pharmacie mise à jour.",
  auto_expire_after_response_silence:
    "Sans validation du patient dans le délai prévu, la demande a expiré.",
  auto_expire_24h_after_response:
    "Sans validation du patient dans le délai prévu, la demande a expiré.",
  expire_overdue_requests: "Délai du dossier dépassé : la demande a expiré.",
  auto_abandon_24h_after_response:
    "Fermeture automatique : pas de validation du patient dans le délai prévu.",
  request_created_with_status: "Demande créée.",
  patient_abandon_request: "Le patient a abandonné la demande.",
  patient_resubmit_product_request_after_response: "Le patient a renvoyé une liste de produits mise à jour.",
  pharmacist_ui_confirm_close: "Dossier clôturé après passage au comptoir.",
};

/** Corps après le préfixe `patient_abandon|` (ex. `no_longer_needed|détail`). */
export function formatPatientAbandonReasonForPharmacistFr(rest: string): string {
  const segs = rest.split("|").map((s) => s.trim());
  const code = segs[0] ?? "";
  const detail = segs.slice(1).filter(Boolean).join(" ").trim();
  const label =
    isPatientCancelReasonCode(code) ? PATIENT_CANCEL_REASON_LABELS[code] : code ? code.replace(/_/g, " ") : "";
  const head = label ? `Abandon côté patient · ${label}` : "Abandon côté patient.";
  if (detail) return `${head} Précision : ${detail}.`;
  return `${head}`;
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
    const head = label ? `Abandon enregistré · ${label}` : "Abandon enregistré.";
    if (detail) return [`${head} Précision : ${detail}.`];
    return [head];
  }
  if (r.startsWith("pharmacist_cancel|")) {
    const motif = r.slice("pharmacist_cancel|".length).trim();
    return [motif ? `La pharmacie a annulé la demande. Précision : ${motif}.` : "La pharmacie a annulé la demande."];
  }
  if (r.startsWith("counter_outcome:")) {
    const rest = r.slice("counter_outcome:".length).trim();
    if (rest === "picked_up") {
      return ["Produit enregistré comme retiré au comptoir."];
    }
    if (rest === "unset") {
      return ["Suivi comptoir remis en attente sur cette ligne."];
    }
    if (rest.startsWith("cancelled_at_counter")) {
      const tail = rest.slice("cancelled_at_counter".length).replace(/^:/, "").trim();
      return [
        tail
          ? `Annulation au comptoir enregistrée. Motif : ${tail}.`
          : "Annulation au comptoir enregistrée sur cette ligne.",
      ];
    }
    return ["Mise à jour du suivi comptoir pour cette ligne."];
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

/**
 * Texte lisible pour une entrée d’historique dossier (pharmacien) — pas de tutoiement « votre part »
 * pour les expirations ; codes `patient_abandon|…` traduits.
 */
export function pharmacistDossierHistoryDetailParagraphsFr(reason: string | null | undefined): string[] {
  const audit = tryParsePatientHistoryAudit(reason);
  if (audit) return patientHistoryAuditDetailLines(audit);
  const r = (reason ?? "").trim();
  if (!r) return [];
  if (r.startsWith("patient_abandon|")) {
    return [formatPatientAbandonReasonForPharmacistFr(r.slice("patient_abandon|".length))];
  }
  if (r.startsWith("pharmacist_cancel|")) {
    const motif = r.slice("pharmacist_cancel|".length).trim();
    return [motif ? `Annulation officine enregistrée. Précision : ${motif}.` : "Annulation officine enregistrée."];
  }
  if (r.startsWith("counter_outcome:")) {
    const rest = r.slice("counter_outcome:".length).trim();
    if (rest === "picked_up") {
      return ["Produit enregistré comme retiré au comptoir."];
    }
    if (rest === "unset") {
      return ["Suivi comptoir remis en attente sur cette ligne."];
    }
    if (rest.startsWith("cancelled_at_counter")) {
      const tail = rest.slice("cancelled_at_counter".length).replace(/^:/, "").trim();
      return [
        tail
          ? `Annulation au comptoir enregistrée. Motif : ${tail}.`
          : "Annulation au comptoir enregistrée sur cette ligne.",
      ];
    }
    return ["Mise à jour du suivi comptoir pour cette ligne."];
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
  return [r];
}

/** Résumé court pour bannière « sans suite » (motif brut issu de l’historique). */
export function pharmacistHardStopMotifSummaryFr(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim();
  if (!t) return null;
  if (t.startsWith("patient_abandon|")) {
    return formatPatientAbandonReasonForPharmacistFr(t.slice("patient_abandon|".length));
  }
  const paras = pharmacistDossierHistoryDetailParagraphsFr(t);
  if (paras.length > 0 && paras.some((p) => p.trim().length > 0)) {
    return paras.filter(Boolean).join(" ");
  }
  if (t.length > 280) return `${t.slice(0, 276)}…`;
  return t;
}
