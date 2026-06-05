"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { PatientProductRequestJourneyModal } from "@/components/requests/product/patient-product-request-journey-modal";
import { PatientPharmacyDossierBand } from "@/components/requests/product/patient-pharmacy-dossier-band";
import type { PatientPharmacyContactInfo } from "@/components/requests/product/patient-pharmacy-quick-contact";
import { DossierHeaderRequestLine } from "@/components/requests/shared/dossier-header-sent-at";
import { requestStatusBadgeClass } from "@/lib/request-display";
import { uiDossierHeaderShell } from "@/lib/ui-surfaces";
import { cn } from "@/lib/utils";

export function PatientProductRequestDossierHeader({
  dossierRefLabel,
  pharmacyContact,
  pharmacyId,
  kindLabel = "Demande",
  requestType = "product_request",
  status,
  statusHint,
  statusDetail,
  submittedAt,
  createdAt,
  hideSentAt = false,
  statusLabel,
}: {
  dossierRefLabel: string;
  pharmacyContact: PatientPharmacyContactInfo | null;
  pharmacyId: string;
  kindLabel?: string;
  requestType?: string | null;
  status: string;
  statusHint: string;
  statusDetail?: string | null;
  submittedAt?: string | null;
  createdAt?: string | null;
  hideSentAt?: boolean;
  /** Libellé statut déjà traduit (next-intl workflow / demandes). */
  statusLabel?: string;
}) {
  const tCommon = useTranslations("common");
  const tDemandes = useTranslations("demandes");
  const [journeyOpen, setJourneyOpen] = useState(false);
  const badgeLabel = statusLabel ?? status;

  return (
    <>
      <header className={uiDossierHeaderShell}>
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
          <PatientPharmacyDossierBand
            pharmacyContact={pharmacyContact}
            pharmacyId={pharmacyId}
            dossierRefLabel={dossierRefLabel}
            requestType={requestType}
          />
        </div>

        <div className="flex flex-wrap items-start gap-2 px-3 py-2 sm:px-3.5">
          <span className={cn("shrink-0 shadow-sm", requestStatusBadgeClass(status))}>{badgeLabel}</span>
          <p className="min-w-0 flex-1 text-[11px] leading-snug text-muted-foreground">{statusHint}</p>
          <button
            type="button"
            onClick={() => setJourneyOpen(true)}
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition hover:bg-muted/40 hover:text-foreground"
            aria-label={tDemandes("header.journeyAria")}
            title={tCommon("detailAndJourney")}
          >
            <Info className="size-4" strokeWidth={2.25} aria-hidden />
          </button>
        </div>
      </header>

      <PatientProductRequestJourneyModal
        open={journeyOpen}
        currentStatus={status}
        statusDetail={statusDetail}
        requestType={requestType}
        onClose={() => setJourneyOpen(false)}
      />
    </>
  );
}
