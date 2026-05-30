import { formatDateShortFr } from "@/lib/datetime-fr";
import {
  altRowsOf,
  effectiveAvailabilityForPatientLine,
  effectiveAvailableQtyForPatientLine,
  effectiveEtaForPatientLine,
  validatedProductLabel,
  validatedQtyForPatientLine,
} from "@/lib/patient-confirmed-line-buckets";
import {
  counterOutcomeReasonPayload,
  counterOutcomeReasonProductName,
  patientDossierHistoryDetailParagraphsFr,
  patientHistoryAuditDetailLines,
  tryParsePatientHistoryAudit,
} from "@/lib/patient-request-history-audit";
import { availabilityStatusFr, counterOutcomePatientLabel } from "@/lib/request-display";
import type { HistoryActorTone, HistoryViewerRole } from "@/lib/request-history-fr";
import { historyActorLabelFr, historyActorToneFromReason } from "@/lib/request-history-fr";
import {
  lineEventTitle,
  supplyAmendmentBodyFact,
  supplyAmendmentKindToLineEventKind,
} from "@/lib/product-line-history/line-event-labels-fr";
import {
  principalProductName,
  productMatchesTimeline,
  reasonMentionsLine,
} from "@/lib/product-line-history/product-matching";
import type {
  DossierHistoryRow,
  LineEventKind,
  LineHistoryPhase,
  ProductLineEvent,
  ProductLineHistoryContext,
  SupplyAmendmentBundle,
} from "@/lib/product-line-history/types";
import type { SupplyAmendmentEntryJson } from "@/lib/supply-amendment-channels";
import { supplyAmendChannelLabel } from "@/lib/supply-amendment-channels";

const TERMINAL_REQUEST_STATUSES = new Set([
  "cancelled",
  "abandoned",
  "expired",
  "completed",
  "partially_collected",
  "fully_collected",
]);

const DOSSIER_ONLY_REASON_KEYS = new Set([
  "patient_planned_visit_updated",
  "patient_update_planned_visit_after_confirmation",
  "patient_confirm_after_response",
  "publication_disponibilites",
  "pharmacist_supply_amendments_saved",
  "pharmacist_adjustments_after_confirmation",
  "request_created_with_status",
  "pharmacien_ui",
  "pharmacist_ui_confirm_close",
  "patient_resubmit_product_request_after_response",
  "pharmacist_response_updated",
  "counter_product_added",
  "counter_alternative_added",
  "counter_alternative_removed",
  "pharmacist_proposed_line_removed",
  "auto_expire_after_response_silence",
  "auto_expire_24h_after_response",
  "expire_overdue_requests",
  "auto_abandon_24h_after_response",
  "patient_abandon_request",
]);

function oneProdAlt(p: unknown): { name?: string | null } | undefined {
  if (!p) return undefined;
  return Array.isArray(p) ? (p[0] as { name?: string | null }) : (p as { name?: string | null });
}

function extractReasonKey(reason: string): string {
  const r = reason.trim();
  if (r.startsWith("request_event:")) return r.slice("request_event:".length).trim().toLowerCase();
  if (r.startsWith("pharmacist_supply_amendments_saved")) return "pharmacist_supply_amendments_saved";
  if (r.startsWith("counter_outcome:")) return counterOutcomeReasonPayload(r).toLowerCase();
  const bar = r.indexOf("|");
  return (bar >= 0 ? r.slice(0, bar) : r).toLowerCase();
}

function postConfirmFulfillmentShortFr(v: string | null | undefined): string {
  if (v === "reserved") return "Réservé en pharmacie";
  if (v === "ordered") return "Commande fournisseur lancée";
  if (v === "arrived_reserved") return "Reçu en pharmacie, prêt à retirer";
  return "En cours de précision";
}

