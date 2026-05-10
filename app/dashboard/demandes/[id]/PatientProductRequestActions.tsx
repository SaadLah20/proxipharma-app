"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  ChevronDown,
  History,
  Layers,
  Mail,
  MessageCircle,
  MessageSquare,
  Minus,
  Package,
  Pencil,
  Phone,
  Plus,
  Search,
  ShoppingCart,
  Sparkles,
  Trash2,
} from "lucide-react";
import { formatDateShortFr, formatPlannedVisitFr, formatTime24hFr } from "@/lib/datetime-fr";
import {
  PATIENT_CANCEL_REASON_CODES,
  PATIENT_CANCEL_REASON_LABELS,
  type PatientCancelReasonCode,
} from "@/lib/patient-flow-reasons";
import { availabilityStatusFr, requestItemLineSourceFr } from "@/lib/request-display";
import { plannedVisitWindow } from "@/lib/planned-visit";
import {
  bucketPatientValidatedLinesThreeWays,
  effectiveAvailabilityForPatientLine,
  effectiveEtaForPatientLine,
  validatedBranchUnitPriceMad,
  validatedProductLabel,
  validatedQtyForPatientLine,
} from "@/lib/patient-confirmed-line-buckets";
import { unitPriceLabel } from "@/lib/product-price";
import { supabase } from "@/lib/supabase";
import { one } from "@/lib/embed";
import {
  buildPatientLineTimelineFr,
  type PatientLineTimelineBlockFr,
} from "@/lib/build-patient-line-timeline-fr";
import { LineHistoryModalFr } from "@/components/requests/line-history-modal-fr";
import { patientLineSuiviModel } from "@/lib/patient-line-suivi-fr";
import { isRequestItemAddedAfterPatientConfirmation } from "@/lib/supply-line-post-confirm";
import { isPatientProductArchiveStatus } from "@/components/requests/patient-request-outcome-banner";

type ProdBrief = { name: string; price_pph?: number | null; photo_url?: string | null };

export type ActionItemAltRow = {
  id: string;
  rank: number;
  availability_status: string | null;
  available_qty: number | null;
  unit_price: number | null;
  pharmacist_comment: string | null;
  expected_availability_date: string | null;
  products: ProdBrief | ProdBrief[] | null;
};

export type ActionItemRow = {
  id: string;
  product_id: string;
  requested_qty: number;
  selected_qty: number | null;
  is_selected_by_patient: boolean;
  availability_status: string | null;
  available_qty: number | null;
  unit_price: number | null;
  pharmacist_comment: string | null;
  /** Q11 note patient par ligne */
  client_comment?: string | null;
  /** Q20 */
  line_source?: string | null;
  pharmacist_proposal_reason?: string | null;
  counter_outcome: string;
  counter_cancel_reason?: string | null;
  counter_cancel_detail?: string | null;
  expected_availability_date: string | null;
  post_confirm_fulfillment?: string | null;
  withdrawn_after_confirm?: boolean | null;
  products: ProdBrief | ProdBrief[] | null;
  patient_chosen_alternative_id?: string | null;
  request_item_alternatives?: ActionItemAltRow | ActionItemAltRow[] | null;
};

/** null = rien pour cette ligne ; "principal" ; sinon id alternative */
export type LineBranch = null | "principal" | string;

export type LineSelState = { branch: LineBranch; qty: number };

function normalizeAlternatives(raw: ActionItemAltRow | ActionItemAltRow[] | null | undefined): ActionItemAltRow[] {
  if (!raw) return [];
  return Array.isArray(raw) ? [...raw].sort((a, b) => a.rank - b.rank) : [raw];
}

function isMarketShortage(st: string | null | undefined): boolean {
  return st === "market_shortage";
}

function maxQtyPrincipal(row: ActionItemRow): number {
  if (isMarketShortage(row.availability_status)) return 0;
  if (row.availability_status === "unavailable") return 0;
  let cap = row.requested_qty;
  if (row.available_qty != null) cap = Math.min(cap, row.available_qty);
  return Math.max(0, cap);
}

function maxQtyAlt(row: ActionItemRow, alt: ActionItemAltRow): number {
  if (isMarketShortage(alt.availability_status)) return 0;
  if (alt.availability_status === "unavailable") return 0;
  let cap = row.requested_qty;
  if (alt.available_qty != null) cap = Math.min(cap, alt.available_qty);
  return Math.max(0, cap);
}

function maxQtyForBranch(row: ActionItemRow, branch: LineBranch, alts: ActionItemAltRow[]): number {
  if (branch === null) return 0;
  if (branch === "principal") return maxQtyPrincipal(row);
  const alt = alts.find((a) => a.id === branch);
  if (!alt) return 0;
  return maxQtyAlt(row, alt);
}

function telHrefPatient(raw: string): string {
  const d = raw.replace(/\D/g, "");
  return d.length >= 8 ? `tel:${d}` : `tel:${raw.trim()}`;
}

function smsHrefPatient(raw: string): string {
  const d = raw.replace(/\D/g, "");
  return d.length >= 8 ? `sms:${d}` : `sms:${raw.trim()}`;
}

function whatsappHrefPatient(raw: string): string {
  const d = raw.replace(/\D/g, "");
  return `https://wa.me/${d}`;
}

function PatientPharmacyQuickContact({
  pharmacy,
  requestRef,
}: {
  pharmacy: PatientPharmacyContactInfo;
  requestRef: string;
}) {
  const telRaw = pharmacy.telephone?.trim() ?? "";
  const digits = telRaw.replace(/\D/g, "");
  const telOk = digits.length >= 8 || telRaw.length >= 8;
  const mail = pharmacy.contact_email?.trim() ?? "";
  const mailOk = mail.length > 4 && mail.includes("@");

  const mailHref = mailOk
    ? `mailto:${mail}?subject=${encodeURIComponent(`Demande ${requestRef}`)}&body=${encodeURIComponent(
        `Bonjour,\n\nConcernant ma demande ${requestRef} :\n\n`
      )}`
    : "";

  const loc = [pharmacy.nom, pharmacy.ville?.trim()].filter(Boolean).join(" · ");

  return (
    <section className="rounded-xl border border-emerald-300/60 bg-gradient-to-br from-emerald-50/85 via-white to-teal-50/40 p-2 shadow-sm ring-1 ring-emerald-200/45">
      <h3 className="text-[10px] font-bold uppercase tracking-wide text-emerald-950">Contacter l&apos;officine</h3>
      <p className="mt-1 text-[10px] leading-snug text-emerald-950/88">
        Pour un ajustement sur un produit déjà validé, contactez directement la pharmacie.
      </p>
      {loc ? (
        <p className="mt-1 text-[11px] font-semibold leading-snug text-emerald-950">{loc}</p>
      ) : null}
      {(telOk || mailOk) ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {telOk ? (
            <>
              <a
                href={telHrefPatient(telRaw)}
                className="inline-flex size-9 items-center justify-center rounded-lg border border-emerald-400/70 bg-white text-emerald-900 shadow-sm transition hover:bg-emerald-50"
                title="Appeler"
                aria-label="Appeler la pharmacie"
              >
                <Phone className="size-4 shrink-0" strokeWidth={2} aria-hidden />
              </a>
              <a
                href={smsHrefPatient(telRaw)}
                className="inline-flex size-9 items-center justify-center rounded-lg border border-emerald-400/70 bg-white text-emerald-900 shadow-sm transition hover:bg-emerald-50"
                title="SMS"
                aria-label="Envoyer un SMS"
              >
                <MessageSquare className="size-4 shrink-0" strokeWidth={2} aria-hidden />
              </a>
              <a
                href={whatsappHrefPatient(telRaw)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex size-9 items-center justify-center rounded-lg border border-emerald-400/70 bg-white text-emerald-900 shadow-sm transition hover:bg-emerald-50"
                title="WhatsApp"
                aria-label="Discuter sur WhatsApp"
              >
                <MessageCircle className="size-4 shrink-0" strokeWidth={2} aria-hidden />
              </a>
            </>
          ) : null}
          {mailOk ? (
            <a
              href={mailHref}
              className="inline-flex size-9 items-center justify-center rounded-lg border border-sky-400/70 bg-white text-sky-900 shadow-sm transition hover:bg-sky-50"
              title="Courriel"
              aria-label="Écrire à la pharmacie"
            >
              <Mail className="size-4 shrink-0" strokeWidth={2} aria-hidden />
            </a>
          ) : null}
        </div>
      ) : (
        <p className="mt-1.5 text-[9px] leading-snug text-emerald-900/80">
          Coordonnées non renseignées sur le dossier — rapprochez-vous de l&apos;officine.
        </p>
      )}
    </section>
  );
}

function monetaryTotalsForRetainedLines(rows: ActionItemRow[]): { count: number; sumKnown: number; missingPrice: boolean } {
  let sumKnown = 0;
  let missingPrice = false;
  let count = 0;
  for (const row of rows) {
    if (!row.is_selected_by_patient || row.withdrawn_after_confirm) continue;
    count += 1;
    const unit = validatedBranchUnitPriceMad(row);
    const qty = validatedQtyForPatientLine(row);
    if (unit == null) missingPrice = true;
    else sumKnown += unit * qty;
  }
  return { count, sumKnown, missingPrice };
}

/** Libellé court sur une ligne (mobile). */
function compactTotalMadLabel(t: { sumKnown: number; missingPrice: boolean; empty: boolean }): string {
  if (t.empty) return "—";
  if (t.missingPrice && t.sumKnown === 0) return "Total —";
  if (t.missingPrice) return `Total · ${t.sumKnown.toFixed(2)} MAD · partiel`;
  return `Total · ${t.sumKnown.toFixed(2)} MAD`;
}

function PatientLineSuiviStrip({
  row,
  bundles,
}: {
  row: ActionItemRow;
  bundles: { id: string; created_at: string; amendments: unknown }[];
}) {
  const m = patientLineSuiviModel(row, bundles);
  return (
    <div className="border-t border-slate-200/90 bg-slate-50/95 px-2 py-1.5 text-[9px] leading-snug text-slate-800">
      <p>
        <span className="font-bold text-slate-900">Suivi · </span>
        {m.etat}
      </p>
      {m.modif ? <p className="mt-0.5 text-slate-700">{m.modif}</p> : null}
      {m.ajout ? <p className="mt-0.5 text-violet-900/90">{m.ajout}</p> : null}
    </div>
  );
}

