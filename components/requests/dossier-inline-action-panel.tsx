"use client";

import type { ReactNode } from "react";
import { clsx } from "clsx";
import { PlatformStickyFooterSummaryRow } from "@/components/layout/platform-sticky-footer";
import type { StickyFooterTone } from "@/lib/platform-sticky-footer";
import { stickyFooterToneBorderClass } from "@/lib/platform-sticky-footer";

type DossierInlineActionPanelProps = {
  children: ReactNode;
  tone?: StickyFooterTone;
  className?: string;
  summaryLeft?: ReactNode;
  summaryRight?: ReactNode;
};

export function DossierInlineActionPanel({
  children,
  tone = "neutral",
  className,
  summaryLeft,
  summaryRight,
}: DossierInlineActionPanelProps) {
  return (
    <section
      className={clsx(
        "mt-4 w-full min-w-0 rounded-xl border bg-card p-3 shadow-sm",
        stickyFooterToneBorderClass(tone),
        className
      )}
    >
      {summaryLeft != null && summaryRight != null ? (
        <PlatformStickyFooterSummaryRow left={summaryLeft} right={summaryRight} />
      ) : null}
      <div className={clsx(summaryLeft != null && summaryRight != null && "mt-2")}>{children}</div>
    </section>
  );
}
