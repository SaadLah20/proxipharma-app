import { formatDateTimeShort24hFr, patientPlannedVisitPassageLineFr } from "@/lib/datetime-fr";
import { formatDateTimeShortForLocale } from "@/lib/datetime-locale";
import type { AppLocale } from "@/lib/i18n/config";
import {
  counterOutcomeReasonPayload,
  counterOutcomeReasonProductName,
  patientDossierHistoryDetailParagraphsFr,
  patientHistoryAuditDetailLines,
  patientHistoryAuditTitle,
  pharmacistDossierHistoryDetailParagraphsFr,
  tryParsePatientHistoryAudit,
} from "@/lib/patient-request-history-audit";
import {
  requestHistoryPatientHeadline,
  requestHistoryPharmacistHeadline,
  requestStatusFr,
} from "@/lib/request-display";
import {
  historyActorLabelFr,
  historyActorToneFromReason,
  sanitizeHistoryDisplayText,
  type HistoryActorTone,
  type HistoryViewerRole,
} from "@/lib/request-history-fr";
import type { TimelineCopyPort } from "@/lib/i18n/timeline-copy-port";
import type { SupplyAmendmentEntryJson } from "@/lib/supply-amendment-channels";
import { summarizeSupplyAmendmentEntryLines } from "@/lib/supply-amendment-channels";

export type DossierHistoryRowInput = {
  id: string;
  created_at: string;
  old_status: string | null;
  new_status: string;
  reason: string | null;
};

export type DossierTimelineBlockFr = {
  id: string;
  atIso: string | null;
  atLabel: string;
  title: string;
  body: string;
  actorLabel: string;
  actorTone?: HistoryActorTone;
  isCurrent?: boolean;
};

export type DossierTimelineInputs = {
  rows: DossierHistoryRowInput[];
  requestCreatedAt: string;
  requestSubmittedAt: string | null;
  requestRespondedAt: string | null;
  requestConfirmedAt: string | null;
  requestStatus: string;
  viewerRole: HistoryViewerRole;
  supplyBundles?: { id: string; created_at: string; amendments: unknown }[];
  patientNote?: string | null;
  plannedVisitDate?: string | null;
  plannedVisitTime?: string | null;
  /** Dates localisées (patient AR/FR). */
  locale?: AppLocale;
  /** Libellés i18n patient (timeline.events). */
  copy?: TimelineCopyPort;
};

const TERMINAL_REQUEST_STATUSES = new Set([
  "cancelled",
  "abandoned",
  "expired",
  "completed",
  "partially_collected",
  "fully_collected",
]);

type PendingEvent = {
  atIso: string;
  sortKey: number;
  id: string;
  title: string;
  bodyLines: string[];
  actorLabel: string;
  actorTone: HistoryActorTone;
  isCurrent?: boolean;
};

function extractReasonKey(reason: string): string {
  const r = reason.trim();
  if (r.startsWith("request_event:")) return r.slice("request_event:".length).trim().toLowerCase();
  if (r.startsWith("pharmacist_supply_amendments_saved")) return "pharmacist_supply_amendments_saved";
  if (r.startsWith("counter_outcome:")) return counterOutcomeReasonPayload(r).toLowerCase();
  const bar = r.indexOf("|");
  return (bar >= 0 ? r.slice(0, bar) : r).toLowerCase();
}

function historyDetailParagraphs(
  reason: string | null | undefined,
  ph: boolean
): string[] {
  const paras = ph
    ? pharmacistDossierHistoryDetailParagraphsFr(reason)
    : patientDossierHistoryDetailParagraphsFr(reason);
  return paras.map(sanitizeHistoryDisplayText).filter(Boolean);
}

