"use client";

import { clsx } from "clsx";
import { formatDateShortCasablancaWithTime24hFr, formatPlannedVisitFr } from "@/lib/datetime-fr";
import { displayRequestPublicRef } from "@/lib/public-ref";
import type { RequestKindConfig } from "@/lib/request-kinds/types";
import { requestStatusBadgeClass, requestStatusFr } from "@/lib/request-display";

export type RequestKindHeaderRequest = {
  id: string;
  status: string;
  request_public_ref?: string | null;
  submitted_at?: string | null;
  created_at: string;
  patient_planned_visit_date?: string | null;
  patient_planned_visit_time?: string | null;
};

type RequestKindHeaderProps = {
  config: RequestKindConfig;
  request: RequestKindHeaderRequest;
  lineCount?: number | null;
  showPlannedVisit?: boolean;
  viewerRole?: "patient" | "pharmacien";
};

function patientProductStatusBadgeClass(status: string): string {
  if (["submitted", "in_review"].includes(status)) {
    return "border-sky-400/85 bg-sky-100 text-sky-950 ring-1 ring-sky-200/80";
  }
  if (status === "responded") return "border-amber-300/95 bg-amber-50 text-amber-950";
  if (
    ["confirmed", "treated", "completed", "partially_collected", "fully_collected", "in_progress_virtual"].includes(
      status
    )
  ) {
    return "border-teal-400/80 bg-teal-50 text-teal-950";
  }
  if (status === "cancelled") return "border-rose-300/90 bg-rose-50 text-rose-950";
  if (status === "abandoned") return "border-orange-300/85 bg-orange-50 text-orange-950";
  if (status === "expired") return "border-amber-300/90 bg-amber-50 text-amber-950";
  return "border-primary/35 bg-primary/10 text-primary";
}

export function RequestKindHeader({
  config,
  request,
  lineCount,
  showPlannedVisit = false,
  viewerRole = "patient",
}: RequestKindHeaderProps) {
  const shellClass =
    viewerRole === "pharmacien" && config.capabilities.workflowEnabled && config.theme.headerShellForStatus
      ? config.theme.headerShellForStatus(request.status)
      : config.theme.headerShellDefault;

  const showLineBadge =
    lineCount != null && config.capabilities.patientCreatesItems && config.id === "product_request";

  const labelAccent =
    config.theme.accent === "amber"
      ? "text-amber-950/90"
      : config.theme.accent === "violet"
        ? "text-violet-950/90"
        : "text-sky-950/85";

  const lineBadgeBorder =
    config.theme.accent === "amber"
      ? "border-amber-200/90 text-amber-950"
      : config.theme.accent === "violet"
        ? "border-violet-200/90 text-violet-950"
        : "border-sky-200/90 text-sky-950";

  const statusBadgeClass =
    viewerRole === "patient" && config.id === "product_request"
      ? patientProductStatusBadgeClass(request.status)
      : requestStatusBadgeClass(request.status);

  return (
    <header className={shellClass}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] sm:gap-x-2">
          <span className={clsx("shrink-0 font-bold uppercase tracking-wide", labelAccent)}>
            {config.theme.headerLabelShort}
          </span>
          <span className="font-mono text-[11px] font-semibold text-foreground">
            {displayRequestPublicRef(request)}
          </span>
          {showLineBadge && lineCount != null ? (
            <span
              className={clsx(
                "shrink-0 rounded-full border bg-white/90 px-1.5 py-0.5 text-[9px] font-bold tabular-nums",
                lineBadgeBorder
              )}
            >
              {lineCount} ligne{lineCount > 1 ? "s" : ""}
            </span>
          ) : null}
          <span className="text-muted-foreground" aria-hidden>
            ·
          </span>
          <span className="text-muted-foreground">
            Envoyée{" "}
            <span className="font-semibold tabular-nums text-foreground">
              {formatDateShortCasablancaWithTime24hFr(request.submitted_at ?? request.created_at)}
            </span>
          </span>
          {showPlannedVisit ? (
            <>
              <span className="text-muted-foreground" aria-hidden>
                ·
              </span>
              <span className="text-muted-foreground">
                Passage{" "}
                <span className="font-semibold text-foreground">
                  {request.patient_planned_visit_date
                    ? formatPlannedVisitFr(request.patient_planned_visit_date, request.patient_planned_visit_time)
                    : "À définir"}
                </span>
              </span>
            </>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:ms-auto">
          <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Statut</span>
          <span
            className={clsx(
              "inline-flex max-w-[min(100%,16rem)] justify-center truncate rounded-full border px-2 py-0.5 text-center text-[10px] font-bold leading-tight shadow-sm sm:max-w-[14rem]",
              statusBadgeClass
            )}
            title={(requestStatusFr[request.status] ?? request.status) + ""}
          >
            {requestStatusFr[request.status] ?? request.status}
          </span>
        </div>
      </div>
    </header>
  );
}
