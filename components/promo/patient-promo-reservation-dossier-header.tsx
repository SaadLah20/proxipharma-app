"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { PatientPharmacyDossierBand } from "@/components/requests/product/patient-pharmacy-dossier-band";
import type { PatientPharmacyContactInfo } from "@/components/requests/product/patient-pharmacy-quick-contact";
import { DossierHeaderRequestLine } from "@/components/requests/shared/dossier-header-sent-at";
import { PatientPromoReservationJourneyModal } from "@/components/promo/patient-promo-reservation-journey-modal";
import { patientPromoReservationDossierHeaderShellClass } from "@/lib/patient-promo-reservation-line-ui";
import { promoReservationUiTheme } from "@/lib/promo/promo-reservation-ui-theme";
import { promoReservationBadgeClass } from "@/lib/promo/reservation-status-ui";
import type { PromoReservationStatus } from "@/lib/promo/types";
import { cn } from "@/lib/utils";

export function PatientPromoReservationDossierHeader({
  dossierRefLabel,
  pharmacyContact,
  pharmacyId,
  status,
  statusLabel,
  statusHint,
  reservedAt,
  createdAt,
}: {
  dossierRefLabel: string;
  pharmacyContact: PatientPharmacyContactInfo | null;
  pharmacyId: string;
  status: PromoReservationStatus;
  statusLabel: string;
  statusHint: string;
  reservedAt?: string | null;
  createdAt?: string | null;
}) {
  const t = useTranslations("promo");
  const tCommon = useTranslations("common");
  const [journeyOpen, setJourneyOpen] = useState(false);

  return (
    <>
      <header className={cn(patientPromoReservationDossierHeaderShellClass())}>
        <div className="border-b border-border px-3 py-2 sm:px-3.5">
          <DossierHeaderRequestLine
            kindLabel={t("dossierKindLabel")}
            dossierRefLabel={dossierRefLabel}
            submittedAt={reservedAt}
            createdAt={createdAt}
            dateLabelKey="reservedOn"
          />
        </div>

        <div className="border-b border-border px-3 py-2 sm:px-3.5">
          <PatientPharmacyDossierBand
            pharmacyContact={pharmacyContact}
            pharmacyId={pharmacyId}
            dossierRefLabel={dossierRefLabel}
            uiTheme={promoReservationUiTheme}
          />
        </div>

        <div className="flex flex-wrap items-start gap-2 px-3 py-2 sm:px-3.5">
          <span className={cn("shrink-0 shadow-sm rounded-full px-2.5 py-1 text-[11px] font-bold", promoReservationBadgeClass(status))}>
            {statusLabel}
          </span>
          <p className="min-w-0 flex-1 text-[11px] leading-snug text-muted-foreground">{statusHint}</p>
          <button
            type="button"
            onClick={() => setJourneyOpen(true)}
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-emerald-200/55 bg-card text-emerald-800 shadow-sm transition hover:border-emerald-300/55 hover:bg-emerald-50/45 hover:text-emerald-950"
            aria-label={t("journeyAria")}
            title={tCommon("detailAndJourney")}
          >
            <Info className="size-4" strokeWidth={2.25} aria-hidden />
          </button>
        </div>
      </header>

      <PatientPromoReservationJourneyModal
        open={journeyOpen}
        currentStatus={status}
        onClose={() => setJourneyOpen(false)}
      />
    </>
  );
}
