"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { Info, MessageCircle, Phone, User } from "lucide-react";
import { PatientProductRequestJourneyModal } from "@/components/requests/product/patient-product-request-journey-modal";
import { StatusPill } from "@/components/ui/badge";
import { RequestKindIndicator, RequestKindRail } from "@/components/ui/request-kind-indicator";
import { requestStatusFr, requestStatusBadgeClass } from "@/lib/request-display";

function phoneDigits(raw: string): string {
  return raw.replace(/\D/g, "");
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
      <RequestKindRail kindId="product_request" className="overflow-hidden">
        <div className="border-b border-border/60 px-3 py-2 sm:px-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <RequestKindIndicator kindId="product_request" />
            <span className="font-mono text-[13px] tabular-nums text-foreground sm:text-sm">N° {dossierRefLabel}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-3 py-2 sm:px-3.5">
          <p className="flex min-w-0 flex-1 items-center gap-1.5 truncate pb-px text-sm font-bold leading-snug text-foreground">
            <User className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="truncate" title={patientLine}>
              {patientLine}
            </span>
          </p>
          {patientPhone ? (
            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
              <a
                href={`tel:${patientPhone.replace(/\s/g, "")}`}
                className="inline-flex size-8 items-center justify-center rounded-lg border border-border/80 bg-card text-foreground shadow-sm hover:bg-muted/50"
                title={`Appeler ${patientPhone}`}
                aria-label="Appeler le patient"
              >
                <Phone className="size-3.5" aria-hidden />
              </a>
              <a
                href={`https://wa.me/${phoneDigits(patientPhone)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex size-8 items-center justify-center rounded-lg border border-border/80 bg-card text-foreground shadow-sm hover:bg-muted/50"
                title={`WhatsApp ${patientPhone}`}
                aria-label="Contacter le patient sur WhatsApp"
              >
                <MessageCircle className="size-3.5" aria-hidden />
              </a>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-start gap-2 px-3 py-2 sm:px-3.5">
          <StatusPill className={clsx("shrink-0 shadow-sm", requestStatusBadgeClass(status))}>{statusLabel}</StatusPill>
          {statusHint ? (
            <p className="min-w-0 flex-1 text-sm leading-snug text-muted-foreground">{statusHint}</p>
          ) : (
            <span className="min-w-0 flex-1" aria-hidden />
          )}
          <button
            type="button"
            onClick={() => setJourneyOpen(true)}
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-border/80 bg-card text-muted-foreground shadow-sm transition hover:bg-muted/50 hover:text-foreground"
            aria-label="Voir le parcours complet d'une demande de produits"
            title="Parcours de la demande"
          >
            <Info className="size-4" strokeWidth={2.25} aria-hidden />
          </button>
        </div>

        <div className="flex flex-wrap gap-1 border-t border-border/60 px-3 py-1.5 text-xs text-muted-foreground sm:px-3.5">
          <span className="rounded-md bg-muted/80 px-1.5 py-px text-foreground">
            {lineCount} ligne{lineCount !== 1 ? "s" : ""}
          </span>
          {selectedCount != null && selectedCount > 0 ? (
            <span className="rounded-md bg-muted/80 px-1.5 py-px text-foreground">
              {selectedCount} retenu{selectedCount !== 1 ? "s" : ""}
            </span>
          ) : null}
          {pendingCounterCount != null && pendingCounterCount > 0 ? (
            <span className="rounded-md bg-muted/80 px-1.5 py-px font-medium text-foreground">
              {pendingCounterCount} au comptoir
            </span>
          ) : null}
        </div>
      </RequestKindRail>

      <PatientProductRequestJourneyModal open={journeyOpen} currentStatus={status} onClose={() => setJourneyOpen(false)} />
    </>
  );
}
