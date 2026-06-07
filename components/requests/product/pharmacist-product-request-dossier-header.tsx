"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { Info } from "lucide-react";
import { PharmacistPatientDossierBand } from "@/components/requests/product/pharmacist-patient-dossier-band";
import type { PharmacistPatientContactInfo } from "@/components/requests/product/pharmacist-patient-quick-contact";
import { PatientProductRequestJourneyModal } from "@/components/requests/product/patient-product-request-journey-modal";
import { DossierHeaderRequestLine } from "@/components/requests/shared/dossier-header-sent-at";
import { pharmacistProductRequestDossierHeaderShellClass } from "@/lib/pharmacist-product-request-line-ui";
import { requestStatusBadgeClass, requestStatusFr } from "@/lib/request-display";

function isProductRequestType(requestType: string | null | undefined): boolean {
  return requestType === "product_request";
}

export function PharmacistProductRequestDossierHeader({
  dossierRefLabel,
  kindLabel = "Demande",
  requestType = "product_request",
  patientId,
  patientName,
  patientRef,
  patientPhone,
  patientEmail,
  status,
  statusHint,
  submittedAt,
  createdAt,
  hideSentAt = false,
}: {
  dossierRefLabel: string;
  kindLabel?: string;
  requestType?: string | null;
  patientId: string;
  patientName: string | null;
  patientRef: string | null;
  patientPhone: string | null;
  patientEmail?: string | null;
  status: string;
  statusHint: string;
  submittedAt?: string | null;
  createdAt?: string | null;
  hideSentAt?: boolean;
}) {
  const [journeyOpen, setJourneyOpen] = useState(false);
  const statusLabel = requestStatusFr[status] ?? status;
  const useSkyChrome = isProductRequestType(requestType);

  const patientContact: PharmacistPatientContactInfo | null = patientId
    ? {
        full_name: patientName,
        patient_ref: patientRef,
        whatsapp: patientPhone,
        email: patientEmail ?? null,
      }
    : null;

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

        <div className="border-b border-border px-3 py-2 sm:px-3.5">
          <PharmacistPatientDossierBand
            patientId={patientId}
            patientContact={patientContact}
            dossierRefLabel={dossierRefLabel}
            requestType={requestType}
          />
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
