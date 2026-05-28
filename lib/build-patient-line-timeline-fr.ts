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
  counterOutcomeReasonPayload,
  counterOutcomeReasonProductName,
  tryParsePatientHistoryAudit,
  patientHistoryAuditDetailLines,
  patientDossierHistoryDetailParagraphsFr,
} from "@/lib/patient-request-history-audit";
import type { SupplyAmendmentEntryJson } from "@/lib/supply-amendment-channels";
import { summarizeSupplyAmendmentEntryLines } from "@/lib/supply-amendment-channels";
import {
  availabilityStatusFr,
  counterOutcomePatientLabel,
  requestHistoryPatientHeadline,
  requestHistoryPharmacistHeadline,
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

const TERMINAL_REQUEST_STATUSES = new Set([
  "cancelled",
  "abandoned",
  "expired",
  "completed",
  "partially_collected",
  "fully_collected",
]);

/** Motifs dossier (hors produit) — exclus de l’historique par ligne. */
const DOSSIER_ONLY_REASON_KEYS = new Set([
  "patient_planned_visit_updated",
  "patient_update_planned_visit_after_confirmation",
]);

/** Motifs dossier affichés sur chaque ligne produit (hors audit / amendements déjà détaillés). */
const DOSSIER_WIDE_REASON_KEYS = new Set([
  "patient_resubmit_product_request_after_response",
  "pharmacist_response_updated",
  "counter_product_added",
  "counter_alternative_added",
  "counter_alternative_removed",
  "pharmacist_proposed_line_removed",
  "pharmacist_ui_confirm_close",
  "pharmacien_ui",
]);

const SKIP_DOSSIER_REASON_KEYS = new Set([
  "publication_disponibilites",
  "patient_confirm_after_response",
  "pharmacist_supply_amendments_saved",
  "pharmacist_adjustments_after_confirmation",
  "request_created_with_status",
]);

type PendingTimelineEvent = {
  atIso: string;
  sortKey: number;
  title: string;
  bodyLines: string[];
  actorLabel: string;
  actorTone: HistoryActorTone;
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

function reasonMentionsLine(row: PatientLineLike, reason: string | null | undefined): boolean {
  const r = (reason ?? "").trim();
  if (!r) return false;
  const { principal, validated } = normalizedProductTokensForTimeline(row);
  const rl = r.toLowerCase();
  return rl.includes(validated) || rl.includes(principal);
}

function extractReasonKey(reason: string): string {
  const r = reason.trim();
  if (r.startsWith("request_event:")) return r.slice("request_event:".length).trim().toLowerCase();
  if (r.startsWith("pharmacist_supply_amendments_saved")) return "pharmacist_supply_amendments_saved";
  if (r.startsWith("counter_outcome:")) {
    return counterOutcomeReasonPayload(r).toLowerCase();
  }
  const bar = r.indexOf("|");
  const base = bar >= 0 ? r.slice(0, bar).trim() : r;
  return base.toLowerCase();
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
  /** Statut actuel du dossier (clôture, archive). */
  requestStatus?: string | null;
  supplyBundles: { id: string; created_at: string; amendments: unknown }[];
  /** `request_status_history` côté patient (filtre audit produit automatique). */
  dossierHistory?: { id?: string; created_at: string; old_status: string | null; new_status: string; reason: string | null }[];
  /** Par défaut libellés patient ; passer `pharmacistDossierHistoryDetailParagraphsFr` pour l’officine. */
  dossierHistoryDetailParagraphs?: (reason: string | null | undefined) => string[];
  /** Ex. « Produit saisi depuis l’ordonnance » (ordonnance) vs « Produit proposé par la pharmacie ». */
  pharmacistProposedOriginLabel?: string;
  /** Ex. « Saisi depuis l’ordonnance » pour `patient_request` sur ordonnance. */
  patientLineOriginLabel?: string;
  /** Historique produit côté officine : formulations « le patient a… ». */
  timelineAudience?: "patient" | "pharmacist";
};

function postConfirmFulfillmentShortFr(v: string | null | undefined): string {
  if (v === "reserved") return "Réservé en pharmacie";
  if (v === "ordered") return "Commande fournisseur lancée";
  if (v === "arrived_reserved") return "Reçu en pharmacie, prêt à retirer";
  return "À préciser";
}

function amendNarrativeTitle(kind: string | undefined, ph: boolean): string {
  switch (kind) {
    case "withdraw_after_confirm":
      return ph ? "Produit retiré de la commande active" : "Retiré de votre commande après validation";
    case "reintegrate_after_confirm":
    case "reintegrate":
      return ph ? "Produit réintégré" : "Réintégré dans votre commande";
    case "validated_qty_change":
      return ph ? "Quantité validée ajustée" : "La pharmacie a modifié la quantité validée";
    case "line_added_after_confirm":
      return ph ? "Produit ajouté après validation patient" : "La pharmacie a ajouté ce produit après validation";
    case "line_removed_after_confirm":
      return ph ? "Produit retiré après validation" : "La pharmacie a retiré ce produit";
    case "line_brought_to_reserve_after_validation":
      return ph ? "Passage en réservation" : "Replacé en réservation en officine";
    case "line_adjust_supply":
      return ph ? "Disponibilité ou quantité modifiée" : "La pharmacie a mis à jour disponibilité ou quantité";
    default:
      return ph ? "Mise à jour enregistrée" : "La pharmacie a enregistré une mise à jour";
  }
}

function dossierSameStatusNarrativeTitle(
  reason: string | null | undefined,
  ph: boolean,
  viewerRole: HistoryViewerRole
): string | null {
  const r = (reason ?? "").trim();
  if (!r) return null;
  if (r.startsWith("counter_outcome:")) {
    const payload = r.slice("counter_outcome:".length).split("|")[0]?.trim() ?? "";
    if (payload === "picked_up") {
      return ph ? "Retrait au comptoir enregistré" : "Retrait au comptoir enregistré par la pharmacie";
    }
    if (payload === "unset") {
      return ph ? "Suivi comptoir remis en attente" : "La pharmacie a remis ce produit en attente au comptoir";
    }
    if (payload.startsWith("cancelled_at_counter")) {
      return ph ? "Non retiré au comptoir" : "Ce produit n'a pas été retiré au comptoir";
    }
    return ph ? "Mise à jour du comptoir" : "Mise à jour du passage au comptoir";
  }
  const key = extractReasonKey(r);
  if (key === "patient_resubmit_product_request_after_response") {
    return ph ? "Le patient a renvoyé une liste mise à jour" : "Vous avez renvoyé une liste de produits mise à jour";
  }
  if (key === "pharmacist_response_updated") {
    return ph ? "Réponse modifiée avant validation patient" : "La pharmacie a modifié sa réponse";
  }
  if (key === "counter_product_added") {
    return ph ? "Produit ajouté au suivi comptoir" : "Ce produit a été ajouté au suivi comptoir";
  }
  if (key === "counter_alternative_added") {
    return ph ? "Alternative ajoutée" : "Une alternative a été ajoutée sur cette ligne";
  }
  if (key === "counter_alternative_removed") {
    return ph ? "Alternative retirée" : "Une alternative a été retirée sur cette ligne";
  }
  if (key === "pharmacist_proposed_line_removed") {
    return ph ? "Proposition retirée" : "La pharmacie a retiré une proposition sur ce produit";
  }
  return null;
}

function statusChangeNarrativeTitle(
  oldStatus: string | null,
  newStatus: string,
  ph: boolean
): string {
  const o = oldStatus?.trim() || null;
  const n = newStatus.trim();
  if (ph) {
    return requestHistoryPharmacistHeadline(o, n).replace(/\.$/, "");
  }
  return requestHistoryPatientHeadline(o, n).replace(/\.$/, "");
}

function dossierRowRelevantForLine(
  row: PatientLineLike,
  h: { old_status: string | null; new_status: string; reason: string | null },
  input: PatientLineTimelineInputs
): boolean {
  const r = (h.reason ?? "").trim();
  if (!r) {
    return h.old_status !== h.new_status;
  }

  const audit = tryParsePatientHistoryAudit(r);
  if (audit) {
    return audit.lines.some((L) => productMatchesTimeline(row, L.productName));
  }

  const key = extractReasonKey(r);
  if (SKIP_DOSSIER_REASON_KEYS.has(key)) return false;
  if (DOSSIER_ONLY_REASON_KEYS.has(key)) return false;

  if (r.startsWith("counter_outcome:")) {
    const pname = counterOutcomeReasonProductName(r);
    if (!pname) return false;
    return productMatchesTimeline(row, pname);
  }

  if (reasonMentionsLine(row, r)) return true;

  if (DOSSIER_WIDE_REASON_KEYS.has(key)) return true;

  const o = h.old_status?.trim() || null;
  const n = h.new_status.trim();
  if (o !== n) {
    if (TERMINAL_REQUEST_STATUSES.has(n)) return true;
    if (n === "treated" && row.is_selected_by_patient) return true;
    if (n === "confirmed" && row.is_selected_by_patient && !input.requestConfirmedAt) return true;
    if (n === "responded" && !input.requestRespondedAt) return true;
    if (n === "expired" || n === "abandoned" || n === "cancelled") return true;
  }

  return false;
}

/** Retire les mentions « date de passage » (niveau dossier, pas produit). */
function filterProductTimelineDetailLines(lines: string[]): string[] {
  return lines.filter((line) => {
    const l = line.toLowerCase();
    if (l.includes("date de passage")) return false;
    if (l.includes("heure de passage")) return false;
    if (l.includes("passage prévu en pharmacie")) return false;
    if (l.includes("modifié votre date") || l.includes("modifié la date")) return false;
    return true;
  });
}

function eventsToBlocks(events: PendingTimelineEvent[]): PatientLineTimelineBlockFr[] {
  const sorted = [...events].sort((a, b) => {
    const ta = new Date(a.atIso).getTime();
    const tb = new Date(b.atIso).getTime();
    if (ta !== tb) return ta - tb;
    return a.sortKey - b.sortKey;
  });
  return sorted.map((e, i) => {
    const lines = e.bodyLines.map((l) => l.trim()).filter(Boolean);
    return {
      id: `line-tl-${i + 1}-${e.sortKey}`,
      atIso: e.atIso,
      atLabel: formatDateTimeShort24hFr(e.atIso),
      title: e.title,
      body: lines.join("\n"),
      actorLabel: e.actorLabel,
      actorTone: e.actorTone,
      isCurrent: e.isCurrent,
    };
  });
}

/** Chronologie du plus ancien (haut) au plus récent (bas). Dernier bloc = situation actuelle ou clôture. */
export function buildPatientLineTimelineFr(input: PatientLineTimelineInputs): PatientLineTimelineBlockFr[] {
  const { row } = input;
  const ph = input.timelineAudience === "pharmacist";
  const amendList = amendmentsForPatientLine(row, input.supplyBundles);
  const histAsc = [...(input.dossierHistory ?? [])].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const historyParas = input.dossierHistoryDetailParagraphs ?? patientDossierHistoryDetailParagraphsFr;
  const viewerRole: HistoryViewerRole = ph ? "pharmacien" : "patient";
  const reqStatus = (input.requestStatus ?? "").trim();
  const isArchived = TERMINAL_REQUEST_STATUSES.has(reqStatus);
  const events: PendingTimelineEvent[] = [];
  let sortKey = 0;

  const push = (
    atIso: string,
    title: string,
    bodyLines: string[],
    actorLabel: string,
    actorTone: HistoryActorTone,
    options?: { isCurrent?: boolean; sortKey?: number }
  ) => {
    events.push({
      atIso,
      sortKey: options?.sortKey ?? sortKey++,
      title,
      bodyLines,
      actorLabel,
      actorTone,
      isCurrent: options?.isCurrent,
    });
  };

  const t0 = input.requestSubmittedAt ?? input.requestCreatedAt;
  const pname = principalName(row);

  /** 1 — Origine */
  const originLines: string[] = [];
  if (row.line_source === "pharmacist_proposed") {
    const originLabel = input.pharmacistProposedOriginLabel ?? "Produit proposé par la pharmacie";
    const motif = row.pharmacist_proposal_reason?.trim();
    originLines.push(motif ? `${originLabel} : ${pname}` : `${originLabel} : ${pname}`);
    if (motif) originLines.push(`Motif : ${motif}`);
    originLines.push(`Quantité proposée : ${row.requested_qty}`);
    push(
      t0,
      ph ? "Produit proposé par l'officine" : "La pharmacie vous a proposé ce produit",
      originLines,
      ph ? "Vous" : "La pharmacie",
      "pharmacy",
      { sortKey: 10 }
    );
  } else {
    const patientOrigin = input.patientLineOriginLabel?.trim();
    if (patientOrigin) originLines.push(patientOrigin);
    originLines.push(`Produit : ${pname}`);
    originLines.push(`Quantité demandée : ${row.requested_qty}`);
    if (row.client_comment?.trim()) {
      originLines.push(
        ph ? `Note du patient : « ${row.client_comment.trim()} »` : `Votre note : « ${row.client_comment.trim()} »`
      );
    }
    push(
      t0,
      ph ? "Produit ajouté au dossier" : "Vous avez ajouté ce produit à votre demande",
      originLines,
      ph ? "Le patient" : "Vous",
      "patient",
      { sortKey: 10 }
    );
  }

  /** 2 — Réponse officine */
  if (input.requestRespondedAt) {
    const rp: string[] = [];
    rp.push(`Produit concerné : ${pname}`);
    const principalAvail = row.availability_status
      ? availabilityStatusFr[row.availability_status] ?? row.availability_status
      : null;
    if (principalAvail) {
      rp.push(`Disponibilité indiquée : ${principalAvail}`);
    }
    if (row.available_qty != null && row.availability_status !== "market_shortage") {
      rp.push(
        ph
          ? `Quantité sur le produit principal : ${row.available_qty}`
          : `Quantité proposée : ${row.available_qty}`
      );
    }
    if (row.unit_price != null) {
      rp.push(`Prix unitaire : ${Number(row.unit_price).toFixed(2)} MAD`);
    }
    if (row.expected_availability_date && row.availability_status === "to_order") {
      rp.push(`Réception prévue : ${formatDateShortFr(row.expected_availability_date)}`);
    }
    for (const alt of altRowsOf(row)) {
      const aname = oneProdAlt(alt.products)?.name?.trim() || "Alternative";
      rp.push(`Alternative proposée : ${aname}`);
      const altAvail = alt.availability_status
        ? availabilityStatusFr[alt.availability_status] ?? alt.availability_status
        : null;
      if (altAvail) rp.push(`Disponibilité (alternative) : ${altAvail}`);
      if (alt.available_qty != null && alt.availability_status !== "market_shortage") {
        rp.push(`Quantité (alternative) : ${alt.available_qty}`);
      }
      if (alt.unit_price != null) {
        rp.push(`Prix (alternative) : ${Number(alt.unit_price).toFixed(2)} MAD`);
      }
      if (alt.expected_availability_date && alt.availability_status === "to_order") {
        rp.push(`Réception prévue (alternative) : ${formatDateShortFr(alt.expected_availability_date)}`);
      }
    }
    if (row.pharmacist_comment?.trim()) {
      rp.push(
        ph
          ? `Note officine : « ${row.pharmacist_comment.trim()} »`
          : `Message de la pharmacie : « ${row.pharmacist_comment.trim()} »`
      );
    }
    push(
      input.requestRespondedAt,
      ph ? "Réponse publiée au patient" : "La pharmacie vous a répondu sur ce produit",
      rp,
      ph ? "Vous" : "La pharmacie",
      "pharmacy",
      { sortKey: 20 }
    );
  }

  /** 3 — Validation patient */
  if (input.requestConfirmedAt) {
    if (row.is_selected_by_patient) {
      const chosenId = row.patient_chosen_alternative_id ?? null;
      const valLines: string[] = [];
      if (chosenId) {
        valLines.push(`Produit retenu : ${validatedProductLabel(row)} (alternative choisie)`);
        valLines.push(`Produit initialement demandé : ${pname}`);
      } else {
        valLines.push(`Produit retenu : ${validatedProductLabel(row)}`);
      }
      valLines.push(`Quantité retenue : ${row.selected_qty ?? row.requested_qty}`);
      push(
        input.requestConfirmedAt,
        ph ? "Le patient a validé ce produit" : "Vous avez retenu ce produit",
        valLines,
        ph ? "Le patient" : "Vous",
        "patient",
        { sortKey: 30 }
      );
    } else {
      push(
        input.requestConfirmedAt,
        ph ? "Non retenu par le patient" : "Vous n'avez pas retenu ce produit",
        [
          ph
            ? "Ce produit n'entre pas dans la commande validée."
            : "Ce produit ne fait pas partie de votre commande validée.",
        ],
        ph ? "Le patient" : "Vous",
        "patient",
        { sortKey: 30 }
      );
    }
  }

  /** 4 — Journal dossier (chronologie) */
  let lastCounterPayloadForLine: string | null = null;
  for (const h of histAsc) {
    if (isArchived && h.new_status === reqStatus && TERMINAL_REQUEST_STATUSES.has(h.new_status)) {
      continue;
    }
    const r = (h.reason ?? "").trim();
    if (r.startsWith("counter_outcome:")) {
      const payload = counterOutcomeReasonPayload(r);
      if (!dossierRowRelevantForLine(row, h, input)) continue;
      if (payload === lastCounterPayloadForLine) continue;
      lastCounterPayloadForLine = payload;
    }
    const audit = tryParsePatientHistoryAudit(h.reason);
    if (audit) {
      const linesDetail = audit.lines.filter((L) => productMatchesTimeline(row, L.productName));
      if (linesDetail.length === 0) continue;
      const subAudit = { ...audit, lines: linesDetail };
      push(
        h.created_at,
        ph ? "Modification après validation patient" : "La pharmacie a ajusté ce produit après validation",
        patientHistoryAuditDetailLines(subAudit, ph ? "pharmacist" : "patient"),
        "La pharmacie",
        "pharmacy",
        { sortKey: 50 }
      );
      continue;
    }

    if (!dossierRowRelevantForLine(row, h, input)) continue;

    const o = h.old_status?.trim() || null;
    const n = h.new_status.trim();
    const sameStatus = !o || o === n;
    let title: string;
    if (sameStatus) {
      title =
        dossierSameStatusNarrativeTitle(h.reason, ph, viewerRole) ??
        (ph ? "Mise à jour sur ce produit" : "Mise à jour enregistrée pour ce produit");
    } else {
      title = statusChangeNarrativeTitle(o, n, ph);
    }

    const detailLines = filterProductTimelineDetailLines(historyParas(h.reason).filter(Boolean));
    if (detailLines.length === 0 && DOSSIER_ONLY_REASON_KEYS.has(extractReasonKey(r))) continue;
    const tone = historyActorToneFromReason(h.reason, viewerRole);
    push(h.created_at, title, detailLines.length > 0 ? detailLines : [title], historyActorLabelFr(h.reason, viewerRole), tone, {
      sortKey: sameStatus ? 55 : 45,
    });
  }

  for (const am of amendList) {
    push(
      am.created_at,
      amendNarrativeTitle(am.entry.kind, ph),
      summarizeSupplyAmendmentEntryLines(am.entry, ph ? "pharmacist" : "patient"),
      "La pharmacie",
      "pharmacy",
      { sortKey: 60 }
    );
  }

  /** 5 — Situation actuelle ou clôture */
  const terminalEntry = isArchived
    ? histAsc.find((h) => h.new_status === reqStatus) ?? histAsc[histAsc.length - 1]
    : null;

  if (isArchived && terminalEntry) {
    const motiveLines = historyParas(terminalEntry.reason).filter(Boolean);
    const closureLines: string[] = [
      ph
        ? `Dossier clôturé : ${requestHistoryPharmacistHeadline(terminalEntry.old_status, terminalEntry.new_status)}`
        : `Demande terminée : ${requestHistoryPatientHeadline(terminalEntry.old_status, terminalEntry.new_status)}`,
      ...motiveLines,
    ];
    if (row.is_selected_by_patient) {
      closureLines.push(`Produit : ${validatedProductLabel(row)}`);
      closureLines.push(`Quantité retenue à la validation : ${validatedQtyForPatientLine(row)}`);
    } else {
      closureLines.push("Ce produit n'avait pas été retenu à la validation.");
    }
    push(
      terminalEntry.created_at,
      ph ? "Dossier archivé pour ce produit" : "Fin du parcours pour ce produit",
      closureLines,
      ph ? "Synthèse" : "Récapitulatif",
      "system",
      { isCurrent: true, sortKey: 90 }
    );
  } else {
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
        curLines.push(`Quantité suivie par l'officine : ${trackedQty}`);
      }
      curLines.push(`Disponibilité : ${eff ? availabilityStatusFr[eff] ?? eff : "—"}`);
      if (eff === "to_order" && eta) {
        curLines.push(`Réception prévue : ${formatDateShortFr(eta)}`);
      }
      curLines.push(`Préparation : ${postConfirmFulfillmentShortFr(row.post_confirm_fulfillment)}`);
      if ((row.counter_outcome ?? "unset") !== "unset") {
        curLines.push(
          `Comptoir : ${counterOutcomePatientLabel(row.counter_outcome, row.counter_cancel_reason ?? null)}`
        );
        if (row.counter_cancel_detail?.trim()) {
          curLines.push(`Précision : ${row.counter_cancel_detail.trim()}`);
        }
      } else {
        curLines.push("Comptoir : en attente de votre passage");
      }
      if (row.withdrawn_after_confirm) {
        curLines.push(
          ph
            ? "Retiré de la commande active (accord patient enregistré)."
            : "Retiré de votre commande active après accord avec la pharmacie."
        );
      }
    } else {
      curLines.push(
        ph
          ? "Produit non retenu lors de la validation patient."
          : "Produit non retenu lors de votre validation."
      );
    }
    const lastTs =
      amendList.slice(-1)[0]?.created_at ??
      histAsc[histAsc.length - 1]?.created_at ??
      input.requestConfirmedAt ??
      input.requestRespondedAt ??
      t0;
    push(
      lastTs,
      ph ? "Situation actuelle de la ligne" : "Où en est ce produit aujourd'hui",
      curLines,
      ph ? "Synthèse" : "Aujourd'hui",
      "system",
      { isCurrent: true, sortKey: 95 }
    );
  }

  return eventsToBlocks(events);
}
