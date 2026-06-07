"use client";

import { MessageCircle, User } from "lucide-react";
import { DossierHeaderRequestLine } from "@/components/requests/shared/dossier-header-sent-at";
import { promoReservationBadgeClass, promoReservationHint, promoReservationLabel } from "@/lib/promo/reservation-status-ui";
import type { PromoReservationStatus } from "@/lib/promo/types";
import { uiActionBtnCompactOutline } from "@/lib/ui-action-buttons";
import { uiDossierHeaderShell } from "@/lib/ui-surfaces";
import { cn } from "@/lib/utils";

function whatsAppHref(phone: string | null | undefined) {
  const digits = (phone ?? "").replace(/[^\d]/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}`;
}

export function PharmacistPromoReservationDossierHeader({
  dossierRefLabel,
  offerTitle,
  status,
  reservedAt,
  createdAt,
  patientName,
  patientWhatsapp,
}: {
  dossierRefLabel: string;
  offerTitle: string;
  status: PromoReservationStatus;
  reservedAt?: string | null;
  createdAt?: string | null;
  patientName?: string | null;
  patientWhatsapp?: string | null;
}) {
  const wa = whatsAppHref(patientWhatsapp);
  const displayName = patientName?.trim() || "Patient";

  return (
    <header className={cn(uiDossierHeaderShell)}>
      <div className="border-b border-border px-3 py-2 sm:px-3.5">
        <DossierHeaderRequestLine
          kindLabel="Réservation pack"
          dossierRefLabel={dossierRefLabel}
          submittedAt={reservedAt}
          createdAt={createdAt}
          dateLabelKey="reservedOn"
        />
        <p className="mt-1 text-[11px] font-semibold text-foreground">{offerTitle}</p>
      </div>

      <div className="border-b border-border px-3 py-2 sm:px-3.5">
        <div className="flex min-w-0 items-start gap-2">
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground shadow-sm ring-1 ring-border/80"
            aria-hidden
          >
            <User className="size-[1.125rem]" strokeWidth={2.25} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold leading-snug text-foreground">{displayName}</p>
            {patientWhatsapp?.trim() ? (
              <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">{patientWhatsapp.trim()}</p>
            ) : null}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {wa ? (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className={uiActionBtnCompactOutline("inline-flex items-center gap-1")}
            >
              <MessageCircle className="size-3.5" aria-hidden />
              WhatsApp
            </a>
          ) : null}
        </div>
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
