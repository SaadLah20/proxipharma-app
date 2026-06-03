"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { PatientProductRequestJourneyModal } from "@/components/requests/product/patient-product-request-journey-modal";
import { PatientPharmacyDossierBand } from "@/components/requests/product/patient-pharmacy-dossier-band";
import type { PatientPharmacyContactInfo } from "@/components/requests/product/patient-pharmacy-quick-contact";
import { DossierHeaderRequestLine } from "@/components/requests/shared/dossier-header-sent-at";
import { requestStatusBadgeClass, requestStatusFr } from "@/lib/request-display";
import { uiDossierHeaderShell } from "@/lib/ui-surfaces";
import { cn } from "@/lib/utils";

export function PatientProductRequestDossierHeader({
  dossierRefLabel,
  pharmacyContact,
  pharmacyId,
  status,
  statusHint,
  statusDetail,
  submittedAt,
  createdAt,
}: {
  dossierRefLabel: string;
  pharmacyContact: PatientPharmacyContactInfo | null;
  pharmacyId: string;
  status: string;
  statusHint: string;
  statusDetail?: string | null;
  submittedAt?: string | null;
  createdAt?: string | null;
}) {
  const [journeyOpen, setJourneyOpen] = useState(false);
  const statusLabel = requestStatusFr[status] ?? status;

  return (
    <>
      <header className={uiDossierHeaderShell}>
        <div className="border-b border-border px-3 py-2 sm:px-3.5">
          <DossierHeaderRequestLine
            kindLabel="Demande"
            dossierRefLabel={dossierRefLabel}
            submittedAt={submittedAt}
            createdAt={createdAt}
          />
        </div>

        <div className="border-b border-border px-3 py-2 sm:px-3.5">
          <PatientPharmacyDossierBand
            pharmacyContact={pharmacyContact}
            pharmacyId={pharmacyId}
            dossierRefLabel={dossierRefLabel}
          />
        </div>

        <div className="flex flex-wrap items-start gap-2 px-3 py-2 sm:px-3.5">
          <span className={cn("shrink-0 shadow-sm", requestStatusBadgeClass(status))}>{statusLabel}</span>
          <p className="min-w-0 flex-1 text-[11px] leading-snug text-muted-foreground">{statusHint}</p>
          <button
            type="button"
            onClick={() => setJourneyOpen(true)}
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition hover:bg-muted/40 hover:text-foreground"
            aria-label="Voir le détail du statut et le parcours de la demande"
            title="Détail et parcours"
          >
            <Info className="size-4" strokeWidth={2.25} aria-hidden />
          </button>
        </div>
      </header>

      <PatientProductRequestJourneyModal
        open={journeyOpen}
        currentStatus={status}
        statusDetail={statusDetail}
        onClose={() => setJourneyOpen(false)}
      />
    </>
  );
}
