import {
  effectiveAvailabilityForPatientLine,
  effectiveEtaForPatientLine,
  type PatientLineLike,
} from "@/lib/patient-confirmed-line-buckets";
import { formatDateShortFr, formatDateTimeShort24hFr } from "@/lib/datetime-fr";
import { counterOutcomePatientLabel } from "@/lib/request-display";
import type { SupplyAmendmentEntryJson } from "@/lib/supply-amendment-channels";
import { supplyAmendChannelLabel } from "@/lib/supply-amendment-channels";
import { isPatientAjoutOfficineLine } from "@/lib/supply-line-post-confirm";

export type PatientLineSuiviModel = {
  etat: string;
  /** Ligne « Modifiée le … » avec canal / description si présents */
  modif: string | null;
  /** Mention ajout officine */
  ajout: string | null;
  /** Retrait comptoir (lignes retenues actives) */
  comptoir: string | null;
};

function comptoirSuiviLine(row: PatientLineLike): string | null {
  if (!row.is_selected_by_patient || row.withdrawn_after_confirm) return null;
  const co = row.counter_outcome ?? "unset";
  return `Comptoir · ${counterOutcomePatientLabel(co, row.counter_cancel_reason)}`;
}

function latestAmendmentLineForRow(
  row: PatientLineLike,
  bundles: { created_at: string; amendments: unknown }[]
): string | null {
  let bestTs = -1;
  let bestText: string | null = null;
  for (const b of bundles) {
    const arr = Array.isArray(b.amendments) ? (b.amendments as SupplyAmendmentEntryJson[]) : [];
    for (const e of arr) {
      if (e.request_item_id !== row.id) continue;
      const base = [e.detail, e.summary].find((x) => x != null && String(x).trim() !== "");
      const baseStr = base != null ? String(base).trim() : "";
      const ch = e.client_confirmation_channel?.trim()
        ? supplyAmendChannelLabel(e.client_confirmation_channel)
        : null;
      const mot = e.client_motive?.trim();
      const parts: string[] = [];
      if (baseStr) parts.push(baseStr);
      const meta: string[] = [];
      if (ch) meta.push(`canal : ${ch}`);
      if (mot) meta.push(`description : ${mot}`);
      if (meta.length) parts.push(meta.join(" · "));
      const lineBody = parts.join(" · ");
      if (!lineBody) continue;
      const ts = new Date(b.created_at).getTime();
      if (ts >= bestTs) {
        bestTs = ts;
        bestText = `Modifiée le ${formatDateTimeShort24hFr(b.created_at)} : ${lineBody}`;
      }
    }
  }
  return bestText;
}

/** Texte court pour le bandeau suivi patient (confirmé / en préparation). */
export function patientLineSuiviModel(
  row: PatientLineLike,
  bundles: { created_at: string; amendments: unknown }[],
  opts?: { pharmacistProposedHint?: string }
): PatientLineSuiviModel {
  const modif = latestAmendmentLineForRow(row, bundles);
  const ajout = isPatientAjoutOfficineLine(row)
    ? (opts?.pharmacistProposedHint ?? "Proposition par la pharmacie (ajout officine).")
    : null;

  if (row.withdrawn_after_confirm) {
    return {
      etat: "Écart après validation (hors commande active)",
      modif,
      ajout,
      comptoir: null,
    };
  }

  const eff = effectiveAvailabilityForPatientLine(row);
  const pcf = row.post_confirm_fulfillment ?? "unset";
  const eta = effectiveEtaForPatientLine(row);

  let etat = "En attente";
  if (eff === "available" || eff === "partially_available") {
    etat = pcf === "reserved" ? "Réservé à la pharmacie" : "En attente de réservation à la pharmacie";
  } else if (eff === "to_order") {
    if (pcf === "arrived_reserved") {
      etat = "Reçu en officine · prêt au comptoir";
    } else if (pcf === "ordered") {
      etat = "Commandé";
    } else {
      etat =
        eta != null
          ? `En attente (commande) · dispo indicative ${formatDateShortFr(eta)}`
          : "En attente (commande fournisseur)";
    }
  } else {
    etat = "Suivi avec l’officine";
  }

  return { etat, modif, ajout, comptoir: comptoirSuiviLine(row) };
}
