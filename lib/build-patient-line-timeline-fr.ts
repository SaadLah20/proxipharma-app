import { formatDateShortFr, formatDateTimeShort24hFr } from "@/lib/datetime-fr";
import {
  altRowsOf,
  effectiveAvailabilityForPatientLine,
  effectiveAvailableQtyForPatientLine,
  effectiveEtaForPatientLine,
  type PatientLineLike,
  validatedProductLabel,
  validatedQtyForPatientLine,
} from "@/lib/patient-confirmed-line-buckets";
import {
  tryParsePatientHistoryAudit,
  patientHistoryAuditDetailLines,
  patientHistoryAuditTitle,
  patientDossierHistoryDetailParagraphsFr,
} from "@/lib/patient-request-history-audit";
import type { SupplyAmendmentEntryJson } from "@/lib/supply-amendment-channels";
import { summarizeSupplyAmendmentEntryLines } from "@/lib/supply-amendment-channels";
import {
  availabilityStatusFr,
  counterOutcomePatientLabel,
} from "@/lib/request-display";
import {
  historyActorLabelFr,
  historyActorToneFromReason,
  type HistoryActorTone,
  type HistoryViewerRole,
} from "@/lib/request-history-fr";

export type PatientLineTimelineBlockFr = {
  id: string;
  atIso: string | null;
  atLabel: string;
  title: string;
  body: string;
  actorLabel: string;
  actorTone?: HistoryActorTone;
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
        return "Modifié après validation";
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
    bodyLines: string[],
    actorLabel: string,
    actorTone: HistoryActorTone,
    isCurrent?: boolean
  ) => {
    const lines = bodyLines.map((l) => l.trim()).filter(Boolean);
    const atLabel = atIso ? formatDateTimeShort24hFr(atIso) : "—";
    blocks.push({
      id: `${++idx}-${title}`,
      atIso,
      atLabel,
      title,
      body: lines.join("\n"),
      actorLabel,
      actorTone,
      isCurrent,
    });
  };

  /** Origine */
  const t0 = input.requestSubmittedAt ?? input.requestCreatedAt;
  const originLines: string[] = [];
  const pname = principalName(row);
  if (row.line_source === "pharmacist_proposed") {
    const originLabel = input.pharmacistProposedOriginLabel ?? "Produit proposé par la pharmacie";
    const motif = row.pharmacist_proposal_reason?.trim();
    originLines.push(motif ? `${originLabel} : ${pname}` : `${originLabel} : ${pname}`);
    if (motif) originLines.push(`Motif : ${motif}`);
    originLines.push(`Quantité proposée : ${row.requested_qty}`);
  } else {
    const patientOrigin = input.patientLineOriginLabel?.trim();
    if (patientOrigin) originLines.push(patientOrigin);
    originLines.push(`Produit demandé : ${pname}`);
    originLines.push(`Quantité demandée : ${row.requested_qty}`);
  }
  if (row.client_comment?.trim()) {
    originLines.push(
      ph ? `Note du patient : ${row.client_comment.trim()}` : `Votre note : ${row.client_comment.trim()}`
    );
  }
  push(
    t0,
    ph ? "Produit ajouté au dossier" : "Vous avez demandé ce produit",
    originLines,
    ph ? "Le patient" : "Vous",
    "patient"
  );

  /** Réponse officine (instantanée réponse dossier). */
  if (input.requestRespondedAt) {
    const rp: string[] = [];
    rp.push(`Produit principal : ${pname}`);
    const principalAvail = row.availability_status
      ? availabilityStatusFr[row.availability_status] ?? row.availability_status
      : null;
    if (principalAvail) {
      rp.push(
        ph ? `Dispo sur le produit principal : ${principalAvail}` : `Dispo indiquée sur le principal : ${principalAvail}`
      );
    }
    if (row.available_qty != null && row.availability_status !== "market_shortage") {
      rp.push(
        ph
          ? `Quantité sur le produit principal : ${row.available_qty}`
          : `Quantité proposée sur le principal : ${row.available_qty}`
      );
    }
    if (row.unit_price != null) {
      rp.push(`Prix sur le produit principal : ${Number(row.unit_price).toFixed(2)} MAD`);
    }
    if (row.expected_availability_date && row.availability_status === "to_order") {
      rp.push(`Réception prévue (principal) : ${formatDateShortFr(row.expected_availability_date)}`);
    }
    for (const alt of altRowsOf(row)) {
      const aname = oneProdAlt(alt.products)?.name?.trim() || "Alternative";
      rp.push(`Alternative proposée : ${aname}`);
      const altAvail = alt.availability_status
        ? availabilityStatusFr[alt.availability_status] ?? alt.availability_status
        : null;
      if (altAvail) {
        rp.push(`Dispo sur cette alternative : ${altAvail}`);
      }
      if (alt.available_qty != null && alt.availability_status !== "market_shortage") {
        rp.push(`Quantité sur cette alternative : ${alt.available_qty}`);
      }
      if (alt.unit_price != null) {
        rp.push(`Prix sur cette alternative : ${Number(alt.unit_price).toFixed(2)} MAD`);
      }
      if (alt.expected_availability_date && alt.availability_status === "to_order") {
        rp.push(`Réception prévue (alternative) : ${formatDateShortFr(alt.expected_availability_date)}`);
      }
    }
    if (row.pharmacist_comment?.trim()) {
      rp.push(
        ph
          ? `Note officine sur la ligne : ${row.pharmacist_comment.trim()}`
          : `Message pharmacie sur la ligne : ${row.pharmacist_comment.trim()}`
      );
    }
    push(
      input.requestRespondedAt,
      ph ? "Réponse publiée" : "La pharmacie a répondu",
      rp,
      ph ? "Vous" : "La pharmacie",
      "pharmacy"
    );
  }

  /** Validation patient */
  if (row.is_selected_by_patient && input.requestConfirmedAt) {
    const chosenId = row.patient_chosen_alternative_id ?? null;
    const valLines: string[] = [];
    if (chosenId) {
      valLines.push(
        ph
          ? `Produit retenu : ${validatedProductLabel(row)} (alternative)`
          : `Produit retenu : ${validatedProductLabel(row)} (alternative choisie)`
      );
      valLines.push(
        ph ? `Référence initiale : ${principalName(row)}` : `Produit initialement demandé : ${principalName(row)}`
      );
    } else {
      valLines.push(
        ph
          ? `Produit retenu : ${validatedProductLabel(row)} (produit principal)`
          : `Produit retenu : ${validatedProductLabel(row)}`
      );
    }
    const qty = row.selected_qty ?? row.requested_qty;
    valLines.push(`Quantité retenue : ${qty}`);
    push(
      input.requestConfirmedAt,
      ph ? "Le patient a validé cette ligne" : "Vous avez validé cette ligne",
      valLines,
      ph ? "Le patient" : "Vous",
      "patient"
    );
  } else if (input.requestConfirmedAt && !row.is_selected_by_patient) {
    push(
      input.requestConfirmedAt,
      ph ? "Non retenu par le patient" : "Non retenu à la validation",
      [
        ph
          ? "Ce produit n'entre pas dans la commande validée par le patient."
          : "Vous n'avez pas retenu ce produit lors de la validation.",
      ],
      ph ? "Le patient" : "Vous",
      "patient"
    );
  }

  const viewerRole: HistoryViewerRole = ph ? "pharmacien" : "patient";

  /** Historique dossier avec audit lignes pertinentes */
  for (const h of histAsc) {
    const audit = tryParsePatientHistoryAudit(h.reason);
    if (!audit) continue;
    const linesDetail = audit.lines.filter((L) => productMatchesTimeline(row, L.productName));
    if (linesDetail.length === 0) continue;
    const subAudit = { ...audit, lines: linesDetail };
    const details = patientHistoryAuditDetailLines(subAudit, ph ? "pharmacist" : "patient");
    push(
      h.created_at,
      ph ? "Modification après validation patient" : patientHistoryAuditTitle(subAudit),
      details,
      "La pharmacie",
      "pharmacy"
    );
  }

  /** Ajustements post-validation (amendements supply) */
  for (const am of amendList) {
    push(
      am.created_at,
      ph ? "Mise à jour après accord patient" : "Modification après votre accord",
      summarizeSupplyAmendmentEntryLines(am.entry, ph ? "pharmacist" : "patient"),
      "La pharmacie",
      "pharmacy"
    );
  }

  /** Autres événements dossier mentionnant ce produit */
  for (const h of histAsc) {
    if (tryParsePatientHistoryAudit(h.reason)) continue;
    const r = `${h.reason ?? ""}`;
    if (!r.trim()) continue;
    const needleA = validatedProductLabel(row).toLowerCase();
    const needleB = principalName(row).toLowerCase();
    const rl = r.toLowerCase();
    if (!rl.includes(needleA) && !rl.includes(needleB)) continue;
    const detailLines = historyParas(h.reason).filter(Boolean);
    if (detailLines.length === 0) continue;
    const tone = historyActorToneFromReason(h.reason, viewerRole);
    push(
      h.created_at,
      ph ? "Événement sur ce produit" : "Mise à jour liée à ce produit",
      detailLines,
      historyActorLabelFr(h.reason, viewerRole),
      tone
    );
  }

  /** État actuel */
  const eff = effectiveAvailabilityForPatientLine(row);
  const eta = effectiveEtaForPatientLine(row);
  const chosenIdNow = row.patient_chosen_alternative_id ?? null;
  const validatedName = validatedProductLabel(row);
  const principal = principalName(row);
  const curLines: string[] = [];
  if (row.is_selected_by_patient) {
    if (chosenIdNow && validatedName.toLowerCase() !== principal.toLowerCase()) {
      curLines.push(`Produit retenu : ${validatedName}`);
      curLines.push(`Référence demandée : ${principal}`);
    } else {
      curLines.push(`Produit retenu : ${validatedName}`);
    }
    const validatedQty = validatedQtyForPatientLine(row);
    const trackedQty = effectiveAvailableQtyForPatientLine(row);
    curLines.push(`Quantité retenue : ${validatedQty}`);
    if (trackedQty != null && trackedQty !== validatedQty) {
      curLines.push(
        ph
          ? `Quantité suivie par l’officine (branche retenue) : ${trackedQty}`
          : `Quantité suivie par l’officine : ${trackedQty}`
      );
    }
    curLines.push(
      `Disponibilité (branche retenue) : ${eff ? availabilityStatusFr[eff] ?? eff : "—"}`
    );
    if (eff === "to_order" && eta) {
      curLines.push(`Réception prévue (branche retenue) : ${formatDateShortFr(eta)}`);
    }
    curLines.push(`Préparation : ${postConfirmFulfillmentShortFr(row.post_confirm_fulfillment)}`);
    if ((row.counter_outcome ?? "unset") !== "unset") {
      curLines.push(
        `Suivi comptoir : ${counterOutcomePatientLabel(row.counter_outcome, row.counter_cancel_reason ?? null)}`
      );
      if (row.counter_cancel_detail?.trim()) {
        curLines.push(`Précision comptoir : ${row.counter_cancel_detail.trim()}`);
      }
    } else {
      curLines.push("Comptoir : en attente de passage");
    }
    if (row.withdrawn_after_confirm) {
      curLines.push(
        ph
          ? "Ligne retirée de la commande active après accord du patient."
          : "Ligne retirée de la commande active après accord avec la pharmacie."
      );
    }
  } else {
    curLines.push(
      ph ? "Produit non retenu par le patient lors de la validation." : "Produit non retenu lors de votre validation."
    );
  }
  const lastTs =
    amendList.slice(-1)[0]?.created_at ??
    input.requestConfirmedAt ??
    input.requestRespondedAt ??
    t0;
  push(lastTs ?? null, "État actuel", curLines, ph ? "Synthèse" : "Aujourd'hui", "system", true);

  return blocks;
}

function postConfirmFulfillmentShortFr(v: string | null | undefined): string {
  if (v === "reserved") return "Réservé en pharmacie";
  if (v === "ordered") return "Commande fournisseur lancée";
  if (v === "arrived_reserved") return "Reçu en pharmacie, prêt à retirer";
  return "À préciser";
}
