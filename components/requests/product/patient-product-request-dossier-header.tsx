"use client";

import { useState } from "react";
import Link from "next/link";
import { Info, MapPin } from "lucide-react";
import { PatientProductRequestJourneyModal } from "@/components/requests/product/patient-product-request-journey-modal";
import {
  PatientPharmacyQuickContact,
  type PatientPharmacyContactInfo,
} from "@/components/requests/product/patient-pharmacy-quick-contact";
import { requestStatusFr } from "@/lib/request-display";
import { pharmacyPublicLabel } from "@/lib/pharmacy-public-label";
import { productRequestPublicTheme as t } from "@/lib/request-kinds/product-request-public-theme";
import { cn } from "@/lib/utils";

function statusBadgeClass(status: string): string {
  if (["submitted", "in_review"].includes(status)) {
    return "border-sky-400/85 bg-sky-100 text-sky-950 ring-1 ring-sky-200/80";
  }
  if (status === "responded") return "border-amber-300/95 bg-amber-50 text-amber-950";
  if (["confirmed", "treated"].includes(status)) {
    return "border-teal-400/80 bg-teal-50 text-teal-950";
  }
  return "border-slate-300/80 bg-slate-50 text-slate-800";
}

export function PatientProductRequestDossierHeader({
  dossierRefLabel,
  pharmacyContact,
  pharmacyId,
  status,
  statusHint,
}: {
  dossierRefLabel: string;
  pharmacyContact: PatientPharmacyContactInfo | null;
  pharmacyId: string;
  status: string;
  statusHint: string;
}) {
  const [journeyOpen, setJourneyOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const phLabel = pharmacyContact?.nom?.trim() ? pharmacyPublicLabel(pharmacyContact.nom) : "Pharmacie";
  const statusLabel = requestStatusFr[status] ?? status;

  return (
    <>
      <header
        className={cn(
          "w-full min-w-0 max-w-full overflow-hidden rounded-xl border-2 shadow-md",
          "border-sky-300/45 bg-gradient-to-br from-sky-50/95 via-white to-teal-50/25 ring-1 ring-sky-200/55"
        )}
      >
        <div className="border-b border-sky-200/70 px-3 py-2 sm:px-3.5">
          <p className="text-[11px] font-bold leading-tight text-sky-950 sm:text-xs">
            <span className="uppercase tracking-wide text-sky-800/90">Demande de produits</span>
            <span className="mx-1.5 font-normal text-sky-600/80" aria-hidden>
              ·
            </span>
            <span className="font-mono text-[13px] tabular-nums text-foreground sm:text-sm">N° {dossierRefLabel}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sky-200/70 px-3 py-2 sm:px-3.5">
          <p className="min-w-0 flex-1 text-sm font-bold leading-tight text-foreground">{phLabel}</p>
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            {pharmacyContact ? (
              <button
                type="button"
                onClick={() => setContactOpen(true)}
                className="inline-flex h-8 items-center rounded-lg border border-sky-400/70 bg-white px-2.5 text-[11px] font-bold text-sky-900 shadow-sm transition hover:bg-sky-50"
              >
                Contacter
              </button>
            ) : null}
            <Link
              href={`/pharmacie/${pharmacyId}`}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-sky-400/70 bg-white px-2.5 text-[11px] font-bold text-sky-900 shadow-sm transition hover:bg-sky-50"
            >
              <MapPin className="size-3.5 shrink-0 opacity-80" aria-hidden />
              Voir la fiche
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap items-start gap-2 px-3 py-2 sm:px-3.5">
          <span
            className={cn(
              "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold leading-tight shadow-sm",
              statusBadgeClass(status)
            )}
          >
            {statusLabel}
          </span>
          <p className="min-w-0 flex-1 text-[11px] leading-snug text-sky-950/90">{statusHint}</p>
          <button
            type="button"
            onClick={() => setJourneyOpen(true)}
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-sky-300/80 bg-white text-sky-700 shadow-sm transition hover:bg-sky-50 hover:text-sky-900"
            aria-label="Voir le parcours complet d'une demande de produits"
            title="Parcours de la demande"
          >
            <Info className="size-4" strokeWidth={2.25} aria-hidden />
          </button>
        </div>
      </header>

      <PatientProductRequestJourneyModal open={journeyOpen} currentStatus={status} onClose={() => setJourneyOpen(false)} />

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
