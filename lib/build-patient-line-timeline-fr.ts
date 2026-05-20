import { formatDateShortFr, formatDateTimeShort24hFr } from "@/lib/datetime-fr";
import {
  effectiveAvailabilityForPatientLine,
  effectiveEtaForPatientLine,
  type PatientLineLike,
  validatedProductLabel,
} from "@/lib/patient-confirmed-line-buckets";
import {
  tryParsePatientHistoryAudit,
  patientHistoryAuditDetailLines,
  patientHistoryAuditTitle,
  patientDossierHistoryDetailParagraphsFr,
} from "@/lib/patient-request-history-audit";
import type { SupplyAmendmentEntryJson } from "@/lib/supply-amendment-channels";
import { summarizeSupplyAmendmentEntry } from "@/lib/supply-amendment-channels";
import {
  availabilityStatusFr,
  counterOutcomePatientLabel,
  requestStatusFr,
} from "@/lib/request-display";
export type PatientLineTimelineBlockFr = {
  id: string;
  atIso: string | null;
  /** Résumé courte date affichée */
  atLabel: string;
  title: string;
  body: string;
  actorLabel: string;
  /** Bloc état présent en bas */
  isCurrent?: boolean;
};

function oneProdAlt(p: unknown): { name?: string | null } | undefined {
  if (!p) return undefined;
  return Array.isArray(p) ? (p[0] as { name?: string | null }) : (p as { name?: string | null });
}

function principalName(row: PatientLineLike): string {
  return oneProdAlt(row.products)?.name?.trim() || "Produit";
}

export function normalizedProductTokensForTimeline(row: PatientLineLike): { principal: string; validated: string } {
  const principal = principalName(row).toLowerCase();
  const validated = validatedProductLabel(row).toLowerCase().trim();
  return { principal, validated };
}

function productMatchesTimeline(row: PatientLineLike, auditProductName: string): boolean {
  const { principal, validated } = normalizedProductTokensForTimeline(row);
  const raw = auditProductName.toLowerCase().trim();
  return raw === validated || raw === principal;
}

