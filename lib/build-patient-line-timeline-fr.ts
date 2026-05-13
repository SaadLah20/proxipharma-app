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
        return "Modifié après validation";
      case "line_added_after_confirm":
        return "Ajouté après modification";
      case "line_removed_after_confirm":
        return "Retiré après validation";
      case "withdraw_after_confirm":
        return "Écart après validation";
      case "reintegrate_after_confirm":
      case "reintegrate":
        return "Réintégré après validation";
      case "line_brought_to_reserve_after_validation":
        return "Replacé sur à réserver";
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
};

/** Chronologie du plus ancien (haut) au plus récent (bas). Dernier bloc = situation actuelle. */
export function buildPatientLineTimelineFr(input: PatientLineTimelineInputs): PatientLineTimelineBlockFr[] {
  const { row } = input;
  const amendList = amendmentsForPatientLine(row, input.supplyBundles);
  const histAsc = [...(input.dossierHistory ?? [])].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
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
    originParts.push(
      `Ligne issue d’une proposition pharmacie (« ${row.pharmacist_proposal_reason?.trim() || "motif indicatif officine"} »).`
    );
    originParts.push(`Produit proposé : ${pname} · qté ${row.requested_qty}.`);
  } else {
    originParts.push(`Produit demandé : ${pname} · qté demandée ${row.requested_qty}.`);
  }
  if (row.client_comment?.trim()) {
    originParts.push(`Votre précision : ${row.client_comment.trim()}`);
  }
  push(t0, "Votre demande transmise", originParts.join("\n"), "Vous");

  /** Réponse officine (instantanée réponse dossier). */
  if (input.requestRespondedAt) {
    const rp: string[] = [];
    rp.push(`Disponibilité sur le principal : ${row.availability_status ? availabilityStatusFr[row.availability_status] ?? row.availability_status : "—"}`);
    if (row.unit_price != null) rp.push(`Prix communiqué (principal) : ${Number(row.unit_price).toFixed(2)} MAD`);
    if (row.expected_availability_date && row.availability_status === "to_order") {
      rp.push(`Réception indiquée (principal) : ${formatDateShortFr(row.expected_availability_date)}`);
    }
    if (row.pharmacist_comment?.trim()) {
      rp.push(`Note officine (ligne) : ${row.pharmacist_comment.trim()}`);
    }
    const altRaw = row.request_item_alternatives;
    const alts = !altRaw ? [] : Array.isArray(altRaw) ? [...altRaw] : [altRaw];
    if (Array.isArray(alts) && alts.length > 0) {
      rp.push(`Alternatives proposées : ${alts.length} · détail disponible lors de votre choix lors de la validation.`);
      for (const a of alts) {
        const an = oneProdAlt((a as { products?: unknown }).products)?.name ?? "Alternative";
        const st = (a as { availability_status?: string | null }).availability_status;
        rp.push(
          `• ${an}${st ? ` — ${availabilityStatusFr[st] ?? st}` : ""}`
        );
      }
    }
    push(input.requestRespondedAt, "Réponse officine publiée", rp.join("\n"), "La pharmacie");
  }

  /** Validation patient */
  if (row.is_selected_by_patient && input.requestConfirmedAt) {
    const chosenId = row.patient_chosen_alternative_id ?? null;
    let choiceTxt: string;
    if (chosenId) {
      choiceTxt = `Vous retenez l’alternative « ${validatedProductLabel(row)} » (référence initiale dans la liste : ${principalName(row)}).`;
    } else {
      choiceTxt = `Vous retenez le produit principal « ${validatedProductLabel(row)} ».`;
    }
    const qty = row.selected_qty ?? row.requested_qty;
    push(
      input.requestConfirmedAt,
      "Vous validez cette ligne sur la commande",
      `${choiceTxt}\nQuantité validée : ${qty}.`,
      "Vous"
    );
  } else if (input.requestConfirmedAt && !row.is_selected_by_patient) {
    push(
      input.requestConfirmedAt,
      "Ligne non retenue lors de votre validation",
      `Aucune commande/pharmacie préparation sur ce produit pour ce dossier — trace conservée à titre informatif.`,
      "Vous"
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
    push(am.created_at, "Ajustement après votre validation", summarizeSupplyAmendmentEntry(am.entry), "La pharmacie");
  }

  /** Entrées d’historique statut dossier hors audit (filtre léger si la raison cite le nom produit ou l’uuid — rare). */
  for (const h of histAsc) {
    if (tryParsePatientHistoryAudit(h.reason)) continue;
    const r = `${h.reason ?? ""}`.toLowerCase();
    if (!r) continue;
    if (!r.includes(row.id.toLowerCase()) && !r.includes(validatedProductLabel(row).toLowerCase())) continue;
    const statusLine = `${h.old_status ? `De « ${requestStatusFr[h.old_status] ?? h.old_status} » à ` : ""}« ${requestStatusFr[h.new_status] ?? h.new_status} »`;
    const detail = patientDossierHistoryDetailParagraphsFr(h.reason).filter(Boolean).join("\n");
    const body = detail ? `${statusLine}\n${detail}` : statusLine;
    push(h.created_at, "Événement dossier lié à cette ligne", body, "Système / officine");
  }

  /** État actuel */
  const eff = effectiveAvailabilityForPatientLine(row);
  const eta = effectiveEtaForPatientLine(row);
  const curParts: string[] = [];
  curParts.push(`Produit suivi · ${validatedProductLabel(row)}`);
  if (row.is_selected_by_patient) {
    curParts.push(`Qté validée : ${row.selected_qty ?? row.requested_qty}`);
    curParts.push(`Disponibilité (branche retenue) : ${eff ? availabilityStatusFr[eff] ?? eff : "—"}`);
    if (eff === "to_order" && eta) curParts.push(`Date de disponibilité indiquée : ${formatDateShortFr(eta)}`);
    curParts.push(`Préparation (indicatif) : ${postConfirmFulfillmentShortFr(row.post_confirm_fulfillment)}`);
    if ((row.counter_outcome ?? "unset") !== "unset") {
      curParts.push(
        `Suivi comptoir : ${counterOutcomePatientLabel(row.counter_outcome, row.counter_cancel_reason ?? null)}${row.counter_cancel_detail ? ` — ${row.counter_cancel_detail}` : ""}`
      );
    } else {
      curParts.push("Comptoir : pas encore indiqué sur cette ligne.");
    }
    if (row.withdrawn_after_confirm) {
      curParts.push("Ligne écartée après votre validation (accord officine communiqué) — aucun suivi de retrait actif.");
    }
  } else {
    curParts.push("Ligne hors périmètre de votre commande validée (non retenue).");
  }
  const lastTs =
    amendList.slice(-1)[0]?.created_at ??
    input.requestConfirmedAt ??
    input.requestRespondedAt ??
    t0;
  push(lastTs ?? null, "Aujourd’hui sur cette ligne", curParts.join("\n"), "Synthèse", true);

  return blocks;
}

function postConfirmFulfillmentShortFr(v: string | null | undefined): string {
  if (v === "reserved") return "Réservation en officine";
  if (v === "ordered") return "Commande fournisseur";
  if (v === "arrived_reserved") return "Reçu en officine · prêt au comptoir";
  return "À préciser";
}
