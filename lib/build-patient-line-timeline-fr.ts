import { formatDateShortFr, formatDateTimeShort24hFr } from "@/lib/datetime-fr";
import {
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
import { summarizeSupplyAmendmentEntry } from "@/lib/supply-amendment-channels";
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
    body: string,
    actorLabel: string,
    actorTone: HistoryActorTone,
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
      actorTone,
      isCurrent,
    });
  };

  /** Origine */
  const t0 = input.requestSubmittedAt ?? input.requestCreatedAt;
  const originParts: string[] = [];
  const pname = principalName(row);
  if (row.line_source === "pharmacist_proposed") {
    const originLabel = input.pharmacistProposedOriginLabel ?? "Produit proposé par la pharmacie";
    const motif = row.pharmacist_proposal_reason?.trim();
    originParts.push(
      motif
        ? `${originLabel} : ${pname} (${motif}).`
        : `${originLabel} : ${pname}.`
    );
    originParts.push(`Quantité : ${row.requested_qty}.`);
  } else {
    const patientOrigin = input.patientLineOriginLabel?.trim();
    originParts.push(
      patientOrigin
        ? `${patientOrigin} — ${pname}, ${row.requested_qty} unité(s).`
        : `${pname} demandé · ${row.requested_qty} unité(s).`
    );
  }
  if (row.client_comment?.trim()) {
    originParts.push(
      ph ? `Note du patient : « ${row.client_comment.trim()} »` : `Votre note : « ${row.client_comment.trim()} »`
    );
  }
  push(
    t0,
    ph ? "Produit ajouté au dossier" : "Vous avez demandé ce produit",
    originParts.join("\n"),
    ph ? "Le patient" : "Vous",
    "patient"
  );

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
      ph ? "Réponse publiée" : "La pharmacie a répondu",
      rp.join("\n"),
      ph ? "Vous" : "La pharmacie",
      "pharmacy"
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
      ph ? "Le patient" : "Vous",
      "patient"
    );
  } else if (input.requestConfirmedAt && !row.is_selected_by_patient) {
    push(
      input.requestConfirmedAt,
      ph ? "Non retenu par le patient" : "Non retenu à la validation",
      ph
        ? "Ce produit n'entre pas dans la commande validée par le patient."
        : "Vous n'avez pas retenu ce produit lors de la validation.",
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
    const details = patientHistoryAuditDetailLines(subAudit).join("\n");
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
      summarizeSupplyAmendmentEntry(am.entry, ph ? "pharmacist" : "patient"),
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
    const detail = historyParas(h.reason).filter(Boolean).join("\n");
    if (!detail.trim()) continue;
    const tone = historyActorToneFromReason(h.reason, viewerRole);
    push(
      h.created_at,
      ph ? "Événement sur ce produit" : "Mise à jour liée à ce produit",
      detail,
      historyActorLabelFr(h.reason, viewerRole),
      tone
    );
  }

  /** État actuel */
  const eff = effectiveAvailabilityForPatientLine(row);
  const eta = effectiveEtaForPatientLine(row);
  const curParts: string[] = [];
  curParts.push(`Produit : ${validatedProductLabel(row)}`);
  if (row.is_selected_by_patient) {
    const validatedQty = validatedQtyForPatientLine(row);
    const trackedQty = effectiveAvailableQtyForPatientLine(row);
    curParts.push(`Quantité retenue : ${validatedQty}`);
    if (trackedQty != null && trackedQty !== validatedQty) {
      curParts.push(`Quantité suivie par l’officine : ${trackedQty}`);
    }
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
  push(
    lastTs ?? null,
    "État actuel",
    curParts.join("\n"),
    ph ? "Synthèse" : "Aujourd'hui",
    "system",
    true
  );

  return blocks;
}

function postConfirmFulfillmentShortFr(v: string | null | undefined): string {
  if (v === "reserved") return "Réservé en pharmacie";
  if (v === "ordered") return "Commande fournisseur lancée";
  if (v === "arrived_reserved") return "Reçu en pharmacie, prêt à retirer";
  return "À préciser";
}
