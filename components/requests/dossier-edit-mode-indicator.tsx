"use client";

import { clsx } from "clsx";
import { dossierEditModeBannerClass } from "@/lib/dossier-edit-mode-ui";
import type { StickyFooterTone } from "@/lib/platform-sticky-footer";

export function DossierEditModeIndicator({
  active,
  tone = "neutral",
  title = "Modification en cours",
  hint = "Enregistrez ou annulez en bas de la page",
  className,
  sticky = false,
}: {
  active: boolean;
  tone?: StickyFooterTone;
  title?: string;
  hint?: string;
  className?: string;
  /** Colle sous le header dossier sur mobile long scroll. */
  sticky?: boolean;
}) {
  if (!active) return null;

  return (
    <section
      role="status"
      aria-live="polite"
      className={clsx(
        "rounded-lg border px-2.5 py-1.5 text-center text-[10px] leading-snug shadow-sm",
        dossierEditModeBannerClass(tone),
        sticky && "sticky top-0 z-20",
        className,
      )}
    >
      <p className="font-bold">{title}</p>
      <p className="mt-0.5 opacity-90">{hint}</p>
    </section>
  );
}
