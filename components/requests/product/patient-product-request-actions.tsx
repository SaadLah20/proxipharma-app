"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  ChevronDown,
  History,
  Layers,
  Calendar,
  Mail,
  MessageCircle,
  MessageSquare,
  Minus,
  Package,
  Pencil,
  Phone,
  Plus,
  LayoutGrid,
  Search,
  ShoppingCart,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";
import { clsx } from "clsx";
import { formatDateShortFr, formatDateTimeShort24hFr, formatPlannedVisitFr, formatTime24hFr } from "@/lib/datetime-fr";
import {
  RequestExitConfirmModalFr,
  type RequestExitModalMode,
} from "@/components/requests/request-exit-confirm-modal-fr";
import type { PatientCancelReasonCode } from "@/lib/patient-flow-reasons";
import {
  availabilityStatusFr,
  pharmacistProposedProductBadgeFr,
  requestItemLineSourceFr,
  requestStatusFr,
} from "@/lib/request-display";
import { plannedVisitWindow } from "@/lib/planned-visit";
import {
  bucketPatientValidatedLinesThreeWays,
  effectiveAvailabilityForPatientLine,
  effectiveEtaForPatientLine,
  type PatientLineLike,
  validatedBranchUnitPriceMad,
  validatedProductLabel,
  validatedQtyForPatientLine,
} from "@/lib/patient-confirmed-line-buckets";
import { formatPriceDh } from "@/lib/product-price";
import { resolvePublicMediaUrl } from "@/lib/storage-media";
import {
  clearPatientDemandeCatalogueReturnEdit,
  clearPatientDemandeProduitsDraft,
  draftLineToResubmitLine,
  peekPatientDemandeCatalogueReturnEdit,
  readPatientDemandeProduitsDraft,
  writePatientDemandeProduitsDraft,
} from "@/lib/patient-demande-produits-draft";
import { buttonVariants } from "@/components/ui/button";
import {
  PRODUCT_CATALOG_SEARCH_LIMIT,
  PRODUCT_CATALOG_SEARCH_MIN_CHARS,
  productNameOrLaboratoryIlikeOr,
  sanitizeProductSearchQuery,
} from "@/lib/product-catalog-search";
import { supabase } from "@/lib/supabase";
import { one } from "@/lib/embed";
import {
  buildPatientLineTimelineFr,
  postConfirmSupplyAmendmentBadgeLabelsFr,
  type PatientLineTimelineBlockFr,
} from "@/lib/build-patient-line-timeline-fr";
import { LineHistoryModalFr } from "@/components/requests/line-history-modal-fr";
import { isPatientProductArchiveStatus, type PatientProductArchiveStatus } from "@/components/requests/patient-request-outcome-banner";
import { PrescriptionImageViewer } from "@/components/requests/prescription/prescription-image-viewer";
import type { PrescriptionPagePaths } from "@/lib/prescription-media";
import { getRequestKindWorkflowCopy } from "@/lib/request-kinds/workflow-copy";
import { patientArchiveIntroCopy, patientArchiveRetainedLabel } from "@/lib/request-kinds/hub-and-terminal-copy";
import { getRequestKindConfig, isRequestKindId } from "@/lib/request-kinds/registry";
import type { RequestKindAccent, RequestKindId } from "@/lib/request-kinds/types";
import { PatientProductPhotoPreviewModal } from "@/components/requests/patient-product-photo-preview-modal";
import { PATIENT_PRODUCT_LINE_COMMENT_MAX } from "@/lib/patient-request-form-limits";
import { inferAvailabilityStatusFromQty } from "@/lib/pharmacist-availability";
import { availabilityStatusUi } from "@/lib/pharmacist-availability-ui";
import {
  lineConversationStripButtonClass,
  lineConversationStripLabel,
  lineConversationVisual,
} from "@/components/pharmacist/pharmacist-line-conversation-chip";

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
  if (row.line_source === "pharmacist_proposed") {
    cap = Math.max(cap, Number(row.available_qty ?? cap));
  }
  if (row.available_qty != null) cap = Math.min(cap, row.available_qty);
  return Math.max(0, cap);
}