/** Cartes condensées : produits validés après confirmation (pas de détail jusqu’à l’historique). */
function PatientValidatedCompactLineCard({
  row,
  tier,
  onOpenHistory,
  suivi,
  supplyAmendmentBundles = [],
}: {
  row: ActionItemRow;
  tier: "dispo_officine" | "commande" | "hors_perimetre" | "retire_apres_validation";
  onOpenHistory: () => void;
  suivi?: ReactNode;
  supplyAmendmentBundles?: { id: string; created_at: string; amendments: unknown }[];
}) {
  const prod = one(row.products);
  const altList = normalizeAlternatives(row.request_item_alternatives);
  const chosenAlt = altList.find((a) => a.id === row.patient_chosen_alternative_id);
  const validatedName = validatedProductLabel(row);
  const validatedQty = validatedQtyForPatientLine(row);
  const unitMad = validatedBranchUnitPriceMad(row);
  const lineTotalMad = unitMad != null ? unitMad * validatedQty : null;
  const thumbUrl = chosenAlt ? one(chosenAlt.products)?.photo_url ?? null : prod?.photo_url ?? null;
  const eff = effectiveAvailabilityForPatientLine(row);
  const eta = effectiveEtaForPatientLine(row);

  let availSentence: string;
  if (!row.is_selected_by_patient) {
    availSentence = "Non retenu lors de votre validation.";
  } else if (eff) {
    availSentence =
      `${availabilityStatusFr[eff] ?? eff}` +
      (eff === "to_order" && eta ? ` · dispo indicative ${formatDateShortFr(eta)}` : "");
  } else {
    availSentence = "Dispo communiquée par la pharmacie à l’historique.";
  }

  const ring =
    tier === "dispo_officine"
      ? "border-emerald-200/80 hover:border-emerald-300"
      : tier === "commande"
        ? "border-teal-200/85 hover:border-teal-300"
        : tier === "retire_apres_validation"
          ? "border-amber-300/85 hover:border-amber-400"
          : "border-border/85 hover:border-muted-foreground/35";

  const withdrawnGrey = tier === "retire_apres_validation";
  const showAjoutOfficineBadge =
    row.line_source === "pharmacist_proposed" &&
    isRequestItemAddedAfterPatientConfirmation(row.id, supplyAmendmentBundles);
  return (
    <li
      className={`overflow-hidden rounded-md border bg-card shadow-sm transition ${ring} ${
        withdrawnGrey ? "opacity-[0.72] saturate-[0.65]" : ""
      }`}
    >
      <div className="flex items-stretch gap-2 p-1.5">
        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded border border-border/70 bg-muted/20">
        {thumbUrl ? (
          <img src={thumbUrl} alt="" className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center">
            <Package className="size-5 text-muted-foreground" aria-hidden />
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 items-stretch gap-1">
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[11px] font-semibold leading-snug text-foreground">{validatedName}</p>
          <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-muted-foreground">
            <span className="tabular-nums font-medium text-foreground">Qté {validatedQty}</span>
            {showAjoutOfficineBadge ? (
              <span className="ms-1 rounded bg-violet-100 px-1 py-0.5 text-[8px] font-bold uppercase tracking-wide text-violet-950">
                Ajout officine
              </span>
            ) : null}
            {tier === "retire_apres_validation" ? (
              <span className="ms-1 rounded bg-amber-100 px-1 py-0.5 text-[8px] font-bold uppercase tracking-wide text-amber-950">
                Écart
              </span>
            ) : null}
            <span className="text-border" aria-hidden>
              {" "}
              ·{" "}
            </span>
            <span className="text-foreground">{availSentence}</span>
          </p>
          <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
            <span className="text-foreground/90">Prix unit. </span>
            <span className="tabular-nums font-semibold text-foreground">
              {unitMad != null ? `${unitMad.toFixed(2)} MAD` : "—"}
            </span>
            <span className="mx-1 text-border" aria-hidden>
              ·
            </span>
            <span className="text-foreground/90">Total </span>
            <span
              className={`tabular-nums font-semibold text-primary ${withdrawnGrey ? "line-through decoration-muted-foreground/70" : ""}`}
            >
              {lineTotalMad != null ? `${lineTotalMad.toFixed(2)} MAD` : "—"}
            </span>
          </p>
        </div>
        <div className="flex shrink-0 flex-col justify-end pb-px">
          <button
            type="button"
            onClick={onOpenHistory}
            className="inline-flex size-7 items-center justify-center rounded-md border border-primary/35 bg-primary/5 text-primary hover:bg-primary/10"
            aria-label="Historique de cette ligne"
            title="Historique"
          >
            <History className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
          </button>
        </div>
        </div>
      </div>
      {suivi}
    </li>
  );
}

function PatientTraceNotRetainedRow({
  row,
  onOpenHistory,
}: {
  row: ActionItemRow;
  onOpenHistory: () => void;
}) {
  const prod = one(row.products);
  const name = prod?.name ?? "Produit";
  const eff = row.availability_status;
  const lineKind =
    row.line_source === "pharmacist_proposed" ? (
      <span className="text-violet-800">{requestItemLineSourceFr.pharmacist_proposed}</span>
    ) : null;
  return (
    <li className="flex items-stretch gap-2 rounded-md border border-border/70 bg-muted/15 px-2 py-1.5">
      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded border border-border/60 bg-card">
        {prod?.photo_url ? (
          <img src={prod.photo_url} alt="" className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center">
            <Package className="size-5 text-muted-foreground" aria-hidden />
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 items-stretch gap-1">
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[10px] font-medium leading-snug">{name}</p>
          <p className="text-[10px] leading-snug text-muted-foreground">
            Demandé ×{row.requested_qty}
            {eff ? ` · ${availabilityStatusFr[eff] ?? eff}` : null}
            {lineKind ? <span className="mx-1">·</span> : null}
            {lineKind}
          </p>
        </div>
        <div className="flex shrink-0 flex-col justify-end pb-px">
          <button
            type="button"
            onClick={onOpenHistory}
            className="inline-flex size-7 items-center justify-center rounded-md border border-primary/35 bg-primary/5 text-primary hover:bg-primary/10"
            aria-label="Historique de cette ligne"
            title="Historique"
          >
            <History className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
          </button>
        </div>
      </div>
    </li>
  );
}

/** Archives (annulé, expiré, etc.) : mêmes cartes compactes que le dossier validé, sans actions ni suivi temps réel. */
function ReadonlyArchivedProductBucketsView({
  items,
  supplyAmendmentBundles,
  pharmacistGlobalComment,
  onOpenLineHistory,
}: {
  items: ActionItemRow[];
  supplyAmendmentBundles: { id: string; created_at: string; amendments: unknown }[];
  pharmacistGlobalComment: string | null | undefined;
  onOpenLineHistory: (itemId: string) => void;
}) {
  const totalsRetained = useMemo(() => monetaryTotalsForRetainedLines(items), [items]);
  const { dispoOfficine, aCommander, horsPerimetre, retireesApresValidation } =
    bucketPatientValidatedLinesThreeWays(items);
  const dispoRetenues = dispoOfficine.filter((r) => r.is_selected_by_patient);
  const aCommanderRetenues = aCommander.filter((r) => r.is_selected_by_patient);
  const horsPerimetreRetenues = horsPerimetre.filter((r) => r.is_selected_by_patient);
  const lignesNonRetenues = items.filter((r) => !r.is_selected_by_patient);
  const subtotalDispo = monetaryTotalsForRetainedLines(dispoRetenues);
  const subtotalCommande = monetaryTotalsForRetainedLines(aCommanderRetenues);
  const totalGrandLabel = compactTotalMadLabel({
    sumKnown: totalsRetained.sumKnown,
    missingPrice: totalsRetained.missingPrice,
    empty: totalsRetained.count < 1,
  });

  return (
    <div className="space-y-2">
      <div className="rounded-md border border-muted-foreground/25 bg-muted/20 px-2 py-1.5">
        <p className="text-[10px] font-semibold leading-snug text-foreground">Lecture seule</p>
        <p className="mt-0.5 text-[9px] leading-snug text-muted-foreground">
          Produits tels qu’au moment de la clôture du dossier (référence). Historique par ligne via le bouton horloge.
        </p>
      </div>

      {pharmacistGlobalComment?.trim() ? (
        <div className="rounded-md border border-emerald-200/80 bg-emerald-50/65 px-2 py-1.5">
          <p className="text-[8px] font-bold uppercase tracking-wide text-emerald-950">Message de la pharmacie</p>
          <p className="mt-0.5 whitespace-pre-wrap text-[10px] leading-snug text-emerald-950">
            {pharmacistGlobalComment.trim()}
          </p>
        </div>
      ) : null}

      <div className="flex flex-nowrap items-center justify-between gap-2 overflow-x-auto rounded-md border border-primary/20 bg-primary/[0.06] px-2 py-1.5">
        <p className="shrink-0 text-[10px] font-semibold text-foreground">
          <span className="tabular-nums">{totalsRetained.count}</span>{" "}
          {totalsRetained.count > 1 ? "produits retenus" : "produit retenu"}
        </p>
        <p className="shrink-0 text-[10px] font-semibold tabular-nums text-primary whitespace-nowrap">{totalGrandLabel}</p>
      </div>

      <div className="rounded-xl border-2 border-slate-200/80 bg-gradient-to-b from-slate-50/70 via-white to-white p-2 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9)] ring-1 ring-slate-200/50">
        {dispoRetenues.length > 0 ? (
          <section className="space-y-1.5">
            <div className="flex flex-nowrap items-center justify-between gap-2 overflow-x-auto text-emerald-950">
              <div className="flex min-w-0 items-center gap-1">
                <Package className="size-3.5 shrink-0 text-emerald-700" aria-hidden />
                <h3 className="text-[10px] font-bold uppercase tracking-wide">
                  À réserver (validé · {dispoRetenues.length})
                </h3>
              </div>
              <p className="shrink-0 text-[10px] font-semibold tabular-nums text-emerald-800 whitespace-nowrap">
                {compactTotalMadLabel({
                  sumKnown: subtotalDispo.sumKnown,
                  missingPrice: subtotalDispo.missingPrice,
                  empty: subtotalDispo.count < 1,
                })}
              </p>
            </div>
            <ul className="space-y-1.5">
              {dispoRetenues.map((row) => (
                <PatientValidatedCompactLineCard
                  key={row.id}
                  row={row}
                  tier="dispo_officine"
                  supplyAmendmentBundles={supplyAmendmentBundles}
                  onOpenHistory={() => onOpenLineHistory(row.id)}
                />
              ))}
            </ul>
          </section>
        ) : null}

        {aCommanderRetenues.length > 0 ? (
          <section className="mt-2 space-y-1.5">
            <div className="flex flex-nowrap items-center justify-between gap-2 overflow-x-auto text-teal-950">
              <div className="flex min-w-0 items-center gap-1">
                <ShoppingCart className="size-3.5 shrink-0 text-teal-800" aria-hidden />
                <h3 className="text-[10px] font-bold uppercase tracking-wide">
                  À commander (validé · {aCommanderRetenues.length})
                </h3>
              </div>
              <p className="shrink-0 text-[10px] font-semibold tabular-nums text-teal-900 whitespace-nowrap">
                {compactTotalMadLabel({
                  sumKnown: subtotalCommande.sumKnown,
                  missingPrice: subtotalCommande.missingPrice,
                  empty: subtotalCommande.count < 1,
                })}
              </p>
            </div>
            <ul className="space-y-1.5">
              {aCommanderRetenues.map((row) => (
                <PatientValidatedCompactLineCard
                  key={row.id}
                  row={row}
                  tier="commande"
                  supplyAmendmentBundles={supplyAmendmentBundles}
                  onOpenHistory={() => onOpenLineHistory(row.id)}
                />
              ))}
            </ul>
          </section>
        ) : null}

        {horsPerimetreRetenues.length > 0 ? (
          <section className="mt-2 space-y-1">
            <div className="flex items-center gap-1 text-amber-950">
              <Layers className="size-3.5 shrink-0 text-amber-800" aria-hidden />
              <h3 className="text-[10px] font-bold uppercase tracking-wide">Point d&apos;attention (hors bloc principal)</h3>
            </div>
            <ul className="space-y-1.5">
              {horsPerimetreRetenues.map((row) => (
                <PatientValidatedCompactLineCard
                  key={row.id}
                  row={row}
                  tier="hors_perimetre"
                  supplyAmendmentBundles={supplyAmendmentBundles}
                  onOpenHistory={() => onOpenLineHistory(row.id)}
                />
              ))}
            </ul>
          </section>
        ) : null}

        {retireesApresValidation.length > 0 ? (
          <section className="mt-2 space-y-1">
            <div className="flex items-center gap-1 text-amber-950">
              <Layers className="size-3.5 shrink-0 text-amber-900" aria-hidden />
              <h3 className="text-[10px] font-bold uppercase tracking-wide">
                Écart après validation ({retireesApresValidation.length})
              </h3>
            </div>
            <ul className="space-y-1.5">
              {retireesApresValidation.map((row) => (
                <PatientValidatedCompactLineCard
                  key={row.id}
                  row={row}
                  tier="retire_apres_validation"
                  supplyAmendmentBundles={supplyAmendmentBundles}
                  onOpenHistory={() => onOpenLineHistory(row.id)}
                />
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      {lignesNonRetenues.length > 0 ? (
        <details className="group rounded-md border border-border/80 bg-muted/10">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2 py-1.5 text-[10px] font-semibold [&::-webkit-details-marker]:hidden">
            <span>Lignes non retenues ({lignesNonRetenues.length})</span>
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <ul className="space-y-1 border-t border-border/60 px-2 py-1.5">
            {lignesNonRetenues.map((row) => (
              <PatientTraceNotRetainedRow key={row.id} row={row} onOpenHistory={() => onOpenLineHistory(row.id)} />
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

/** Défaut atelier : d’abord le principal disponible, sinon première alternative disponible, sinon rien */
function pickDefaultBranch(row: ActionItemRow, alts: ActionItemAltRow[]): LineBranch {
  if (maxQtyPrincipal(row) > 0) return "principal";
  for (const alt of alts) {
    if (maxQtyAlt(row, alt) > 0) return alt.id;
  }
  return null;
}

function computeSelFromItems(items: ActionItemRow[]): Record<string, LineSelState> {
  const next: Record<string, LineSelState> = {};
  for (const row of items) {
    const alts = normalizeAlternatives(row.request_item_alternatives);
    let branch = pickDefaultBranch(row, alts);
    let cap = maxQtyForBranch(row, branch, alts);
    if (branch !== null && cap < 1) branch = null;
    cap = maxQtyForBranch(row, branch, alts);
    const qty = branch !== null && cap > 0 ? cap : 1;
    next[row.id] = { branch, qty: branch !== null && cap > 0 ? Math.min(qty, cap) : 1 };
  }
  return next;
}

type ResubmitLine = {
  product_id: string;
  name: string;
  photo_url?: string | null;
  qty: number;
  price_pph?: number | null;
  client_comment: string;
  line_source?: string | null;
  pharmacist_proposal_reason?: string | null;
};

/** Tant que la réponse n’est pas publiée, les propositions officine sont un brouillon : le patient ne les voit qu’après `responded`. */
function visibleItemsForPatientBeforePharmacyResponse(items: ActionItemRow[], status: string): ActionItemRow[] {
  if (status !== "submitted" && status !== "in_review") return items;
  return items.filter((row) => row.line_source !== "pharmacist_proposed");
}

function computeResubmitLinesFromItems(items: ActionItemRow[]): ResubmitLine[] {
  return items.map((row) => ({
    product_id: row.product_id,
    name: one(row.products)?.name ?? "Produit",
    photo_url: one(row.products)?.photo_url ?? null,
    qty: Math.min(10, Math.max(1, row.requested_qty)),
    price_pph: one(row.products)?.price_pph ?? null,
    client_comment: row.client_comment ?? "",
    line_source: row.line_source ?? null,
    pharmacist_proposal_reason: row.pharmacist_proposal_reason ?? null,
  }));
}

type ProductHit = {
  id: string;
  name: string;
  product_type: string;
  laboratory: string | null;
  photo_url?: string | null;
  price_pph?: number | null;
};

export type PatientPharmacyContactInfo = {
  nom: string;
  ville?: string | null;
  telephone?: string | null;
  contact_email?: string | null;
};

type Props = {
  requestId: string;
  status: string;
  items: ActionItemRow[];
  initialPatientNote: string | null;
  initialPlannedVisitDate?: string | null;
  initialPlannedVisitTime?: string | null;
  onReload: () => Promise<void>;
  /** Coordonnées officine : affichées une fois la demande validée (passage direct). */
  pharmacyContact?: PatientPharmacyContactInfo | null;
  /** Référence courte (ex. PR-…) pour préremplir un courriel. */
  requestPublicRef?: string | null;
  supplyAmendmentBundles?: { id: string; created_at: string; amendments: unknown }[];
  /** Dernier commentaire officine « message global », non interne (`request_comments`). */
  pharmacistGlobalComment?: string | null;
  /** Dates dossier pour la timeline produit après validation */
  requestTimelineMeta?: {
    created_at: string;
    submitted_at: string | null;
    responded_at: string | null;
    confirmed_at: string | null;
  };
  /** `request_status_history` (filtre audit par produit dans le modal). */
  dossierHistoryRows?: { id: string; created_at: string; old_status: string | null; new_status: string; reason: string | null }[];
};

function clampVisitYmd(ymd: string, minY: string, maxY: string): string {
  if (ymd < minY) return minY;
  if (ymd > maxY) return maxY;
  return ymd;
}

function htmlTimeToPg(t: string): string | null {
  const s = t.trim();
  if (!s) return null;
  if (/^\d{2}:\d{2}$/.test(s)) return `${s}:00`;
  return s;
}

type RespondedChooserProps = {
  row: ActionItemRow;
  selState: LineSelState;
  setLineBranch: (itemId: string, branch: LineBranch) => void;
  setLineQty: (itemId: string, qty: number) => void;
  togglePrincipalOnlyLine: (itemId: string, on: boolean) => void;
};

/** Même résumé qté + dispo que la ligne ait des alternatives ou non. */
function RespondedProductQtyStatusLine({ row }: { row: ActionItemRow }) {
  const isProposedLine = row.line_source === "pharmacist_proposed";
  return (
    <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
      {!isProposedLine ? (
        <span>
          Demandé · <strong className="tabular-nums text-foreground">{row.requested_qty}</strong>
        </span>
      ) : null}
      {row.availability_status ? (
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-800">
          {availabilityStatusFr[row.availability_status] ?? row.availability_status}
        </span>
      ) : null}
      {row.availability_status === "to_order" && row.expected_availability_date ? (
        <span className="text-[10px]">
          Réception indicative · {formatDateShortFr(row.expected_availability_date)}
        </span>
      ) : null}
    </p>
  );
}

function RespondedPatientLineChooser({
  row,
  selState,
  setLineBranch,
  setLineQty,
  togglePrincipalOnlyLine,
}: RespondedChooserProps) {
  const prod = one(row.products);
  const prodUnitPrice = unitPriceLabel(prod?.price_pph);
  const altList = normalizeAlternatives(row.request_item_alternatives);
  const hasAlts = altList.length > 0;
  const capPrincipal = maxQtyPrincipal(row);
  const radioName = `line-choice-${row.id}`;
  const currentBranch = selState.branch;
  const isProposedLine = row.line_source === "pharmacist_proposed";
  const maxBranch = maxQtyForBranch(row, currentBranch, altList);

  const patientNote = row.client_comment?.trim();
  const pharmaLineNote = row.pharmacist_comment?.trim();

  const thumb = (
    <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
      {prod?.photo_url ? (
        <img src={prod.photo_url} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Package className="size-7 text-muted-foreground" aria-hidden />
        </div>
      )}
    </div>
  );

  const qtyStepper =
    currentBranch !== null && maxBranch > 0 ? (
      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-background/80 px-2.5 py-2">
        <span className="text-[11px] text-muted-foreground">
          Quantité <span className="tabular-nums">(max. {maxBranch})</span>
        </span>
        <button
          type="button"
          aria-label="Diminuer la quantité"
          disabled={selState.qty <= 1}
          className="rounded-lg border border-border bg-card p-1.5 text-foreground hover:bg-muted/60 disabled:opacity-40"
          onClick={() => setLineQty(row.id, selState.qty - 1)}
        >
          <Minus size={16} />
        </button>
        <span className="min-w-[2rem] text-center text-sm font-semibold tabular-nums">{selState.qty}</span>
        <button
          type="button"
          aria-label="Augmenter la quantité"
          disabled={selState.qty >= maxBranch}
          className="rounded-lg border border-border bg-card p-1.5 text-foreground hover:bg-muted/60 disabled:opacity-40"
          onClick={() => setLineQty(row.id, selState.qty + 1)}
        >
          <Plus size={16} />
        </button>
        {(() => {
          const branchPrice =
            currentBranch === "principal"
              ? row.unit_price
              : altList.find((a) => a.id === currentBranch)?.unit_price ?? null;
          return branchPrice != null ? (
            <span className="ml-auto text-[11px] font-semibold text-foreground">
              Total <span className="tabular-nums">{(selState.qty * Number(branchPrice)).toFixed(2)}</span> MAD
            </span>
          ) : null;
        })()}
      </div>
    ) : null;

  const commentsBlock =
    patientNote || pharmaLineNote ? (
      <div
        className={`mt-2.5 grid gap-2 ${patientNote && pharmaLineNote ? "sm:grid-cols-2" : ""}`}
      >
        {patientNote ? (
          <div className="rounded-xl border border-sky-200/90 bg-sky-50/90 px-2.5 py-2">
            <p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wide text-sky-900/90">
              <MessageSquare className="size-3.5 shrink-0 opacity-80" aria-hidden />
              Votre précision
            </p>
            <p className="mt-1 text-[11px] leading-snug text-sky-950">{patientNote}</p>
          </div>
        ) : null}
        {pharmaLineNote ? (
          <div className="rounded-xl border border-emerald-200/90 bg-emerald-50/90 px-2.5 py-2">
            <p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wide text-emerald-950/90">
              <Sparkles className="size-3.5 shrink-0 opacity-80" aria-hidden />
              Réponse pharmacie (ligne)
            </p>
            <p className="mt-1 text-[11px] leading-snug text-emerald-950">{pharmaLineNote}</p>
          </div>
        ) : null}
      </div>
    ) : null;

  const cardShell = (inner: ReactNode) => (
    <li
      className={`overflow-hidden rounded-2xl border-2 bg-white shadow-md ring-1 ring-black/[0.04] ${
        isProposedLine ? "border-violet-200/90" : "border-emerald-200/70"
      }`}
    >
      {isProposedLine ? (
        <div className="border-b border-violet-200/80 bg-gradient-to-r from-violet-50 to-white px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-violet-800">
            {requestItemLineSourceFr.pharmacist_proposed}
          </p>
          {row.pharmacist_proposal_reason?.trim() ? (
            <p className="mt-1 text-[11px] leading-snug text-violet-950">
              <span className="font-semibold">Motif : </span>
              {row.pharmacist_proposal_reason.trim()}
            </p>
          ) : (
            <p className="mt-1 text-[11px] italic text-violet-800/80">Motif non renseigné par l’officine.</p>
          )}
        </div>
      ) : (
        <div className="border-b border-emerald-100 bg-gradient-to-r from-emerald-50/80 to-white px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-900">Votre demande initiale</p>
          <p className="mt-0.5 text-[10px] text-emerald-900/70">
            Origine : <strong>{requestItemLineSourceFr.patient_request}</strong>
          </p>
        </div>
      )}
      <div className="p-3">{inner}</div>
    </li>
  );

  if (!hasAlts) {
    return cardShell(
      <>
        <div className="flex min-h-[96px] items-stretch gap-3">
          {thumb}
          <div className="min-w-0 flex-1">
            <p
              className="overflow-hidden pr-1 text-[13px] font-semibold leading-tight text-foreground sm:text-[15px]"
              style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
            >
              {prod?.name ?? "Produit"}
            </p>
            {prodUnitPrice ? <p className="mt-0.5 text-xs font-medium text-primary">{prodUnitPrice}</p> : null}
            <RespondedProductQtyStatusLine row={row} />
          </div>
        </div>
        {commentsBlock}
        <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border-2 border-slate-200 bg-slate-50/40 px-3 py-2.5 transition hover:border-emerald-200">
          <input
            type="checkbox"
            className="mt-1 rounded border-primary"
            checked={currentBranch === "principal" && capPrincipal > 0}
            disabled={capPrincipal === 0}
            onChange={(e) => togglePrincipalOnlyLine(row.id, e.target.checked)}
          />
          <span className="text-sm leading-snug">
            <span className="font-semibold text-foreground">Je retiens cette ligne</span>
            <span className="mt-0.5 block text-[11px] text-muted-foreground">
              Une seule option possible — quantité réglable jusqu’à la limite communiquée par la pharmacie.
            </span>
          </span>
        </label>
        {capPrincipal === 0 ? (
          <p className="mt-2 rounded-lg border border-amber-200/80 bg-amber-50 px-2.5 py-2 text-[11px] leading-snug text-amber-950">
            Aucune quantité disponible sur ce produit pour l’instant. Tu peux ne pas retenir cette ligne ou repasser après un échange avec
            l’officine.
          </p>
        ) : null}
        {qtyStepper}
      </>
    );
  }

  return cardShell(
    <>
      <div className="flex min-h-[96px] items-stretch gap-3">
        {thumb}
        <div className="min-w-0 flex-1">
          <p
            className="overflow-hidden pr-1 text-[13px] font-semibold leading-tight text-foreground sm:text-[15px]"
            style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
          >
            {prod?.name ?? "Produit"}
          </p>
          {prodUnitPrice ? <p className="mt-0.5 text-xs font-medium text-primary">{prodUnitPrice}</p> : null}
          <RespondedProductQtyStatusLine row={row} />
        </div>
      </div>

      {commentsBlock}

      <div className="mt-4 rounded-xl border border-teal-200/70 bg-gradient-to-b from-teal-50/50 to-background p-2.5">
        <div className="mb-2 flex items-center gap-2 text-teal-950">
          <Layers className="size-4 shrink-0 opacity-90" aria-hidden />
          <p className="text-[10px] font-bold uppercase tracking-wide">Choisis quoi récupérer</p>
        </div>
        <p className="mb-3 text-[10px] leading-snug text-teal-900/85">
          {isProposedLine ? (
            <>
              <strong className="text-teal-950">Proposition officine</strong> = produit suggéré par ta pharmacie (rien n’avait été
              demandé sur cette ligne). <strong className="text-teal-950">Alternatives</strong> = autres équivalences proposées.
            </>
          ) : (
            <>
              <strong className="text-teal-950">Principal</strong> = produit demandé. <strong className="text-teal-950">Alternatives</strong>{" "}
              = équivalences proposées par ta pharmacie. Tu peux aussi ne garder aucune option pour cette ligne.
            </>
          )}
        </p>

        <fieldset className="space-y-2 border-0 p-0">
          <legend className="sr-only">Choix pour {prod?.name ?? "Produit"}</legend>

          <label
            className={`flex cursor-pointer flex-col rounded-xl border-2 px-3 py-2.5 transition ${
              currentBranch === null
                ? "border-slate-500 bg-slate-100/60 shadow-sm ring-2 ring-slate-300/30"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <span className="flex items-start gap-2.5">
              <input type="radio" name={radioName} className="mt-1 shrink-0" checked={currentBranch === null} onChange={() => setLineBranch(row.id, null)} />
              <span>
                <span className="text-sm font-semibold text-foreground">Ne pas retenir cette ligne</span>
                <span className="mt-0.5 block text-[11px] text-muted-foreground">Aucun des produits ci-dessous ne m’intéresse.</span>
              </span>
            </span>
          </label>

          <label
            className={`flex cursor-pointer flex-col rounded-xl border-2 px-3 py-2.5 transition ${
              currentBranch === "principal"
                ? "border-emerald-500 bg-emerald-50/80 shadow-sm ring-1 ring-emerald-200"
                : capPrincipal === 0
                  ? "cursor-not-allowed border-slate-100 bg-slate-50 opacity-60"
                  : "border-emerald-200/80 bg-white hover:border-emerald-300"
            }`}
          >
            <span className="flex items-start gap-2.5">
              <input
                type="radio"
                name={radioName}
                className="mt-1 shrink-0"
                checked={currentBranch === "principal"}
                disabled={capPrincipal === 0}
                onChange={() => setLineBranch(row.id, "principal")}
              />
              <span className="min-w-0 flex-1 space-y-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">
                    {isProposedLine ? "Produit proposé par la pharmacie" : "Produit principal"}
                  </span>
                  {isProposedLine ? (
                    <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                      Proposé
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                      Demandé
                    </span>
                  )}
                </span>
                <span className="flex flex-wrap gap-x-2 text-[11px] text-muted-foreground">
                  {row.unit_price != null ? (
                    <span>
                      Prix <strong className="tabular-nums text-foreground">{Number(row.unit_price).toFixed(2)}</strong> MAD
                    </span>
                  ) : null}
                  {row.availability_status ? (
                    <span>{availabilityStatusFr[row.availability_status] ?? row.availability_status}</span>
                  ) : null}
                  {row.availability_status === "to_order" && row.expected_availability_date ? (
                    <span>Disponible le {formatDateShortFr(row.expected_availability_date)}</span>
                  ) : null}
                </span>
              </span>
            </span>
          </label>

          {altList.map((alt) => {
            const altProd = one(alt.products);
            const capA = maxQtyAlt(row, alt);
            const disabled = capA === 0;
            const altComment = alt.pharmacist_comment?.trim();
            return (
              <label
                key={alt.id}
                className={`flex cursor-pointer flex-col rounded-xl border-2 px-3 py-2.5 transition ${
                  currentBranch === alt.id
                    ? "border-teal-500 bg-teal-50/80 shadow-sm ring-1 ring-teal-200"
                    : disabled
                      ? "cursor-not-allowed border-slate-100 bg-slate-50 opacity-60"
                      : "border-teal-200/70 bg-white hover:border-teal-400"
                }`}
              >
                <span className="flex items-start gap-2.5">
                  <input
                    type="radio"
                    name={radioName}
                    className="mt-1 shrink-0"
                    checked={currentBranch === alt.id}
                    disabled={disabled}
                    onChange={() => setLineBranch(row.id, alt.id)}
                  />
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{altProd?.name ?? "Alternative"}</span>
                      <span className="rounded-full bg-teal-600 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                        Alternative
                      </span>
                    </span>
                    <span className="flex flex-wrap gap-x-2 text-[11px] text-muted-foreground">
                      {alt.unit_price != null ? (
                        <span>
                          Prix <strong className="tabular-nums text-foreground">{Number(alt.unit_price).toFixed(2)}</strong> MAD
                        </span>
                      ) : null}
                      {alt.availability_status ? (
                        <span>{availabilityStatusFr[alt.availability_status] ?? alt.availability_status}</span>
                      ) : null}
                      {alt.availability_status === "to_order" && alt.expected_availability_date ? (
                        <span>Disponible le {formatDateShortFr(alt.expected_availability_date)}</span>
                      ) : null}
                    </span>
                    {altComment ? (
                      <p className="rounded-lg border border-teal-200/60 bg-white/70 px-2 py-1.5 text-[10px] leading-snug text-teal-950">
                        <span className="font-semibold text-teal-900">Note officine : </span>
                        {altComment}
                      </p>
                    ) : null}
                  </span>
                </span>
              </label>
            );
          })}
        </fieldset>
      </div>

      {qtyStepper}
    </>
  );
}

function splitVisitHm(raw: string | null | undefined): { h: string; m: string } {
  if (!raw) return { h: "", m: "" };
  const m = /^(\d{1,2}):(\d{2})/.exec(raw.trim());
  if (!m) return { h: "", m: "" };
  return { h: m[1] ?? "", m: m[2] ?? "" };
}

type PatientConfirmRpcRow = {
  request_item_id: string;
  is_selected: boolean;
  selected_qty: number | null;
  chosen_alternative_id: string | null;
};

type PatientConfirmPreviewLine = {
  rowId: string;
  productName: string;
  choiceDetail: string;
  qty: number;
  unitPriceMad: number | null;
  lineTotalMad: number | null;
  bucket: "reserve" | "order";
  etaLabel: string | null;
  photoUrl: string | null;
};

type PatientConfirmReviewSnapshot = {
  rpcPayload: PatientConfirmRpcRow[];
  preview: PatientConfirmPreviewLine[];
  plannedVisitDate: string;
  plannedVisitTimePg: string | null;
  visitSummaryFr: string;
};

function buildPatientConfirmSelection(
  items: ActionItemRow[],
  sel: Record<string, LineSelState>
): { rpcPayload: PatientConfirmRpcRow[]; preview: PatientConfirmPreviewLine[] } {
  const preview: PatientConfirmPreviewLine[] = [];
  const rpcPayload = items.map((row) => {
    const alts = normalizeAlternatives(row.request_item_alternatives);
    const st = sel[row.id] ?? ({ branch: null, qty: 1 } satisfies LineSelState);
    const cap = maxQtyForBranch(row, st.branch, alts);
    const on = st.branch !== null && cap > 0;
    const qty = on ? Math.min(st.qty, cap) : null;
    const chosenAlt = on && st.branch !== null && st.branch !== "principal" ? st.branch : null;

    if (on && qty != null) {
      const principalProd = one(row.products);
      let productName: string;
      let unitPrice: number | null;
      let effStatus: string | null;
      let eta: string | null = null;
      let choiceDetail: string;
      let photoUrl: string | null;

      if (st.branch === "principal") {
        productName = principalProd?.name ?? "Produit";
        unitPrice = row.unit_price != null ? Number(row.unit_price) : null;
        effStatus = row.availability_status;
        if (row.line_source === "pharmacist_proposed") {
          choiceDetail = "Proposition officine — produit ajouté par la pharmacie";
        } else {
          choiceDetail = "Produit demandé initialement";
        }
        if (effStatus === "to_order" && row.expected_availability_date) {
          eta = formatDateShortFr(row.expected_availability_date);
        }
        photoUrl = principalProd?.photo_url ?? null;
      } else {
        const alt = alts.find((a) => a.id === st.branch);
        const altProd = alt ? one(alt.products) : null;
        productName = altProd?.name ?? "Alternative";
        unitPrice = alt?.unit_price != null ? Number(alt.unit_price) : null;
        effStatus = alt?.availability_status ?? null;
        choiceDetail = "Alternative proposée par la pharmacie";
        if (effStatus === "to_order" && alt?.expected_availability_date) {
          eta = formatDateShortFr(alt.expected_availability_date);
        }
        photoUrl = altProd?.photo_url ?? null;
      }

      const lineTotalMad =
        unitPrice != null && Number.isFinite(unitPrice) ? unitPrice * qty : null;
      const bucket: "reserve" | "order" = effStatus === "to_order" ? "order" : "reserve";

      preview.push({
        rowId: row.id,
        productName,
        choiceDetail,
        qty,
        unitPriceMad: unitPrice,
        lineTotalMad,
        bucket,
        etaLabel: eta,
        photoUrl,
      });
    }

    return {
      request_item_id: row.id,
      is_selected: on,
      selected_qty: qty,
      chosen_alternative_id: chosenAlt,
    };
  });

  return { rpcPayload, preview };
}

function validatePatientConfirmBeforeReview(
  rpcPayload: PatientConfirmRpcRow[],
  visitWin: ReturnType<typeof plannedVisitWindow>,
  resolvedVisitDate: string,
  visitDateRaw: string
): string | null {
  const anyOn = rpcPayload.some((p) => p.is_selected);
  if (!anyOn) {
    return "Garde au moins une ligne sélectionnée, modifie ta liste avant renvoi, ou abandonne la demande.";
  }
  if (visitWin.missingEtaOnToOrder) {
    return "Une ligne « à commander » n’a pas de date de réception côté pharmacie. Contacte l’officine ou modifie ta sélection.";
  }
  const rawVisit = visitDateRaw.trim();
  if (rawVisit !== "" && rawVisit !== resolvedVisitDate) {
    return visitWin.hasToOrder
      ? `Date hors plage autorisée (jusqu’au ${new Date(visitWin.maxYmd + "T12:00:00").toLocaleDateString("fr-FR")} inclus selon les produits à commander).`
      : `Date hors plage : au plus tard le ${new Date(visitWin.maxYmd + "T12:00:00").toLocaleDateString("fr-FR")} (4 jours).`;
  }
  return null;
}

function blockMonetarySummary(lines: PatientConfirmPreviewLine[]): { sumKnown: number; missingUnitPrice: boolean } {
  let sumKnown = 0;
  let missingUnitPrice = false;
  for (const L of lines) {
    if (L.lineTotalMad == null) missingUnitPrice = true;
    else sumKnown += L.lineTotalMad;
  }
  return { sumKnown, missingUnitPrice };
}

function formatBlockSubtotalLabel(lines: PatientConfirmPreviewLine[]): string {
  const { sumKnown, missingUnitPrice } = blockMonetarySummary(lines);
  if (lines.length === 0) return "";
  if (missingUnitPrice && sumKnown === 0) return "Sous-total du bloc — prix non communiqué sur une ou plusieurs lignes";
  if (missingUnitPrice) return `Sous-total du bloc (partiel) · ${sumKnown.toFixed(2)} MAD · certaines lignes sans prix unitaire`;
  return `Sous-total du bloc · ${sumKnown.toFixed(2)} MAD`;
}

function formatGrandTotalLabel(all: PatientConfirmPreviewLine[]): string {
  const { sumKnown, missingUnitPrice } = blockMonetarySummary(all);
  if (all.length === 0) return "";
  if (missingUnitPrice && sumKnown === 0) return "Total estimé — impossible à calculer sans prix unitaire";
  if (missingUnitPrice) return `Total connu (indicatif) · ${sumKnown.toFixed(2)} MAD · certaines lignes sans prix`;
  return `Total estimé · ${sumKnown.toFixed(2)} MAD`;
}

function PatientConfirmReviewLineCard({ line }: { line: PatientConfirmPreviewLine }) {
  const isOrder = line.bucket === "order";
  const thumbRing = isOrder ? "border-teal-300/70 ring-1 ring-teal-300/35" : "border-emerald-300/65 ring-1 ring-emerald-300/35";
  const thumb = (
    <div
      className={`relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl border bg-white shadow-inner ${thumbRing}`}
    >
      {line.photoUrl ? (
        <img src={line.photoUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <div
          className={`flex h-full w-full items-center justify-center ${isOrder ? "bg-teal-50/90" : "bg-emerald-50/90"}`}
        >
          <Package className={`size-6 ${isOrder ? "text-teal-600/90" : "text-emerald-600/90"}`} aria-hidden />
        </div>
      )}
    </div>
  );

  const cardShell = isOrder
    ? "border-2 border-teal-200/90 bg-gradient-to-br from-teal-50/90 via-white to-cyan-50/40 shadow-md ring-1 ring-teal-200/40"
    : "border-2 border-emerald-200/85 bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/30 shadow-md ring-1 ring-emerald-200/35";
  const titleTone = isOrder ? "text-teal-950" : "text-emerald-950";
  const metaTone = isOrder ? "text-teal-800/90" : "text-emerald-900/88";
  const qtyTone = isOrder ? "text-teal-900" : "text-emerald-900";
  const priceAccent = isOrder ? "text-teal-700" : "text-emerald-700";

  return (
    <li className={`rounded-lg p-2 ${cardShell}`}>
      <div className="flex gap-2">
        {thumb}
        <div className="min-w-0 flex-1">
          <p
            className={`text-[12px] font-semibold leading-tight ${titleTone}`}
            style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
          >
            {line.productName}
          </p>
          <p className={`mt-0.5 text-[9px] leading-snug ${metaTone}`}>{line.choiceDetail}</p>
          <p className={`mt-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-[10px] ${qtyTone}`}>
            <span>
              Qté <strong className="tabular-nums">{line.qty}</strong>
            </span>
            <span className={isOrder ? "text-teal-500/80" : "text-emerald-500/80"}>·</span>
            <span>
              PU{" "}
              <strong className={`tabular-nums ${priceAccent}`}>
                {line.unitPriceMad != null && Number.isFinite(line.unitPriceMad)
                  ? `${line.unitPriceMad.toFixed(2)} MAD`
                  : "—"}
              </strong>
            </span>
          </p>
          {line.bucket === "order" && line.etaLabel ? (
            <p className="mt-0.5 rounded border border-teal-200/70 bg-teal-100/50 px-1.5 py-0.5 text-[9px] font-medium text-teal-950">
              Dispo · {line.etaLabel}
            </p>
          ) : null}
          <p
            className={`mt-1 rounded border px-1.5 py-1 text-right text-[10px] font-semibold ${
              isOrder
                ? "border-teal-200/80 bg-teal-100/45 text-teal-950"
                : "border-emerald-200/80 bg-emerald-100/45 text-emerald-950"
            }`}
          >
            Total · <span className="tabular-nums">{line.lineTotalMad != null ? `${line.lineTotalMad.toFixed(2)} MAD` : "—"}</span>
          </p>
        </div>
      </div>
    </li>
  );
}

export function PatientProductRequestActions({
  requestId,
  status,
  items,
  initialPatientNote,
  initialPlannedVisitDate,
  initialPlannedVisitTime,
  onReload,
  pharmacyContact = null,
  requestPublicRef = null,
  supplyAmendmentBundles = [],
  pharmacistGlobalComment = null,
  requestTimelineMeta = undefined,
  dossierHistoryRows = [],
}: Props) {
  const [actionError, setActionError] = useState("");
  const [historyModalItemId, setHistoryModalItemId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<"" | "confirm" | "resubmit" | "abandon" | "visit">("");
  const [confirmReviewOpen, setConfirmReviewOpen] = useState(false);
  const [confirmReviewSnap, setConfirmReviewSnap] = useState<PatientConfirmReviewSnapshot | null>(null);
  const [abandonCode, setAbandonCode] = useState<PatientCancelReasonCode>("no_longer_needed");
  const [abandonDetail, setAbandonDetail] = useState("");

  /** Lignes `pharmacist_proposed` masquées tant que statut submitted / in_review — elles sont un brouillon coté officine. */
  const itemsFilteredPending = useMemo(
    () => visibleItemsForPatientBeforePharmacyResponse(items, status),
    [items, status]
  );

  /** Confirmation responded -> confirmed — reset via parent `key` when server rows change */
  const [sel, setSel] = useState(() => computeSelFromItems(items));

  /** Créneau de passage officine (`''` = défaut automatique borne min) */
  const [visitDate, setVisitDate] = useState(initialPlannedVisitDate ?? "");
  const [visitHour, setVisitHour] = useState(() => splitVisitHm(initialPlannedVisitTime).h);
  const [visitMinute, setVisitMinute] = useState(() => splitVisitHm(initialPlannedVisitTime).m);

  /** Note générale à l’étape « pharmacie a répondu » (persistée avec la validation). */
  const [confirmPatientNote, setConfirmPatientNote] = useState(() => initialPatientNote ?? "");

  /** Resubmit draft — idem */
  const [noteDraft, setNoteDraft] = useState(() => initialPatientNote ?? "");
  const [lines, setLines] = useState<ResubmitLine[]>(() =>
    computeResubmitLinesFromItems(visibleItemsForPatientBeforePharmacyResponse(items, status))
  );
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<ProductHit[]>([]);
  const [editMode, setEditMode] = useState(false);

  /** Restaure le brouillon resubmit à l'état initial (sortie du mode édition sans renvoi). */
  const resetResubmitDraft = () => {
    setLines(computeResubmitLinesFromItems(visibleItemsForPatientBeforePharmacyResponse(items, status)));
    setNoteDraft(initialPatientNote ?? "");
    setQuery("");
    setHits([]);
    setActionError("");
  };

  const debouncedQuery = useMemo(() => query.trim(), [query]);

  const visitWin = useMemo(() => {
    const linesPayload = itemsFilteredPending.map((row) => {
      const alts = normalizeAlternatives(row.request_item_alternatives);
      let branch: LineBranch = null;
      let capPositive = false;

      if (status === "confirmed" || status === "processing" || status === "treated") {
        if (!row.is_selected_by_patient) {
          branch = null;
          capPositive = false;
        } else if (row.patient_chosen_alternative_id) {
          branch = row.patient_chosen_alternative_id;
          capPositive = maxQtyForBranch(row, branch, alts) > 0;
        } else {
          branch = "principal";
          capPositive = maxQtyPrincipal(row) > 0;
        }
      } else {
        const st = sel[row.id] ?? { branch: null, qty: 1 };
        branch = st.branch;
        capPositive = st.branch !== null && maxQtyForBranch(row, st.branch, alts) > 0;
      }

      return {
        capPositive,
        branch,
        principalAvail: row.availability_status,
        principalEta: row.expected_availability_date ?? null,
        alternatives: alts.map((a) => ({
          id: a.id,
          availability_status: a.availability_status,
          expected_availability_date: a.expected_availability_date ?? null,
        })),
      };
    });
    return plannedVisitWindow(linesPayload);
  }, [itemsFilteredPending, sel, status]);

  const resolvedVisitDate = useMemo(() => {
    const t = visitDate.trim();
    if (t === "") return visitWin.minYmd;
    return clampVisitYmd(t, visitWin.minYmd, visitWin.maxYmd);
  }, [visitDate, visitWin.minYmd, visitWin.maxYmd]);

  const visitTimeComposed = useMemo(() => {
    const h = visitHour.trim();
    const m = visitMinute.trim();
    if (h === "" && m === "") return "";
    const hi = Math.min(23, Math.max(0, Number.parseInt(h, 10) || 0));
    const mi = Math.min(59, Math.max(0, Number.parseInt(m, 10) || 0));
    return `${String(hi).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
  }, [visitHour, visitMinute]);

  const historyModalRow = useMemo(
    () => (historyModalItemId ? items.find((r) => r.id === historyModalItemId) ?? null : null),
    [historyModalItemId, items]
  );

  const historyModalBlocks = useMemo((): PatientLineTimelineBlockFr[] => {
    if (!historyModalRow || !requestTimelineMeta?.created_at) return [];
    return buildPatientLineTimelineFr({
      row: historyModalRow,
      requestCreatedAt: requestTimelineMeta.created_at,
      requestSubmittedAt: requestTimelineMeta.submitted_at,
      requestRespondedAt: requestTimelineMeta.responded_at,
      requestConfirmedAt: requestTimelineMeta.confirmed_at,
      supplyBundles: supplyAmendmentBundles,
      dossierHistory: dossierHistoryRows,
    });
  }, [historyModalRow, requestTimelineMeta, supplyAmendmentBundles, dossierHistoryRows]);

  const visibleHits = debouncedQuery.length < 2 ? [] : hits;
  const resubmitTotal = useMemo(
    () => lines.reduce((sum, l) => sum + (l.price_pph ?? 0) * l.qty, 0),
    [lines]
  );

  const confirmSelectionSummary = useMemo(() => {
    let count = 0;
    let total = 0;
    if (status !== "responded") return { count, total };
    for (const row of items) {
      const alts = normalizeAlternatives(row.request_item_alternatives);
      const st = sel[row.id];
      if (!st || st.branch === null) continue;
      const cap = maxQtyForBranch(row, st.branch, alts);
      if (cap < 1) continue;
      count += 1;
      const effQty = Math.min(st.qty, cap);
      const branchPrice =
        st.branch === "principal"
          ? row.unit_price
          : alts.find((a) => a.id === st.branch)?.unit_price ?? null;
      if (branchPrice != null) total += Number(branchPrice) * effQty;
    }
    return { count, total };
  }, [status, items, sel]);

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      return;
    }
    const t = setTimeout(() => {
      void (async () => {
        const { data, error } = await supabase
          .from("products")
          .select("id,name,product_type,laboratory,photo_url,price_pph")
          .eq("is_active", true)
          .ilike("name", `%${debouncedQuery}%`)
          .order("name")
          .limit(10);
        if (error || !Array.isArray(data)) {
          setHits([]);
          return;
        }
        setHits(data as ProductHit[]);
      })();
    }, 280);
    return () => clearTimeout(t);
  }, [debouncedQuery]);

  const addProduct = (p: ProductHit) => {
    setLines((prev) => {
      if (prev.some((l) => l.product_id === p.id)) return prev;
      return [
        ...prev,
        {
          product_id: p.id,
          name: p.name,
          photo_url: p.photo_url ?? null,
          qty: 1,
          price_pph: p.price_pph ?? null,
          client_comment: "",
          line_source: "patient_request",
          pharmacist_proposal_reason: null,
        },
      ];
    });
    setQuery("");
    setHits([]);
    setActionError("");
  };

  const setLineBranch = (itemId: string, branch: LineBranch) => {
    setSel((s) => {
      const row = items.find((i) => i.id === itemId);
      if (!row) return s;
      const alts = normalizeAlternatives(row.request_item_alternatives);
      const cap = maxQtyForBranch(row, branch, alts);
      const qty = branch !== null && cap > 0 ? cap : 1;
      return {
        ...s,
        [itemId]: {
          branch,
          qty: branch !== null && cap > 0 ? Math.min(Math.max(1, qty), cap) : 1,
        },
      };
    });
  };

  const setLineQty = (itemId: string, qty: number) => {
    const row = items.find((i) => i.id === itemId);
    if (!row) return;
    const alts = normalizeAlternatives(row.request_item_alternatives);
    const branch = sel[itemId]?.branch ?? null;
    const cap = maxQtyForBranch(row, branch, alts);
    if (branch === null || cap < 1) return;
    setSel((s) => ({
      ...s,
      [itemId]: {
        ...(s[itemId] ?? { branch, qty: 1 }),
        qty: Math.min(Math.max(1, qty), cap),
      },
    }));
  };

  const togglePrincipalOnlyLine = (itemId: string, on: boolean) => {
    setSel((s) => {
      const row = items.find((i) => i.id === itemId);
      if (!row) return s;
      const alts = normalizeAlternatives(row.request_item_alternatives);
      const branch: LineBranch = on ? "principal" : null;
      const cap = maxQtyForBranch(row, branch, alts);
      const qty = on && cap > 0 ? cap : 1;
      return {
        ...s,
        [itemId]: {
          branch,
          qty: on && cap > 0 ? Math.min(Math.max(1, s[itemId]?.qty ?? qty), cap) : 1,
        },
      };
    });
  };

  const closeConfirmReview = useCallback(() => {
    setConfirmReviewOpen(false);
    setConfirmReviewSnap(null);
  }, []);

  const openConfirmReview = useCallback(() => {
    const built = buildPatientConfirmSelection(items, sel);
    const err = validatePatientConfirmBeforeReview(built.rpcPayload, visitWin, resolvedVisitDate, visitDate);
    if (err) {
      setActionError(err);
      return;
    }
    setActionError("");
    const timePg = htmlTimeToPg(visitTimeComposed);
    setConfirmReviewSnap({
      rpcPayload: built.rpcPayload,
      preview: built.preview,
      plannedVisitDate: resolvedVisitDate,
      plannedVisitTimePg: timePg,
      visitSummaryFr: formatPlannedVisitFr(resolvedVisitDate, timePg ?? null),
    });
    setConfirmReviewOpen(true);
  }, [items, sel, visitWin, resolvedVisitDate, visitDate, visitTimeComposed]);

  useEffect(() => {
    if (!confirmReviewOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeConfirmReview();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmReviewOpen, closeConfirmReview]);

  useEffect(() => {
    if (!confirmReviewOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [confirmReviewOpen]);

  const performConfirmAfterReview = async () => {
    if (!confirmReviewSnap) return;
    setActionError("");
    setBusyAction("confirm");
    const { error } = await supabase.rpc("patient_confirm_after_response", {
      p_request_id: requestId,
      p_selections: confirmReviewSnap.rpcPayload.map((p) => ({
        request_item_id: p.request_item_id,
        is_selected: p.is_selected,
        selected_qty: p.selected_qty,
        chosen_alternative_id: p.chosen_alternative_id,
      })),
      p_planned_visit_date: confirmReviewSnap.plannedVisitDate,
      p_planned_visit_time: confirmReviewSnap.plannedVisitTimePg,
    });
    setBusyAction("");
    if (error) {
      setActionError(error.message);
      return;
    }
    const trimmedNote = confirmPatientNote.trim();
    const { error: noteErr } = await supabase
      .from("product_requests")
      .update({ patient_note: trimmedNote === "" ? null : trimmedNote })
      .eq("request_id", requestId);
    if (noteErr) {
      console.error("patient_note after confirm:", noteErr);
    }
    closeConfirmReview();
    await onReload();
  };

  const runResubmit = async () => {
    setActionError("");
    if (lines.length === 0) {
      setActionError("Ajoute au moins un produit à la liste.");
      return;
    }

    const seen = new Set<string>();
    for (const l of lines) {
      if (seen.has(l.product_id)) {
        setActionError("Chaque produit ne peut apparaître qu’une seule fois dans ta liste.");
        return;
      }
      seen.add(l.product_id);
      if (l.qty < 1 || l.qty > 10) {
        setActionError("Les quantités doivent être entre 1 et 10 pour chaque produit.");
        return;
      }
    }

    const p_items = lines.map((l) => {
      const cc = l.client_comment.trim().slice(0, 500);
      return {
        product_id: l.product_id,
        requested_qty: l.qty,
        ...(cc.length > 0 ? { client_comment: cc } : {}),
      };
    });
    setBusyAction("resubmit");
    const { error } = await supabase.rpc("patient_resubmit_product_request_after_response", {
      p_request_id: requestId,
      p_patient_note: noteDraft.trim() === "" ? null : noteDraft.trim(),
      p_items,
    });
    setBusyAction("");
    if (error) {
      setActionError(error.message);
      return;
    }
    await onReload();
  };

  const runAbandon = async () => {
    const other = abandonDetail.trim();
    if (abandonCode === "other" && other.length < 8) {
      setActionError("Pour « Autre », précise en au moins 8 caractères.");
      return;
    }

    if (!globalThis.confirm("Annuler cette demande ? Le pharmacien verra cette décision dans l’historique.")) {
      return;
    }
    setActionError("");
    setBusyAction("abandon");
    const { error } = await supabase.rpc("patient_abandon_request", {
      p_request_id: requestId,
      p_reason_code: abandonCode,
      p_reason_other: abandonCode === "other" ? other : null,
    });
    setBusyAction("");
    if (error) {
      setActionError(error.message);
      return;
    }
    await onReload();
  };

  const runUpdateVisit = async () => {
    setActionError("");
    const rawVisit = visitDate.trim();
    if (rawVisit !== "" && rawVisit !== resolvedVisitDate) {
      setActionError(
        visitWin.hasToOrder
          ? `Date hors plage autorisée (jusqu’au ${new Date(visitWin.maxYmd + "T12:00:00").toLocaleDateString("fr-FR")} inclus selon les produits à commander).`
          : `Date hors plage : au plus tard le ${new Date(visitWin.maxYmd + "T12:00:00").toLocaleDateString("fr-FR")} (4 jours).`
      );
      return;
    }
    setBusyAction("visit");
    const { error } = await supabase.rpc("patient_update_planned_visit_after_confirmation", {
      p_request_id: requestId,
      p_planned_visit_date: resolvedVisitDate,
      p_planned_visit_time: htmlTimeToPg(visitTimeComposed),
    });
    setBusyAction("");
    if (error) {
      setActionError(error.message);
      return;
    }
    await onReload();
  };

  const totalsRetained = useMemo(() => monetaryTotalsForRetainedLines(items), [items]);

  const interactiveAllowed =
    status === "submitted" ||
    status === "in_review" ||
    status === "responded" ||
    status === "confirmed" ||
    status === "processing" ||
    status === "treated";
  const readOnlyArchive = isPatientProductArchiveStatus(status);
  if (!interactiveAllowed && !readOnlyArchive) return null;

  if (readOnlyArchive) {
    return (
      <>
        <section className="mt-2 rounded-lg border border-border/90 bg-muted/15 p-2 sm:p-2.5">
          <ReadonlyArchivedProductBucketsView
            items={items}
            supplyAmendmentBundles={supplyAmendmentBundles}
            pharmacistGlobalComment={pharmacistGlobalComment}
            onOpenLineHistory={(itemId) => setHistoryModalItemId(itemId)}
          />
        </section>
        <LineHistoryModalFr
          open={historyModalItemId !== null}
          title={historyModalRow ? validatedProductLabel(historyModalRow) : ""}
          blocks={historyModalBlocks}
          onClose={() => setHistoryModalItemId(null)}
        />
      </>
    );
  }

  const showConfirm = status === "responded";
  const showResubmit = status === "submitted" || status === "in_review";
  const showAbandonAfterResponse =
    status === "responded" || status === "confirmed" || status === "processing" || status === "treated";
  const showConfirmedCards = status === "confirmed" || status === "processing" || status === "treated";
  /** Date/heure de passage : à la validation (responded) et pour modifier après coup. */
  const showVisitFields = showConfirm || showConfirmedCards;

  const visitTimeFr = visitTimeComposed ? formatTime24hFr(htmlTimeToPg(visitTimeComposed) ?? visitTimeComposed) : "";

  const dossierRefLabel = requestPublicRef?.trim() || `Dossier ${requestId.slice(0, 8)}…`;

  const confirmReserveLines =
    confirmReviewSnap?.preview.filter((l) => l.bucket === "reserve") ?? [];
  const confirmOrderLines = confirmReviewSnap?.preview.filter((l) => l.bucket === "order") ?? [];
  const confirmAllPreviewLines = confirmReviewSnap?.preview ?? [];

  return (
    <section
      className={`mt-2 rounded-lg border border-border/90 bg-muted/15 p-2 sm:p-2.5 ${showResubmit ? "pb-20" : ""} ${showConfirm ? "pb-28" : ""}`}
    >
      {actionError ? (
        <p className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-[11px] text-destructive">{actionError}</p>
      ) : null}

      {showConfirm ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-emerald-200/75 bg-emerald-50/45 p-2.5 sm:p-3">
            <h2 className="text-[14px] font-bold leading-snug text-foreground sm:text-[15px]">La pharmacie a répondu — à toi de confirmer</h2>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
              Pour chaque ligne, retiens le <strong className="text-foreground">principal</strong>, une{" "}
              <strong className="text-foreground">alternative</strong>, ou{" "}
              <strong className="text-foreground">aucune option</strong>. Les quantités ne peuvent pas dépasser celles indiquées par
              l&apos;officine, mais tu peux les baisser.
            </p>
            <ul className="mt-2 grid gap-1 text-[10px] leading-snug text-muted-foreground sm:grid-cols-2 sm:text-[11px]">
              <li className="flex items-center gap-2">
                <span className="inline-block size-2 shrink-0 rounded-full bg-emerald-500" aria-hidden />
                <span>
                  <strong className="text-emerald-950">Ta liste</strong> — ordre identique à celui de la pharmacie.
                </span>
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-block size-2 shrink-0 rounded-full bg-violet-500" aria-hidden />
                <span>
                  <strong className="text-violet-950">Proposé officine</strong> — repéré sur la carte violette.
                </span>
              </li>
            </ul>
          </div>

          {pharmacistGlobalComment?.trim() ? (
            <div className="rounded-xl border border-emerald-200/85 bg-emerald-50/70 px-2.5 py-2 ring-1 ring-emerald-100/50">
              <p className="text-[9px] font-bold uppercase tracking-wide text-emerald-950">Message de la pharmacie</p>
              <p className="mt-1 whitespace-pre-wrap text-[11px] leading-snug text-emerald-950">{pharmacistGlobalComment.trim()}</p>
            </div>
          ) : null}

          {items.length > 0 ? (
            <section className="space-y-3">
              <h3 className="px-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Produits</h3>
              <ul className="space-y-3">
                {items.map((row) => (
                  <RespondedPatientLineChooser
                    key={row.id}
                    row={row}
                    selState={sel[row.id] ?? { branch: null, qty: 1 }}
                    setLineBranch={setLineBranch}
                    setLineQty={setLineQty}
                    togglePrincipalOnlyLine={togglePrincipalOnlyLine}
                  />
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}

      {showConfirmedCards ? (
        (() => {
          const { dispoOfficine, aCommander, horsPerimetre, retireesApresValidation } =
            bucketPatientValidatedLinesThreeWays(items);
          const dispoRetenues = dispoOfficine.filter((r) => r.is_selected_by_patient);
          const aCommanderRetenues = aCommander.filter((r) => r.is_selected_by_patient);
          const horsPerimetreRetenues = horsPerimetre.filter((r) => r.is_selected_by_patient);
          const lignesNonRetenues = items.filter((r) => !r.is_selected_by_patient);
          const subtotalDispo = monetaryTotalsForRetainedLines(dispoRetenues);
          const subtotalCommande = monetaryTotalsForRetainedLines(aCommanderRetenues);
          const totalGrandLabel = compactTotalMadLabel({
            sumKnown: totalsRetained.sumKnown,
            missingPrice: totalsRetained.missingPrice,
            empty: totalsRetained.count < 1,
          });
          const showLineSuivi = status === "confirmed" || status === "processing";

          return (
            <div className="space-y-2">
              {pharmacistGlobalComment?.trim() ? (
                <div className="rounded-md border border-emerald-200/80 bg-emerald-50/65 px-2 py-1.5">
                  <p className="text-[8px] font-bold uppercase tracking-wide text-emerald-950">Message de la pharmacie</p>
                  <p className="mt-0.5 whitespace-pre-wrap text-[10px] leading-snug text-emerald-950">
                    {pharmacistGlobalComment.trim()}
                  </p>
                </div>
              ) : null}

              <div className="flex flex-nowrap items-center justify-between gap-2 overflow-x-auto rounded-md border border-primary/20 bg-primary/[0.06] px-2 py-1.5">
                <p className="shrink-0 text-[10px] font-semibold text-foreground">
                  <span className="tabular-nums">{totalsRetained.count}</span>{" "}
                  {totalsRetained.count > 1 ? "produits retenus" : "produit retenu"}
                </p>
                <p className="shrink-0 text-[10px] font-semibold tabular-nums text-primary whitespace-nowrap">
                  {totalGrandLabel}
                </p>
              </div>

              <div className="rounded-xl border-2 border-slate-200/80 bg-gradient-to-b from-slate-50/70 via-white to-white p-2 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9)] ring-1 ring-slate-200/50">
              {dispoRetenues.length > 0 ? (
                <section className="space-y-1.5">
                  <div className="flex flex-nowrap items-center justify-between gap-2 overflow-x-auto text-emerald-950">
                    <div className="flex min-w-0 items-center gap-1">
                      <Package className="size-3.5 shrink-0 text-emerald-700" aria-hidden />
                      <h3 className="text-[10px] font-bold uppercase tracking-wide">
                        À réserver (validé · {dispoRetenues.length})
                      </h3>
                    </div>
                    <p className="shrink-0 text-[10px] font-semibold tabular-nums text-emerald-800 whitespace-nowrap">
                      {compactTotalMadLabel({
                        sumKnown: subtotalDispo.sumKnown,
                        missingPrice: subtotalDispo.missingPrice,
                        empty: subtotalDispo.count < 1,
                      })}
                    </p>
                  </div>
                  <ul className="space-y-1.5">
                    {dispoRetenues.map((row) => (
                      <PatientValidatedCompactLineCard
                        key={row.id}
                        row={row}
                        tier="dispo_officine"
                        supplyAmendmentBundles={supplyAmendmentBundles}
                        onOpenHistory={() => setHistoryModalItemId(row.id)}
                        suivi={
                          showLineSuivi ? (
                            <PatientLineSuiviStrip row={row} bundles={supplyAmendmentBundles} />
                          ) : undefined
                        }
                      />
                    ))}
                  </ul>
                </section>
              ) : null}

              {aCommanderRetenues.length > 0 ? (
                <section className="mt-2 space-y-1.5">
                  <div className="flex flex-nowrap items-center justify-between gap-2 overflow-x-auto text-teal-950">
                    <div className="flex min-w-0 items-center gap-1">
                      <ShoppingCart className="size-3.5 shrink-0 text-teal-800" aria-hidden />
                      <h3 className="text-[10px] font-bold uppercase tracking-wide">
                        À commander (validé · {aCommanderRetenues.length})
                      </h3>
                    </div>
                    <p className="shrink-0 text-[10px] font-semibold tabular-nums text-teal-900 whitespace-nowrap">
                      {compactTotalMadLabel({
                        sumKnown: subtotalCommande.sumKnown,
                        missingPrice: subtotalCommande.missingPrice,
                        empty: subtotalCommande.count < 1,
                      })}
                    </p>
                  </div>
                  <ul className="space-y-1.5">
                    {aCommanderRetenues.map((row) => (
                      <PatientValidatedCompactLineCard
                        key={row.id}
                        row={row}
                        tier="commande"
                        supplyAmendmentBundles={supplyAmendmentBundles}
                        onOpenHistory={() => setHistoryModalItemId(row.id)}
                        suivi={
                          showLineSuivi ? (
                            <PatientLineSuiviStrip row={row} bundles={supplyAmendmentBundles} />
                          ) : undefined
                        }
                      />
                    ))}
                  </ul>
                </section>
              ) : null}

              {horsPerimetreRetenues.length > 0 ? (
                <section className="mt-2 space-y-1">
                  <div className="flex items-center gap-1 text-amber-950">
                    <Layers className="size-3.5 shrink-0 text-amber-800" aria-hidden />
                    <h3 className="text-[10px] font-bold uppercase tracking-wide">Point d&apos;attention (hors bloc principal)</h3>
                  </div>
                  <p className="text-[9px] leading-snug text-muted-foreground">
                    À confirmer avec l&apos;officine si besoin.
                  </p>
                  <ul className="space-y-1.5">
                    {horsPerimetreRetenues.map((row) => (
                      <PatientValidatedCompactLineCard
                        key={row.id}
                        row={row}
                        tier="hors_perimetre"
                        supplyAmendmentBundles={supplyAmendmentBundles}
                        onOpenHistory={() => setHistoryModalItemId(row.id)}
                        suivi={
                          showLineSuivi ? (
                            <PatientLineSuiviStrip row={row} bundles={supplyAmendmentBundles} />
                          ) : undefined
                        }
                      />
                    ))}
                  </ul>
                </section>
              ) : null}

              {retireesApresValidation.length > 0 ? (
                <section className="mt-2 space-y-1">
                  <div className="flex items-center gap-1 text-amber-950">
                    <Layers className="size-3.5 shrink-0 text-amber-900" aria-hidden />
                    <h3 className="text-[10px] font-bold uppercase tracking-wide">
                      Écart après validation ({retireesApresValidation.length})
                    </h3>
                  </div>
                  <p className="text-[9px] leading-snug text-muted-foreground">
                    Retrait convenu avec la pharmacie — trace uniquement.
                  </p>
                  <ul className="space-y-1.5">
                    {retireesApresValidation.map((row) => (
                      <PatientValidatedCompactLineCard
                        key={row.id}
                        row={row}
                        tier="retire_apres_validation"
                        supplyAmendmentBundles={supplyAmendmentBundles}
                        onOpenHistory={() => setHistoryModalItemId(row.id)}
                        suivi={
                          showLineSuivi ? (
                            <PatientLineSuiviStrip row={row} bundles={supplyAmendmentBundles} />
                          ) : undefined
                        }
                      />
                    ))}
                  </ul>
                </section>
              ) : null}
              </div>

              {lignesNonRetenues.length > 0 ? (
                <details className="group rounded-md border border-border/80 bg-muted/10">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2 py-1.5 text-[10px] font-semibold [&::-webkit-details-marker]:hidden">
                    <span>Lignes non retenues ({lignesNonRetenues.length})</span>
                    <ChevronDown className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
                  </summary>
                  <ul className="space-y-1 border-t border-border/60 px-2 py-1.5">
                    {lignesNonRetenues.map((row) => (
                      <PatientTraceNotRetainedRow
                        key={row.id}
                        row={row}
                        onOpenHistory={() => setHistoryModalItemId(row.id)}
                      />
                    ))}
                  </ul>
                </details>
              ) : null}
            </div>
          );
        })()
      ) : null}

      {showResubmit && editMode ? (
        <div className="mt-2 rounded-2xl border border-primary/20 bg-primary/[0.06] p-3 shadow-sm">
          <label className="block text-sm font-semibold text-foreground">Recherche de produits</label>
          <p className="mt-1 text-xs text-muted-foreground">Commencez à taper le nom du produit (2 caractères minimum).</p>
          <div className="relative mt-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ex: Doliprane, Smecta..."
              className="w-full rounded-xl border border-input bg-background py-2.5 pl-9 pr-3 text-sm shadow-sm placeholder:text-muted-foreground"
            />
          </div>
          {visibleHits.length > 0 ? (
            <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto">
              {visibleHits.map((h) => (
                <li key={h.id}>
                  <button
                    type="button"
                    onClick={() => addProduct(h)}
                    className="flex h-20 w-full items-center gap-3 rounded-xl border border-border/70 bg-muted/20 px-2.5 py-2 text-left transition hover:bg-muted/35"
                  >
                    <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/70 bg-card">
                      {h.photo_url ? (
                        <img src={h.photo_url} alt={h.name} className="h-full w-full object-cover" />
                      ) : (
                        <Package className="size-5 text-muted-foreground" aria-hidden />
                      )}
                    </div>
                    <div className="min-w-0 flex flex-1 flex-col justify-center">
                      <p
                        className="overflow-hidden pr-1 text-[14px] font-semibold leading-tight text-foreground sm:text-[15px]"
                        style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
                      >
                        {h.name}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-primary sm:text-sm">
                        {unitPriceLabel(h.price_pph) ?? "Prix indisponible"}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : query.trim().length >= 2 ? (
            <p className="mt-2 text-xs text-muted-foreground">Aucun résultat.</p>
          ) : null}
        </div>
      ) : null}

      {showResubmit ? (
        <div className="mt-2">
          <ul className="space-y-3">
            {lines.map((l, idx) => (
              <li key={`${l.product_id}-${idx}`} className="rounded-xl border border-border/70 bg-muted/20 p-2">
                <div className="flex min-h-[96px] items-stretch gap-2.5">
                  <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-border/70 bg-card">
                    {editMode ? (
                      <button
                        type="button"
                        aria-label="Retirer"
                        className="absolute right-1 top-1 z-10 rounded-md bg-background/90 p-1 text-destructive shadow-sm hover:bg-destructive/10"
                        onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        <Trash2 size={15} />
                      </button>
                    ) : null}
                    {l.photo_url ? (
                      <img src={l.photo_url} alt={l.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Package className="size-7 text-muted-foreground" aria-hidden />
                      </div>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <p
                      className="overflow-hidden pr-1 text-[13px] font-semibold leading-tight text-foreground sm:text-[15px]"
                      style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
                    >
                      {l.name}
                    </p>
                    <p className="mt-0.5 text-xs font-medium text-primary">
                      {unitPriceLabel(l.price_pph) ?? "Prix unitaire indisponible"}
                    </p>
                    {l.line_source === "pharmacist_proposed" ? (
                      <p className="mt-1 text-[10px] font-medium text-violet-900">
                        {requestItemLineSourceFr.pharmacist_proposed}
                        {l.pharmacist_proposal_reason ? ` — ${l.pharmacist_proposal_reason}` : ""}
                      </p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        aria-label="Diminuer"
                        disabled={!editMode || l.qty <= 1}
                        className="rounded-lg border border-border bg-card p-1.5 text-foreground hover:bg-muted/60 disabled:opacity-40"
                        onClick={() =>
                          setLines((prev) => prev.map((row, i) => (i === idx ? { ...row, qty: Math.max(1, row.qty - 1) } : row)))
                        }
                      >
                        <Minus size={16} />
                      </button>
                      <span className="w-8 text-center text-sm font-semibold tabular-nums">{l.qty}</span>
                      <button
                        type="button"
                        aria-label="Augmenter"
                        disabled={!editMode || l.qty >= 10}
                        className="rounded-lg border border-border bg-card p-1.5 text-foreground hover:bg-muted/60 disabled:opacity-40"
                        onClick={() =>
                          setLines((prev) => prev.map((row, i) => (i === idx ? { ...row, qty: Math.min(10, row.qty + 1) } : row)))
                        }
                      >
                        <Plus size={16} />
                      </button>
                      <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        Total{" "}
                        <span className="inline-block rounded bg-background px-1.5 py-0.5 font-semibold text-foreground">
                          {l.price_pph != null ? `${(l.price_pph * l.qty).toFixed(2)} MAD` : "-"}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
                <label className="mt-2 block">
                  <input
                    type="text"
                    disabled={!editMode}
                    value={l.client_comment}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((row, i) => (i === idx ? { ...row, client_comment: e.target.value.slice(0, 500) } : row))
                      )
                    }
                    placeholder="Commentaire sur ce produit (optionnel)"
                    className="w-full touch-pan-x rounded-lg border border-primary/45 bg-primary/[0.06] px-3 py-2 text-sm placeholder:text-muted-foreground disabled:opacity-70"
                  />
                </label>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-2 space-y-1.5 rounded-md border border-border/70 bg-card p-1.5 sm:p-2">
        {showResubmit ? (
          <div className="rounded-md border border-border/70 bg-background p-2.5">
            <label className="block text-xs font-medium text-gray-700">
              Message pour la pharmacie (optionnel)
              <textarea
                value={noteDraft}
                disabled={!editMode}
                onChange={(e) => setNoteDraft(e.target.value)}
                rows={2}
                placeholder="Précisions, créneau de retrait..."
                className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs disabled:bg-muted"
              />
            </label>
          </div>
        ) : null}

        {showConfirm ? (
          <div className="rounded-xl border border-sky-200/80 bg-sky-50/35 p-2.5 sm:p-3">
            <label className="block text-xs font-semibold text-foreground">
              Message général pour la pharmacie (optionnel)
              <textarea
                value={confirmPatientNote}
                onChange={(e) => setConfirmPatientNote(e.target.value.slice(0, 2000))}
                rows={3}
                placeholder="Précisions complémentaires, horaires, questions… seront enregistrées avec ta validation."
                className="mt-1 w-full resize-y rounded-xl border border-sky-200/90 bg-background px-3 py-2 text-xs shadow-sm placeholder:text-muted-foreground/70 sm:text-sm"
              />
            </label>
            <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground">
              Tu peux reprendre ou adapter le message précédent ; cette version remplace celui attaché à la demande après validation.
            </p>
          </div>
        ) : null}

        {showVisitFields ? (
          <div className="rounded-md border border-primary/20 bg-primary/5 p-1.5">
            <label className="block text-[10px] font-medium text-foreground">
              Date de passage {showConfirm ? <span className="text-destructive">*</span> : null}
              <input
                type="date"
                min={visitWin.minYmd}
                max={visitWin.maxYmd}
                value={resolvedVisitDate}
                onChange={(e) => setVisitDate(e.target.value)}
                className="mt-0.5 block w-full rounded border border-input bg-background px-1.5 py-1 text-[11px]"
                required={showConfirm}
              />
            </label>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              <label className="block text-[10px] font-medium text-foreground">
                Heure (0–23)
                <input
                  type="number"
                  min={0}
                  max={23}
                  inputMode="numeric"
                  placeholder="—"
                  value={visitHour}
                  onChange={(e) => setVisitHour(e.target.value.replace(/\D/g, "").slice(0, 2))}
                  className="mt-0.5 block w-full rounded border border-input bg-background px-1.5 py-1 text-[11px] tabular-nums"
                />
              </label>
              <label className="block text-[10px] font-medium text-foreground">
                Minutes (0–59)
                <input
                  type="number"
                  min={0}
                  max={59}
                  inputMode="numeric"
                  placeholder="—"
                  value={visitMinute}
                  onChange={(e) => setVisitMinute(e.target.value.replace(/\D/g, "").slice(0, 2))}
                  className="mt-0.5 block w-full rounded border border-input bg-background px-1.5 py-1 text-[11px] tabular-nums"
                />
              </label>
            </div>
            {visitTimeFr ? (
              <span className="mt-0.5 block text-[9px] text-muted-foreground">Enregistré : {visitTimeFr}</span>
            ) : null}
            {showConfirmedCards ? (
              <p className="mt-1 text-[9px] leading-snug text-primary/90">
                La pharmacie voit les changements sur la demande.
              </p>
            ) : null}
          </div>
        ) : null}

        {showConfirmedCards ? (
          <button
            type="button"
            disabled={busyAction !== ""}
            onClick={() => void runUpdateVisit()}
            className="w-full rounded border border-primary/30 bg-primary/10 py-1.5 text-[11px] font-semibold text-primary disabled:opacity-50"
          >
            {busyAction === "visit" ? "Mise à jour…" : "Mettre à jour ma date de passage"}
          </button>
        ) : null}

        {showConfirmedCards ? (
          pharmacyContact ? (
            <div className="mt-2">
              <PatientPharmacyQuickContact pharmacy={pharmacyContact} requestRef={dossierRefLabel} />
            </div>
          ) : (
            <section className="mt-2 rounded-xl border border-emerald-200/65 bg-muted/25 px-2 py-1.5 text-[10px] leading-snug text-muted-foreground">
              Après validation, les changements passent par votre pharmacie.
            </section>
          )
        ) : null}

        {showAbandonAfterResponse ? (
          <>
            <label className="block text-[10px] font-medium text-gray-700">
              Motif d’annulation
              <select
                value={abandonCode}
                onChange={(e) => setAbandonCode(e.target.value as PatientCancelReasonCode)}
                className="mt-0.5 block w-full rounded-md border bg-white px-2 py-1.5 text-xs text-gray-900"
              >
                {PATIENT_CANCEL_REASON_CODES.map((c) => (
                  <option key={c} value={c}>
                    {PATIENT_CANCEL_REASON_LABELS[c]}
                  </option>
                ))}
              </select>
            </label>
            {abandonCode === "other" ? (
              <textarea
                value={abandonDetail}
                rows={2}
                onChange={(e) => setAbandonDetail(e.target.value)}
                placeholder="Précisez votre motif"
                className="w-full rounded-md border bg-white px-2 py-1.5 text-xs text-gray-900"
              />
            ) : null}
            <button
              type="button"
              disabled={busyAction !== "" || (abandonCode === "other" && abandonDetail.trim().length < 8)}
              onClick={() => void runAbandon()}
              className="w-full rounded-md border border-red-400 bg-white py-1.5 text-xs font-semibold text-red-950 disabled:opacity-50"
            >
              {busyAction === "abandon" ? "Annulation…" : "Annuler la demande"}
            </button>
          </>
        ) : null}
      </div>

      {showResubmit ? (
        <div className="mt-3 space-y-2 rounded-md border border-amber-200/80 bg-amber-50/50 p-2.5 shadow-sm sm:p-3">
          <button
            type="button"
            onClick={() => {
              if (editMode) {
                resetResubmitDraft();
                setEditMode(false);
              } else {
                setEditMode(true);
              }
            }}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-amber-400/90 bg-white px-3 text-xs font-semibold text-amber-950 shadow-sm hover:bg-amber-50/90"
          >
            <Pencil size={15} />
            {editMode ? "Annuler les modifications" : "Modifier"}
          </button>

          {editMode ? (
            <button
              type="button"
              disabled={busyAction !== "" || lines.length === 0}
              onClick={() => void runResubmit()}
              className="w-full rounded-lg border border-amber-600 bg-amber-100/80 py-2.5 text-sm font-semibold text-amber-950 shadow-sm disabled:opacity-50"
            >
              {busyAction === "resubmit" ? "Envoi…" : "Mettre à jour et renvoyer"}
            </button>
          ) : null}
        </div>
      ) : null}

      {showResubmit ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
          <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{lines.length}</span>{" "}
              {lines.length > 1 ? "produits" : "produit"} ajoutés
            </p>
            <p className="text-xs text-muted-foreground">
              Total indicatif <span className="font-semibold text-foreground">{resubmitTotal.toFixed(2)} MAD</span>
            </p>
          </div>
        </div>
      ) : null}

      {showConfirm ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/80 bg-background/95 px-4 py-3 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] backdrop-blur supports-[backdrop-filter]:bg-background/90">
          <div className="mx-auto flex max-w-lg flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="min-w-0 text-[11px] text-muted-foreground sm:text-xs">
              <p>
                <span className="font-semibold text-foreground">{confirmSelectionSummary.count}</span>{" "}
                {confirmSelectionSummary.count > 1 ? "lignes retenues" : "ligne retenue"}
              </p>
              <p className="mt-0.5">
                Total indicatif{" "}
                <span className="font-semibold tabular-nums text-foreground">
                  {confirmSelectionSummary.total > 0 ? `${confirmSelectionSummary.total.toFixed(2)} MAD` : "—"}
                </span>
              </p>
            </div>
            <button
              type="button"
              disabled={busyAction !== "" || visitWin.missingEtaOnToOrder}
              onClick={openConfirmReview}
              className="w-full shrink-0 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-95 disabled:opacity-50 sm:w-auto sm:min-w-[220px]"
            >
              Valider ma demande
            </button>
          </div>
        </div>
      ) : null}

      {showConfirm && confirmReviewOpen && confirmReviewSnap ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            aria-label="Fermer le récapitulatif"
            onClick={() => {
              if (busyAction !== "confirm") closeConfirmReview();
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-review-title"
            className="relative z-10 flex max-h-[min(92vh,760px)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-sky-200/80 bg-gradient-to-b from-sky-50/50 via-card to-muted/15 shadow-xl sm:rounded-2xl"
          >
            <div className="shrink-0 border-b border-sky-200/65 bg-gradient-to-r from-sky-100/50 via-teal-50/30 to-transparent px-4 py-3">
              <h2 id="confirm-review-title" className="text-base font-semibold text-sky-950 sm:text-lg">
                Récapitulatif avant validation
              </h2>
              <p className="mt-1 text-[11px] leading-snug text-sky-900/80 sm:text-xs">
                Vérifiez les lignes ci-dessous. Rien n&apos;est envoyé à la pharmacie tant que vous n&apos;avez pas confirmé.
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto bg-gradient-to-b from-white/70 to-muted/25 px-3 py-3 sm:px-4">
              <div className="rounded-xl border border-primary/25 bg-primary/5 px-3 py-2">
                <p className="text-[9px] font-bold uppercase tracking-wide text-primary/95">Passage en officine retenu</p>
                <p className="mt-1 text-[12px] font-medium text-foreground">{confirmReviewSnap.visitSummaryFr}</p>
              </div>

              {confirmReserveLines.length > 0 ? (
                <div className="mt-4">
                  <div className="mb-2 flex items-center gap-2 rounded-lg border border-emerald-200/80 bg-emerald-50/70 px-2.5 py-2">
                    <Package className="size-4 shrink-0 text-emerald-900" aria-hidden />
                    <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-950">
                      Produits disponibles à réserver
                    </p>
                  </div>
                  <ul className="space-y-2">
                    {confirmReserveLines.map((line) => (
                      <PatientConfirmReviewLineCard key={line.rowId} line={line} />
                    ))}
                  </ul>
                  <p className="mt-2 text-right text-[11px] leading-snug font-medium text-emerald-900/85">
                    {formatBlockSubtotalLabel(confirmReserveLines)}
                  </p>
                </div>
              ) : null}

              {confirmOrderLines.length > 0 ? (
                <div className="mt-4">
                  <div className="mb-2 flex items-center gap-2 rounded-lg border border-teal-200/85 bg-teal-50/70 px-2.5 py-2">
                    <ShoppingCart className="size-4 shrink-0 text-teal-950" aria-hidden />
                    <p className="text-[10px] font-bold uppercase tracking-wide text-teal-950">Produits à commander</p>
                  </div>
                  <ul className="space-y-2">
                    {confirmOrderLines.map((line) => (
                      <PatientConfirmReviewLineCard key={line.rowId} line={line} />
                    ))}
                  </ul>
                  <p className="mt-2 text-right text-[11px] leading-snug font-medium text-teal-900/88">
                    {formatBlockSubtotalLabel(confirmOrderLines)}
                  </p>
                </div>
              ) : null}

              <div className="mt-4 rounded-xl border-2 border-violet-200/70 bg-gradient-to-br from-violet-50/90 via-background to-teal-50/40 px-3 py-2.5 shadow-inner ring-1 ring-violet-200/35">
                <p className="text-[11px] font-semibold tabular-nums text-violet-950 sm:text-xs">
                  {formatGrandTotalLabel(confirmAllPreviewLines)}
                </p>
                {blockMonetarySummary(confirmAllPreviewLines).missingUnitPrice ? (
                  <p className="mt-1.5 text-[10px] leading-snug text-violet-900/80">
                    Les montants reflètent uniquement les prix unitaires communiqués par la pharmacie. Une ligne sans prix n&apos;entre pas dans le total.
                  </p>
                ) : (
                  <p className="mt-1.5 text-[10px] leading-snug text-violet-900/75">
                    Total indicatif (TTC selon officine au moment du retrait).
                  </p>
                )}
              </div>
            </div>

            <div className="shrink-0 border-t border-border/80 bg-background/95 px-3 py-3 backdrop-blur sm:px-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-3">
                <button
                  type="button"
                  disabled={busyAction === "confirm"}
                  onClick={closeConfirmReview}
                  className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground shadow-sm transition hover:bg-muted/60 disabled:opacity-50 sm:order-1 sm:w-auto"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={busyAction === "confirm"}
                  onClick={() => void performConfirmAfterReview()}
                  className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-95 disabled:opacity-50 sm:order-2 sm:w-auto sm:min-w-[200px]"
                >
                  {busyAction === "confirm" ? "Enregistrement…" : "Confirmer définitivement"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <LineHistoryModalFr
        open={historyModalItemId !== null}
        title={historyModalRow ? validatedProductLabel(historyModalRow) : ""}
        blocks={historyModalBlocks}
        onClose={() => setHistoryModalItemId(null)}
      />
    </section>
  );
}
