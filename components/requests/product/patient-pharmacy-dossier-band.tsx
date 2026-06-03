"use client";

import { useState } from "react";
import Link from "next/link";
import { Store } from "lucide-react";
import { PharmacyNavigationPicker } from "@/components/pharmacy/pharmacy-navigation-picker";
import {
  PatientPharmacyQuickContact,
  type PatientPharmacyContactInfo,
} from "@/components/requests/product/patient-pharmacy-quick-contact";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import { requestKindUiTheme } from "@/lib/request-kind-ui-theme";
import { pharmacyPublicLabel } from "@/lib/pharmacy-public-label";
import { uiActionBtnCompactOutline, uiActionBtnCompactPrimary } from "@/lib/ui-action-buttons";
import { cn } from "@/lib/utils";

export function PatientPharmacyDossierBand({
  pharmacyContact,
  pharmacyId,
  dossierRefLabel,
  requestType = "product_request",
  compact = false,
  className,
}: {
  pharmacyContact: PatientPharmacyContactInfo | null;
  pharmacyId: string;
  dossierRefLabel: string;
  requestType?: string | null;
  /** Bandeau réduit (carte récap envoyée). */
  compact?: boolean;
  className?: string;
}) {
  const t = requestKindUiTheme(requestType);
  const [contactOpen, setContactOpen] = useState(false);
  const phLabel = pharmacyContact?.nom?.trim()
    ? pharmacyPublicLabel(pharmacyContact.nom)
    : "Pharmacie";
  const iconBox = compact ? "size-8 rounded-lg" : "size-9 rounded-lg";
  const iconSize = compact ? "size-4" : "size-[1.125rem]";
  const nameClass = compact
    ? "text-[11px] font-bold leading-snug text-foreground"
    : "text-sm font-bold leading-snug text-foreground";
  const villeClass = compact
    ? "text-[10px] font-medium text-muted-foreground"
    : "text-[11px] font-medium text-muted-foreground";

  const navigationTarget = pharmacyContact
    ? {
        pharmacyId,
        nom: pharmacyContact.nom,
        adresse: pharmacyContact.adresse ?? null,
        ville: pharmacyContact.ville ?? null,
        latitude: pharmacyContact.latitude ?? null,
        longitude: pharmacyContact.longitude ?? null,
        maps_url: pharmacyContact.maps_url ?? null,
      }
    : null;

  return (
    <>
      <div className={cn("flex min-w-0 flex-col gap-2", className)}>
        <div className="flex min-w-0 items-start gap-2">
          <span
            className={cn(
              "flex shrink-0 items-center justify-center shadow-sm ring-1",
              iconBox,
              t.accentIconBg,
              t.accentIcon
            )}
            aria-hidden
          >
            <Store className={cn(iconSize, "shrink-0")} strokeWidth={2.25} />
          </span>
          <div className="min-w-0 flex-1">
            <p className={cn(nameClass, "break-words")}>{phLabel}</p>
            {pharmacyContact?.ville?.trim() ? (
              <p className={cn("mt-0.5", villeClass)}>{pharmacyContact.ville.trim()}</p>
            ) : null}
            {compact && pharmacyContact?.public_ref?.trim() ? (
              <p className="mt-0.5 font-mono text-[9px] font-semibold text-muted-foreground">
                Off. {pharmacyContact.public_ref.trim()}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {pharmacyContact ? (
            <button
              type="button"
              onClick={() => setContactOpen(true)}
              className={uiActionBtnCompactOutline()}
            >
              Contacter
            </button>
          ) : null}
          {navigationTarget ? (
            <PharmacyNavigationPicker
              pharmacy={navigationTarget}
              source="profile"
              variant="compact-outline"
              disabledClassName="pointer-events-none opacity-45"
            />
          ) : null}
          <Link href={`/pharmacie/${pharmacyId}`} className={uiActionBtnCompactPrimary()}>
            Voir la fiche
          </Link>
        </div>
      </div>

      {contactOpen && pharmacyContact ? (
        <AppModalOverlay
          open
          aria-labelledby="contact-pharmacy-band-title"
          onBackdropClick={() => setContactOpen(false)}
        >
          <div
            className={cn(
              "w-full max-w-sm rounded-2xl border bg-card p-4 shadow-2xl sm:mx-auto",
              t.modalShell
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="contact-pharmacy-band-title" className="text-sm font-bold text-foreground">
              Contacter {phLabel}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">Réf. dossier {dossierRefLabel}</p>
            <div className="mt-3 pb-1">
              <PatientPharmacyQuickContact
                pharmacy={pharmacyContact}
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