function splitAmendmentDetailFacts(detail: string): string[] {
  const raw = detail.trim();
  if (!raw) return [];
  const withoutProductPrefix = raw.includes(" — ")
    ? raw.slice(raw.indexOf(" — ") + 3).trim() || raw
    : raw;
  return withoutProductPrefix
    .split(/\s*[·•]\s*|\s+—\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function amendmentBodyLines(entry: SupplyAmendmentEntryJson, audience: "patient" | "pharmacist"): string[] {
  const lines: string[] = [];
  const detail = (entry.detail ?? entry.summary ?? "").trim();
  const facts =
    detail && !detail.toLowerCase().includes("request_item") ? splitAmendmentDetailFacts(detail) : [];
  for (const fact of facts) {
    lines.push(fact.length > 180 ? `${fact.slice(0, 177).trim()}…` : fact);
  }
  if (lines.length === 0) {
    const fromKind = supplyAmendmentBodyFact(entry.kind, audience);
    if (fromKind) lines.push(fromKind);
  }
  const ch = entry.client_confirmation_channel ? supplyAmendChannelLabel(entry.client_confirmation_channel) : null;
  const mot = entry.client_motive?.trim();
  if (ch) lines.push(`Accord patient : ${ch}`);
  if (mot) lines.push(`Précision : ${mot}`);
  return lines.length > 0 ? lines : ["Modification enregistrée."];
}

export function amendmentsForLine(
  rowId: string,
  bundles: SupplyAmendmentBundle[]
): { created_at: string; entry: SupplyAmendmentEntryJson }[] {
  const out: { created_at: string; entry: SupplyAmendmentEntryJson }[] = [];
  for (const b of bundles) {
    const arr = Array.isArray(b.amendments) ? (b.amendments as SupplyAmendmentEntryJson[]) : [];
    for (const e of arr) {
      if (e.request_item_id === rowId) out.push({ created_at: b.created_at, entry: e });
    }
  }
  return out.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

function amendNearTimestamp(iso: string, amendList: { created_at: string }[], windowMs = 180_000): boolean {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  return amendList.some((a) => {
    const ta = new Date(a.created_at).getTime();
    return Number.isFinite(ta) && Math.abs(ta - t) <= windowMs;
  });
}

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

function dossierRowRelevantForLine(row: ProductLineHistoryContext["row"], h: DossierHistoryRow): boolean {
  const r = (h.reason ?? "").trim();
  const o = h.old_status?.trim() || null;
  const n = h.new_status.trim();
  if (o !== n) return false;
  if (!r) return false;

  const audit = tryParsePatientHistoryAudit(r);
  if (audit) return audit.lines.some((L) => productMatchesTimeline(row, L.productName));

  const key = extractReasonKey(r);
  if (DOSSIER_ONLY_REASON_KEYS.has(key)) return false;

  if (r.startsWith("counter_outcome:")) {
    const pname = counterOutcomeReasonProductName(r);
    return pname ? productMatchesTimeline(row, pname) : false;
  }

  return reasonMentionsLine(row, r);
}

function counterEventKind(payload: string): LineEventKind {
  if (payload === "picked_up") return "counter_picked_up";
  if (payload === "unset") return "counter_unset";
  if (payload.startsWith("cancelled_at_counter")) return "counter_cancelled";
  return "counter_other";
}

function inferWithdrawTimestamp(
  ctx: ProductLineHistoryContext,
  histAsc: DossierHistoryRow[]
): { atIso: string; autoAtClosure: boolean } {
  const rowUpdated = ctx.row.updated_at?.trim();
  if (rowUpdated) return { atIso: rowUpdated, autoAtClosure: false };
  for (let i = histAsc.length - 1; i >= 0; i--) {
    const h = histAsc[i];
    const reason = (h.reason ?? "").trim().toLowerCase();
    if (h.new_status.trim() === "completed" && reason.includes("pharmacist_complete_request_after_counter")) {
      return { atIso: h.created_at, autoAtClosure: true };
    }
  }
  return {
    atIso:
      ctx.requestConfirmedAt ??
      ctx.requestRespondedAt ??
      ctx.requestSubmittedAt ??
      ctx.requestCreatedAt,
    autoAtClosure: false,
  };
}

function dedupeEvents(events: ProductLineEvent[]): ProductLineEvent[] {
  const out: ProductLineEvent[] = [];
  for (const e of events) {
    const bodyKey = e.bodyLines.join("|");
    const prev = out[out.length - 1];
    if (prev) {
      const prevBody = prev.bodyLines.join("|");
      const dt = Math.abs(new Date(prev.atIso).getTime() - new Date(e.atIso).getTime());
      if (prev.kind === e.kind && prevBody === bodyKey && dt < 120_000) continue;
      if (prevBody === bodyKey && dt < 60_000) continue;
    }
    out.push(e);
  }
  return out;
}

function pushEvent(
  events: ProductLineEvent[],
  partial: Omit<ProductLineEvent, "id"> & { id?: string }
): void {
  events.push({
    id: partial.id ?? `evt-${events.length + 1}-${partial.sortKey}`,
    ...partial,
  });
}

/** Collecte tous les événements produit, dédupliqués, prêts pour le rendu. */
export function collectProductLineEvents(ctx: ProductLineHistoryContext): ProductLineEvent[] {
  const { row } = ctx;
  const ph = ctx.audience === "pharmacist";
  const audience = ctx.audience;
  const viewerRole: HistoryViewerRole = ph ? "pharmacien" : "patient";
  const amendList = amendmentsForLine(row.id, ctx.supplyBundles);
  const histAsc = [...(ctx.dossierHistory ?? [])].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const historyParas = ctx.dossierHistoryDetailParagraphs ?? patientDossierHistoryDetailParagraphsFr;
  const reqStatus = (ctx.requestStatus ?? "").trim();
  const isArchived = TERMINAL_REQUEST_STATUSES.has(reqStatus);
  const events: ProductLineEvent[] = [];
  const t0 = ctx.requestSubmittedAt ?? ctx.requestCreatedAt;
  const pname = principalProductName(row);

  /** — Chapitre origine — */
  if (row.line_source === "pharmacist_proposed") {
    const originLines: string[] = [];
    const originLabel = ctx.pharmacistProposedOriginLabel ?? "Produit proposé par la pharmacie";
    originLines.push(`${originLabel} : ${pname}`);
    const motif = row.pharmacist_proposal_reason?.trim();
    if (motif) originLines.push(`Motif : ${motif}`);
    originLines.push(`Quantité proposée : ${row.requested_qty}`);
    pushEvent(events, {
      kind: "origin_pharmacist_proposed",
      phase: "origin",
      atIso: t0,
      sortKey: 10,
      title: lineEventTitle("origin_pharmacist_proposed", audience),
      bodyLines: originLines,
      actorLabel: ph ? "Vous" : "La pharmacie",
      actorTone: "pharmacy",
      isSynthetic: true,
    });
  } else {
    const originLines: string[] = [];
    const patientOrigin = ctx.patientLineOriginLabel?.trim();
    if (patientOrigin) originLines.push(patientOrigin);
    originLines.push(`Produit : ${pname}`);
    originLines.push(`Quantité demandée : ${row.requested_qty}`);
    if (row.client_comment?.trim()) {
      originLines.push(
        ph ? `Note patient : « ${row.client_comment.trim()} »` : `Votre note : « ${row.client_comment.trim()} »`
      );
    }
    pushEvent(events, {
      kind: "origin_patient_request",
      phase: "origin",
      atIso: t0,
      sortKey: 10,
      title: lineEventTitle("origin_patient_request", audience),
      bodyLines: originLines,
      actorLabel: ph ? "Le patient" : "Vous",
      actorTone: "patient",
      isSynthetic: true,
    });
  }

  /** — Chapitre réponse — */
  if (ctx.requestRespondedAt) {
    const rp: string[] = [];
    const principalAvail = row.availability_status
      ? availabilityStatusFr[row.availability_status] ?? row.availability_status
      : null;
    if (principalAvail) rp.push(`Disponibilité : ${principalAvail}`);
    if (row.available_qty != null && row.availability_status !== "market_shortage") {
      rp.push(ph ? `Quantité proposée : ${row.available_qty}` : `Quantité proposée : ${row.available_qty}`);
    }
    if (row.unit_price != null) rp.push(`Prix unitaire : ${Number(row.unit_price).toFixed(2)} MAD`);
    if (row.expected_availability_date && row.availability_status === "to_order") {
      rp.push(`Réception prévue : ${formatDateShortFr(row.expected_availability_date)}`);
    }
    const alts = altRowsOf(row);
    if (alts.length > 0) {
      const altNames = alts
        .map((alt) => oneProdAlt(alt.products)?.name?.trim())
        .filter(Boolean)
        .slice(0, 3);
      if (altNames.length > 0) {
        rp.push(
          altNames.length === 1
            ? `Alternative proposée : ${altNames[0]}`
            : `Alternatives proposées : ${altNames.join(", ")}${alts.length > 3 ? "…" : ""}`
        );
      }
    }
    if (row.pharmacist_comment?.trim()) {
      rp.push(
        ph
          ? `Note officine : « ${row.pharmacist_comment.trim()} »`
          : `Message : « ${row.pharmacist_comment.trim()} »`
      );
    }
    pushEvent(events, {
      kind: "pharmacist_response",
      phase: "response",
      atIso: ctx.requestRespondedAt,
      sortKey: 20,
      title: lineEventTitle("pharmacist_response", audience),
      bodyLines: rp.length > 0 ? rp : [`Produit : ${pname}`],
      actorLabel: ph ? "Vous" : "La pharmacie",
      actorTone: "pharmacy",
      isSynthetic: true,
    });
  }

  /** — Chapitre validation — */
  if (ctx.requestConfirmedAt) {
    if (row.is_selected_by_patient) {
      const valLines: string[] = [];
      const chosenId = row.patient_chosen_alternative_id ?? null;
      if (chosenId) {
        valLines.push(`Produit retenu : ${validatedProductLabel(row)} (alternative)`);
        valLines.push(`Demandé initialement : ${pname}`);
      } else {
        valLines.push(`Produit retenu : ${validatedProductLabel(row)}`);
      }
      valLines.push(`Quantité retenue : ${row.selected_qty ?? row.requested_qty}`);
      pushEvent(events, {
        kind: "patient_validation_kept",
        phase: "validation",
        atIso: ctx.requestConfirmedAt,
        sortKey: 30,
        title: lineEventTitle("patient_validation_kept", audience),
        bodyLines: valLines,
        actorLabel: ph ? "Le patient" : "Vous",
        actorTone: "patient",
        isSynthetic: true,
      });
    } else {
      pushEvent(events, {
        kind: "patient_validation_skipped",
        phase: "validation",
        atIso: ctx.requestConfirmedAt,
        sortKey: 30,
        title: lineEventTitle("patient_validation_skipped", audience),
        bodyLines: [
          ph
            ? "Ce produit n'entre pas dans la commande validée."
            : "Ce produit ne fait pas partie de votre commande.",
        ],
        actorLabel: ph ? "Le patient" : "Vous",
        actorTone: "patient",
        isSynthetic: true,
      });
    }
  }

  /** — Journal dossier (comptoir + traces legacy) — */
  let lastCounterPayload: string | null = null;
  for (const h of histAsc) {
    const r = (h.reason ?? "").trim();

    if (r.startsWith("counter_outcome:")) {
      const payload = counterOutcomeReasonPayload(r);
      if (!dossierRowRelevantForLine(row, h)) continue;
      if (payload === lastCounterPayload) continue;
      lastCounterPayload = payload;
      const kind = counterEventKind(payload);
      const detailLines = filterProductTimelineDetailLines(historyParas(h.reason).filter(Boolean));
      pushEvent(events, {
        kind,
        phase: "counter",
        atIso: h.created_at,
        sortKey: 55,
        title: lineEventTitle(kind, audience),
        bodyLines: detailLines.length > 0 ? detailLines.slice(0, 4) : [lineEventTitle(kind, audience)],
        actorLabel: historyActorLabelFr(h.reason, viewerRole),
        actorTone: historyActorToneFromReason(h.reason, viewerRole),
      });
      continue;
    }

    const audit = tryParsePatientHistoryAudit(r);
    if (audit) {
      const linesDetail = audit.lines.filter((L) => productMatchesTimeline(row, L.productName));
      if (linesDetail.length === 0) continue;
      if (amendList.length > 0 && amendNearTimestamp(h.created_at, amendList)) continue;
      pushEvent(events, {
        kind: "legacy_audit_adjustment",
        phase: "preparation",
        atIso: h.created_at,
        sortKey: 50,
        title: lineEventTitle("legacy_audit_adjustment", audience),
        bodyLines: patientHistoryAuditDetailLines({ ...audit, lines: linesDetail }, ph ? "pharmacist" : "patient"),
        actorLabel: "La pharmacie",
        actorTone: "pharmacy",
      });
      continue;
    }

    if (!dossierRowRelevantForLine(row, h)) continue;
    const detailLines = filterProductTimelineDetailLines(historyParas(h.reason).filter(Boolean));
    if (detailLines.length === 0) continue;
    pushEvent(events, {
      kind: "dossier_line_note",
      phase: "preparation",
      atIso: h.created_at,
      sortKey: 52,
      title: lineEventTitle("dossier_line_note", audience),
      bodyLines: detailLines.slice(0, 4),
      actorLabel: historyActorLabelFr(h.reason, viewerRole),
      actorTone: historyActorToneFromReason(h.reason, viewerRole),
    });
  }

  /** — Amendements officine (source de vérité post-validé) — */
  const seenAmendKeys = new Set<string>();
  for (const am of amendList) {
    const dedupeKey = `${am.created_at}|${am.entry.kind ?? ""}|${(am.entry.detail ?? am.entry.summary ?? "").slice(0, 100)}`;
    if (seenAmendKeys.has(dedupeKey)) continue;
    seenAmendKeys.add(dedupeKey);
    const eventKind = supplyAmendmentKindToLineEventKind(am.entry.kind);
    pushEvent(events, {
      kind: eventKind,
      phase: eventKind.startsWith("counter_") ? "counter" : "preparation",
      atIso: am.created_at,
      sortKey: 60,
      title: lineEventTitle(eventKind, audience),
      bodyLines: amendmentBodyLines(am.entry, audience),
      actorLabel: "La pharmacie",
      actorTone: "pharmacy",
    });
  }

  /** — Écart sans journal (clôture comptoir partielle ou données legacy) — */
  const hasWithdrawAmend = amendList.some((a) => (a.entry.kind ?? "").trim() === "withdraw_after_confirm");
  if (row.is_selected_by_patient && Boolean(row.withdrawn_after_confirm) && !hasWithdrawAmend) {
    const { atIso, autoAtClosure } = inferWithdrawTimestamp(ctx, histAsc);
    const kind: LineEventKind = autoAtClosure ? "withdraw_auto_at_closure" : "withdraw_inferred";
    const bodyLines = [`Produit : ${validatedProductLabel(row)}`];
    bodyLines.push(
      autoAtClosure
        ? ph
          ? "Écarté automatiquement à la clôture (non récupéré au comptoir)."
          : "Écarté automatiquement à la clôture, car non récupéré au comptoir."
        : ph
          ? "Écarté de la commande active."
          : "Écarté de votre commande active."
    );
    pushEvent(events, {
      kind,
      phase: "preparation",
      atIso,
      sortKey: 62,
      title: lineEventTitle(kind, audience),
      bodyLines,
      actorLabel: "La pharmacie",
      actorTone: "pharmacy",
      isSynthetic: true,
    });
  }

  /** — Épilogue court (pas de répétition du détail déjà tracé) — */
  const lastTs =
    events.length > 0
      ? events[events.length - 1]!.atIso
      : ctx.requestConfirmedAt ?? ctx.requestRespondedAt ?? t0;

  if (isArchived) {
    const closureLines: string[] = [];
    if (row.is_selected_by_patient) {
      if ((row.counter_outcome ?? "unset") === "picked_up") {
        closureLines.push("Récupéré au comptoir.");
      } else if (row.withdrawn_after_confirm) {
        closureLines.push("Écarté de la commande active.");
      } else {
        closureLines.push(`Produit : ${validatedProductLabel(row)}`);
      }
    } else {
      closureLines.push("Non retenu à la validation.");
    }
    if (reqStatus === "expired") closureLines.push(ph ? "Dossier expiré." : "Demande expirée.");
    else if (reqStatus === "cancelled" || reqStatus === "abandoned") {
      closureLines.push(ph ? "Dossier annulé ou abandonné." : "Demande annulée ou abandonnée.");
    } else if (TERMINAL_REQUEST_STATUSES.has(reqStatus)) {
      closureLines.push(ph ? "Dossier clôturé." : "Demande terminée.");
    }
    pushEvent(events, {
      kind: "epilogue_archived",
      phase: "epilogue",
      atIso: lastTs,
      sortKey: 90,
      title: lineEventTitle("epilogue_archived", audience),
      bodyLines: closureLines,
      actorLabel: ph ? "Synthèse" : "Récap",
      actorTone: "system",
      isCurrent: true,
      isSynthetic: true,
    });
  } else if (row.is_selected_by_patient) {
    const epilogueLines: string[] = [];
    const eff = effectiveAvailabilityForPatientLine(row);
    const pcf = row.post_confirm_fulfillment ?? "unset";
    const co = row.counter_outcome ?? "unset";

    if (row.withdrawn_after_confirm) {
      epilogueLines.push(ph ? "Écarté — plus dans la commande active." : "Écarté de votre commande active.");
    } else if (co === "picked_up") {
      epilogueLines.push("Récupéré au comptoir.");
    } else {
      const prep = postConfirmFulfillmentShortFr(pcf);
      if (pcf !== "unset") epilogueLines.push(`Préparation : ${prep}.`);
      else if (eff === "to_order") epilogueLines.push("En attente de réception fournisseur.");
      else if (eff === "available" || eff === "partially_available") {
        epilogueLines.push("En attente de votre passage.");
      }
      const eta = effectiveEtaForPatientLine(row);
      if (eff === "to_order" && eta && pcf !== "arrived_reserved") {
        epilogueLines.push(`Réception prévue : ${formatDateShortFr(eta)}.`);
      }
      const trackedQty = effectiveAvailableQtyForPatientLine(row);
      const validatedQty = validatedQtyForPatientLine(row);
      if (trackedQty != null && trackedQty !== validatedQty) {
        epilogueLines.push(`Quantité suivie : ${trackedQty} (validée : ${validatedQty}).`);
      }
      if (co !== "unset") {
        epilogueLines.push(
          `Comptoir : ${counterOutcomePatientLabel(co, row.counter_cancel_reason ?? null)}.`
        );
      }
    }

    if (epilogueLines.length > 0) {
      pushEvent(events, {
        kind: "epilogue_active",
        phase: "epilogue",
        atIso: lastTs,
        sortKey: 95,
        title: lineEventTitle("epilogue_active", audience),
        bodyLines: epilogueLines.slice(0, 4),
        actorLabel: ph ? "Maintenant" : "Aujourd'hui",
        actorTone: "system",
        isCurrent: true,
        isSynthetic: true,
      });
    }
  } else if (ctx.requestConfirmedAt) {
    pushEvent(events, {
      kind: "epilogue_active",
      phase: "epilogue",
      atIso: lastTs,
      sortKey: 95,
      title: lineEventTitle("epilogue_active", audience),
      bodyLines: [ph ? "Non retenu à la validation." : "Vous ne l'avez pas retenu."],
      actorLabel: ph ? "Maintenant" : "Aujourd'hui",
      actorTone: "system",
      isCurrent: true,
      isSynthetic: true,
    });
  }

  return dedupeEvents(
    [...events].sort((a, b) => {
      const ta = new Date(a.atIso).getTime();
      const tb = new Date(b.atIso).getTime();
      if (ta !== tb) return ta - tb;
      return a.sortKey - b.sortKey;
    })
  );
}

export function phaseForEventKind(kind: LineEventKind): LineHistoryPhase {
  if (kind.startsWith("origin_")) return "origin";
  if (kind === "pharmacist_response") return "response";
  if (kind.startsWith("patient_validation_")) return "validation";
  if (kind.startsWith("counter_")) return "counter";
  if (kind.startsWith("epilogue_")) return "epilogue";
  return "preparation";
}
