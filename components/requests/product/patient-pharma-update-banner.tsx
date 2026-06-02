"use client";

import { useState } from "react";
import { ClipboardList, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import { formatDateTimeShort24hFr } from "@/lib/datetime-fr";
import {
  buildPatientPharmaAmendmentResumeFr,
  type PatientPharmaAmendmentResumeSection,
} from "@/lib/patient-pharma-amendment-resume-fr";

export function PatientPharmaUpdateBanner({
  bundles,
}: {
  /** Conservé pour compatibilité appelant ; le libellé détaillé est dans la modale Résumé. */
  whenLabel?: string;
  bundles: { created_at: string; amendments: unknown }[];
}) {
  const [open, setOpen] = useState(false);
  const resume = buildPatientPharmaAmendmentResumeFr(bundles);

  if (!resume) return null;

  return (
    <>
      <div className="mb-2 flex min-w-0 items-center gap-2 rounded-lg border border-violet-300/85 bg-violet-50/95 px-2.5 py-1.5 shadow-sm ring-1 ring-violet-200/60">
        <RefreshCw className="size-3.5 shrink-0 text-violet-700" strokeWidth={2.25} aria-hidden />
        <p className="min-w-0 flex-1 truncate text-[11px] font-semibold text-violet-950">
          Cette demande a été modifiée par la pharmacie après votre validation.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 shrink-0 border-violet-400/70 bg-white px-2.5 text-[10px] font-semibold text-violet-950 hover:bg-violet-50"
          onClick={() => setOpen(true)}
        >
          <ClipboardList className="mr-1 size-3" aria-hidden />
          Résumé
        </Button>
      </div>

      <AppModalOverlay
        open={open}
        onBackdropClick={() => setOpen(false)}
        aria-labelledby="pharma-resume-title"
      >
        <div
          className="max-h-[min(85vh,32rem)] w-full max-w-md overflow-hidden rounded-xl border border-violet-200 bg-white shadow-xl"
          role="document"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-b border-violet-100 bg-violet-50/80 px-3 py-2.5">
            <h2 id="pharma-resume-title" className="text-sm font-bold leading-snug text-violet-950">
              Modifications après validation
            </h2>
            <p className="mt-0.5 text-[11px] text-violet-800/90">
              {resume.batchCount > 1
                ? `${resume.batchCount} mises à jour depuis votre validation · dernière ${formatDateTimeShort24hFr(
                    bundles[0]?.created_at ?? ""
                  )}`
                : `Mise à jour ${resume.whenLabel}`}
            </p>
          </div>
          <div className="max-h-[min(60vh,24rem)] space-y-3 overflow-y-auto px-3 py-3 text-[11px] leading-snug text-foreground">
            {resume.sections.map((sec: PatientPharmaAmendmentResumeSection) => (
              <section key={sec.id}>
                <h3 className="mb-1 text-[10px] font-bold uppercase tracking-wide text-violet-900">{sec.title}</h3>
                <ul className="list-inside list-disc space-y-0.5 text-muted-foreground">
                  {sec.lines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <div className="border-t border-violet-100 px-3 py-2">
            <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setOpen(false)}>
              Fermer
            </Button>
          </div>
        </div>
      </AppModalOverlay>
    </>
  );
}
