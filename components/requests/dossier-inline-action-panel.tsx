"use client";

import type { ReactNode } from "react";
import { clsx } from "clsx";
import { PlatformStickyFooterSummaryRow } from "@/components/layout/platform-sticky-footer";
import {
  dossierEditModePanelClass,
  dossierEditModePanelLabelClass,
} from "@/lib/dossier-edit-mode-ui";
import type { StickyFooterTone } from "@/lib/platform-sticky-footer";
import { stickyFooterToneBorderClass } from "@/lib/platform-sticky-footer";

export const DOSSIER_INLINE_ACTIONS_ID = "dossier-inline-actions";

type DossierInlineActionPanelProps = {
  children: ReactNode;
  tone?: StickyFooterTone;
  className?: string;
  summaryLeft?: ReactNode;
  summaryRight?: ReactNode;
  /** Accentue le panneau quand le dossier est en mode modification. */
  editing?: boolean;
  editingLabel?: string;
};

export function DossierInlineActionPanel({
  children,
  tone = "neutral",
  className,
  summaryLeft,
  summaryRight,
  editing = false,
  editingLabel = "Enregistrement",
}: DossierInlineActionPanelProps) {
  return (
    <section
      id={DOSSIER_INLINE_ACTIONS_ID}
      className={clsx(
        "mt-4 w-full min-w-0 rounded-xl border bg-card p-3 shadow-sm",
        editing ? dossierEditModePanelClass(tone) : stickyFooterToneBorderClass(tone),
        className,
      )}
    >
      {editing ? (
        <p
          className={clsx(
            "mb-2 text-[10px] font-bold uppercase tracking-wide",
            dossierEditModePanelLabelClass(tone),
          )}
        >
          {editingLabel}
        </p>
      ) : null}
      {summaryLeft != null && summaryRight != null ? (
        <PlatformStickyFooterSummaryRow left={summaryLeft} right={summaryRight} />
      ) : null}
      <div className={clsx(summaryLeft != null && summaryRight != null && "mt-2")}>{children}</div>
    </section>
  );
}
