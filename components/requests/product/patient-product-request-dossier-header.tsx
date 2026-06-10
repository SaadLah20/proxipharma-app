"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { PatientProductRequestJourneyModal } from "@/components/requests/product/patient-product-request-journey-modal";
import { PatientPharmacyDossierBand } from "@/components/requests/product/patient-pharmacy-dossier-band";
import type { PatientPharmacyContactInfo } from "@/components/requests/product/patient-pharmacy-quick-contact";
import { DossierHeaderRequestLine } from "@/components/requests/shared/dossier-header-sent-at";
import {
  PatientAmendmentResumeButton,
  PatientAmendmentResumeModal,
  patientAmendedStatusBadgeClass,
  type PatientSupplyAmendmentBundle,
} from "@/components/requests/product/patient-pharma-update-banner";
import { usePatientRequestStatusLabel } from "@/lib/i18n/patient-request-status-label";
import { usePatientPharmaAmendmentCopy } from "@/lib/i18n/use-patient-pharma-amendment-copy";
import { requestStatusBadgeClass } from "@/lib/request-display";
import { patientWorkflowDossierHeaderShellClass } from "@/lib/patient-product-request-line-ui";
import { uiDossierHeaderShell } from "@/lib/ui-surfaces";
import { cn } from "@/lib/utils";

export function PatientProductRequestDossierHeader({
  dossierRefLabel,
  pharmacyContact,
  pharmacyId,
  kindLabel,
  requestType = "product_request",
  status,
  statusHint,
  statusDetail,
  submittedAt,
  createdAt,
  hideSentAt = false,
  statusLabel,
  amendmentResumeBundles,
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
  statusLabel?: string;
  amendmentResumeBundles?: PatientSupplyAmendmentBundle[];
}) {
  const tCommon = useTranslations("common");
  const tDemandes = useTranslations("demandes");
  const { buildAmendmentResume } = usePatientPharmaAmendmentCopy();
  const resolvedKindLabel = kindLabel ?? tCommon("defaultRequestKindLabel");
  const translatedStatusLabel = usePatientRequestStatusLabel(status);
  const [journeyOpen, setJourneyOpen] = useState(false);
  const [resumeOpen, setResumeOpen] = useState(false);
  const badgeLabel = statusLabel ?? translatedStatusLabel;
  const amendmentResume = amendmentResumeBundles?.length
    ? buildAmendmentResume(amendmentResumeBundles)
    : null;
  const showAmendedState = Boolean(amendmentResume);

  return (
    <>
      <header
        className={cn(
          patientWorkflowDossierHeaderShellClass(requestType) ?? uiDossierHeaderShell,
        )}
      >
        <div className="border-b border-border px-3 py-2 sm:px-3.5">
          <DossierHeaderRequestLine
            kindLabel={resolvedKindLabel}
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

        <div className="px-3 py-2 sm:px-3.5">
          <div className="flex flex-wrap items-start gap-2">
            <span className={cn("shrink-0 shadow-sm", requestStatusBadgeClass(status))}>{badgeLabel}</span>
            <p className="min-w-0 flex-1 text-[11px] leading-snug text-muted-foreground">{statusHint}</p>
            <button
              type="button"
              onClick={() => setJourneyOpen(true)}
              className={cn(
                "inline-flex size-7 shrink-0 items-center justify-center rounded-full border bg-card shadow-sm transition",
                requestType === "product_request"
                  ? "border-sky-200/80 text-sky-700 hover:border-sky-300/80 hover:bg-sky-50/80 hover:text-sky-900"
                  : requestType === "prescription"
                    ? "border-amber-200/55 text-amber-800 hover:border-amber-300/55 hover:bg-amber-50/45 hover:text-amber-950"
                    : "border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground",
              )}
              aria-label={tDemandes("header.journeyAria")}
              title={tCommon("detailAndJourney")}
            >
              <Info className="size-4" strokeWidth={2.25} aria-hidden />
            </button>
          </div>

          {showAmendedState ? (
            <div className="mt-2 flex flex-wrap items-start gap-2 border-t border-border/60 pt-2">
              <span className={patientAmendedStatusBadgeClass()}>{tDemandes("header.amendedBadge")}</span>
              <p className="min-w-0 flex-1 text-[11px] leading-snug text-muted-foreground">
                {tDemandes("header.amendedHint")}
              </p>
              <PatientAmendmentResumeButton onClick={() => setResumeOpen(true)} requestType={requestType} />
            </div>
          ) : null}
        </div>
      </header>

      <PatientProductRequestJourneyModal
        open={journeyOpen}
        currentStatus={status}
        statusDetail={statusDetail}
        requestType={requestType}
        onClose={() => setJourneyOpen(false)}
      />

      {showAmendedState && amendmentResumeBundles ? (
        <PatientAmendmentResumeModal
          open={resumeOpen}
          bundles={amendmentResumeBundles}
          onClose={() => setResumeOpen(false)}
        />
      ) : null}
    </>
  );
}
