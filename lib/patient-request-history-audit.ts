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
