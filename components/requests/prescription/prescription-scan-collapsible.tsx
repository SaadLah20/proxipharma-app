"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { ChevronDown, FileImage } from "lucide-react";
import { PrescriptionImageViewer } from "@/components/requests/prescription/prescription-image-viewer";
import type { PrescriptionPagePaths } from "@/lib/prescription-media";

type Props = {
  paths: PrescriptionPagePaths;
  id?: string;
  /** Ouvert par défaut (ex. avant première saisie). */
  defaultOpen?: boolean;
  className?: string;
  ordonnanceQuickAdd?: {
    lineCount: number;
    onOpenAdd: () => void;
  };
  controlledLightbox?: { label: string; url: string } | null;
  onControlledLightboxChange?: (next: { label: string; url: string } | null) => void;
  controlledActiveTab?: 1 | 2;
  onControlledActiveTabChange?: (tab: 1 | 2) => void;
};

export function PrescriptionScanCollapsible({
  paths,
  id = "prescription-scan-panel",
  defaultOpen = false,
  className,
  ordonnanceQuickAdd,
  controlledLightbox,
  onControlledLightboxChange,
  controlledActiveTab,
  onControlledActiveTabChange,
}: Props) {
  const [panelOpen, setPanelOpen] = useState(defaultOpen);

  return (
    <details
      id={id}
      open={panelOpen}
      className={clsx(
        "group rounded-xl border-2 border-amber-200/75 bg-gradient-to-b from-amber-50/35 via-white to-white shadow-sm ring-1 ring-amber-100/80",
        className
      )}
    >
      <summary
        className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 marker:content-none [&::-webkit-details-marker]:hidden"
        onClick={(e) => {
          e.preventDefault();
          setPanelOpen((open) => !open);
        }}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-900">
          <FileImage className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1 text-[10px] font-bold uppercase tracking-wide text-amber-900/90">
          Ordonnance scannée
        </span>
        <ChevronDown
          className="size-4 shrink-0 text-amber-800 transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="border-t border-amber-200/60 px-2 pb-2 pt-1">
        <PrescriptionImageViewer
          paths={paths}
          accent="amber"
          layout="default"
          allowMobileExpand
          className="border-0 shadow-none ring-0"
          controlledLightbox={controlledLightbox}
          onControlledLightboxChange={onControlledLightboxChange}
          controlledActiveTab={controlledActiveTab}
          onControlledActiveTabChange={onControlledActiveTabChange}
          ordonnanceQuickAdd={
            ordonnanceQuickAdd
              ? {
                  lineCount: ordonnanceQuickAdd.lineCount,
                  onOpenAdd: ordonnanceQuickAdd.onOpenAdd,
                }
              : undefined
          }
        />
      </div>
    </details>
  );
}
