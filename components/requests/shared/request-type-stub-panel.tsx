"use client";

import type { RequestKindConfig } from "@/lib/request-kinds/types";

type RequestTypeStubPanelProps = {
  config: RequestKindConfig;
  viewerRole: "patient" | "pharmacien";
};

export function RequestTypeStubPanel({ config, viewerRole }: RequestTypeStubPanelProps) {
  const message =
    viewerRole === "patient" ? config.copy.patientNotEnabledMessage : config.copy.pharmacistNotEnabledMessage;
  if (!message.trim()) return null;

  const borderClass =
    config.theme.accent === "amber"
      ? "border-amber-200/80 bg-amber-50/40 text-amber-950"
      : config.theme.accent === "violet"
        ? "border-violet-200/80 bg-violet-50/40 text-violet-950"
        : "border-border bg-muted/30 text-muted-foreground";

  return (
    <p className={`mt-2 rounded-md border p-2.5 text-[11px] leading-snug ${borderClass}`}>{message}</p>
  );
}