function sameStatusNarrativeTitle(
  reason: string | null | undefined,
  ph: boolean,
  copy?: TimelineCopyPort,
): string | null {
  const r = (reason ?? "").trim();
  if (!r) return null;

  const audit = tryParsePatientHistoryAudit(r);
  if (audit) {
    if (copy) return copy.dossierAuditTitle(audit.lines.length > 1, ph);
    return ph
      ? audit.lines.length > 1
        ? "Modifications après validation patient"
        : "Modification après validation patient"
      : patientHistoryAuditTitle(audit);
  }

  if (r.startsWith("counter_outcome:")) {
    const payload = counterOutcomeReasonPayload(r).slice("counter_outcome:".length);
    const product = counterOutcomeReasonProductName(r);
    const productSuffix = product ? ` (${product})` : "";
    const key =
      payload === "picked_up"
        ? "counter_picked_up"
        : payload === "unset"
          ? "counter_unset"
          : payload.startsWith("cancelled_at_counter")
            ? "counter_cancelled_at_counter"
            : "counter_other";
    if (copy) return copy.dossierReasonTitle(key, ph, productSuffix);
    if (payload === "picked_up") {
      return ph
        ? `Retrait au comptoir enregistré${productSuffix}`
        : `Retrait au comptoir enregistré${productSuffix}`;
    }
    if (payload === "unset") {
      return ph
        ? `Suivi comptoir remis en attente${productSuffix}`
        : `Produit remis en attente au comptoir${productSuffix}`;
    }
    if (payload.startsWith("cancelled_at_counter")) {
      return ph ? `Non retiré au comptoir${productSuffix}` : `Non retiré au comptoir${productSuffix}`;
    }
    return ph ? `Mise à jour comptoir${productSuffix}` : `Mise à jour au comptoir${productSuffix}`;
  }

  const key = extractReasonKey(r);
  if (copy) return copy.dossierReasonTitle(key, ph);
  switch (key) {
    case "publication_disponibilites":
      return ph ? "Réponse publiée au patient" : "La pharmacie a publié sa réponse";
    case "patient_confirm_after_response":
      return ph ? "Le patient a validé sa commande" : "Vous avez validé votre commande";
    case "patient_planned_visit_updated":
    case "patient_update_planned_visit_after_confirmation":
      return ph ? "Date de passage modifiée" : "Vous avez modifié votre date de passage";
    case "patient_resubmit_product_request_after_response":
      return ph ? "Liste de produits renvoyée par le patient" : "Vous avez renvoyé une liste de produits mise à jour";
    case "pharmacist_response_updated":
      return ph ? "Réponse modifiée avant validation patient" : "La pharmacie a modifié sa réponse";
    case "pharmacist_adjustments_after_confirmation":
      return ph ? "Ajustements après validation patient" : "La pharmacie a ajusté votre commande validée";
    case "pharmacist_supply_amendments_saved":
      return ph ? "Modifications enregistrées avec accord patient" : "La pharmacie a mis à jour votre commande";
    case "pharmacist_proposed_line_removed":
      return ph ? "Proposition de produit retirée" : "La pharmacie a retiré une proposition";
    case "counter_product_added":
      return ph ? "Produit ajouté au suivi comptoir" : "Un produit a été ajouté au suivi comptoir";
    case "counter_alternative_added":
      return ph ? "Alternative ajoutée" : "Une alternative a été ajoutée";
    case "counter_alternative_removed":
      return ph ? "Alternative retirée" : "Une alternative a été retirée";
    case "pharmacist_ui_confirm_close":
    case "pharmacien_ui":
      return ph ? "Clôture ou action officine" : "Mise à jour par la pharmacie";
    case "patient_abandon_request":
      return ph ? "Abandon par le patient" : "Vous avez abandonné la demande";
    default:
      return null;
  }
}

function statusChangeTitle(
  oldStatus: string | null,
  newStatus: string,
  ph: boolean,
  copy?: TimelineCopyPort,
): string {
  const o = oldStatus?.trim() || null;
  const n = newStatus.trim();
  if (copy) {
    const headline = ph ? copy.dossierPharmacistHeadline(o, n) : copy.dossierPatientHeadline(o, n);
    return headline.replace(/\.$/, "");
  }
  if (ph) return requestHistoryPharmacistHeadline(o, n).replace(/\.$/, "");
  return requestHistoryPatientHeadline(o, n).replace(/\.$/, "");
}

function hasCreationInHistory(rows: DossierHistoryRowInput[]): boolean {
  return rows.some((h) => {
    const r = (h.reason ?? "").trim().toLowerCase();
    if (r.includes("request_created")) return true;
    const o = h.old_status?.trim() || null;
    const n = h.new_status.trim();
    if (!o && (n === "submitted" || n === "in_review")) return true;
    if (o === "draft" && n === "submitted") return true;
    return false;
  });
}

