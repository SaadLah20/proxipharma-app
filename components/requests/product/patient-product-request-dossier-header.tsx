"use client";

import { useState } from "react";
import Link from "next/link";
import { Info, MapPin } from "lucide-react";
import { PatientProductRequestJourneyModal } from "@/components/requests/product/patient-product-request-journey-modal";
import {
  PatientPharmacyQuickContact,
  type PatientPharmacyContactInfo,
} from "@/components/requests/product/patient-pharmacy-quick-contact";
import { RequestKindIndicator, RequestKindRail } from "@/components/ui/request-kind-indicator";
import { requestStatusFr } from "@/lib/request-display";
import { pharmacyPublicLabel } from "@/lib/pharmacy-public-label";
import { productRequestPublicTheme as t } from "@/lib/request-kinds/product-request-public-theme";
import { cn } from "@/lib/utils";

function statusBadgeClass(status: string): string {
  if (["submitted", "in_review"].includes(status)) {
    return "border-sky-400/85 bg-sky-100 text-sky-950 ring-1 ring-sky-200/80";
  }
  if (status === "responded") return "border-amber-300/95 bg-amber-50 text-amber-950";
  if (status === "expired") return "border-amber-400/90 bg-amber-100 text-amber-950 ring-1 ring-amber-200/80";
  if (status === "cancelled") return "border-rose-400/90 bg-rose-100 text-rose-950 ring-1 ring-rose-200/80";
  if (status === "abandoned") return "border-orange-400/90 bg-orange-100 text-orange-950 ring-1 ring-orange-200/80";
  if (status === "partially_collected") {
    return "border-teal-400/85 bg-teal-100 text-teal-950 ring-1 ring-teal-200/80";
  }
  if (status === "fully_collected") {
    return "border-emerald-400/90 bg-emerald-100 text-emerald-950 ring-1 ring-emerald-200/80";
  }
  if (status === "completed") {
    return "border-emerald-400/85 bg-emerald-100 text-emerald-950 ring-1 ring-emerald-200/80";
  }
  if (["confirmed", "treated"].includes(status)) {
    return "border-teal-400/80 bg-teal-50 text-teal-950";
  }
  return "border-slate-300/80 bg-slate-50 text-slate-800";
}

const actionBtnClass =
  "inline-flex h-8 items-center rounded-lg border border-border/80 bg-card px-2.5 text-xs font-semibold text-foreground shadow-sm transition hover:bg-muted/40";

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
      <RequestKindRail
        kindId="product_request"
        className="w-full min-w-0 max-w-full overflow-hidden px-3 py-0 sm:px-3.5"
      >
        <div className="border-b border-border/60 py-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <RequestKindIndicator kindId="product_request" label="Demande de produits" />
            <span className="font-mono text-xs font-semibold tabular-nums text-foreground sm:text-sm">
              N° {dossierRefLabel}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-b border-border/60 py-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold leading-snug text-foreground break-words">{phLabel}</p>
            {pharmacyContact?.ville?.trim() ? (
              <p className="mt-0.5 text-xs font-medium text-muted-foreground">{pharmacyContact.ville.trim()}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            {pharmacyContact ? (
              <button type="button" onClick={() => setContactOpen(true)} className={actionBtnClass}>
                Contacter
              </button>
            ) : null}
            <Link href={`/pharmacie/${pharmacyId}`} className={cn(actionBtnClass, "gap-1")}>
              <MapPin className="size-3.5 shrink-0 opacity-80" aria-hidden />
              Voir la fiche
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap items-start gap-2 py-2">
          <span
            className={cn(
              "shrink-0 rounded-full border px-2 py-0.5 text-xs font-bold leading-tight shadow-sm",
              statusBadgeClass(status)
            )}
          >
            {statusLabel}
          </span>
          <p className="min-w-0 flex-1 text-xs leading-snug text-muted-foreground">{statusHint}</p>
          <button
            type="button"
            onClick={() => setJourneyOpen(true)}
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-border/80 bg-card text-muted-foreground shadow-sm transition hover:bg-muted/40 hover:text-foreground"
            aria-label="Voir le détail du statut et le parcours de la demande"
            title="Détail et parcours"
          >
            <Info className="size-4" strokeWidth={2.25} aria-hidden />
          </button>
        </div>
      </RequestKindRail>

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
