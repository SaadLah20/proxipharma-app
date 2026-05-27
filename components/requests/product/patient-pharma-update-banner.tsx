"use client";

import { useEffect, useState } from "react";
import { ClipboardList, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  buildPatientPharmaAmendmentResumeFr,
  type PatientPharmaAmendmentResumeSection,
} from "@/lib/patient-pharma-amendment-resume-fr";

export function PatientPharmaUpdateBanner({
  whenLabel,
  bundles,
}: {
  whenLabel: string;
  bundles: { created_at: string; amendments: unknown }[];
}) {
  const [open, setOpen] = useState(false);
  const resume = buildPatientPharmaAmendmentResumeFr(bundles);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!resume) return null;

  return (
    <>
      <div className="mb-2 flex items-start gap-2 rounded-lg border border-violet-300/85 bg-violet-50/95 px-2.5 py-2 shadow-sm ring-1 ring-violet-200/60">
        <span
          className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white"
          aria-hidden
        >
          <RefreshCw className="size-3.5" strokeWidth={2.25} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[11px] font-semibold leading-snug text-violet-950">
            Demande modifiée par la pharmacie après votre validation · dernière mise à jour {whenLabel}
          </p>
          <div className="mt-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 border-violet-400/70 bg-white px-2.5 text-[10px] font-semibold text-violet-950 hover:bg-violet-50"
              onClick={() => setOpen(true)}
            >
              <ClipboardList className="mr-1 size-3" aria-hidden />
              Résumé
            </Button>
          </div>
        </div>
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 p-3 sm:items-center"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[min(85vh,32rem)] w-full max-w-md overflow-hidden rounded-xl border border-violet-200 bg-white shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pharma-resume-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-violet-100 bg-violet-50/80 px-3 py-2.5">
              <h2 id="pharma-resume-title" className="text-sm font-bold leading-snug text-violet-950">
                Modifications après validation
              </h2>
              <p className="mt-0.5 text-[11px] text-violet-800/90">Mise à jour {resume.whenLabel}</p>
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setOpen(false)}
              >
                Fermer
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
