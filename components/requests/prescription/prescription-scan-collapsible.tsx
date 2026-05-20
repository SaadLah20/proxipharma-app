"use client";

import { clsx } from "clsx";
import { ChevronDown, FileImage } from "lucide-react";
import { PrescriptionImageViewer } from "@/components/requests/prescription/prescription-image-viewer";
import type { PrescriptionPagePaths } from "@/lib/prescription-media";

type Props = {
  paths: PrescriptionPagePaths;
  /** Ouvert par défaut (ex. avant première saisie). */
  defaultOpen?: boolean;
  viewerRole?: "patient" | "pharmacien";
  className?: string;
  prescriptionNote?: string | null;
  ordonnanceQuickAdd?: {
    lineCount: number;
    onOpenAdd: () => void;
  };
};

export function PrescriptionScanCollapsible({
  paths,
  defaultOpen = false,
  viewerRole = "patient",
  className,
  prescriptionNote,
  ordonnanceQuickAdd,
}: Props) {
  const isPharma = viewerRole === "pharmacien";

  return (
    <details
      open={defaultOpen}
      className={clsx(
        "group rounded-xl border-2 border-amber-200/75 bg-gradient-to-b from-amber-50/35 via-white to-white shadow-sm ring-1 ring-amber-100/80",
        className
      )}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-900">
          <FileImage className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-bold uppercase tracking-wide text-amber-900/90">
            Ordonnance scannée
          </span>
          <span className="block text-[11px] leading-snug text-amber-950/85">
            {isPharma
              ? "Référence pour la saisie — les produits sont listés ci-dessous."
              : "Votre scan pour référence — consultez les produits saisis par la pharmacie."}
          </span>
        </span>
        <ChevronDown
          className="size-4 shrink-0 text-amber-800 transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="border-t border-amber-200/60 px-2 pb-2 pt-1">
        {prescriptionNote?.trim() ? (
          <p className="mb-2 rounded-lg border border-amber-200/60 bg-amber-50/50 px-2.5 py-2 text-[11px] leading-snug text-amber-950">
            <span className="font-semibold">Votre message : </span>
            {prescriptionNote.trim()}
          </p>
        ) : null}
        <PrescriptionImageViewer
          paths={paths}
          accent="amber"
          layout="default"
          allowMobileExpand
          className="border-0 shadow-none ring-0"
          ordonnanceQuickAdd={
            ordonnanceQuickAdd
              ? {
                  lineCount: ordonnanceQuickAdd.lineCount,
                  onOpenAdd: ordonnanceQuickAdd.onOpenAdd,
                  showMainHint: isPharma,
                }
              : undefined
          }
        />
      </div>
    </details>
  );
}