function maxQtyAlt(row: ActionItemRow, alt: ActionItemAltRow): number {
  if (isMarketShortage(alt.availability_status)) return 0;
  if (alt.availability_status === "unavailable") return 0;
  let cap = row.requested_qty;
  if (row.line_source === "pharmacist_proposed") {
    cap = Math.max(cap, Number(row.available_qty ?? cap));
  }
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
  variant = "default",
}: {
  pharmacy: PatientPharmacyContactInfo;
  requestRef: string;
  variant?: "default" | "iconsOnly";
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

  const iconButtons = (
    <>
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
    </>
  );

  if (variant === "iconsOnly") {
    if (!telOk && !mailOk) {
      return (
        <p className="text-[9px] leading-snug text-emerald-900/80">
          Coordonnées non renseignées sur le dossier — rapprochez-vous de l&apos;officine.
        </p>
      );
    }
    return <div className="flex flex-wrap items-center gap-1.5">{iconButtons}</div>;
  }

  return (
    <section className="rounded-xl border border-emerald-300/60 bg-gradient-to-br from-emerald-50/85 via-white to-teal-50/40 p-2 shadow-sm ring-1 ring-emerald-200/45">
      <h3 className="text-[10px] font-bold uppercase tracking-wide text-emerald-950">Contacter l&apos;officine</h3>
      <p className="mt-1 text-[10px] leading-snug text-emerald-950/88">
        Pour un ajustement sur un produit déjà validé, contactez directement la pharmacie.
      </p>
      {loc ? (
        <p className="mt-1 text-[11px] font-semibold leading-snug text-emerald-950">{loc}</p>
      ) : null}
      {telOk || mailOk ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">{iconButtons}</div>
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

/** Ligne de statut sous la carte produit (dossier traité côté patient). */
function patientTreatedSupplyStatusLine(row: ActionItemRow): string {
  if (!row.is_selected_by_patient) {
    return "Non retenu à la validation — pas de suivi réservation / commande.";
  }
  if (row.withdrawn_after_confirm) {
    return "Écart après validation : ce produit n’est plus suivi comme commande active.";
  }
  const eff = effectiveAvailabilityForPatientLine(row);
  const pcf = row.post_confirm_fulfillment ?? "unset";
  const co = row.counter_outcome ?? "unset";
  const picked = co === "picked_up";

  if (eff === "available" || eff === "partially_available") {
    if (pcf === "reserved") {
      return picked
        ? "Suivi : produit réservé à la pharmacie et indiqué comme récupéré au comptoir."
        : "Suivi : produit réservé à la pharmacie — en attente de ton passage au comptoir.";
    }
    return "Suivi : la pharmacie n’a pas encore indiqué la mise de côté (réservé).";
  }
  if (eff === "to_order") {
    if (pcf === "arrived_reserved") {
      return picked
        ? "Suivi : commande reçue à l’officine puis récupérée au comptoir."
        : "Suivi : commande reçue à l’officine — en attente de ton passage au comptoir.";
    }
    if (pcf === "ordered") {
      return "Suivi : produit commandé auprès du fournisseur — pas encore reçu en officine.";
    }
    return "Suivi : commande en cours de traitement par la pharmacie (pas encore indiquée comme commandée).";
  }
  return "Suivi : statut à préciser avec ta pharmacie.";
}

/** Jalons compacts pour une ligne retenue (dossier traité côté patient). */
function PatientTreatedLineSuiviStrip({ row }: { row: ActionItemRow }) {
  if (!row.is_selected_by_patient || row.withdrawn_after_confirm) return null;
  const eff = effectiveAvailabilityForPatientLine(row);
  const pcf = row.post_confirm_fulfillment ?? "unset";
  const picked = (row.counter_outcome ?? "unset") === "picked_up";

  const chip = (label: string, variant: "done" | "current" | "todo") => {
    const base =
      "inline-flex max-w-full items-center rounded-md border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide leading-tight";
    if (variant === "done") {
      return (
        <span className={`${base} border-emerald-400/80 bg-emerald-100/90 text-emerald-950`} aria-current="false">
          {label}
        </span>
      );
    }
    if (variant === "current") {
      return (
        <span
          className={`${base} border-primary/50 bg-primary/12 text-primary ring-1 ring-primary/25`}
          aria-current="step"
        >
          {label}
        </span>
      );
    }
    return (
      <span className={`${base} border-border/70 bg-muted/25 text-muted-foreground`} aria-current="false">
        {label}
      </span>
    );
  };

  const sep = <span className="text-[9px] font-semibold text-muted-foreground/80" aria-hidden>→</span>;

  if (eff === "available" || eff === "partially_available") {
    const reserved = pcf === "reserved";
    const s0 = reserved ? "done" : "current";
    const s1 = picked ? "done" : reserved ? "current" : "todo";
    const s2 = picked ? "done" : "todo";
    return (
      <div className="space-y-1">
        <p className="text-[8px] font-bold uppercase tracking-wide text-slate-700">Suivi</p>
        <div className="flex flex-wrap items-center gap-1">
          {chip("Réservé", s0)}
          {sep}
          {chip("En attente de passage", s1)}
          {sep}
          {chip("Récupéré", s2)}
        </div>
      </div>
    );
  }

  if (eff === "to_order") {
    const arrived = pcf === "arrived_reserved";
    const ordered = pcf === "ordered" || arrived;
    const sCmd = ordered ? "done" : "current";
    const sRecv = arrived ? "done" : ordered ? "current" : "todo";
    const sPass = picked ? "done" : arrived ? "current" : "todo";
    const sPick = picked ? "done" : "todo";
    return (
      <div className="space-y-1">
        <p className="text-[8px] font-bold uppercase tracking-wide text-slate-700">Suivi</p>
        <div className="flex flex-wrap items-center gap-1">
          {chip("Commandé", sCmd)}
          {sep}
          {chip("Reçu à la pharmacie", sRecv)}
          {sep}
          {chip("En attente de passage", sPass)}
          {sep}
          {chip("Récupéré", sPick)}
        </div>
      </div>
    );
  }

  return (
    <p className="text-[10px] font-semibold leading-snug text-slate-800">{patientTreatedSupplyStatusLine(row)}</p>
  );
}

/** Cartes condensées : produits validés après confirmation (pas de détail jusqu'à l'historique). */
function PatientValidatedCompactLineCard({
  row,
  tier,
  onOpenHistory,
  treatedSupplyStatusLine,
  requestStatusForCard = null,
  postConfirmBadges,
  onPhotoPreview,
  pharmacistProposedBadgeLabel = pharmacistProposedProductBadgeFr,
}: {
  row: ActionItemRow;
  tier: "dispo_officine" | "commande" | "hors_perimetre" | "retire_apres_validation";
  onOpenHistory: () => void;
  /** Dossier `treated` : texte court réservation / commande / réception / comptoir. */
  treatedSupplyStatusLine?: string | null;
  /** Quand `treated`, affiche le bandeau jalons à la place du paragraphe pour les lignes suivies. */
  requestStatusForCard?: string | null;
  /** Jalons post-validation (détail dans Historique produit). */
  postConfirmBadges?: string[];
  /** Agrandissement photo plein écran (patient). */
  onPhotoPreview?: (url: string, title: string) => void;
  pharmacistProposedBadgeLabel?: string;
}) {
  const prod = one(row.products);
  const altList = normalizeAlternatives(row.request_item_alternatives);
  const chosenAlt = altList.find((a) => a.id === row.patient_chosen_alternative_id);
  const validatedName = validatedProductLabel(row);
  const validatedQty = validatedQtyForPatientLine(row);
  const unitMad = validatedBranchUnitPriceMad(row);
  const lineTotalMad = unitMad != null ? unitMad * validatedQty : null;
  const thumbUrl = resolvePublicMediaUrl(
    chosenAlt ? one(chosenAlt.products)?.photo_url ?? null : prod?.photo_url ?? null
  );
  const eff = effectiveAvailabilityForPatientLine(row);
  const eta = effectiveEtaForPatientLine(row);

  const availStatusOnly =
    !row.is_selected_by_patient
      ? "Non retenu lors de votre validation."
      : eff
        ? (availabilityStatusFr[eff] ?? eff)
        : "Dispo communiquée par la pharmacie à l’historique.";

  const availUi = row.is_selected_by_patient && eff ? availabilityStatusUi(eff) : null;
  const AvailIcon = availUi?.Icon;

  const shell =
    tier === "dispo_officine"
      ? "rounded-xl border-2 border-emerald-200 bg-gradient-to-b from-white to-emerald-50/40 px-2.5 py-2 shadow-sm ring-1 ring-emerald-100/90 sm:px-3"
      : tier === "commande"
        ? "rounded-xl border-2 border-teal-200 bg-gradient-to-b from-white to-teal-50/40 px-2.5 py-2 shadow-sm ring-1 ring-teal-100/90 sm:px-3"
        : tier === "retire_apres_validation"
          ? "rounded-xl border-2 border-amber-200/90 bg-gradient-to-b from-white to-amber-50/35 px-2.5 py-2 shadow-sm ring-1 ring-amber-100/85 sm:px-3"
          : "rounded-xl border-2 border-slate-200 bg-gradient-to-b from-white to-slate-50/50 px-2.5 py-2 shadow-sm ring-1 ring-slate-100/90 sm:px-3";

  const withdrawnGrey = tier === "retire_apres_validation";
  const showAjoutOfficineBadge = row.line_source === "pharmacist_proposed";
  return (
    <li
      className={clsx(
        shell,
        withdrawnGrey && "opacity-[0.72] saturate-[0.65]"
      )}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-start gap-2">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-card shadow-inner">
            {thumbUrl ? (
              onPhotoPreview ? (
                <button
                  type="button"
                  className="relative z-0 size-full cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  onClick={() => onPhotoPreview(thumbUrl, validatedName)}
                  aria-label={`Agrandir la photo · ${validatedName}`}
                >
                  <img src={thumbUrl} alt="" className="pointer-events-none h-full w-full object-cover" />
                </button>
              ) : (
                <img src={thumbUrl} alt="" className="h-full w-full object-cover" />
              )
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Package className="size-6 text-muted-foreground" aria-hidden />
              </div>
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex items-start justify-between gap-2">
              <p
                className="min-w-0 flex-1 overflow-hidden text-[13px] font-semibold leading-tight text-slate-950 sm:text-[14px]"
                style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
              >
                {validatedName}
              </p>
              <button
                type="button"
                onClick={onOpenHistory}
                className="shrink-0 rounded-lg border border-slate-300 bg-white p-1.5 text-slate-700 shadow-sm hover:bg-slate-50"
                aria-label="Historique de cette ligne"
                title="Historique"
              >
                <History className="size-4 shrink-0" strokeWidth={2} aria-hidden />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
              {availUi && AvailIcon ? (
                <span
                  className={clsx(
                    "inline-flex max-w-full items-center gap-1 rounded-full px-1.5 py-px text-[9px] font-semibold ring-1",
                    availUi.badgeClass
                  )}
                  title={availUi.label}
                >
                  <AvailIcon className="size-2.5 shrink-0" aria-hidden />
                  <span className="truncate">{availUi.label}</span>
                </span>
              ) : (
                <span className="text-[10px] leading-snug text-foreground/90">{availStatusOnly}</span>
              )}
              {showAjoutOfficineBadge ? (
                <span className="rounded-full bg-violet-600 px-1.5 py-px text-[8px] font-bold uppercase tracking-wide text-white">
                  {pharmacistProposedBadgeLabel}
                </span>
              ) : null}
              {tier === "retire_apres_validation" ? (
                <span className="rounded-full bg-amber-600 px-1.5 py-px text-[8px] font-bold uppercase tracking-wide text-white">
                  Écart
                </span>
              ) : null}
            </div>
            {row.is_selected_by_patient && eff === "to_order" && eta ? <RespondedReceptionBadgeFr dateYmd={eta} /> : null}
            <PatientRespondedLineConvoStripReadOnly
              patientNote={row.client_comment ?? ""}
              pharmaLineNote={row.pharmacist_comment ?? ""}
              layout="embedded"
            />
          </div>
        </div>
        <div className="grid grid-cols-[5rem_1fr_auto] items-baseline gap-x-2 pt-1.5 text-[12px] font-medium leading-none tabular-nums text-slate-800 sm:text-[13px]">
          <div className="min-w-0 text-start">
            <span className="text-slate-500">PU</span>{" "}
            <strong className="font-semibold text-slate-900">{formatPriceDh(unitMad)}</strong>
          </div>
          <div className="flex min-w-0 justify-center text-center">
            <span className="text-slate-500">Qté</span>{" "}
            <strong className="font-semibold text-slate-900">{validatedQty}</strong>
          </div>
          <div className="min-w-0 text-end">
            <span className="inline-flex flex-nowrap items-baseline justify-end gap-x-1 whitespace-nowrap">
              <span className="text-slate-500">Total</span>
              <strong
                className={clsx(
                  "font-semibold text-sky-900",
                  withdrawnGrey && "line-through decoration-muted-foreground/70"
                )}
              >
                {formatPriceDh(lineTotalMad)}
              </strong>
            </span>
          </div>
        </div>
      </div>
      {postConfirmBadges && postConfirmBadges.length > 0 ? (
        <div className="mt-2 border-t border-border/55 pt-2">
          <div className="flex flex-wrap gap-1">
            {postConfirmBadges.map((label) => (
              <span
                key={label}
                className="inline-flex max-w-full rounded-md border border-slate-300/80 bg-slate-50 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-slate-800"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      {requestStatusForCard === "treated" &&
      row.is_selected_by_patient &&
      tier !== "retire_apres_validation" &&
      !row.withdrawn_after_confirm ? (
        <div className="mt-2 border-t border-slate-200/85 bg-slate-50/90 px-2 py-2 sm:px-2.5">
          <PatientTreatedLineSuiviStrip row={row} />
        </div>
      ) : treatedSupplyStatusLine != null && treatedSupplyStatusLine.trim() !== "" ? (
        <div className="mt-2 border-t border-slate-200/85 bg-slate-50/90 px-2 py-2 sm:px-2.5">
          <p className="text-[10px] font-semibold leading-snug text-slate-800">{treatedSupplyStatusLine}</p>
        </div>
      ) : null}
    </li>
  );
}

function PatientTraceNotRetainedRow({
  row,
  onOpenHistory,
  postConfirmBadges,
  onPhotoPreview,
}: {
  row: ActionItemRow;
  onOpenHistory: () => void;
  postConfirmBadges?: string[];
  onPhotoPreview?: (url: string, title: string) => void;
}) {
  const prod = one(row.products);
  const name = prod?.name ?? "Produit";
  const eff = row.availability_status;
  const lineKind =
    row.line_source === "pharmacist_proposed" ? (
      <span className="text-violet-800">{requestItemLineSourceFr.pharmacist_proposed}</span>
    ) : null;
  return (
    <li className="flex flex-col gap-1 rounded-md border border-border/70 bg-muted/15 px-2 py-1.5">
      <div className="flex items-start gap-2">
      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded border border-border/60 bg-card">
        {prod?.photo_url ? (
          onPhotoPreview ? (
            <button
              type="button"
              className="relative size-full cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              onClick={() => onPhotoPreview(prod.photo_url!, name)}
              aria-label={`Agrandir la photo · ${name}`}
            >
              <img src={prod.photo_url} alt="" className="pointer-events-none size-full object-cover" />
            </button>
          ) : (
            <img src={prod.photo_url} alt="" className="size-full object-cover" />
          )
        ) : (
          <div className="flex size-full items-center justify-center">
            <Package className="size-5 text-muted-foreground" aria-hidden />
          </div>
        )}
      </div>
      <div className="relative min-w-0 flex-1">
        <button
          type="button"
          onClick={onOpenHistory}
          className="absolute right-0 top-0 z-10 inline-flex size-7 touch-manipulation items-center justify-center rounded-md border border-primary/35 bg-card/95 text-primary shadow-sm backdrop-blur-[2px] hover:bg-primary/10"
          aria-label="Historique de cette ligne"
          title="Historique"
        >
          <History className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
        </button>
        <p className="line-clamp-2 pr-9 text-[10px] font-medium leading-snug">{name}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1 gap-y-0.5 pr-9 text-[10px] leading-snug text-muted-foreground">
          <span className="text-[8px] font-bold uppercase tracking-wide text-muted-foreground/90">Demandé</span>
          <span className="tabular-nums font-semibold text-foreground">×{row.requested_qty}</span>
          {eff ? (
            <>
              <span className="text-border" aria-hidden>
                ·
              </span>
              <span>{availabilityStatusFr[eff] ?? eff}</span>
            </>
          ) : null}
          {lineKind ? (
            <>
              <span className="text-border" aria-hidden>
                ·
              </span>
              {lineKind}
            </>
          ) : null}
        </p>
      </div>
      </div>
      {postConfirmBadges && postConfirmBadges.length > 0 ? (
        <div className="flex flex-wrap gap-1 border-t border-border/50 pt-1">
          {postConfirmBadges.map((label) => (
            <span
              key={label}
              className="inline-flex max-w-full rounded-md border border-slate-300/80 bg-slate-50 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-slate-800"
            >
              {label}
            </span>
          ))}
        </div>
      ) : null}
      <PatientRespondedLineConvoStripReadOnly
        patientNote={row.client_comment ?? ""}
        pharmaLineNote={row.pharmacist_comment ?? ""}
      />
    </li>
  );
}

function archiveReadonlyIntroShell(status: PatientProductArchiveStatus): { ring: string; gradient: string } {
  switch (status) {
    case "cancelled":
      return {
        ring: "border-rose-200/90 ring-1 ring-rose-200/45",
        gradient: "from-rose-50/80 via-white to-rose-50/20",
      };
    case "abandoned":
      return {
        ring: "border-orange-200/90 ring-1 ring-orange-200/45",
        gradient: "from-orange-50/75 via-white to-amber-50/25",
      };
    case "expired":
      return {
        ring: "border-amber-200/90 ring-1 ring-amber-200/45",
        gradient: "from-amber-50/85 via-white to-amber-50/25",
      };
    case "partially_collected":
      return {
        ring: "border-teal-200/90 ring-1 ring-teal-200/45",
        gradient: "from-teal-50/70 via-white to-cyan-50/20",
      };
    case "fully_collected":
      return {
        ring: "border-emerald-200/90 ring-1 ring-emerald-200/45",
        gradient: "from-emerald-50/75 via-white to-teal-50/25",
      };
    case "completed":
    default:
      return {
        ring: "border-slate-200/90 ring-1 ring-slate-200/40",
        gradient: "from-slate-50/80 via-white to-slate-50/15",
      };
  }
}

/** Archives (annulé, expiré, etc.) : mêmes cartes compactes que le dossier validé, sans actions ni suivi temps réel. */
function ReadonlyArchivedProductBucketsView({
  items,
  onOpenLineHistory,
  linePostConfirmBadgesById,
  archiveStatus,
  onPhotoPreview,
  pharmacistProposedBadgeLabel,
  requestType = "product_request",
}: {
  items: ActionItemRow[];
  onOpenLineHistory: (itemId: string) => void;
  linePostConfirmBadgesById: Record<string, string[]>;
  archiveStatus: PatientProductArchiveStatus;
  onPhotoPreview: (url: string, title: string) => void;
  pharmacistProposedBadgeLabel: string;
  requestType?: string;
}) {
  const kindId: RequestKindId =
    isRequestKindId(requestType) && requestType !== "free_consultation" ? requestType : "product_request";
  const introText = patientArchiveIntroCopy(archiveStatus, kindId);
  const introShell = archiveReadonlyIntroShell(archiveStatus);
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
      <div
        className={`rounded-xl border-2 bg-gradient-to-br px-2.5 py-2 shadow-sm sm:px-3 ${introShell.ring} ${introShell.gradient}`}
      >
        <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Lecture seule</p>
        <p className="mt-0.5 text-[11px] font-bold leading-snug text-foreground">{introText.title}</p>
        <p className="mt-1 text-[10px] leading-snug text-muted-foreground">{introText.lede}</p>
      </div>

      <div className="flex flex-nowrap items-center justify-between gap-2 overflow-x-auto rounded-md border border-primary/20 bg-primary/[0.06] px-2 py-1.5">
        <p className="shrink-0 text-[10px] font-semibold text-foreground">
          <span className="tabular-nums">{totalsRetained.count}</span>{" "}
          {patientArchiveRetainedLabel(kindId, totalsRetained.count)}
        </p>
        <p className="shrink-0 text-[10px] font-semibold tabular-nums text-primary whitespace-nowrap">{totalGrandLabel}</p>
      </div>

      <div className="rounded-xl border-2 border-emerald-200/70 bg-gradient-to-b from-emerald-50/30 via-white to-white p-2 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9)] ring-1 ring-emerald-200/45">
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
                  onOpenHistory={() => onOpenLineHistory(row.id)}
                  postConfirmBadges={linePostConfirmBadgesById[row.id]}
                  onPhotoPreview={onPhotoPreview}
                  pharmacistProposedBadgeLabel={pharmacistProposedBadgeLabel}
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
                  onOpenHistory={() => onOpenLineHistory(row.id)}
                  postConfirmBadges={linePostConfirmBadgesById[row.id]}
                  onPhotoPreview={onPhotoPreview}
                  pharmacistProposedBadgeLabel={pharmacistProposedBadgeLabel}
                />
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      {horsPerimetreRetenues.length > 0 || retireesApresValidation.length > 0 ? (
        <div className="mt-2 rounded-xl border-2 border-amber-200/75 bg-gradient-to-b from-amber-50/35 via-white to-white p-2 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9)] ring-1 ring-amber-200/50">
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
                  onOpenHistory={() => onOpenLineHistory(row.id)}
                  postConfirmBadges={linePostConfirmBadgesById[row.id]}
                  onPhotoPreview={onPhotoPreview}
                  pharmacistProposedBadgeLabel={pharmacistProposedBadgeLabel}
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
                  onOpenHistory={() => onOpenLineHistory(row.id)}
                  postConfirmBadges={linePostConfirmBadgesById[row.id]}
                  onPhotoPreview={onPhotoPreview}
                  pharmacistProposedBadgeLabel={pharmacistProposedBadgeLabel}
                />
              ))}
            </ul>
          </section>
        ) : null}
        </div>
      ) : null}

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
                onOpenHistory={() => onOpenLineHistory(row.id)}
                postConfirmBadges={linePostConfirmBadgesById[row.id]}
                onPhotoPreview={onPhotoPreview}
              />
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
  pharmacist_comment?: string | null;
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
    photo_url: resolvePublicMediaUrl(one(row.products)?.photo_url ?? null),
    qty: Math.min(10, Math.max(1, row.requested_qty)),
    price_pph: one(row.products)?.price_pph ?? null,
    client_comment: row.client_comment ?? "",
    pharmacist_comment: row.pharmacist_comment ?? "",
    line_source: row.line_source ?? null,
    pharmacist_proposal_reason: row.pharmacist_proposal_reason ?? null,
  }));
}

function resubmitLinesSignature(ls: ResubmitLine[]): string {
  return ls
    .map((l) =>
      [
        l.product_id,
        String(l.qty),
        l.client_comment.trim(),
        (l.pharmacist_comment ?? "").trim(),
        l.line_source ?? "",
        l.pharmacist_proposal_reason ?? "",
      ].join(":")
    )
    .join(">");
}

/** Bouton « Notes produit (…) » + petite fenêtre (fermeture fond ou Fermer). */
function PatientSentLineNotesModalFr({
  productName,
  client,
  pharmacist,
}: {
  productName: string;
  client: string;
  pharmacist: string;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const c = client.trim();
  const p = pharmacist.trim();

  const label = !c && !p
    ? "Notes produit (vide)"
    : c && p
      ? "Notes produit (Vous + officine)"
      : c
        ? "Notes produit (vous)"
        : "Notes produit (officine)";

  const noteCls =
    !c && !p
      ? "text-sky-700"
      : c && p
        ? "text-violet-700"
        : c
          ? "text-sky-700"
          : "text-emerald-800";

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className={clsx(
          "flex min-h-[2.5rem] w-full max-w-full cursor-pointer items-center gap-1.5 rounded-lg border-2 px-2 py-2 text-left text-[9px] font-semibold leading-snug shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/45 focus-visible:ring-offset-1",
          !c && !p &&
            "border-sky-400/80 bg-gradient-to-r from-sky-50 to-sky-50/40 text-sky-950 hover:border-sky-500 hover:from-sky-100 hover:to-sky-50 active:scale-[0.99]",
          c &&
            p &&
            "border-violet-400/80 bg-gradient-to-r from-violet-50 to-violet-50/40 text-violet-950 hover:border-violet-500 hover:from-violet-100 hover:to-violet-50/50 active:scale-[0.99]",
          c &&
            !p &&
            "border-sky-400/80 bg-gradient-to-r from-sky-50 to-sky-50/40 text-sky-950 hover:border-sky-500 hover:from-sky-100 hover:to-sky-50 active:scale-[0.99]",
          !c &&
            p &&
            "border-emerald-400/80 bg-gradient-to-r from-emerald-50 to-emerald-50/40 text-emerald-950 hover:border-emerald-500 hover:from-emerald-100 hover:to-emerald-50 active:scale-[0.99]"
        )}
        onClick={() => setOpen(true)}
      >
        <StickyNote className={clsx("size-4 shrink-0 self-center", noteCls)} strokeWidth={2} aria-hidden />
        <span className="min-w-0 leading-tight">{label}</span>
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-3 backdrop-blur-[1px] sm:items-center"
              role="presentation"
              onClick={(e) => {
                if (e.target === e.currentTarget) setOpen(false);
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className="max-h-[min(80vh,20rem)] w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200/90 bg-card shadow-2xl ring-1 ring-slate-900/10"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-2 border-b border-border/60 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <h2 id={titleId} className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                      <span className="block">Notes — produit</span>
                      <span className="mt-1 block text-[13px] font-semibold normal-case leading-snug text-foreground">{productName}</span>
                    </h2>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-muted/60"
                    aria-label="Fermer"
                    onClick={() => setOpen(false)}
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </div>
                <div className="max-h-[min(60vh,16rem)] space-y-2 overflow-y-auto overscroll-y-contain px-3 py-2.5 text-[11px] [-webkit-overflow-scrolling:touch]">
                  {!c && !p ? (
                    <p className="text-[11px] leading-snug text-muted-foreground">Aucune note sur ce produit.</p>
                  ) : null}
                  {c ? (
                    <div className="rounded-lg border border-sky-200/80 bg-sky-50/90 px-2.5 py-2">
                      <p className="text-[8px] font-bold uppercase tracking-wide text-sky-900">Vous</p>
                      <p className="mt-0.5 whitespace-pre-wrap break-words leading-snug text-sky-950">{c}</p>
                    </div>
                  ) : null}
                  {p ? (
                    <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/90 px-2.5 py-2">
                      <p className="text-[8px] font-bold uppercase tracking-wide text-emerald-900">Officine</p>
                      <p className="mt-0.5 whitespace-pre-wrap break-words leading-snug text-emerald-950">{p}</p>
                    </div>
                  ) : null}
                </div>
                <div className="border-t border-border/60 px-3 py-2">
                  <button
                    type="button"
                    className="h-9 w-full rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
                    onClick={() => setOpen(false)}
                  >
                    Fermer
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}

function summaryThemeClasses(accent: RequestKindAccent) {
  if (accent === "amber") {
    return {
      shell: "mb-2 rounded-lg border-2 border-amber-500/35 bg-gradient-to-br from-amber-500/12 via-white to-orange-50/30 px-2 py-2 text-[10px] leading-snug shadow-sm ring-1 ring-amber-400/35 sm:px-2.5",
      borderB: "border-amber-200/70",
      borderB2: "border-amber-200/60",
      title: "text-amber-950",
      meta: "text-amber-900/90",
      chip: "border-amber-300/60 text-amber-900",
      link: "text-amber-800",
      contactBtn: "border-amber-400/70 text-amber-950 hover:bg-amber-50",
      contactIcon: "text-amber-700",
      contactPanel: "border-amber-200 ring-amber-200/60",
      metaRow: "text-amber-950/88",
      metaLabel: "text-amber-900/90",
      hint: "text-amber-950/90",
    };
  }
  return {
    shell: "mb-2 rounded-lg border-2 border-sky-500/35 bg-gradient-to-br from-sky-500/12 via-white to-teal-50/30 px-2 py-2 text-[10px] leading-snug shadow-sm ring-1 ring-sky-400/35 sm:px-2.5",
    borderB: "border-sky-200/70",
    borderB2: "border-sky-200/60",
    title: "text-sky-950",
    meta: "text-sky-900/90",
    chip: "border-sky-300/60 text-sky-900",
    link: "text-sky-800",
    contactBtn: "border-sky-400/70 text-sky-950 hover:bg-sky-50",
    contactIcon: "text-sky-700",
    contactPanel: "border-sky-200 ring-sky-200/60",
    metaRow: "text-sky-950/88",
    metaLabel: "text-sky-900/90",
    hint: "text-sky-950/90",
  };
}

function PatientSentEnvoyeeSummaryCard({
  pharmacyContact,
  pharmacyId,
  dossierRefLabel,
  lineCount,
  lineCountLabel,
  status,
  createdAt,
  updatedAt,
  kindLabel,
  refShort,
  statusHint,
  accent = "sky",
}: {
  pharmacyContact: PatientPharmacyContactInfo | null;
  pharmacyId: string;
  dossierRefLabel: string;
  lineCount: number;
  lineCountLabel: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  kindLabel: string;
  refShort: string;
  statusHint: string;
  accent?: RequestKindAccent;
}) {
  const ph = pharmacyContact;
  const titleLine =
    ph?.nom?.trim() != null && ph.nom.trim() !== ""
      ? `${ph.nom.trim()}${ph.ville?.trim() ? ` · ${ph.ville.trim()}` : ""}`
      : "Officine";
  const phRef = ph?.public_ref?.trim();
  const t = summaryThemeClasses(accent);
  return (
    <div className={t.shell}>
      <div className="flex flex-wrap items-start gap-x-2 gap-y-1 border-b border-sky-200/70 pb-1.5">
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-[11px] font-bold leading-tight text-sky-950">{titleLine}</p>
          {phRef ? (
            <p className="text-[9px] text-sky-900/90">
              <span className="font-mono font-semibold text-foreground">Off. {phRef}</span>
            </p>
          ) : null}
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[9px] text-sky-900/85">
            <span className="rounded border border-sky-300/60 bg-white/90 px-1 py-px font-semibold uppercase tracking-wide text-sky-900">
              Horaires
            </span>
            <Link href={`/pharmacie/${pharmacyId}`} className="font-semibold text-sky-800 underline underline-offset-2">
              Voir fiche & horaires
            </Link>
          </p>
        </div>
        {ph ? (
          <details className="group relative shrink-0">
            <summary className="flex cursor-pointer list-none items-center gap-1 rounded-md border border-sky-400/70 bg-white/95 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-sky-950 shadow-sm marker:content-none hover:bg-sky-50 [&::-webkit-details-marker]:hidden">
              Contacter
              <ChevronDown className="size-3 text-sky-700 transition group-open:rotate-180" aria-hidden />
            </summary>
            <div className="absolute right-0 z-[60] mt-1 min-w-[12rem] max-w-[min(100vw-2rem,18rem)] rounded-lg border border-sky-200 bg-card p-2 shadow-lg ring-1 ring-sky-200/60">
              <PatientPharmacyQuickContact pharmacy={ph} requestRef={dossierRefLabel} variant="iconsOnly" />
            </div>
          </details>
        ) : null}
      </div>
      <p className={clsx("mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 border-b pb-1.5 text-[9px]", t.borderB2, t.metaRow)}>
        <span className={clsx("font-bold uppercase tracking-wide", t.metaLabel)}>Dossier</span>
        <span className="font-mono font-semibold text-foreground">
          {refShort} {dossierRefLabel}
        </span>
        <span aria-hidden>·</span>
        <span>{kindLabel}</span>
        <span aria-hidden>·</span>
        <span className="tabular-nums font-semibold">{lineCountLabel}</span>
        <span aria-hidden>·</span>
        <span>
          Créée{" "}
          <span className="font-medium tabular-nums text-foreground">
            {createdAt ? formatDateTimeShort24hFr(createdAt) : "—"}
          </span>
        </span>
        <span aria-hidden>·</span>
        <span>
          MAJ{" "}
          <span className="font-medium tabular-nums text-foreground">
            {updatedAt ? formatDateTimeShort24hFr(updatedAt) : "—"}
          </span>
        </span>
      </p>
      <div className="mt-1.5 flex flex-wrap items-start gap-2">
        <span className="shrink-0 rounded-full border border-amber-300/90 bg-amber-50 px-1.5 py-px text-[8px] font-bold uppercase tracking-wide text-amber-950">
          {requestStatusFr[status] ?? status}
        </span>
        <p className={clsx("min-w-0 flex-1 text-[9px] leading-snug", t.hint)}>{statusHint}</p>
      </div>
    </div>
  );
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
  public_ref?: string | null;
};

type Props = {
  requestId: string;
  status: string;
  items: ActionItemRow[];
  initialPlannedVisitDate?: string | null;
  initialPlannedVisitTime?: string | null;
  onReload: () => Promise<void>;
  /** Coordonnées officine : affichées une fois la demande validée (passage direct). */
  pharmacyContact?: PatientPharmacyContactInfo | null;
  /** Référence courte (ex. PR-…) pour préremplir un courriel. */
  requestPublicRef?: string | null;
  supplyAmendmentBundles?: { id: string; created_at: string; amendments: unknown }[];
  /** Dates dossier pour la timeline produit après validation */
  requestTimelineMeta?: {
    created_at: string;
    submitted_at: string | null;
    responded_at: string | null;
    confirmed_at: string | null;
  };
  /** `request_status_history` (filtre audit par produit dans le modal). */
  dossierHistoryRows?: { id: string; created_at: string; old_status: string | null; new_status: string; reason: string | null }[];
  /** Pour lien annuaire + récap « envoyées ». */
  pharmacyId?: string | null;
  requestUpdatedAt?: string | null;
  requestType?: string;
  prescriptionPaths?: PrescriptionPagePaths | null;
  prescriptionNote?: string | null;
};

function buildPatientSummaryStatusHint(
  status: string,
  requestType: string,
  workflow: ReturnType<typeof getRequestKindWorkflowCopy>
): string {
  if (status === "responded") return "Un choix par produit, puis date de passage et validation.";
  if (status === "confirmed") {
    return requestType === "prescription"
      ? "La pharmacie prépare votre commande selon les produits saisis sur l’ordonnance."
      : "Ta pharmacie prépare ta commande (mise de côté et commandes fournisseur selon les produits). Les mises à jour restent visibles sur cette page.";
  }
  if (status === "treated") {
    return "Tu peux passer à l’officine pour retirer les produits réservés et ceux commandés déjà reçus. Le suivi par produit est indiqué sur chaque carte.";
  }
  if (status === "in_review") {
    return requestType === "prescription"
      ? workflow.patientWaitingInReviewHint
      : workflow.patientWaitingInReviewHint;
  }
  return requestType === "prescription" ? workflow.patientWaitingSubmittedHint : workflow.patientWaitingSubmittedHint;
}

function buildPatientLineCountLabel(
  requestType: string,
  status: string,
  lineCount: number
): string {
  if (requestType === "prescription" && ["submitted", "in_review"].includes(status)) {
    return "Scan envoyé";
  }
  if (requestType === "prescription" && lineCount > 0) {
    return `${lineCount} produit${lineCount > 1 ? "s" : ""} saisi${lineCount > 1 ? "s" : ""}`;
  }
  return `${lineCount} ligne${lineCount > 1 ? "s" : ""}`;
}

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
  onPhotoPreview?: (url: string, title: string) => void;
};

/** Même résumé qté + dispo que la ligne ait des alternatives ou non. */
function RespondedProductQtyStatusLine({ row }: { row: ActionItemRow }) {
  const isProposedLine = row.line_source === "pharmacist_proposed";
  let inferredKey = row.availability_status ?? "available";
  try {
    inferredKey = inferAvailabilityStatusFromQty({
      status: row.availability_status ?? "available",
      availableQty: Number(row.available_qty ?? 0),
      requestedQty: row.requested_qty,
      isProposedLine,
    });
  } catch {
    inferredKey = row.availability_status ?? "available";
  }
  const availUi = availabilityStatusUi(inferredKey);
  const AvailIcon = availUi.Icon;
  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
      {!isProposedLine ? (
        <span className="inline-flex items-center gap-0.5">
          Demandé <strong className="tabular-nums text-foreground">{row.requested_qty}</strong>
        </span>
      ) : null}
      <span
        className={clsx(
          "inline-flex max-w-full items-center gap-1 rounded-full px-1.5 py-px text-[9px] font-semibold ring-1",
          availUi.badgeClass
        )}
        title={availUi.label}
      >
        <AvailIcon className="size-2.5 shrink-0" aria-hidden />
        <span className="truncate">{availUi.label}</span>
      </span>
      {row.availability_status === "to_order" && row.expected_availability_date ? (
        <RespondedReceptionBadgeFr dateYmd={row.expected_availability_date} />
      ) : null}
    </p>
  );
}

/** Date de réception (produit à commander) — libellé très visible. */
function RespondedReceptionBadgeFr({ dateYmd, className }: { dateYmd: string; className?: string }) {
  return (
    <span
      className={clsx(
        "inline-flex max-w-full shrink-0 items-center rounded-md border-2 border-amber-500/80 bg-amber-100 px-2 py-0.5 text-[10px] font-bold leading-tight text-amber-950 shadow-sm sm:py-1",
        className
      )}
    >
      Réception · {formatDateShortFr(dateYmd)}
    </span>
  );
}

/** Bandeau + modal lecture seule (échanges patient / pharmacie sur la ligne). */
function PatientRespondedLineConvoStripReadOnly({
  patientNote,
  pharmaLineNote,
  layout = "footer",
}: {
  patientNote: string;
  pharmaLineNote: string;
  /** `embedded` : sous la dispo, pleine largeur, sans ligne du haut (carte compacte validée/traitée). */
  layout?: "footer" | "embedded";
}) {
  const [open, setOpen] = useState(false);
  const visual = lineConversationVisual(patientNote, pharmaLineNote);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const wrapCls =
    layout === "embedded"
      ? "mt-1.5 flex w-full min-w-0 justify-stretch pt-0"
      : "mt-1.5 flex w-full min-w-0 justify-end border-t border-dotted border-border/55 pt-1.5";

  return (
    <>
      <div className={wrapCls}>
        <button
          type="button"
          className={clsx(
            lineConversationStripButtonClass(visual, { open, disabled: false }),
            layout === "embedded" && "w-full max-w-none justify-start"
          )}
          aria-label={`Échanges sur ce produit · ${lineConversationStripLabel(visual)}`}
          title="Voir les messages (lecture seule)"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen((o) => !o);
          }}
        >
          <MessageCircle className="size-3.5 shrink-0 opacity-90" strokeWidth={2.2} aria-hidden />
          <span className="max-w-[11rem] truncate text-[9px] font-medium leading-tight sm:max-w-[14rem]">
            {lineConversationStripLabel(visual)}
          </span>
        </button>
      </div>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-3 backdrop-blur-[1px] sm:items-center"
              role="presentation"
              onClick={(e) => {
                if (e.target === e.currentTarget) setOpen(false);
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Échanges sur la ligne"
                className="max-h-[min(80vh,22rem)] w-full max-w-md overflow-hidden rounded-2xl border border-border/90 bg-card shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
                  <p className="text-[11px] font-bold text-foreground">Sur ce produit</p>
                  <button
                    type="button"
                    className="rounded-lg p-1 text-muted-foreground hover:bg-muted/60"
                    aria-label="Fermer"
                    onClick={() => setOpen(false)}
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </div>
                <div className="max-h-[min(65vh,18rem)] space-y-2 overflow-y-auto overscroll-y-contain px-3 py-2.5 text-[11px] [-webkit-overflow-scrolling:touch]">
                  {patientNote.trim() ? (
                    <div className="rounded-lg border border-sky-200/80 bg-sky-50/90 px-2.5 py-2">
                      <p className="text-[8px] font-bold uppercase tracking-wide text-sky-900">Vous</p>
                      <p className="mt-0.5 whitespace-pre-wrap break-words leading-snug text-sky-950">{patientNote.trim()}</p>
                    </div>
                  ) : (
                    <p className="text-[10px] italic text-muted-foreground">Aucun commentaire de votre part sur ce produit.</p>
                  )}
                  {pharmaLineNote.trim() ? (
                    <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/90 px-2.5 py-2">
                      <p className="text-[8px] font-bold uppercase tracking-wide text-emerald-900">Pharmacie</p>
                      <p className="mt-0.5 whitespace-pre-wrap break-words leading-snug text-emerald-950">{pharmaLineNote.trim()}</p>
                    </div>
                  ) : (
                    <p className="text-[10px] italic text-muted-foreground">Aucune note de la pharmacie sur ce produit.</p>
                  )}
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}

function RespondedPatientLineChooser({
  row,
  selState,
  setLineBranch,
  setLineQty,
  togglePrincipalOnlyLine,
  onPhotoPreview,
}: RespondedChooserProps) {
  const prod = one(row.products);
  const altList = normalizeAlternatives(row.request_item_alternatives);
  const hasAlts = altList.length > 0;
  const capPrincipal = maxQtyPrincipal(row);
  const radioName = `line-choice-${row.id}`;
  const currentBranch = selState.branch;
  const isProposedLine = row.line_source === "pharmacist_proposed";
  const maxBranch = maxQtyForBranch(row, currentBranch, altList);

  const unitForSelection =
    currentBranch === "principal"
      ? row.unit_price
      : currentBranch !== null
        ? altList.find((a) => a.id === currentBranch)?.unit_price ?? null
        : null;

  const thumb = (
    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-card shadow-inner">
      {prod?.photo_url ? (
        onPhotoPreview ? (
          <button
            type="button"
            className="relative z-0 size-full cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            onClick={() => onPhotoPreview(prod.photo_url!, prod?.name ?? "Produit")}
            aria-label={`Agrandir la photo · ${prod?.name ?? "Produit"}`}
          >
            <img src={prod.photo_url} alt="" className="pointer-events-none h-full w-full object-cover" />
          </button>
        ) : (
          <img src={prod.photo_url} alt="" className="h-full w-full object-cover" />
        )
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Package className="size-6 text-muted-foreground" aria-hidden />
        </div>
      )}
    </div>
  );

  const qtyRowGrid =
    currentBranch !== null && maxBranch > 0 ? (
      <div
        className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-x-3.5 gap-y-1 border-t border-slate-200/80 pt-2 text-[12px] font-medium leading-none tabular-nums text-slate-800 sm:gap-x-4 sm:text-[13px]"
        title={`Quantité max autorisée : ${maxBranch}`}
      >
        <div className="min-w-0 justify-self-start truncate">
          {unitForSelection != null ? (
            <>
              <span className="text-slate-500">PU</span>{" "}
              <strong className="font-semibold text-slate-900">{formatPriceDh(Number(unitForSelection))}</strong>
            </>
          ) : (
            <span className="text-slate-400">PU —</span>
          )}
        </div>
        <div className="flex shrink-0 items-center justify-center gap-1.5 justify-self-center">
          <span className="shrink-0 text-slate-500">Qté</span>
          <button
            type="button"
            aria-label="Diminuer la quantité"
            disabled={selState.qty <= 1}
            className="rounded-md border border-slate-300 bg-white p-1.5 text-foreground shadow-sm hover:bg-slate-50 disabled:opacity-40"
            onClick={() => setLineQty(row.id, selState.qty - 1)}
          >
            <Minus size={15} />
          </button>
          <span className="min-w-[1.5rem] text-center font-semibold text-slate-900">{selState.qty}</span>
          <button
            type="button"
            aria-label="Augmenter la quantité"
            disabled={selState.qty >= maxBranch}
            className="rounded-md border border-slate-300 bg-white p-1.5 text-foreground shadow-sm hover:bg-slate-50 disabled:opacity-40"
            onClick={() => setLineQty(row.id, selState.qty + 1)}
          >
            <Plus size={15} />
          </button>
        </div>
        <div className="min-w-0 justify-self-end truncate text-end">
          <span className="text-slate-500">Total</span>{" "}
          <strong className="font-semibold text-sky-900">
            {unitForSelection != null ? formatPriceDh(selState.qty * Number(unitForSelection)) : "—"}
          </strong>
        </div>
      </div>
    ) : null;

  const cardShell = (inner: ReactNode) => (
    <li className="rounded-2xl border-[3px] border-slate-400/70 bg-gradient-to-b from-white to-slate-50/50 px-2.5 py-2.5 shadow-md ring-2 ring-slate-200/50 sm:px-3.5">
      {isProposedLine ? (
        <div className="mb-2 rounded-md border border-violet-200/90 bg-violet-50/70 px-2 py-1.5">
          <p className="text-[9px] font-bold uppercase tracking-wide text-violet-800">
            {requestItemLineSourceFr.pharmacist_proposed}
          </p>
          {row.pharmacist_proposal_reason?.trim() ? (
            <p className="mt-0.5 line-clamp-2 text-[10px] font-medium leading-snug text-violet-950">{row.pharmacist_proposal_reason.trim()}</p>
          ) : (
            <p className="mt-0.5 text-[10px] italic text-violet-800/80">Motif non renseigné.</p>
          )}
        </div>
      ) : null}
      <div className="flex flex-col gap-2">{inner}</div>
    </li>
  );

  if (!hasAlts) {
    return cardShell(
      <>
        <div className="flex items-start gap-2">
          {thumb}
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <p
              className="overflow-hidden pr-0.5 text-[13px] font-semibold leading-tight text-slate-950 sm:text-[14px]"
              style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
            >
              {prod?.name ?? "Produit"}
            </p>
            <RespondedProductQtyStatusLine row={row} />
            <PatientSentLineNotesModalFr
              productName={prod?.name ?? "Produit"}
              client={row.client_comment ?? ""}
              pharmacist={row.pharmacist_comment ?? ""}
            />
          </div>
        </div>
        <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border-2 border-slate-200 bg-slate-50/40 px-2.5 py-2 transition hover:border-sky-200">
          <input
            type="checkbox"
            className="mt-1 rounded border-primary"
            checked={currentBranch === "principal" && capPrincipal > 0}
            disabled={capPrincipal === 0}
            onChange={(e) => togglePrincipalOnlyLine(row.id, e.target.checked)}
          />
          <span className="text-[13px] leading-snug">
            <span className="font-semibold text-foreground">Je retiens cette ligne</span>
          </span>
        </label>
        {capPrincipal === 0 ? (
          <p className="rounded-lg border border-amber-200/80 bg-amber-50 px-2 py-1.5 text-[10px] leading-snug text-amber-950">
            Aucune quantité dispo pour l’instant — tu peux ne pas retenir cette ligne ou contacter l’officine.
          </p>
        ) : null}
        {qtyRowGrid}
      </>
    );
  }

  return cardShell(
    <>
      <div className="rounded-xl border-2 border-slate-300/70 bg-slate-100/45 p-2 ring-1 ring-slate-200/50">
        <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <Layers className="size-3.5 shrink-0 text-slate-600" aria-hidden />
            <p className="truncate text-[9px] font-bold uppercase tracking-wide text-slate-700">Choix pour cette ligne</p>
          </div>
          <details className="shrink-0 text-[9px] text-slate-700">
            <summary className="cursor-pointer font-semibold underline decoration-slate-400 underline-offset-2">Aide</summary>
            <p className="mt-1 max-w-[14rem] rounded-md bg-white px-1.5 py-1 leading-snug ring-1 ring-slate-200/60">
              Une option : principal{isProposedLine ? " / proposition" : ""}, alternative ou aucune.
            </p>
          </details>
        </div>

        <fieldset className="space-y-2 border-0 p-0">
          <legend className="sr-only">Choix pour {prod?.name ?? "Produit"}</legend>

          <label
            className={clsx(
              "flex cursor-pointer items-start gap-2 rounded-xl border-2 px-2.5 py-2 transition",
              currentBranch === null
                ? "border-slate-500 bg-slate-100/90 shadow-sm ring-2 ring-slate-300/35"
                : "border-slate-200 bg-white/90 opacity-65"
            )}
          >
            <input
              type="radio"
              name={radioName}
              className="mt-1 shrink-0"
              checked={currentBranch === null}
              onChange={() => setLineBranch(row.id, null)}
            />
            <span>
              <span className="text-[13px] font-semibold text-foreground">Ne pas retenir</span>
              <span className="mt-0.5 block text-[10px] text-muted-foreground">Aucune des options ci-dessous.</span>
            </span>
          </label>

          <label
            className={clsx(
              "flex cursor-pointer gap-2 rounded-xl border-2 p-2 transition",
              capPrincipal === 0 && "cursor-not-allowed opacity-40",
              currentBranch === "principal"
                ? isProposedLine
                  ? "border-violet-500 bg-violet-50 ring-2 ring-violet-200/80 shadow-md"
                  : "border-sky-500 bg-sky-50 ring-2 ring-sky-200/80 shadow-md"
                : isProposedLine
                  ? "border-violet-200/90 bg-gradient-to-br from-violet-50/50 to-white"
                  : "border-sky-200/90 bg-gradient-to-br from-sky-50/55 via-white to-white",
              currentBranch !== null && currentBranch !== "principal" && "opacity-45 saturate-[0.65]",
              currentBranch === null && "bg-slate-50/90 opacity-55"
            )}
          >
            <input
              type="radio"
              name={radioName}
              className="shrink-0 self-start pt-2"
              checked={currentBranch === "principal"}
              disabled={capPrincipal === 0}
              onChange={() => setLineBranch(row.id, "principal")}
            />
            {thumb}
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={clsx(
                    "rounded-md px-1.5 py-px text-[8px] font-bold uppercase tracking-wide text-white",
                    isProposedLine ? "bg-violet-700" : "bg-sky-700"
                  )}
                >
                  {isProposedLine ? "Proposition officine" : "Principal"}
                </span>
                {isProposedLine ? (
                  <span className="rounded-full bg-violet-600 px-1.5 py-px text-[8px] font-bold uppercase tracking-wide text-white">
                    Proposé
                  </span>
                ) : (
                  <span className="rounded-full bg-sky-600 px-1.5 py-px text-[8px] font-bold uppercase tracking-wide text-white">
                    Ta demande
                  </span>
                )}
              </div>
              <p
                className="text-[13px] font-semibold leading-tight text-slate-950 sm:text-[14px]"
                style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}
              >
                {prod?.name ?? "Produit"}
              </p>
              <RespondedProductQtyStatusLine row={row} />
              <PatientSentLineNotesModalFr
                productName={prod?.name ?? "Produit"}
                client={row.client_comment ?? ""}
                pharmacist={row.pharmacist_comment ?? ""}
              />
            </div>
          </label>

          {altList.map((alt) => {
            const altProd = one(alt.products);
            const capA = maxQtyAlt(row, alt);
            const disabled = capA === 0;
            const altComment = alt.pharmacist_comment?.trim();
            const altPhoto = resolvePublicMediaUrl(altProd?.photo_url ?? null);
            const altSelected = currentBranch === alt.id;
            return (
              <label
                key={alt.id}
                className={clsx(
                  "flex cursor-pointer gap-2 rounded-xl border-2 p-2 transition",
                  disabled && "cursor-not-allowed opacity-40",
                  altSelected
                    ? "border-teal-500 bg-teal-50 ring-2 ring-teal-200/80 shadow-md"
                    : "border-teal-100/85 bg-gradient-to-br from-teal-50/35 to-white",
                  !disabled && currentBranch !== null && currentBranch !== alt.id && "opacity-45 saturate-[0.65]",
                  !disabled && currentBranch === null && "bg-slate-50/90 opacity-55"
                )}
              >
                <input
                  type="radio"
                  name={radioName}
                  className="shrink-0 self-center"
                  checked={altSelected}
                  disabled={disabled}
                  onChange={() => setLineBranch(row.id, alt.id)}
                />
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-card shadow-inner sm:h-20 sm:w-20">
                  {altPhoto ? (
                    onPhotoPreview ? (
                      <button
                        type="button"
                        className="relative z-0 size-full cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                        onClick={() => onPhotoPreview(altPhoto, altProd?.name ?? "Alternative")}
                        aria-label={`Agrandir la photo · ${altProd?.name ?? "Alternative"}`}
                      >
                        <img src={altPhoto} alt="" className="pointer-events-none h-full w-full object-cover" />
                      </button>
                    ) : (
                      <img src={altPhoto} alt="" className="h-full w-full object-cover" />
                    )
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Package className="size-6 text-muted-foreground" aria-hidden />
                    </div>
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
                  <span className="text-[13px] font-semibold leading-tight text-foreground">
                    {altProd?.name ?? "Alternative"}
                  </span>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
                    {alt.unit_price != null ? (
                      <span>
                        PU <strong className="tabular-nums text-foreground">{formatPriceDh(Number(alt.unit_price))}</strong>
                      </span>
                    ) : null}
                    {alt.availability_status ? (
                      <span className="rounded-full bg-slate-200/80 px-1.5 py-px text-[9px] font-semibold text-slate-800">
                        {availabilityStatusFr[alt.availability_status] ?? alt.availability_status}
                      </span>
                    ) : null}
                    <span className="rounded-full bg-teal-600 px-1.5 py-0.5 text-[7px] font-bold uppercase leading-tight tracking-wide text-white sm:px-2 sm:text-[8px]">
                      ALTERNATIVE
                    </span>
                  </div>
                  {alt.availability_status === "to_order" && alt.expected_availability_date ? (
                    <RespondedReceptionBadgeFr dateYmd={alt.expected_availability_date} />
                  ) : null}
                  {altComment ? (
                    <details className="rounded-md border border-teal-200/50 bg-white/80 text-[9px] text-teal-950">
                      <summary className="cursor-pointer px-1.5 py-1 font-semibold">Note officine</summary>
                      <p className="border-t border-teal-100/80 px-1.5 py-1 leading-snug">{altComment}</p>
                    </details>
                  ) : null}
                </div>
              </label>
            );
          })}
        </fieldset>
      </div>

      {qtyRowGrid}
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

type PatientConfirmSkippedLine = {
  rowId: string;
  productName: string;
  isProposed: boolean;
};

type PatientConfirmReviewSnapshot = {
  rpcPayload: PatientConfirmRpcRow[];
  preview: PatientConfirmPreviewLine[];
  skippedLines: PatientConfirmSkippedLine[];
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
        photoUrl = resolvePublicMediaUrl(principalProd?.photo_url ?? null);
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
        photoUrl = resolvePublicMediaUrl(altProd?.photo_url ?? null);
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

function buildNonRetainedConfirmLines(
  items: ActionItemRow[],
  sel: Record<string, LineSelState>
): PatientConfirmSkippedLine[] {
  const out: PatientConfirmSkippedLine[] = [];
  for (const row of items) {
    const alts = normalizeAlternatives(row.request_item_alternatives);
    const st = sel[row.id] ?? ({ branch: null, qty: 1 } satisfies LineSelState);
    const cap = maxQtyForBranch(row, st.branch, alts);
    const on = st.branch !== null && cap > 0;
    if (!on) {
      out.push({
        rowId: row.id,
        productName: one(row.products)?.name ?? "Produit",
        isProposed: row.line_source === "pharmacist_proposed",
      });
    }
  }
  return out;
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
  if (missingUnitPrice && sumKnown === 0) return "TOTAL: — (prix incomplet)";
  if (missingUnitPrice) return `TOTAL: ${sumKnown.toFixed(2)} MAD (partiel)`;
  return `TOTAL: ${sumKnown.toFixed(2)} MAD`;
}

function PatientConfirmReviewLineCard({
  line,
  onPhotoPreview,
}: {
  line: PatientConfirmPreviewLine;
  onPhotoPreview?: (url: string, title: string) => void;
}) {
  const isOrder = line.bucket === "order";
  const thumbRing = isOrder ? "border-teal-300/70 ring-1 ring-teal-300/35" : "border-emerald-300/65 ring-1 ring-emerald-300/35";
  const thumb = (
    <div
      className={`relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl border bg-white shadow-inner ${thumbRing}`}
    >
      {line.photoUrl ? (
        onPhotoPreview ? (
          <button
            type="button"
            className="relative size-full cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            onClick={() => onPhotoPreview(line.photoUrl!, line.productName)}
            aria-label={`Agrandir la photo · ${line.productName}`}
          >
            <img src={line.photoUrl} alt="" className="pointer-events-none h-full w-full object-cover" />
          </button>
        ) : (
          <img src={line.photoUrl} alt="" className="h-full w-full object-cover" />
        )
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
            Tot · <span className="tabular-nums">{line.lineTotalMad != null ? `${line.lineTotalMad.toFixed(2)} MAD` : "—"}</span>
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
  initialPlannedVisitDate,
  initialPlannedVisitTime,
  onReload,
  pharmacyContact = null,
  requestPublicRef = null,
  supplyAmendmentBundles = [],
  requestTimelineMeta = undefined,
  dossierHistoryRows = [],
  pharmacyId = null,
  requestUpdatedAt = null,
  requestType = "product_request",
  prescriptionPaths = null,
  prescriptionNote = null,
}: Props) {
  const pathname = usePathname();
  const kindConfig = getRequestKindConfig(requestType);
  const workflowCopy = kindConfig.copy.workflow;
  const accent = kindConfig.theme.accent;
  const isPrescription = requestType === "prescription";
  const [actionError, setActionError] = useState("");
  const [historyModalItemId, setHistoryModalItemId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<"" | "confirm" | "resubmit" | "abandon" | "visit">("");
  const [confirmReviewOpen, setConfirmReviewOpen] = useState(false);
  const [confirmReviewSnap, setConfirmReviewSnap] = useState<PatientConfirmReviewSnapshot | null>(null);
  const [exitModalOpen, setExitModalOpen] = useState(false);
  const [exitModalNonce, setExitModalNonce] = useState(0);
  const [exitModalMode, setExitModalMode] = useState<RequestExitModalMode>("patient_abandon");
  const [productPhotoPreview, setProductPhotoPreview] = useState<{ url: string; title: string } | null>(null);
  const openProductPhotoPreview = useCallback((url: string, title: string) => {
    if (!url.trim()) return;
    setProductPhotoPreview({ url: url.trim(), title: title.trim() || "Produit" });
  }, []);

  /** Lignes `pharmacist_proposed` masquées tant que statut submitted / in_review — elles sont un brouillon coté officine. */
  const itemsFilteredPending = useMemo(
    () => visibleItemsForPatientBeforePharmacyResponse(items, status),
    [items, status]
  );

  const linePostConfirmBadgesById = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const row of items) {
      const labels = postConfirmSupplyAmendmentBadgeLabelsFr(row as unknown as PatientLineLike, supplyAmendmentBundles);
      if (labels.length > 0) m[row.id] = labels;
    }
    return m;
  }, [items, supplyAmendmentBundles]);

  /** Confirmation responded -> confirmed — reset via parent `key` when server rows change */
  const [sel, setSel] = useState(() => computeSelFromItems(items));

  /** Créneau de passage officine (`''` = défaut automatique borne min) */
  const [visitDate, setVisitDate] = useState(initialPlannedVisitDate ?? "");
  const [visitHour, setVisitHour] = useState(() => splitVisitHm(initialPlannedVisitTime).h);
  const [visitMinute, setVisitMinute] = useState(() => splitVisitHm(initialPlannedVisitTime).m);

  const visitSyncKey = `${initialPlannedVisitDate ?? ""}|${initialPlannedVisitTime ?? ""}`;
  const [prevVisitSyncKey, setPrevVisitSyncKey] = useState(visitSyncKey);
  if (visitSyncKey !== prevVisitSyncKey) {
    setPrevVisitSyncKey(visitSyncKey);
    setVisitDate(initialPlannedVisitDate ?? "");
    const hm = splitVisitHm(initialPlannedVisitTime);
    setVisitHour(hm.h);
    setVisitMinute(hm.m);
  }

  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<ProductHit[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [resubmitConfirmOpen, setResubmitConfirmOpen] = useState(false);
  const [shouldRestoreFromCatalogue] = useState(() =>
    requestId ? peekPatientDemandeCatalogueReturnEdit(requestId) : false
  );
  const [catalogueRestoreDone, setCatalogueRestoreDone] = useState(false);

  const serverResubmitLines = useMemo(
    () => computeResubmitLinesFromItems(visibleItemsForPatientBeforePharmacyResponse(items, status)),
    [items, status]
  );
  const linesSyncKey = editMode
    ? "edit"
    : serverResubmitLines.map((l) => `${l.product_id}:${l.qty}:${l.client_comment}`).join("|");
  const [prevLinesSyncKey, setPrevLinesSyncKey] = useState(linesSyncKey);
  const [lines, setLines] = useState<ResubmitLine[]>(serverResubmitLines);
  if (!editMode && linesSyncKey !== prevLinesSyncKey) {
    setPrevLinesSyncKey(linesSyncKey);
    setLines(serverResubmitLines);
  }

  if (shouldRestoreFromCatalogue && !catalogueRestoreDone && pharmacyId && requestId) {
    clearPatientDemandeCatalogueReturnEdit(requestId);
    setCatalogueRestoreDone(true);
    setEditMode(true);
    setPrevLinesSyncKey("edit");
    const draft = readPatientDemandeProduitsDraft(pharmacyId, requestId);
    if (draft.length > 0) {
      setLines(
        draft.map((d) => {
          const srv = serverResubmitLines.find((s) => s.product_id === d.product_id);
          const base = draftLineToResubmitLine(d);
          return {
            product_id: base.product_id,
            name: base.name,
            photo_url: base.photo_url,
            qty: base.qty,
            price_pph: base.price_pph ?? srv?.price_pph ?? null,
            client_comment: base.client_comment,
            pharmacist_comment: srv?.pharmacist_comment ?? null,
            line_source: srv?.line_source ?? null,
            pharmacist_proposal_reason: srv?.pharmacist_proposal_reason ?? null,
          };
        })
      );
    }
  }

  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    const fromCatalogue = prevPathname.includes("/demande-produits/catalogue");
    setPrevPathname(pathname);
    if (
      fromCatalogue &&
      editMode &&
      pharmacyId &&
      requestId &&
      pathname.endsWith(`/dashboard/demandes/${requestId}`)
    ) {
      setPrevLinesSyncKey("edit");
      const draft = readPatientDemandeProduitsDraft(pharmacyId, requestId);
      if (draft.length > 0) {
        setLines(
          draft.map((d) => {
            const srv = serverResubmitLines.find((s) => s.product_id === d.product_id);
            const base = draftLineToResubmitLine(d);
            return {
              product_id: base.product_id,
              name: base.name,
              photo_url: base.photo_url,
              qty: base.qty,
              price_pph: base.price_pph ?? srv?.price_pph ?? null,
              client_comment: base.client_comment,
              pharmacist_comment: srv?.pharmacist_comment ?? null,
              line_source: srv?.line_source ?? null,
              pharmacist_proposal_reason: srv?.pharmacist_proposal_reason ?? null,
            };
          })
        );
      }
    }
  }

  /** Restaure le brouillon resubmit à l'état initial (sortie du mode édition sans renvoi). */
  const resetResubmitDraft = () => {
    if (requestId) clearPatientDemandeCatalogueReturnEdit(requestId);
    if (pharmacyId) clearPatientDemandeProduitsDraft(pharmacyId, requestId);
    setLines(computeResubmitLinesFromItems(visibleItemsForPatientBeforePharmacyResponse(items, status)));
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

      if (status === "confirmed" || status === "treated") {
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

  const baselineResolvedVisitDate = useMemo(() => {
    const raw = (initialPlannedVisitDate ?? "").trim();
    if (raw !== "") return clampVisitYmd(raw, visitWin.minYmd, visitWin.maxYmd);
    return visitWin.minYmd;
  }, [initialPlannedVisitDate, visitWin.minYmd, visitWin.maxYmd]);

  const baselineVisitTimeComposed = useMemo(() => {
    const { h, m } = splitVisitHm(initialPlannedVisitTime);
    const hci = h.trim();
    const mci = m.trim();
    if (hci === "" && mci === "") return "";
    const hi = Math.min(23, Math.max(0, Number.parseInt(hci, 10) || 0));
    const mi = Math.min(59, Math.max(0, Number.parseInt(mci, 10) || 0));
    return `${String(hi).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
  }, [initialPlannedVisitTime]);

  const visitPassageDirty = useMemo(
    () =>
      resolvedVisitDate !== baselineResolvedVisitDate || visitTimeComposed !== baselineVisitTimeComposed,
    [resolvedVisitDate, baselineResolvedVisitDate, visitTimeComposed, baselineVisitTimeComposed]
  );

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
      pharmacistProposedOriginLabel: workflowCopy.timelinePharmacistProposedOrigin,
    });
  }, [historyModalRow, requestTimelineMeta, supplyAmendmentBundles, dossierHistoryRows, workflowCopy.timelinePharmacistProposedOrigin]);

  const visibleHits = debouncedQuery.length < PRODUCT_CATALOG_SEARCH_MIN_CHARS ? [] : hits;
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
    if (debouncedQuery.length < PRODUCT_CATALOG_SEARCH_MIN_CHARS) {
      return;
    }
    const t = setTimeout(() => {
      void (async () => {
        const sanitized = sanitizeProductSearchQuery(debouncedQuery);
        if (sanitized.length < PRODUCT_CATALOG_SEARCH_MIN_CHARS) {
          setHits([]);
          return;
        }
        const { data, error } = await supabase
          .from("products")
          .select("id,name,product_type,laboratory,photo_url,price_pph")
          .eq("is_active", true)
          .or(productNameOrLaboratoryIlikeOr(sanitized))
          .order("name")
          .limit(PRODUCT_CATALOG_SEARCH_LIMIT);
        if (error || !Array.isArray(data)) {
          setHits([]);
          return;
        }
        setHits(
          (data as ProductHit[]).map((p) => ({
            ...p,
            photo_url: resolvePublicMediaUrl(p.photo_url ?? null),
          }))
        );
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
          photo_url: resolvePublicMediaUrl(p.photo_url ?? null),
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
    const skippedLines = buildNonRetainedConfirmLines(items, sel);
    setConfirmReviewSnap({
      rpcPayload: built.rpcPayload,
      preview: built.preview,
      skippedLines,
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
    closeConfirmReview();
    await onReload();
  };

  const validateResubmitLines = (): string | null => {
    if (lines.length === 0) return "Ajoute au moins un produit à la liste.";
    const seen = new Set<string>();
    for (const l of lines) {
      if (seen.has(l.product_id)) return "Chaque produit ne peut apparaître qu’une seule fois dans ta liste.";
      seen.add(l.product_id);
      if (l.qty < 1 || l.qty > 10) return "Les quantités doivent être entre 1 et 10 pour chaque produit.";
    }
    return null;
  };

  const executeResubmit = async () => {
    setActionError("");

    const p_items = lines.map((l) => {
      const cc = l.client_comment.trim().slice(0, PATIENT_PRODUCT_LINE_COMMENT_MAX);
      return {
        product_id: l.product_id,
        requested_qty: l.qty,
        ...(cc.length > 0 ? { client_comment: cc } : {}),
      };
    });
    setBusyAction("resubmit");
    const { error } = await supabase.rpc("patient_resubmit_product_request_after_response", {
      p_request_id: requestId,
      p_patient_note: null,
      p_items,
    });
    setBusyAction("");
    if (error) {
      setActionError(error.message);
      return;
    }
    setResubmitConfirmOpen(false);
    if (requestId) clearPatientDemandeCatalogueReturnEdit(requestId);
    if (pharmacyId) clearPatientDemandeProduitsDraft(pharmacyId, requestId);
    setEditMode(false);
    await onReload();
  };

  const openResubmitConfirm = () => {
    const err = validateResubmitLines();
    if (err) {
      setActionError(err);
      return;
    }
    setActionError("");
    setResubmitConfirmOpen(true);
  };

  const handlePatientExitConfirm = async (p: {
    kind: "patient";
    code: PatientCancelReasonCode;
    other: string | null;
  }) => {
    setActionError("");
    setBusyAction("abandon");
    try {
      if (exitModalMode === "patient_before_response") {
        const { error } = await supabase.rpc("patient_cancel_product_request_before_response", {
          p_request_id: requestId,
          p_reason_code: p.code,
          p_reason_other: p.other,
        });
        if (error) {
          setActionError(error.message);
          return;
        }
      } else {
        const { error } = await supabase.rpc("patient_abandon_request", {
          p_request_id: requestId,
          p_reason_code: p.code,
          p_reason_other: p.other,
        });
        if (error) {
          setActionError(error.message);
          return;
        }
      }
      setExitModalOpen(false);
      await onReload();
    } finally {
      setBusyAction("");
    }
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
  const totalRetainedGrandLabel = useMemo(
    () =>
      compactTotalMadLabel({
        sumKnown: totalsRetained.sumKnown,
        missingPrice: totalsRetained.missingPrice,
        empty: totalsRetained.count < 1,
      }),
    [totalsRetained]
  );

  const resubmitBaseline = useMemo(
    () => computeResubmitLinesFromItems(visibleItemsForPatientBeforePharmacyResponse(items, status)),
    [items, status]
  );
  const resubmitDirty = useMemo(() => {
    if (status !== "submitted" && status !== "in_review") return false;
    return resubmitLinesSignature(lines) !== resubmitLinesSignature(resubmitBaseline);
  }, [status, lines, resubmitBaseline]);

  const interactiveAllowed =
    status === "submitted" ||
    status === "in_review" ||
    status === "responded" ||
    status === "confirmed" ||
    status === "treated";
  const readOnlyArchive = isPatientProductArchiveStatus(status);
  const productPhotoPreviewModal = (
    <PatientProductPhotoPreviewModal
      open={productPhotoPreview !== null}
      imageUrl={productPhotoPreview?.url ?? null}
      title={productPhotoPreview?.title ?? ""}
      onClose={() => setProductPhotoPreview(null)}
    />
  );
  if (!interactiveAllowed && !readOnlyArchive) return null;

  if (readOnlyArchive) {
    return (
      <>
        <section className="mt-2 rounded-lg border border-border/90 bg-muted/15 p-2 sm:p-2.5">
          <ReadonlyArchivedProductBucketsView
            items={items}
            onOpenLineHistory={(itemId) => setHistoryModalItemId(itemId)}
            linePostConfirmBadgesById={linePostConfirmBadgesById}
            archiveStatus={status}
            onPhotoPreview={openProductPhotoPreview}
            pharmacistProposedBadgeLabel={workflowCopy.patientProposedBadge}
            requestType={requestType}
          />
        </section>
        <LineHistoryModalFr
          open={historyModalItemId !== null}
          title={historyModalRow ? validatedProductLabel(historyModalRow) : ""}
          blocks={historyModalBlocks}
          onClose={() => setHistoryModalItemId(null)}
        />
        {productPhotoPreviewModal}
      </>
    );
  }

  const showConfirm = status === "responded";
  const showProductResubmit = !isPrescription && (status === "submitted" || status === "in_review");
  const showPrescriptionWaiting =
    isPrescription && (status === "submitted" || status === "in_review") && prescriptionPaths?.page1;
  const showWaitingShell = showProductResubmit || showPrescriptionWaiting;
  const showPatientExitCTA =
    status === "submitted" ||
    status === "in_review" ||
    status === "responded" ||
    status === "confirmed" ||
    status === "treated";
  const patientExitPrimaryLabel =
    status === "submitted" || status === "in_review"
      ? workflowCopy.patientCancelWhileWaitingLabel
      : "Abandonner la demande";
  const showConfirmedCards = status === "confirmed" || status === "treated";
  /** Date/heure de passage : à la validation (responded) et pour modifier après coup. */
  const showVisitFields = showConfirm || showConfirmedCards;

  const visitTimeFr = visitTimeComposed ? formatTime24hFr(htmlTimeToPg(visitTimeComposed) ?? visitTimeComposed) : "";

  const dossierRefLabel = requestPublicRef?.trim() || `Dossier ${requestId.slice(0, 8)}…`;

  const confirmReserveLines =
    confirmReviewSnap?.preview.filter((l) => l.bucket === "reserve") ?? [];
  const confirmOrderLines = confirmReviewSnap?.preview.filter((l) => l.bucket === "order") ?? [];
  const confirmAllPreviewLines = confirmReviewSnap?.preview ?? [];
  const confirmSkippedLines = confirmReviewSnap?.skippedLines ?? [];

  return (
    <section
      className={clsx(
        "touch-pan-y mt-2 rounded-xl border-2 border-slate-200 bg-slate-50/95 p-2.5 sm:p-3",
        (showWaitingShell || showConfirm || showConfirmedCards) && "pb-40"
      )}
    >
      {actionError ? (
        <p className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-[11px] text-destructive">{actionError}</p>
      ) : null}

      {(showWaitingShell || showConfirm || showConfirmedCards) && pharmacyId ? (
        <PatientSentEnvoyeeSummaryCard
          pharmacyContact={pharmacyContact}
          pharmacyId={pharmacyId}
          dossierRefLabel={dossierRefLabel}
          lineCount={showProductResubmit ? lines.length : items.length}
          lineCountLabel={buildPatientLineCountLabel(
            requestType,
            showConfirm ? "responded" : status,
            showProductResubmit ? lines.length : items.length
          )}
          status={showConfirm ? "responded" : status}
          createdAt={requestTimelineMeta?.created_at ?? ""}
          updatedAt={requestUpdatedAt ?? requestTimelineMeta?.created_at ?? ""}
          kindLabel={workflowCopy.patientSummaryKindLabel}
          refShort={workflowCopy.patientSummaryRefShort}
          statusHint={buildPatientSummaryStatusHint(showConfirm ? "responded" : status, requestType, workflowCopy)}
          accent={accent}
        />
      ) : null}

      {showPrescriptionWaiting && prescriptionPaths ? (
        <section className="mt-2 space-y-3">
          <PrescriptionImageViewer paths={prescriptionPaths} accent="amber" />
          {prescriptionNote?.trim() ? (
            <div className="rounded-xl border border-amber-200/70 bg-amber-50/40 px-3 py-2.5 text-sm">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Votre message</p>
              <p className="mt-1 whitespace-pre-wrap text-foreground">{prescriptionNote.trim()}</p>
            </div>
          ) : null}
        </section>
      ) : null}

      {showConfirm ? (
        <div className="space-y-2">
          {items.length > 0 ? (
            <section className="space-y-2">
              <h3 className="px-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                {workflowCopy.patientProductsSectionTitle}
              </h3>
              <ul className="space-y-4">
                {items.map((row) => (
                  <RespondedPatientLineChooser
                    key={row.id}
                    row={row}
                    selState={sel[row.id] ?? { branch: null, qty: 1 }}
                    setLineBranch={setLineBranch}
                    setLineQty={setLineQty}
                    togglePrincipalOnlyLine={togglePrincipalOnlyLine}
                    onPhotoPreview={openProductPhotoPreview}
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

          return (
            <section className="space-y-2">
              <h3 className="px-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                {workflowCopy.patientProductsSectionTitle}
              </h3>
              <div className="space-y-2">
              <div className="rounded-xl border-2 border-emerald-200/70 bg-gradient-to-b from-emerald-50/30 via-white to-white p-2.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9)] ring-1 ring-emerald-200/45 sm:p-3">
              {dispoRetenues.length > 0 ? (
                <section className="space-y-2">
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
                  <ul className="space-y-2">
                    {dispoRetenues.map((row) => (
                      <PatientValidatedCompactLineCard
                        key={row.id}
                        row={row}
                        tier="dispo_officine"
                        onOpenHistory={() => setHistoryModalItemId(row.id)}
                        postConfirmBadges={linePostConfirmBadgesById[row.id]}
                        requestStatusForCard={status}
                        treatedSupplyStatusLine={status === "treated" ? patientTreatedSupplyStatusLine(row) : undefined}
                        onPhotoPreview={openProductPhotoPreview}
                        pharmacistProposedBadgeLabel={workflowCopy.patientProposedBadge}
                      />
                    ))}
                  </ul>
                </section>
              ) : null}

              {aCommanderRetenues.length > 0 ? (
                <section className="mt-2 space-y-2">
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
                  <ul className="space-y-2">
                    {aCommanderRetenues.map((row) => (
                      <PatientValidatedCompactLineCard
                        key={row.id}
                        row={row}
                        tier="commande"
                        onOpenHistory={() => setHistoryModalItemId(row.id)}
                        postConfirmBadges={linePostConfirmBadgesById[row.id]}
                        requestStatusForCard={status}
                        treatedSupplyStatusLine={status === "treated" ? patientTreatedSupplyStatusLine(row) : undefined}
                        onPhotoPreview={openProductPhotoPreview}
                        pharmacistProposedBadgeLabel={workflowCopy.patientProposedBadge}
                      />
                    ))}
                  </ul>
                </section>
              ) : null}
              </div>

              {horsPerimetreRetenues.length > 0 || retireesApresValidation.length > 0 ? (
                <div className="mt-2 rounded-xl border-2 border-amber-200/75 bg-gradient-to-b from-amber-50/35 via-white to-white p-2.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9)] ring-1 ring-amber-200/50 sm:p-3">
              {horsPerimetreRetenues.length > 0 ? (
                <section className="mt-2 space-y-1">
                  <div className="flex items-center gap-1 text-amber-950">
                    <Layers className="size-3.5 shrink-0 text-amber-800" aria-hidden />
                    <h3 className="text-[10px] font-bold uppercase tracking-wide">Point d&apos;attention (hors bloc principal)</h3>
                  </div>
                  <p className="text-[9px] leading-snug text-muted-foreground">
                    À confirmer avec l&apos;officine si besoin.
                  </p>
                  <ul className="space-y-2">
                    {horsPerimetreRetenues.map((row) => (
                      <PatientValidatedCompactLineCard
                        key={row.id}
                        row={row}
                        tier="hors_perimetre"
                        onOpenHistory={() => setHistoryModalItemId(row.id)}
                        postConfirmBadges={linePostConfirmBadgesById[row.id]}
                        requestStatusForCard={status}
                        treatedSupplyStatusLine={status === "treated" ? patientTreatedSupplyStatusLine(row) : undefined}
                        onPhotoPreview={openProductPhotoPreview}
                        pharmacistProposedBadgeLabel={workflowCopy.patientProposedBadge}
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
                  <ul className="space-y-2">
                    {retireesApresValidation.map((row) => (
                      <PatientValidatedCompactLineCard
                        key={row.id}
                        row={row}
                        tier="retire_apres_validation"
                        onOpenHistory={() => setHistoryModalItemId(row.id)}
                        postConfirmBadges={linePostConfirmBadgesById[row.id]}
                        requestStatusForCard={status}
                        treatedSupplyStatusLine={status === "treated" ? patientTreatedSupplyStatusLine(row) : undefined}
                        onPhotoPreview={openProductPhotoPreview}
                        pharmacistProposedBadgeLabel={workflowCopy.patientProposedBadge}
                      />
                    ))}
                  </ul>
                </section>
              ) : null}
                </div>
              ) : null}

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
                        postConfirmBadges={linePostConfirmBadgesById[row.id]}
                        onPhotoPreview={openProductPhotoPreview}
                      />
                    ))}
                  </ul>
                </details>
              ) : null}
              </div>
            </section>
          );
        })()
      ) : null}

      {showProductResubmit ? (
        <section className="mt-2 space-y-2">
          <h3 className="px-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            {workflowCopy.patientProductsSectionTitle}
          </h3>
          {editMode ? (
        <div className="rounded-2xl border-2 border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <label className="block text-base font-semibold text-slate-900">Ajouter un produit</label>
          <p className="mt-1 text-sm text-slate-600">
            Au moins 2 caractères : recherche par nom ou laboratoire dans le catalogue.
          </p>
          <div className="relative mt-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ex: Doliprane, Smecta..."
              className="touch-pan-y w-full rounded-xl border-2 border-slate-300 bg-white py-3 pl-11 pr-3 text-base shadow-sm placeholder:text-slate-400"
            />
          </div>
          {pharmacyId ? (
            <Link
              href={`/pharmacie/${pharmacyId}/demande-produits/catalogue?requestId=${encodeURIComponent(requestId)}&returnTo=${encodeURIComponent(`/dashboard/demandes/${requestId}`)}`}
              onClick={() =>
                writePatientDemandeProduitsDraft(
                  pharmacyId,
                  lines.map((l) => ({
                    product_id: l.product_id,
                    name: l.name,
                    photo_url: l.photo_url ?? null,
                    qty: l.qty,
                    price_pph: l.price_pph ?? null,
                    client_comment: l.client_comment,
                  })),
                  requestId
                )
              }
              className={clsx(
                buttonVariants({ variant: "outline", size: "sm" }),
                "mt-3 flex h-11 w-full items-center justify-center gap-2 text-sm font-semibold text-sky-900"
              )}
            >
              <LayoutGrid className="size-4 shrink-0" aria-hidden />
              Voir tous les produits
            </Link>
          ) : null}
          {visibleHits.length > 0 ? (
            <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto">
              {visibleHits.map((h) => (
                <li key={h.id}>
                  <div className="flex h-20 w-full items-center gap-3 rounded-xl border border-border/70 bg-muted/20 px-2.5 py-2 transition hover:bg-muted/35">
                    <button
                      type="button"
                      disabled={!h.photo_url}
                      className={clsx(
                        "flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/70 bg-card transition",
                        h.photo_url ? "cursor-zoom-in hover:ring-2 hover:ring-sky-400/50" : "cursor-default opacity-80"
                      )}
                      aria-label={h.photo_url ? `Agrandir la photo · ${h.name}` : "Pas de photo catalogue"}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        if (h.photo_url) openProductPhotoPreview(h.photo_url, h.name);
                      }}
                    >
                      {h.photo_url ? (
                        <img src={h.photo_url} alt="" className="pointer-events-none h-full w-full object-cover" />
                      ) : (
                        <Package className="size-5 text-muted-foreground" aria-hidden />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => addProduct(h)}
                      className="flex min-h-[5rem] min-w-0 flex-1 flex-col justify-center text-left"
                    >
                      <p
                        className="overflow-hidden pr-1 text-[14px] font-semibold leading-tight text-foreground sm:text-[15px]"
                        style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
                      >
                        {h.name}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-sky-900 sm:text-sm">{formatPriceDh(h.price_pph)}</p>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : query.trim().length >= 2 ? (
            <p className="mt-2 text-xs text-muted-foreground">Aucun résultat.</p>
          ) : null}
        </div>
          ) : null}
          <ul className="space-y-2">
            {lines.map((l, idx) => (
              <li
                key={`${l.product_id}-${idx}`}
                className="rounded-xl border-2 border-slate-200 bg-gradient-to-b from-white to-slate-50/50 px-2.5 py-2 shadow-sm ring-1 ring-slate-100/90 sm:px-3"
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-start gap-2">
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-card shadow-inner">
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
                        <button
                          type="button"
                          className="relative z-0 size-full cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                          onClick={() => openProductPhotoPreview(l.photo_url!, l.name)}
                          aria-label={`Agrandir la photo · ${l.name}`}
                        >
                          <img src={l.photo_url} alt={l.name} className="pointer-events-none h-full w-full object-cover" />
                        </button>
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Package className="size-6 text-muted-foreground" aria-hidden />
                        </div>
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <p
                        className="overflow-hidden pr-0.5 text-[13px] font-semibold leading-tight text-slate-950 sm:text-[14px]"
                        style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
                      >
                        {l.name}
                      </p>
                      {l.line_source === "pharmacist_proposed" ? (
                        <p className="text-[9px] font-medium leading-snug text-violet-900">
                          {requestItemLineSourceFr.pharmacist_proposed}
                          {l.pharmacist_proposal_reason ? ` — ${l.pharmacist_proposal_reason}` : ""}
                        </p>
                      ) : null}
                      <PatientSentLineNotesModalFr productName={l.name} client={l.client_comment} pharmacist={l.pharmacist_comment ?? ""} />
                    </div>
                  </div>
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-3.5 gap-y-1 border-t border-slate-200/80 pt-2 text-[12px] font-medium leading-none tabular-nums text-slate-800 sm:gap-x-4 sm:text-[13px]">
                    <div className="min-w-0 justify-self-start truncate">
                      <span className="text-slate-500">PU</span>{" "}
                      <strong className="font-semibold text-slate-900">{formatPriceDh(l.price_pph)}</strong>
                    </div>
                    <div className="flex shrink-0 items-center justify-center gap-1.5 justify-self-center">
                      <span className="shrink-0 text-slate-500">Qté</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          aria-label="Diminuer"
                          disabled={!editMode || l.qty <= 1}
                          className="rounded-md border border-slate-300 bg-white p-1.5 text-foreground shadow-sm hover:bg-slate-50 disabled:opacity-40"
                          onClick={() =>
                            setLines((prev) => prev.map((row, i) => (i === idx ? { ...row, qty: Math.max(1, row.qty - 1) } : row)))
                          }
                        >
                          <Minus size={15} />
                        </button>
                        <span className="min-w-[1.5rem] text-center font-semibold text-slate-900">{l.qty}</span>
                        <button
                          type="button"
                          aria-label="Augmenter"
                          disabled={!editMode || l.qty >= 10}
                          className="rounded-md border border-slate-300 bg-white p-1.5 text-foreground shadow-sm hover:bg-slate-50 disabled:opacity-40"
                          onClick={() =>
                            setLines((prev) => prev.map((row, i) => (i === idx ? { ...row, qty: Math.min(10, row.qty + 1) } : row)))
                          }
                        >
                          <Plus size={15} />
                        </button>
                      </div>
                    </div>
                    <div className="min-w-0 justify-self-end truncate text-end">
                      <span className="text-slate-500">Total</span>{" "}
                      <strong className="font-semibold text-sky-900">
                        {l.price_pph != null ? formatPriceDh(l.price_pph * l.qty) : "—"}
                      </strong>
                    </div>
                  </div>
                </div>
                {editMode ? (
                  <label className="mt-2 block">
                    <span className="mb-0.5 block text-xs font-medium text-slate-800">Commentaire sur ce produit</span>
                    <input
                      type="text"
                      value={l.client_comment}
                      maxLength={PATIENT_PRODUCT_LINE_COMMENT_MAX}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((row, i) =>
                            i === idx
                              ? { ...row, client_comment: e.target.value.slice(0, PATIENT_PRODUCT_LINE_COMMENT_MAX) }
                              : row
                          )
                        )
                      }
                      placeholder="Ex. dosage, précision…"
                        className="w-full rounded-lg border-2 border-slate-300 bg-white px-2.5 py-1.5 text-sm leading-normal text-slate-900 placeholder:text-slate-400 [touch-action:pan-x_pan-y]"
                    />
                    <span className="mt-0.5 block text-right text-[9px] text-slate-400 tabular-nums">
                      {l.client_comment.length}/{PATIENT_PRODUCT_LINE_COMMENT_MAX}
                    </span>
                  </label>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-2 space-y-2">
        {showVisitFields ? (
          <div className="rounded-xl border-2 border-primary/35 bg-gradient-to-br from-primary/[0.12] via-background to-primary/[0.06] p-2.5 shadow-md ring-1 ring-primary/25 sm:p-3">
            <div className="flex items-center gap-2">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary shadow-sm ring-1 ring-primary/20">
                <Calendar className="size-4" strokeWidth={2} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-wide text-foreground">
                  Date de passage {showConfirm ? <span className="text-destructive">*</span> : null}
                </p>
                <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
                  Indique quand tu prévois de passer à l&apos;officine.
                </p>
              </div>
            </div>
            <label className="mt-2.5 block text-[11px] font-semibold text-foreground">
              <span className="sr-only">Date</span>
              <input
                type="date"
                min={visitWin.minYmd}
                max={visitWin.maxYmd}
                value={resolvedVisitDate}
                onChange={(e) => setVisitDate(e.target.value)}
                className="mt-1 block w-full rounded-lg border-2 border-input bg-background px-2 py-2 text-[13px] font-semibold tabular-nums shadow-inner"
                required={showConfirm}
              />
            </label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="block text-[10px] font-semibold text-foreground">
                Heure (0–23)
                <input
                  type="number"
                  min={0}
                  max={23}
                  inputMode="numeric"
                  placeholder="—"
                  value={visitHour}
                  onChange={(e) => setVisitHour(e.target.value.replace(/\D/g, "").slice(0, 2))}
                  className="mt-1 block w-full rounded-lg border-2 border-input bg-background px-2 py-1.5 text-[12px] font-semibold tabular-nums shadow-inner"
                />
              </label>
              <label className="block text-[10px] font-semibold text-foreground">
                Minutes (0–59)
                <input
                  type="number"
                  min={0}
                  max={59}
                  inputMode="numeric"
                  placeholder="—"
                  value={visitMinute}
                  onChange={(e) => setVisitMinute(e.target.value.replace(/\D/g, "").slice(0, 2))}
                  className="mt-1 block w-full rounded-lg border-2 border-input bg-background px-2 py-1.5 text-[12px] font-semibold tabular-nums shadow-inner"
                />
              </label>
            </div>
            {visitTimeFr ? (
              <span className="mt-2 block text-[10px] font-medium text-muted-foreground">Enregistré : {visitTimeFr}</span>
            ) : null}
            {showConfirmedCards ? (
              <p className="mt-2 text-[10px] leading-snug text-primary/90">
                La pharmacie voit les changements sur la demande.
              </p>
            ) : showConfirm ? (
              <p className="mt-2 text-[10px] leading-snug text-sky-900/85">
                Ces informations seront transmises avec ta validation.
              </p>
            ) : null}
          </div>
        ) : null}

        {(showConfirm || showConfirmedCards) ? (
          pharmacyContact ? (
            <div className="mt-2">
              <PatientPharmacyQuickContact pharmacy={pharmacyContact} requestRef={dossierRefLabel} />
            </div>
          ) : (
            <section className="mt-2 rounded-xl border border-emerald-200/65 bg-muted/25 px-2 py-1.5 text-[10px] leading-snug text-muted-foreground">
              {showConfirmedCards
                ? "Après validation, les changements passent par votre pharmacie."
                : "Les coordonnées de l’officine seront affichées ici lorsqu’elles sont disponibles."}
            </section>
          )
        ) : null}

        {showConfirm || showConfirmedCards ? (
          <p className="mt-3 rounded-lg border border-sky-200/70 bg-white/90 px-2.5 py-2 text-[10px] leading-snug text-sky-950 shadow-sm">
            Pour échanger avec la pharmacie à tout moment, utilise le bouton{" "}
            <strong className="font-semibold">Conversation</strong> en bas à droite de l&apos;écran.
          </p>
        ) : null}

        {showPatientExitCTA ? (
          <div
            className={clsx(
              "mt-4 border-t border-rose-200/50 pt-3",
              showProductResubmit && "mb-20",
              showConfirm && "mb-24",
              showConfirmedCards && "mb-32"
            )}
          >
            <button
              type="button"
              disabled={busyAction !== ""}
              onClick={() => {
                setExitModalNonce((n) => n + 1);
                setExitModalMode(
                  status === "submitted" || status === "in_review"
                    ? "patient_before_response"
                    : "patient_abandon"
                );
                setExitModalOpen(true);
              }}
              className="mx-auto flex min-h-[2.75rem] min-w-[min(100%,14rem)] max-w-md items-center justify-center rounded-lg border border-rose-300/70 bg-rose-50/80 px-4 py-2.5 text-sm font-semibold text-rose-950 shadow-sm hover:bg-rose-100/90 disabled:opacity-50"
            >
              {patientExitPrimaryLabel}
            </button>
            <RequestExitConfirmModalFr
              key={exitModalNonce}
              open={exitModalOpen}
              mode={exitModalMode}
              busy={busyAction === "abandon"}
              onClose={() => {
                if (busyAction === "abandon") return;
                setExitModalOpen(false);
              }}
              onConfirmPatient={handlePatientExitConfirm}
            />
          </div>
        ) : null}
      </div>

      {showProductResubmit ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-slate-300 bg-white/98 px-4 py-3 shadow-[0_-6px_24px_rgba(15,23,42,0.08)] backdrop-blur supports-[backdrop-filter]:bg-white/95">
          <div className="mx-auto flex max-w-lg flex-col gap-2.5">
            <div className="flex flex-nowrap items-center justify-between gap-3">
              <p className="min-w-0 shrink text-sm font-medium text-slate-700 sm:text-base">
                <span className="font-bold tabular-nums text-slate-950">{lines.length}</span>{" "}
                produit{lines.length > 1 ? "s" : ""}
              </p>
              <div className="shrink-0 text-right">
                <p className="sr-only">Total indicatif, prix catalogue pharmacie</p>
                <p className="text-lg font-bold tabular-nums text-sky-900 sm:text-xl">{formatPriceDh(resubmitTotal)}</p>
              </div>
            </div>
            {!editMode ? (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  disabled={busyAction !== ""}
                  onClick={() => {
                    window.scrollTo({ top: 0, behavior: "smooth" });
                    setEditMode(true);
                  }}
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-amber-500/80 bg-amber-50 px-3 text-sm font-semibold text-amber-950 shadow-sm hover:bg-amber-100/90 disabled:opacity-50"
                >
                  <Pencil size={16} aria-hidden />
                  Modifier
                </button>
                {resubmitDirty ? (
                  <button
                    type="button"
                    disabled={busyAction !== "" || lines.length === 0}
                    onClick={() => openResubmitConfirm()}
                    className="h-9 w-full rounded-md border border-amber-600 bg-amber-600/95 text-xs font-semibold text-white shadow-sm hover:bg-amber-700 disabled:opacity-50"
                  >
                    {busyAction === "resubmit" ? "Envoi…" : "Renvoyer à la pharmacie"}
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busyAction !== ""}
                  onClick={() => {
                    resetResubmitDraft();
                    setEditMode(false);
                  }}
                  className="h-10 flex-1 rounded-lg border-2 border-slate-300 bg-white text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={busyAction !== ""}
                  onClick={() => setEditMode(false)}
                  className="h-10 flex-1 rounded-lg border border-sky-600 bg-sky-700 text-sm font-semibold text-white shadow-sm hover:bg-sky-800 disabled:opacity-50"
                >
                  Enregistrer les modifications
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {showConfirm ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-slate-300 bg-white/98 px-4 py-3 shadow-[0_-6px_24px_rgba(15,23,42,0.08)] backdrop-blur supports-[backdrop-filter]:bg-white/95">
          <div className="mx-auto flex max-w-lg flex-col gap-2.5">
            <div className="flex flex-nowrap items-center justify-between gap-3">
              <p className="min-w-0 shrink text-sm font-medium text-slate-700 sm:text-base">
                <span className="font-bold tabular-nums text-slate-950">{confirmSelectionSummary.count}</span>{" "}
                {confirmSelectionSummary.count > 1 ? "lignes retenues" : "ligne retenue"}
              </p>
              <p className="shrink-0 text-lg font-bold tabular-nums text-sky-900 sm:text-xl">
                {confirmSelectionSummary.total > 0 ? `${confirmSelectionSummary.total.toFixed(2)} MAD` : "—"}
              </p>
            </div>
            <button
              type="button"
              disabled={busyAction !== "" || visitWin.missingEtaOnToOrder}
              onClick={openConfirmReview}
              className="w-full shrink-0 rounded-xl bg-primary px-4 py-3 text-base font-semibold text-primary-foreground shadow-md transition hover:opacity-95 disabled:opacity-50 sm:ms-auto sm:w-auto sm:min-w-[220px]"
            >
              Valider ma demande
            </button>
          </div>
        </div>
      ) : null}

      {showConfirmedCards ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-slate-300 bg-white/98 px-4 py-3 shadow-[0_-6px_24px_rgba(15,23,42,0.08)] backdrop-blur supports-[backdrop-filter]:bg-white/95">
          <div className="mx-auto flex max-w-lg flex-col gap-2.5">
            <div className="flex flex-nowrap items-center justify-between gap-3">
              <p className="min-w-0 shrink text-sm font-medium text-slate-700 sm:text-base">
                <span className="font-bold tabular-nums text-slate-950">{totalsRetained.count}</span>{" "}
                {totalsRetained.count > 1 ? "produits retenus" : "produit retenu"}
              </p>
              <p className="shrink-0 whitespace-nowrap text-lg font-bold tabular-nums text-sky-900 sm:text-xl">
                {totalRetainedGrandLabel}
              </p>
            </div>
            <button
              type="button"
              disabled={busyAction !== "" || !visitPassageDirty}
              onClick={() => void runUpdateVisit()}
              className="w-full shrink-0 rounded-xl bg-primary px-4 py-3 text-base font-semibold text-primary-foreground shadow-md transition hover:opacity-95 disabled:opacity-50 sm:ms-auto sm:w-auto sm:min-w-[220px]"
            >
              {busyAction === "visit" ? "Mise à jour…" : "Mettre à jour ma date de passage"}
            </button>
          </div>
        </div>
      ) : null}

      {showConfirm && confirmReviewOpen && confirmReviewSnap ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/45 p-2 sm:items-center sm:p-4">
          <button
            type="button"
            className="fixed inset-0 cursor-default"
            aria-label="Fermer le récapitulatif"
            onClick={() => {
              if (busyAction !== "confirm") closeConfirmReview();
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-review-title"
            className="relative z-10 flex max-h-[min(92dvh,34rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-emerald-200/85 bg-card shadow-2xl ring-1 ring-emerald-900/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 border-b border-emerald-200/60 bg-gradient-to-r from-emerald-50/80 via-white to-teal-50/30 px-3 py-2.5">
              <h2 id="confirm-review-title" className="text-center text-sm font-bold text-emerald-950 sm:text-base">
                Confirmer ta sélection
              </h2>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain bg-gradient-to-b from-white/80 to-muted/20 px-2.5 py-2.5 sm:px-3 [-webkit-overflow-scrolling:touch]">
              <div className="rounded-lg border border-primary/20 bg-primary/5 px-2 py-1.5">
                <p className="text-[8px] font-bold uppercase tracking-wide text-primary/95">Passage</p>
                <p className="mt-0.5 text-[11px] font-medium leading-snug text-foreground">{confirmReviewSnap.visitSummaryFr}</p>
              </div>

              {confirmReserveLines.length > 0 ? (
                <div className="mt-3">
                  <div className="mb-1.5 flex items-center gap-1.5 rounded-md border border-emerald-200/80 bg-emerald-50/70 px-2 py-1">
                    <Package className="size-3.5 shrink-0 text-emerald-900" aria-hidden />
                    <p className="text-[9px] font-bold uppercase tracking-wide text-emerald-950">À réserver</p>
                  </div>
                  <ul className="space-y-1.5">
                    {confirmReserveLines.map((line) => (
                      <PatientConfirmReviewLineCard
                        key={line.rowId}
                        line={line}
                        onPhotoPreview={openProductPhotoPreview}
                      />
                    ))}
                  </ul>
                  <p className="mt-2 text-right text-[11px] leading-snug font-medium text-emerald-900/85">
                    {formatBlockSubtotalLabel(confirmReserveLines)}
                  </p>
                </div>
              ) : null}

              {confirmOrderLines.length > 0 ? (
                <div className="mt-3">
                  <div className="mb-1.5 flex items-center gap-1.5 rounded-md border border-teal-200/85 bg-teal-50/70 px-2 py-1">
                    <ShoppingCart className="size-3.5 shrink-0 text-teal-950" aria-hidden />
                    <p className="text-[9px] font-bold uppercase tracking-wide text-teal-950">À commander</p>
                  </div>
                  <ul className="space-y-1.5">
                    {confirmOrderLines.map((line) => (
                      <PatientConfirmReviewLineCard
                        key={line.rowId}
                        line={line}
                        onPhotoPreview={openProductPhotoPreview}
                      />
                    ))}
                  </ul>
                  <p className="mt-2 text-right text-[11px] leading-snug font-medium text-teal-900/88">
                    {formatBlockSubtotalLabel(confirmOrderLines)}
                  </p>
                </div>
              ) : null}

              {confirmSkippedLines.length > 0 ? (
                <div className="mt-3 rounded-lg border border-slate-200/90 bg-slate-50/90 px-2 py-2 ring-1 ring-slate-200/50">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-slate-700">Non retenus (information)</p>
                  <ul className="mt-1.5 space-y-1">
                    {confirmSkippedLines.map((s) => (
                      <li
                        key={s.rowId}
                        className="flex flex-wrap items-baseline justify-between gap-2 rounded-md border border-slate-200/70 bg-white/90 px-2 py-1 text-[10px] text-slate-800"
                      >
                        <span className="min-w-0 font-medium leading-snug">{s.productName}</span>
                        {s.isProposed ? (
                          <span className="shrink-0 rounded bg-violet-100 px-1 py-px text-[8px] font-semibold uppercase text-violet-900">
                            Proposition
                          </span>
                        ) : (
                          <span className="shrink-0 text-[9px] text-muted-foreground">Ta demande</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="mt-3 rounded-lg border border-violet-200/70 bg-violet-50/40 px-2 py-1.5 ring-1 ring-violet-200/30">
                <p className="text-[10px] font-semibold tabular-nums text-violet-950 sm:text-[11px]">
                  {formatGrandTotalLabel(confirmAllPreviewLines)}
                </p>
                {blockMonetarySummary(confirmAllPreviewLines).missingUnitPrice ? (
                  <p className="mt-0.5 text-[9px] leading-snug text-violet-900/85">Total partiel : certains prix unitaires manquent.</p>
                ) : null}
              </div>
            </div>

            <div className="shrink-0 border-t border-border/70 bg-background/95 px-2.5 py-2 backdrop-blur sm:px-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-2">
                <button
                  type="button"
                  disabled={busyAction === "confirm"}
                  onClick={closeConfirmReview}
                  className="w-full rounded-xl border border-border bg-card px-3 py-2 text-[12px] font-semibold text-foreground shadow-sm transition hover:bg-muted/60 disabled:opacity-50 sm:order-1 sm:w-auto"
                >
                  Retour
                </button>
                <button
                  type="button"
                  disabled={busyAction === "confirm"}
                  onClick={() => void performConfirmAfterReview()}
                  className="w-full rounded-xl bg-primary px-3 py-2 text-[12px] font-semibold text-primary-foreground shadow-sm transition hover:opacity-95 disabled:opacity-50 sm:order-2 sm:w-auto sm:min-w-[180px]"
                >
                  {busyAction === "confirm" ? "Enregistrement…" : "Confirmer définitivement"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showProductResubmit && resubmitConfirmOpen ? (
        <div className="fixed inset-0 z-[55] flex items-end justify-center p-3 sm:items-center">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Fermer"
            disabled={busyAction === "resubmit"}
            onClick={() => busyAction !== "resubmit" && setResubmitConfirmOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="resubmit-confirm-title"
            className="relative z-10 flex max-h-[min(88dvh,560px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-2 border-b border-slate-200 px-3 py-2.5 sm:px-4">
              <h2 id="resubmit-confirm-title" className="text-base font-bold leading-tight text-slate-900 sm:text-lg">
                {"Confirmer le renvoi de la liste"}
              </h2>
              <button
                type="button"
                disabled={busyAction === "resubmit"}
                className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40"
                onClick={() => setResubmitConfirmOpen(false)}
                aria-label="Fermer"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2 sm:px-4">
              <p className="text-xs leading-snug text-slate-600">
                {lines.length} produit{lines.length > 1 ? "s" : ""} — les photos viennent du catalogue si disponibles.
              </p>
              <ul className="mt-2 space-y-2">
                {lines.map((l, idx) => (
                  <li
                    key={`${l.product_id}-${idx}`}
                    className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50/80 px-2 py-1.5"
                  >
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-white">
                      {l.photo_url ? (
                        <button
                          type="button"
                          className="relative size-full cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                          onClick={() => openProductPhotoPreview(l.photo_url!, l.name)}
                          aria-label={`Agrandir la photo · ${l.name}`}
                        >
                          <img src={l.photo_url} alt="" className="pointer-events-none size-full object-cover" />
                        </button>
                      ) : (
                        <div className="flex size-full items-center justify-center">
                          <Package className="size-5 text-slate-400" aria-hidden />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-slate-900">{l.name}</p>
                      <div className="mt-0.5">
                        <p className="text-[11px] text-slate-600">
                          Qté <span className="font-bold tabular-nums text-slate-900">{l.qty}</span>
                        </p>
                        <div className="mt-0.5 flex flex-nowrap items-baseline justify-between gap-2">
                          <span className="min-w-0 shrink text-[11px] text-slate-600">
                            <span className="font-semibold text-slate-500">PU</span>{" "}
                            <strong className="whitespace-nowrap tabular-nums text-slate-900">
                              {formatPriceDh(l.price_pph)}
                            </strong>
                          </span>
                          <span className="shrink-0 whitespace-nowrap text-[11px] font-bold tabular-nums text-sky-900">
                            <span className="font-semibold text-sky-800/90">Tot</span>{" "}
                            {l.price_pph != null ? formatPriceDh(l.price_pph * l.qty) : "—"}
                          </span>
                        </div>
                        {l.client_comment?.trim() ? (
                          <div className="mt-1 rounded-md border border-slate-200 bg-white px-2 py-1.5">
                            <p className="text-[10px] font-semibold text-slate-700">Votre commentaire</p>
                            <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-[11px] leading-snug text-slate-800">
                              {l.client_comment.trim()}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="border-t border-slate-200 bg-slate-50 px-3 py-2.5 sm:px-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-slate-800">TOTAL</span>
                <span className="text-lg font-bold tabular-nums text-sky-900">{formatPriceDh(resubmitTotal)}</span>
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={busyAction === "resubmit"}
                  onClick={() => setResubmitConfirmOpen(false)}
                  className="h-10 flex-1 rounded-xl border-2 border-slate-300 bg-white text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={busyAction === "resubmit"}
                  onClick={() => void executeResubmit()}
                  className="h-10 flex-1 rounded-xl bg-amber-600 text-sm font-semibold text-white shadow-md hover:bg-amber-700 disabled:opacity-50"
                >
                  {busyAction === "resubmit" ? "Envoi…" : "Confirmer le renvoi"}
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
      {productPhotoPreviewModal}
    </section>
  );
}
