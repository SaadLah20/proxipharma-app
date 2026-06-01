"use client";

import { clsx } from "clsx";
import { formatDateShortCasablancaWithTime24hFr, formatPlannedVisitFr } from "@/lib/datetime-fr";
import { displayRequestPublicRef } from "@/lib/public-ref";
import type { RequestKindConfig } from "@/lib/request-kinds/types";
import { requestStatusBadgeClass, requestStatusFr } from "@/lib/request-display";
import { uiEyebrowLabel, uiSecondaryLabel } from "@/lib/ui-label-styles";

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
  /** Court paragraphe sous le bandeau (ex. dossier clôturé / expiré). */
  statusDetail?: string | null;
};

export function RequestKindHeader({
  config,
  request,
  lineCount,
  showPlannedVisit = false,
  viewerRole = "patient",
  statusDetail = null,
}: RequestKindHeaderProps) {
  const shellClass =
    viewerRole === "pharmacien" && config.capabilities.workflowEnabled && config.theme.headerShellForStatus
      ? config.theme.headerShellForStatus(request.status)
      : config.theme.headerShellDefault;

  const showLineBadge =
    lineCount != null && config.capabilities.patientCreatesItems && config.id === "product_request";

  return (
    <header className={shellClass}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] sm:gap-x-2 sm:text-xs">
          <span className={clsx("shrink-0 sm:text-[11px]", uiEyebrowLabel)}>{config.theme.headerLabelShort}</span>
          <span className="font-mono text-[12px] font-semibold text-foreground sm:text-[13px]">
            {displayRequestPublicRef(request)}
          </span>
          {showLineBadge && lineCount != null ? (
            <span className={uiSecondaryLabel}>
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
        <div className="flex shrink-0 items-center sm:ms-auto">
          <span
            className={clsx(
              "inline-flex max-w-[min(100%,16rem)] justify-center truncate text-center shadow-sm",
              requestStatusBadgeClass(request.status)
            )}
            title={(requestStatusFr[request.status] ?? request.status) + ""}
          >
            {requestStatusFr[request.status] ?? request.status}
          </span>
        </div>
      </div>
      {statusDetail?.trim() ? (
        <p className="mt-2 border-t border-border/50 pt-2 text-[11px] leading-snug text-muted-foreground">{statusDetail}</p>
      ) : null}
    </header>
  );
}