function supplyAmendmentDetailLines(
  atIso: string,
  bundles: DossierTimelineInputs["supplyBundles"],
  ph: boolean,
  copy?: TimelineCopyPort,
): string[] {
  if (!bundles?.length) return [];
  const bundle = bundles.find((b) => b.created_at === atIso);
  if (!bundle) return [];
  const arr = Array.isArray(bundle.amendments) ? (bundle.amendments as SupplyAmendmentEntryJson[]) : [];
  const lines: string[] = [];
  for (const entry of arr) {
    if (copy) {
      lines.push(...copy.summarizeAmendmentEntryLines(entry, ph ? "pharmacist" : "patient"));
    } else {
      lines.push(...summarizeSupplyAmendmentEntryLines(entry, ph ? "pharmacist" : "patient"));
    }
  }
  return lines;
}

function shouldSkipCounterRow(
  reason: string,
  lastCounterPayloadByProduct: Map<string, string>
): boolean {
  if (!reason.startsWith("counter_outcome:")) return false;
  const payload = counterOutcomeReasonPayload(reason);
  const productKey = (counterOutcomeReasonProductName(reason) ?? "").toLowerCase() || "__legacy__";
  const prev = lastCounterPayloadByProduct.get(productKey);
  if (prev === payload) return true;
  lastCounterPayloadByProduct.set(productKey, payload);
  return false;
}

function formatTimelineAtLabel(iso: string, locale?: AppLocale): string {
  if (locale) return formatDateTimeShortForLocale(iso, locale);
  return formatDateTimeShort24hFr(iso);
}

function eventsToBlocks(events: PendingEvent[], locale?: AppLocale): DossierTimelineBlockFr[] {
  const sorted = [...events].sort((a, b) => {
    const ta = new Date(a.atIso).getTime();
    const tb = new Date(b.atIso).getTime();
    if (ta !== tb) return ta - tb;
    return a.sortKey - b.sortKey;
  });
  return sorted.map((e) => ({
    id: e.id,
    atIso: e.atIso,
    atLabel: formatTimelineAtLabel(e.atIso, locale),
    title: e.title,
    body: e.bodyLines.join("\n"),
    actorLabel: e.actorLabel,
    actorTone: e.actorTone,
    isCurrent: e.isCurrent,
  }));
}

