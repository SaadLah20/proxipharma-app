"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { Info, MessageCircle, Phone, User } from "lucide-react";
import { PatientProductRequestJourneyModal } from "@/components/requests/product/patient-product-request-journey-modal";
import { DossierHeaderRequestLine } from "@/components/requests/shared/dossier-header-sent-at";
import { pharmacistProductRequestDossierHeaderShellClass } from "@/lib/pharmacist-product-request-line-ui";
import { requestStatusBadgeClass, requestStatusFr } from "@/lib/request-display";
import { uiActionBtnCompactOutline } from "@/lib/ui-action-buttons";

function phoneDigits(raw: string): string {
  return raw.replace(/\D/g, "");
}

function isProductRequestType(requestType: string | null | undefined): boolean {
  return requestType === "product_request";
}

export function PharmacistProductRequestDossierHeader({
  dossierRefLabel,
  kindLabel = "Demande",
  requestType = "product_request",
  patientName,
  patientRef,
  patientPhone,
  status,
  statusHint,
  submittedAt,
  createdAt,
  hideSentAt = false,
}: {
  dossierRefLabel: string;
  kindLabel?: string;
  requestType?: string | null;
  patientName: string | null;
  patientRef: string | null;
  patientPhone: string | null;
  status: string;
  statusHint: string;
  submittedAt?: string | null;
  createdAt?: string | null;
  hideSentAt?: boolean;
}) {
  const [journeyOpen, setJourneyOpen] = useState(false);
  const statusLabel = requestStatusFr[status] ?? status;
  const displayName = patientName?.trim() || null;
  const displayRef = patientRef?.trim() || null;
  const useSkyChrome = isProductRequestType(requestType);

  return (
    <>
      <header
        className={clsx(
          useSkyChrome ? pharmacistProductRequestDossierHeaderShellClass() : "rounded-xl border border-border bg-card shadow-sm",
        )}
      >
        <div className="border-b border-border px-3 py-2 sm:px-3.5">
          <DossierHeaderRequestLine
            kindLabel={kindLabel}
            dossierRefLabel={dossierRefLabel}
            submittedAt={submittedAt}
            createdAt={createdAt}
            hideSentAt={hideSentAt}
          />
        </div>

        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border px-3 py-2 sm:px-3.5">
          <div className="min-w-0 flex-1">
            <p className="flex min-w-0 items-center gap-1.5 text-sm font-bold leading-snug text-foreground">
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground shadow-sm ring-1 ring-border/80"
                aria-hidden
              >
                <User className="size-[1.125rem]" strokeWidth={2.25} />
              </span>
              <span className="min-w-0 truncate" title={displayName ?? undefined}>
                {displayName ?? "Patient"}
              </span>
            </p>
            {displayRef ? (
              <p className="mt-0.5 pl-[2.625rem] text-[11px] font-medium tabular-nums text-muted-foreground">
                {displayRef}
              </p>
            ) : null}
          </div>
          {patientPhone ? (
            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
              <a
                href={`tel:${patientPhone.replace(/\s/g, "")}`}
                className={uiActionBtnCompactOutline("inline-flex size-8 items-center justify-center p-0")}
                title={`Appeler ${patientPhone}`}
                aria-label="Appeler le patient"
              >
                <Phone className="size-3.5" aria-hidden />
              </a>
              <a
                href={`https://wa.me/${phoneDigits(patientPhone)}`}
                target="_blank"
                rel="noreferrer"
                className={uiActionBtnCompactOutline("inline-flex size-8 items-center justify-center p-0")}
                title={`WhatsApp ${patientPhone}`}
                aria-label="Contacter le patient sur WhatsApp"
              >
                <MessageCircle className="size-3.5" aria-hidden />
              </a>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-start gap-2 px-3 py-2 sm:px-3.5">
          <span className={clsx("shrink-0 shadow-sm rounded-full px-2.5 py-1 text-[11px] font-bold", requestStatusBadgeClass(status))}>
            {statusLabel}
          </span>
          {statusHint ? (
            <p className="min-w-0 flex-1 text-[11px] leading-snug text-muted-foreground">{statusHint}</p>
          ) : (
            <span className="min-w-0 flex-1" aria-hidden />
          )}
          <button
            type="button"
            onClick={() => setJourneyOpen(true)}
            className={clsx(
              "inline-flex size-7 shrink-0 items-center justify-center rounded-full border bg-card shadow-sm transition",
              useSkyChrome
                ? "border-sky-200/55 text-sky-800 hover:border-sky-300/55 hover:bg-sky-50/45 hover:text-sky-950"
                : "border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground",
            )}
            aria-label={`Voir le parcours de ${kindLabel.toLowerCase()}`}
            title={`Parcours de l’${kindLabel.toLowerCase()}`}
          >
            <Info className="size-4" strokeWidth={2.25} aria-hidden />
          </button>
        </div>
      </header>

      <PatientProductRequestJourneyModal
        open={journeyOpen}
        currentStatus={status}
        requestType={requestType}
        onClose={() => setJourneyOpen(false)}
      />
    </>
  );
}
