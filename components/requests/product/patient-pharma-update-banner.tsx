"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import { formatDateTimeShortForLocale } from "@/lib/datetime-locale";
import type { AppLocale } from "@/lib/i18n/config";
import { usePatientPharmaAmendmentCopy } from "@/lib/i18n/use-patient-pharma-amendment-copy";
import type { PatientPharmaAmendmentResumeSection } from "@/lib/patient-pharma-amendment-resume-fr";
import { cn } from "@/lib/utils";

export type PatientSupplyAmendmentBundle = { created_at: string; amendments: unknown };

export function PatientAmendmentResumeModal({
  open,
  bundles,
  onClose,
}: {
  open: boolean;
  bundles: PatientSupplyAmendmentBundle[];
  onClose: () => void;
}) {
  const locale = useLocale() as AppLocale;
  const tResume = useTranslations("demandes.amendmentResume");
  const tCommon = useTranslations("common");
  const { buildAmendmentResume } = usePatientPharmaAmendmentCopy();
  const resume = buildAmendmentResume(bundles);

  if (!resume) return null;

  return (
    <AppModalOverlay open={open} onBackdropClick={onClose} aria-labelledby="pharma-resume-title">
      <div
        className="max-h-[min(85vh,32rem)] w-full max-w-md overflow-hidden rounded-xl border border-border/80 bg-card shadow-xl"
        role="document"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border/80 bg-muted/20 px-3 py-2.5">
          <h2 id="pharma-resume-title" className="text-sm font-bold leading-snug text-foreground">
            {tResume("modalTitle")}
          </h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {resume.batchCount > 1
              ? tResume("modalSubtitleMulti", {
                  count: resume.batchCount,
                  when: formatDateTimeShortForLocale(bundles[0]?.created_at ?? "", locale),
                })
              : tResume("modalSubtitleSingle", { when: resume.whenLabel })}
          </p>
        </div>
        <div className="max-h-[min(60vh,24rem)] space-y-3 overflow-y-auto px-3 py-3 text-[11px] leading-snug text-foreground">
          {resume.sections.map((sec: PatientPharmaAmendmentResumeSection) => (
            <section key={sec.id}>
              <h3 className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{sec.title}</h3>
              <ul className="list-inside list-disc space-y-0.5 text-muted-foreground">
                {sec.lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <div className="border-t border-border/80 px-3 py-2">
          <Button type="button" variant="outline" size="sm" className="w-full" onClick={onClose}>
            {tCommon("close")}
          </Button>
        </div>
      </div>
    </AppModalOverlay>
  );
}

/** @deprecated Utiliser le bandeau intégré dans PatientProductRequestDossierHeader. */
export function PatientPharmaUpdateBanner({ bundles }: { whenLabel?: string; bundles: PatientSupplyAmendmentBundle[] }) {
  const [open, setOpen] = useState(false);
  const { buildAmendmentResume } = usePatientPharmaAmendmentCopy();
  const resume = buildAmendmentResume(bundles);
  if (!resume) return null;
  return (
    <>
      <PatientAmendmentResumeModal open={open} bundles={bundles} onClose={() => setOpen(false)} />
    </>
  );
}

export function PatientAmendmentResumeButton({
  onClick,
  requestType,
  className,
}: {
  onClick: () => void;
  requestType?: string | null;
  className?: string;
}) {
  const tDemandes = useTranslations("demandes");

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-1 rounded-full border bg-card px-2.5 text-[10px] font-semibold shadow-sm transition",
        requestType === "product_request"
          ? "border-sky-200/80 text-sky-800 hover:border-sky-300/80 hover:bg-sky-50/80"
          : requestType === "prescription"
            ? "border-amber-200/55 text-amber-900 hover:border-amber-300/55 hover:bg-amber-50/45"
            : "border-border text-foreground hover:bg-muted/40",
        className,
      )}
      aria-label={tDemandes("header.amendedResumeAria")}
    >
      <ClipboardList className="size-3" aria-hidden />
      {tDemandes("header.amendedResume")}
    </button>
  );
}

export function patientAmendedStatusBadgeClass(): string {
  return "inline-flex shrink-0 items-center rounded-full border border-violet-300/70 bg-violet-100/80 px-2 py-0.5 text-[10px] font-bold leading-tight text-violet-950 shadow-sm";
}