/** Chronologie dossier : du plus ancien au plus récent ; dernier bloc = situation ou clôture. */
export function buildDossierTimelineFr(input: DossierTimelineInputs): DossierTimelineBlockFr[] {
  const ph = input.viewerRole === "pharmacien";
  const copy = input.copy;
  const histAsc = [...input.rows].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const reqStatus = input.requestStatus.trim();
  const isArchived = TERMINAL_REQUEST_STATUSES.has(reqStatus);
  const events: PendingEvent[] = [];
  let sortKey = 0;
  const lastCounterByProduct = new Map<string, string>();

  const push = (e: Omit<PendingEvent, "sortKey"> & { sortKey?: number }) => {
    events.push({ ...e, sortKey: e.sortKey ?? sortKey++ });
  };

  const t0 = input.requestSubmittedAt ?? input.requestCreatedAt;
  if (!hasCreationInHistory(histAsc)) {
    const originLines: string[] = [];
    if (input.patientNote?.trim()) {
      originLines.push(
        copy
          ? copy.dossierOriginNote(ph, input.patientNote.trim())
          : ph
            ? `Note du patient à l'envoi : « ${input.patientNote.trim()} »`
            : `Votre message à l'envoi : « ${input.patientNote.trim()} »`,
      );
    }
    push({
      id: "dossier-origin",
      atIso: t0,
      title: copy ? copy.dossierOriginTitle(ph) : ph ? "Demande reçue" : "Vous avez envoyé votre demande",
      bodyLines: originLines,
      actorLabel: copy ? copy.actorLabel(null, input.viewerRole) : ph ? "Le patient" : "Vous",
      actorTone: "patient",
      sortKey: 5,
    });
  }

  for (const h of histAsc) {
    if (isArchived && h.new_status === reqStatus && TERMINAL_REQUEST_STATUSES.has(h.new_status)) {
      continue;
    }

    const r = (h.reason ?? "").trim();
    if (r && shouldSkipCounterRow(r, lastCounterByProduct)) continue;

    const audit = tryParsePatientHistoryAudit(h.reason);
    const o = h.old_status?.trim() || null;
    const n = h.new_status.trim();
    const sameStatus = !o || o === n;

    let title: string;
    if (audit) {
      title = copy
        ? copy.dossierAuditTitle(audit.lines.length > 1, ph)
        : ph
          ? audit.lines.length > 1
            ? "Modifications après validation patient"
            : "Modification après validation patient"
          : patientHistoryAuditTitle(audit);
    } else if (sameStatus) {
      title =
        sameStatusNarrativeTitle(h.reason, ph, copy) ??
        (copy
          ? copy.dossierSameStatusFallback(ph)
          : ph
            ? "Mise à jour enregistrée sur le dossier"
            : "Une mise à jour a été enregistrée");
    } else {
      title = statusChangeTitle(o, n, ph, copy);
    }

    let bodyLines: string[] = [];
    if (audit) {
      bodyLines = patientHistoryAuditDetailLines(audit, ph ? "pharmacist" : "patient")
        .map(sanitizeHistoryDisplayText)
        .filter(Boolean);
    } else {
      bodyLines = historyDetailParagraphs(h.reason, ph);
      if (r.includes("supply_amendments") || extractReasonKey(r) === "pharmacist_supply_amendments_saved") {
        const amendLines = supplyAmendmentDetailLines(h.created_at, input.supplyBundles, ph, copy);
        if (amendLines.length > 0) {
          bodyLines = amendLines;
        }
      }
    }

    if (bodyLines.length === 0 && !audit) {
      const key = extractReasonKey(r);
      if (/^[a-z][a-z0-9_]*$/i.test(key) && key.length < 120) {
        bodyLines = [title];
      }
    }

    const tone = historyActorToneFromReason(h.reason, input.viewerRole);
    push({
      id: h.id,
      atIso: h.created_at,
      title,
      bodyLines,
      actorLabel: copy ? copy.actorLabel(h.reason, input.viewerRole) : historyActorLabelFr(h.reason, input.viewerRole),
      actorTone: tone,
      sortKey: sameStatus ? 55 : 45,
    });
  }

  const terminalEntry = isArchived
    ? histAsc.find((h) => h.new_status === reqStatus) ?? histAsc[histAsc.length - 1]
    : null;

  if (isArchived && terminalEntry) {
    const motiveLines = historyDetailParagraphs(terminalEntry.reason, ph);
    const statusLabel = copy ? copy.requestStatusLabel(reqStatus) : requestStatusFr[reqStatus] ?? reqStatus;
    push({
      id: `dossier-closure-${terminalEntry.id}`,
      atIso: terminalEntry.created_at,
      title: copy ? copy.dossierClosureTitle(ph) : ph ? "Dossier archivé" : "Fin de votre demande",
      bodyLines: [
        copy
          ? copy.dossierFinalStatus(ph, statusLabel)
          : ph
            ? `Statut final : ${requestStatusFr[reqStatus] ?? reqStatus}.`
            : `Votre demande est ${requestStatusFr[reqStatus] ?? reqStatus}.`,
        ...motiveLines,
      ],
      actorLabel: copy ? copy.actorSummary(ph) : ph ? "Synthèse" : "Récapitulatif",
      actorTone: "system",
      isCurrent: true,
      sortKey: 90,
    });
  } else {
    const curStatusLabel = copy ? copy.requestStatusLabel(reqStatus) : requestStatusFr[reqStatus] ?? reqStatus;
    const curLines: string[] = [
      copy ? copy.dossierCurrentStatus(curStatusLabel) : `Statut actuel : ${requestStatusFr[reqStatus] ?? reqStatus}.`,
    ];
    const passage = copy
      ? copy.plannedVisitLine(input.plannedVisitDate, input.plannedVisitTime)
      : patientPlannedVisitPassageLineFr(input.plannedVisitDate, input.plannedVisitTime);
    if (passage && (reqStatus === "confirmed" || reqStatus === "treated")) {
      curLines.push(passage);
    }
    if (input.requestRespondedAt && reqStatus === "responded" && input.requestConfirmedAt == null) {
      curLines.push(copy ? copy.dossierAwaitingValidation(ph) : ph ? "En attente de validation patient." : "En attente de votre validation.");
    }
    const lastTs =
      histAsc[histAsc.length - 1]?.created_at ??
      input.requestConfirmedAt ??
      input.requestRespondedAt ??
      t0;
    push({
      id: "dossier-current",
      atIso: lastTs,
      title: copy ? copy.dossierCurrentTitle(ph) : ph ? "Situation actuelle du dossier" : "Où en est votre demande aujourd'hui",
      bodyLines: curLines,
      actorLabel: copy ? copy.actorToday(ph) : ph ? "Maintenant" : "Aujourd'hui",
      actorTone: "system",
      isCurrent: true,
      sortKey: 95,
    });
  }

  return eventsToBlocks(events, input.locale);
}