/** Entrées `request_supply_amendments` concernant cette ligne. */
export function amendmentsForPatientLine(row: PatientLineLike, bundles: { id: string; created_at: string; amendments: unknown }[]) {
  const out: { created_at: string; entry: SupplyAmendmentEntryJson }[] = [];
  for (const b of bundles) {
    const arr = Array.isArray(b.amendments) ? (b.amendments as SupplyAmendmentEntryJson[]) : [];
    for (const e of arr) {
      if (e.request_item_id === row.id) {
        out.push({ created_at: b.created_at, entry: e });
      }
    }
  }
  return out.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

/** Libellés courts sur la carte produit (détail complet dans « Historique produit »). Ordre chronologique des types rencontrés. */
export function postConfirmSupplyAmendmentBadgeLabelsFr(
  row: PatientLineLike,
  bundles: { id: string; created_at: string; amendments: unknown }[]
): string[] {
  const list = amendmentsForPatientLine(row, bundles);
  const labelForKind = (kind: string | undefined): string | null => {
    switch (kind) {
      case "line_adjust_supply":
        return "Modifié après votre accord";
      case "line_added_after_confirm":
        return "Ajouté par la pharmacie";
      case "line_removed_after_confirm":
        return "Retiré par la pharmacie";
      case "withdraw_after_confirm":
        return "Retiré de la commande active";
      case "reintegrate_after_confirm":
      case "reintegrate":
        return "Réintégré";
      case "line_brought_to_reserve_after_validation":
        return "Replacé en « à réserver »";
      case "validated_qty_change":
        return "Quantité ajustée";
      default:
        return kind ? "Mise à jour" : null;
    }
  };
  const seen = new Set<string>();
  const out: string[] = [];
  for (const { entry } of list) {
    const k = (entry.kind ?? "").trim();
    if (!k || seen.has(k)) continue;
    const lab = labelForKind(k);
    if (!lab) continue;
    seen.add(k);
    out.push(lab);
  }
  return out;
}

export type PatientLineTimelineInputs = {
  row: PatientLineLike;
  requestCreatedAt: string;
  requestSubmittedAt: string | null;
  requestRespondedAt: string | null;
  requestConfirmedAt: string | null;
  supplyBundles: { id: string; created_at: string; amendments: unknown }[];
  /** `request_status_history` côté patient (filtre audit produit automatique). */
  dossierHistory?: { created_at: string; old_status: string | null; new_status: string; reason: string | null }[];
  /** Par défaut libellés patient ; passer `pharmacistDossierHistoryDetailParagraphsFr` pour l’officine. */
  dossierHistoryDetailParagraphs?: (reason: string | null | undefined) => string[];
  /** Ex. « Produit saisi depuis l’ordonnance » (ordonnance) vs « Produit proposé par la pharmacie ». */
  pharmacistProposedOriginLabel?: string;
  /** Ex. « Saisi depuis l’ordonnance » pour `patient_request` sur ordonnance. */
  patientLineOriginLabel?: string;
  /** Historique produit côté officine : formulations « le patient a… ». */
  timelineAudience?: "patient" | "pharmacist";
};

/** Chronologie du plus ancien (haut) au plus récent (bas). Dernier bloc = situation actuelle. */
export function buildPatientLineTimelineFr(input: PatientLineTimelineInputs): PatientLineTimelineBlockFr[] {
  const { row } = input;
  const ph = input.timelineAudience === "pharmacist";
  const amendList = amendmentsForPatientLine(row, input.supplyBundles);
  const histAsc = [...(input.dossierHistory ?? [])].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const historyParas = input.dossierHistoryDetailParagraphs ?? patientDossierHistoryDetailParagraphsFr;
  const blocks: PatientLineTimelineBlockFr[] = [];
  let idx = 0;
  const push = (
    atIso: string | null,
    title: string,
    body: string,
    actorLabel: string,
    isCurrent?: boolean
  ) => {
    const atLabel = atIso ? formatDateTimeShort24hFr(atIso) : "—";
    blocks.push({
      id: `${++idx}-${title}`,
      atIso,
      atLabel,
      title,
      body,
      actorLabel,
      isCurrent,
    });
  };

  /** Origine */
  const t0 = input.requestSubmittedAt ?? input.requestCreatedAt;
  const originParts: string[] = [];
  const pname = principalName(row);
  if (row.line_source === "pharmacist_proposed") {
    const originLabel = input.pharmacistProposedOriginLabel ?? "Produit proposé par la pharmacie";
    originParts.push(
      `${originLabel} (« ${row.pharmacist_proposal_reason?.trim() || "précision à lire sur la ligne"} »).`
    );
    originParts.push(`Référence : ${pname} · ${row.requested_qty} unité(s).`);
  } else {
    const patientOrigin = input.patientLineOriginLabel?.trim();
    originParts.push(
      patientOrigin
        ? `${patientOrigin} : ${pname} · ${row.requested_qty} unité(s) prescrite(s).`
        : `Produit demandé : ${pname} · ${row.requested_qty} unité(s).`
    );
  }
  if (row.client_comment?.trim()) {
    originParts.push(
      ph ? `Précision patient : ${row.client_comment.trim()}` : `Votre précision : ${row.client_comment.trim()}`
    );
  }
  push(t0, ph ? "Demande reçue" : "Demande envoyée", originParts.join("\n"), ph ? "Le patient" : "Vous");

  /** Réponse officine (instantanée réponse dossier). */
  if (input.requestRespondedAt) {
    const rp: string[] = [];
    const availLab = row.availability_status
      ? availabilityStatusFr[row.availability_status] ?? row.availability_status
      : "—";
    rp.push(
      ph
        ? `Vous avez indiqué sur le principal : ${availLab}`
        : `Sur le produit principal : ${availLab}`
    );
    if (row.unit_price != null) {
      rp.push(
        ph
          ? `Prix indiqué sur le principal : ${Number(row.unit_price).toFixed(2)} MAD`
          : `Prix indiqué sur le principal : ${Number(row.unit_price).toFixed(2)} MAD`
      );
    }
    if (row.expected_availability_date && row.availability_status === "to_order") {
      rp.push(`Indication de réception : ${formatDateShortFr(row.expected_availability_date)}`);
    }
    if (row.pharmacist_comment?.trim()) {
      rp.push(
        ph
          ? `Votre note sur cette ligne : ${row.pharmacist_comment.trim()}`
          : `Message de la pharmacie sur cette ligne : ${row.pharmacist_comment.trim()}`
      );
    }
    const altRaw = row.request_item_alternatives;
    const alts = !altRaw ? [] : Array.isArray(altRaw) ? [...altRaw] : [altRaw];
    if (Array.isArray(alts) && alts.length > 0) {
      rp.push(
        ph
          ? `Des alternatives ont été proposées au patient (${alts.length}).`
          : `Des options alternatives vous sont aussi proposées sur la page de validation (${alts.length}).`
      );
    }
    push(
      input.requestRespondedAt,
      ph ? "Réponse enregistrée" : "La pharmacie a répondu",
      rp.join("\n"),
      ph ? "Vous" : "La pharmacie"
    );
  }

  /** Validation patient */
  if (row.is_selected_by_patient && input.requestConfirmedAt) {
    const chosenId = row.patient_chosen_alternative_id ?? null;
    let choiceTxt: string;
    if (chosenId) {
      choiceTxt = ph
        ? `Le patient a retenu l’alternative « ${validatedProductLabel(row)} » (référence initiale : ${principalName(row)}).`
        : `Vous retenez l’alternative « ${validatedProductLabel(row)} » (référence initiale dans la liste : ${principalName(row)}).`;
    } else {
      choiceTxt = ph
        ? `Le patient a retenu le produit principal « ${validatedProductLabel(row)} ».`
        : `Vous retenez le produit principal « ${validatedProductLabel(row)} ».`;
    }
    const qty = row.selected_qty ?? row.requested_qty;
    push(
      input.requestConfirmedAt,
      ph ? "Le patient a validé cette ligne" : "Vous avez validé cette ligne",
      `${choiceTxt}\nQuantité retenue : ${qty}.`,
      ph ? "Le patient" : "Vous"
    );
  } else if (input.requestConfirmedAt && !row.is_selected_by_patient) {
    push(
      input.requestConfirmedAt,
      ph ? "Ligne non retenue par le patient" : "Ligne non retenue lors de votre validation",
      ph
        ? "Ce produit ne fait pas partie de la commande validée par le patient (trace conservée)."
        : "Ce produit ne fait pas partie de votre commande validée (trace conservée).",
      ph ? "Le patient" : "Vous"
    );
  }

  /** Historique dossier avec audit lignes pertinentes */
  for (const h of histAsc) {
    const audit = tryParsePatientHistoryAudit(h.reason);
    if (!audit) continue;
    const linesDetail = audit.lines.filter((L) => productMatchesTimeline(row, L.productName));
    if (linesDetail.length === 0) continue;
    const subAudit = { ...audit, lines: linesDetail };
    const details = patientHistoryAuditDetailLines(subAudit).join("\n");
    push(h.created_at, patientHistoryAuditTitle(subAudit), details, "La pharmacie");
  }

  /** Ajustements post-validation (JSON amendements avec request_item_id) */
  for (const am of amendList) {
    push(
      am.created_at,
      ph ? "Changement après accord du patient" : "Changement après votre accord",
      summarizeSupplyAmendmentEntry(am.entry),
      "La pharmacie"
    );
  }

  /** Entrées d’historique statut dossier hors audit (filtre léger si la raison cite le nom produit ou l’uuid — rare). */
  for (const h of histAsc) {
    if (tryParsePatientHistoryAudit(h.reason)) continue;
    const r = `${h.reason ?? ""}`.toLowerCase();
    if (!r) continue;
    if (!r.includes(row.id.toLowerCase()) && !r.includes(validatedProductLabel(row).toLowerCase())) continue;
    const statusLine = `${h.old_status ? `Étape précédente : ${requestStatusFr[h.old_status] ?? h.old_status} → ` : ""}${requestStatusFr[h.new_status] ?? h.new_status}`;
    const detail = historyParas(h.reason).filter(Boolean).join("\n");
    const body = detail.trim() !== "" ? detail : statusLine;
    push(h.created_at, "Mise à jour du dossier", body, "La pharmacie");
  }

  /** État actuel */
  const eff = effectiveAvailabilityForPatientLine(row);
  const eta = effectiveEtaForPatientLine(row);
  const curParts: string[] = [];
  curParts.push(`Produit : ${validatedProductLabel(row)}`);
  if (row.is_selected_by_patient) {
    curParts.push(`Quantité retenue : ${row.selected_qty ?? row.requested_qty}`);
    curParts.push(`Disponibilité affichée : ${eff ? availabilityStatusFr[eff] ?? eff : "—"}`);
    if (eff === "to_order" && eta) curParts.push(`Indication de disponibilité : ${formatDateShortFr(eta)}`);
    curParts.push(`Préparation : ${postConfirmFulfillmentShortFr(row.post_confirm_fulfillment)}`);
    if ((row.counter_outcome ?? "unset") !== "unset") {
      curParts.push(
        `Suivi comptoir : ${counterOutcomePatientLabel(row.counter_outcome, row.counter_cancel_reason ?? null)}${row.counter_cancel_detail ? ` — ${row.counter_cancel_detail}` : ""}`
      );
    } else {
      curParts.push("Comptoir : en attente de passage ou pas encore indiqué.");
    }
    if (row.withdrawn_after_confirm) {
      curParts.push(
        ph
          ? "Ligne retirée de la commande active après accord du patient."
          : "Ligne retirée de la commande active après votre accord avec la pharmacie."
      );
    }
  } else {
    curParts.push(ph ? "Produit non retenu par le patient lors de la validation." : "Produit non retenu lors de votre validation.");
  }
  const lastTs =
    amendList.slice(-1)[0]?.created_at ??
    input.requestConfirmedAt ??
    input.requestRespondedAt ??
    t0;
  push(lastTs ?? null, "Situation actuelle", curParts.join("\n"), "Résumé", true);

  return blocks;
}

function postConfirmFulfillmentShortFr(v: string | null | undefined): string {
  if (v === "reserved") return "Réservé en pharmacie";
  if (v === "ordered") return "Commande fournisseur lancée";
  if (v === "arrived_reserved") return "Reçu en pharmacie, prêt à retirer";
  return "À préciser";
}
