"use client";

import { DossierHeaderRequestLine } from "@/components/requests/shared/dossier-header-sent-at";
import { PharmacistPatientDossierBand } from "@/components/requests/product/pharmacist-patient-dossier-band";
import type { PharmacistPatientContactInfo } from "@/components/requests/product/pharmacist-patient-quick-contact";
import { pharmacistPromoReservationDossierHeaderShellClass } from "@/lib/pharmacist-promo-reservation-line-ui";
import { promoReservationBadgeClass, promoReservationHint, promoReservationLabel } from "@/lib/promo/reservation-status-ui";
import { promoReservationUiTheme } from "@/lib/promo/promo-reservation-ui-theme";
import type { PromoReservationStatus } from "@/lib/promo/types";
import { cn } from "@/lib/utils";

export function PharmacistPromoReservationDossierHeader({
  dossierRefLabel,
  offerTitle,
  status,
  reservedAt,
  createdAt,
  patientId,
  patientContact,
}: {
  dossierRefLabel: string;
  offerTitle: string;
  status: PromoReservationStatus;
  reservedAt?: string | null;
  createdAt?: string | null;
  patientId: string;
  patientContact: PharmacistPatientContactInfo | null;
}) {
  return (
    <header className={cn(pharmacistPromoReservationDossierHeaderShellClass())}>
      <div className="border-b border-emerald-200/40 px-3 py-2 sm:px-3.5">
        <DossierHeaderRequestLine
          kindLabel="Réservation pack"
          dossierRefLabel={dossierRefLabel}
          submittedAt={reservedAt}
          createdAt={createdAt}
          dateLabelKey="reservedOn"
        />
        <p className="mt-1 text-[11px] font-semibold text-foreground">{offerTitle}</p>
      </div>

      <div className="border-b border-emerald-200/40 px-3 py-2 sm:px-3.5">
        <PharmacistPatientDossierBand
          patientId={patientId}
          patientContact={patientContact}
          dossierRefLabel={dossierRefLabel}
          requestType="promo_reservation"
          uiTheme={promoReservationUiTheme}
        />
      </div>

      <div className="flex flex-wrap items-start gap-2 px-3 py-2 sm:px-3.5">
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold shadow-sm",
            promoReservationBadgeClass(status),
          )}
        >
          {promoReservationLabel(status, "pharmacien")}
        </span>
        <p className="min-w-0 flex-1 text-[11px] leading-snug text-muted-foreground">
          {promoReservationHint(status, { pharmacistMessage: false })}
        </p>
      </div>
    </header>
  );
}
