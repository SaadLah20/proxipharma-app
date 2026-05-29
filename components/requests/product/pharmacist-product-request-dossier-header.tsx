"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { Info, MessageCircle, Phone, User } from "lucide-react";
import { PatientProductRequestJourneyModal } from "@/components/requests/product/patient-product-request-journey-modal";
import { requestStatusFr } from "@/lib/request-display";

function phoneDigits(raw: string): string {
  return raw.replace(/\D/g, "");
}

function statusBadgeClass(status: string): string {
  if (["submitted", "in_review"].includes(status)) {
    return "border-sky-400/85 bg-sky-100 text-sky-950 ring-1 ring-sky-200/80";
  }
  if (status === "responded") return "border-amber-300/95 bg-amber-50 text-amber-950 ring-1 ring-amber-200/80";
  if (status === "expired") return "border-amber-400/90 bg-amber-100 text-amber-950 ring-1 ring-amber-200/80";
  if (status === "cancelled") return "border-rose-400/90 bg-rose-100 text-rose-950 ring-1 ring-rose-200/80";
  if (status === "abandoned") return "border-orange-400/90 bg-orange-100 text-orange-950 ring-1 ring-orange-200/80";
  if (["completed", "partially_collected", "fully_collected"].includes(status)) {
    return "border-emerald-400/85 bg-emerald-100 text-emerald-950 ring-1 ring-emerald-200/80";
  }
  if (["confirmed", "treated"].includes(status)) {
    return "border-teal-400/80 bg-teal-50 text-teal-950 ring-1 ring-teal-200/70";
  }
  return "border-slate-300/80 bg-slate-50 text-slate-800 ring-1 ring-slate-200/70";
}

export function PharmacistProductRequestDossierHeader({
  dossierRefLabel,
  patientName,
  patientRef,
  patientPhone,
  status,
  statusHint,
  lineCount,
  selectedCount,
  pendingCounterCount,
}: {
  dossierRefLabel: string;
  patientName: string | null;
  patientRef: string | null;
  patientPhone: string | null;
  status: string;
  statusHint: string;
  lineCount: number;
  selectedCount?: number;
  pendingCounterCount?: number;
}) {
  const [journeyOpen, setJourneyOpen] = useState(false);
  const statusLabel = requestStatusFr[status] ?? status;
  const patientLine = patientName?.trim()
    ? patientRef?.trim()
      ? `${patientName.trim()} · ${patientRef.trim()}`
      : patientName.trim()
    : patientRef?.trim() ?? "Patient";

  return (
    <>
      <header
        className={clsx(
          "w-full min-w-0 max-w-full overflow-hidden rounded-xl border-2 shadow-md",
          "border-sky-300/45 bg-gradient-to-br from-sky-50/95 via-white to-teal-50/25 ring-1 ring-sky-200/55"
        )}
      >
        <div className="border-b border-sky-200/70 px-3 py-2 sm:px-3.5">
          <p className="text-[11px] font-bold leading-tight text-sky-950 sm:text-xs">
            <span className="uppercase tracking-wide text-sky-800/90">Demande de produits</span>
            <span className="mx-1.5 font-normal text-sky-600/80" aria-hidden>
              ·
            </span>
            <span className="font-mono text-[13px] tabular-nums text-foreground sm:text-sm">N° {dossierRefLabel}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sky-200/70 px-3 py-2 sm:px-3.5">
          <p className="flex min-w-0 flex-1 items-center gap-1.5 truncate pb-px text-sm font-bold leading-snug text-foreground">
            <User className="size-4 shrink-0 text-sky-700" aria-hidden />
            <span className="truncate" title={patientLine}>
              {patientLine}
            </span>
          </p>
          {patientPhone ? (
            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
              <a
                href={`tel:${patientPhone.replace(/\s/g, "")}`}
                className="inline-flex size-8 items-center justify-center rounded-lg border border-sky-300/80 bg-white text-sky-800 shadow-sm hover:bg-sky-50"
                title={`Appeler ${patientPhone}`}
                aria-label="Appeler le patient"
              >
                <Phone className="size-3.5" aria-hidden />
              </a>
              <a
                href={`https://wa.me/${phoneDigits(patientPhone)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex size-8 items-center justify-center rounded-lg border border-emerald-500/80 bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
                title={`WhatsApp ${patientPhone}`}
                aria-label="Contacter le patient sur WhatsApp"
              >
                <MessageCircle className="size-3.5" aria-hidden />
              </a>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-start gap-2 px-3 py-2 sm:px-3.5">
          <span
            className={clsx(
              "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold leading-tight shadow-sm",
              statusBadgeClass(status)
            )}
          >
            {statusLabel}
          </span>
          {statusHint ? (
            <p className="min-w-0 flex-1 text-[11px] leading-snug text-sky-950/90">{statusHint}</p>
          ) : (
            <span className="min-w-0 flex-1" aria-hidden />
          )}
          <button
            type="button"
            onClick={() => setJourneyOpen(true)}
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-sky-300/80 bg-white text-sky-700 shadow-sm transition hover:bg-sky-50 hover:text-sky-900"
            aria-label="Voir le parcours complet d'une demande de produits"
            title="Parcours de la demande"
          >
            <Info className="size-4" strokeWidth={2.25} aria-hidden />
          </button>
        </div>

        <div className="flex flex-wrap gap-1 border-t border-sky-200/60 px-3 py-1.5 text-[9px] font-medium text-muted-foreground sm:px-3.5">
          <span className="rounded-md bg-muted/80 px-1.5 py-px text-foreground">
            {lineCount} ligne{lineCount !== 1 ? "s" : ""}
          </span>
          {selectedCount != null && selectedCount > 0 ? (
            <span className="rounded-md bg-muted/80 px-1.5 py-px text-foreground">
              {selectedCount} retenu{selectedCount !== 1 ? "s" : ""}
            </span>
          ) : null}
          {pendingCounterCount != null && pendingCounterCount > 0 ? (
            <span className="rounded-md bg-violet-100 px-1.5 py-px font-semibold text-violet-950">
              {pendingCounterCount} au comptoir
            </span>
          ) : null}
        </div>
      </header>

      <PatientProductRequestJourneyModal open={journeyOpen} currentStatus={status} onClose={() => setJourneyOpen(false)} />
    </>
  );
}
