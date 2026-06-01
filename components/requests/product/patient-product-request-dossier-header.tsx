"use client";

import { useState } from "react";
import Link from "next/link";
import { Info, MapPin } from "lucide-react";
import { PatientProductRequestJourneyModal } from "@/components/requests/product/patient-product-request-journey-modal";
import {
  PatientPharmacyQuickContact,
  type PatientPharmacyContactInfo,
} from "@/components/requests/product/patient-pharmacy-quick-contact";
import { requestStatusBadgeClass, requestStatusFr } from "@/lib/request-display";
import { pharmacyPublicLabel } from "@/lib/pharmacy-public-label";
import { productRequestPublicTheme as t } from "@/lib/request-kinds/product-request-public-theme";
import { uiDossierHeaderShell } from "@/lib/ui-surfaces";
import { uiEyebrowLabel } from "@/lib/ui-label-styles";
import { cn } from "@/lib/utils";

export function PatientProductRequestDossierHeader({
  dossierRefLabel,
  pharmacyContact,
  pharmacyId,
  status,
  statusHint,
  statusDetail,
}: {
  dossierRefLabel: string;
  pharmacyContact: PatientPharmacyContactInfo | null;
  pharmacyId: string;
  status: string;
  statusHint: string;
  statusDetail?: string | null;
}) {
  const [journeyOpen, setJourneyOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const phLabel = pharmacyContact?.nom?.trim() ? pharmacyPublicLabel(pharmacyContact.nom) : "Pharmacie";
  const statusLabel = requestStatusFr[status] ?? status;

  return (
    <>
      <header className={uiDossierHeaderShell}>
        <div className="border-b border-border px-3 py-2 sm:px-3.5">
          <p className="text-[11px] font-bold leading-tight text-foreground sm:text-xs">
            <span className={uiEyebrowLabel}>Demande de produits</span>
            <span className="mx-1.5 font-normal text-muted-foreground" aria-hidden>
              ·
            </span>
            <span className="font-mono text-[13px] tabular-nums text-foreground sm:text-sm">N° {dossierRefLabel}</span>
          </p>
        </div>

        <div className="flex flex-col gap-2 border-b border-border px-3 py-2 sm:flex-row sm:items-start sm:justify-between sm:px-3.5">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold leading-snug text-foreground break-words">{phLabel}</p>
            {pharmacyContact?.ville?.trim() ? (
              <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">{pharmacyContact.ville.trim()}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            {pharmacyContact ? (
              <button
                type="button"
                onClick={() => setContactOpen(true)}
                className="inline-flex h-8 items-center rounded-lg border border-border bg-card px-2.5 text-[11px] font-bold text-foreground shadow-sm transition hover:bg-muted/40"
              >
                Contacter
              </button>
            ) : null}
            <Link
              href={`/pharmacie/${pharmacyId}`}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-card px-2.5 text-[11px] font-bold text-foreground shadow-sm transition hover:bg-muted/40"
            >
              <MapPin className="size-3.5 shrink-0 opacity-80" aria-hidden />
              Voir la fiche
            </Link>
          </div>
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

      {contactOpen && pharmacyContact ? (
        <div className="fixed inset-0 z-[65] flex items-end justify-center p-3 sm:items-center">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Fermer"
            onClick={() => setContactOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="contact-pharmacy-title"
            className={cn("relative z-10 w-full max-w-sm rounded-2xl border bg-card p-4 shadow-2xl", t.modalShell)}
          >
            <h2 id="contact-pharmacy-title" className="text-sm font-bold text-foreground">
              Contacter {phLabel}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">Réf. dossier {dossierRefLabel}</p>
            <div className="mt-3">
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
        </div>
      ) : null}
    </>
  );
}
