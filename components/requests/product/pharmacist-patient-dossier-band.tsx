"use client";

import { useState } from "react";
import Link from "next/link";
import { User } from "lucide-react";
import {
  PharmacistPatientQuickContact,
  type PharmacistPatientContactInfo,
} from "@/components/requests/product/pharmacist-patient-quick-contact";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import { requestKindUiTheme, type RequestKindUiTheme } from "@/lib/request-kind-ui-theme";
import { uiActionBtnCompactOutline, uiActionBtnCompactPrimary } from "@/lib/ui-action-buttons";
import { cn } from "@/lib/utils";

export function PharmacistPatientDossierBand({
  patientId,
  patientContact,
  dossierRefLabel,
  requestType = "product_request",
  uiTheme,
  className,
}: {
  patientId: string;
  patientContact: PharmacistPatientContactInfo | null;
  dossierRefLabel: string;
  requestType?: string | null;
  uiTheme?: RequestKindUiTheme;
  className?: string;
}) {
  const theme = uiTheme ?? requestKindUiTheme(requestType);
  const [contactOpen, setContactOpen] = useState(false);
  const displayName = patientContact?.full_name?.trim() || "Patient";
  const displayRef = patientContact?.patient_ref?.trim() || null;
  const hasContact =
    Boolean(patientContact?.whatsapp?.trim()) || Boolean(patientContact?.email?.trim());

  return (
    <>
      <div className={cn("flex min-w-0 flex-col gap-2", className)}>
        <div className="flex min-w-0 items-start gap-2">
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg shadow-sm ring-1",
              theme.accentIconBg,
              theme.accentIcon,
            )}
            aria-hidden
          >
            <User className="size-[1.125rem] shrink-0" strokeWidth={2.25} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="break-words text-sm font-bold leading-snug text-foreground">{displayName}</p>
            {displayRef ? (
              <p className="mt-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">{displayRef}</p>
            ) : null}
          </div>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {hasContact ? (
            <button type="button" onClick={() => setContactOpen(true)} className={uiActionBtnCompactOutline()}>
              Contacter
            </button>
          ) : null}
          <Link href={`/dashboard/pharmacien/clients/${patientId}`} className={uiActionBtnCompactPrimary()}>
            Voir le client
          </Link>
        </div>
      </div>

      {contactOpen && patientContact && hasContact ? (
        <AppModalOverlay
          open
          aria-labelledby="contact-patient-band-title"
          onBackdropClick={() => setContactOpen(false)}
        >
          <div
            className={cn(
              "w-full max-w-sm rounded-2xl border bg-card p-4 shadow-2xl sm:mx-auto",
              theme.modalShell,
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="contact-patient-band-title" className="text-sm font-bold text-foreground">
              Contacter {displayName}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">Dossier {dossierRefLabel}</p>
            <div className="mt-3 pb-1">
              <PharmacistPatientQuickContact
                patient={patientContact}
                requestRef={dossierRefLabel}
                variant="iconsOnly"
              />
            </div>
            <button
              type="button"
              onClick={() => setContactOpen(false)}
              className="mt-4 w-full rounded-lg border border-border/80 py-2 text-sm font-semibold text-foreground hover:bg-muted/40"
            >
              Fermer
            </button>
          </div>
        </AppModalOverlay>
      ) : null}
    </>
  );
}
