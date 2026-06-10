"use client";

import type { ReactNode } from "react";
import { clsx } from "clsx";
import { useLocale, useTranslations } from "next-intl";
import { formatDateTimeShortForLocale } from "@/lib/datetime-locale";
import type { AppLocale } from "@/lib/i18n/config";
import { usePatientRequestStatusLabel } from "@/lib/i18n/patient-request-status-label";
import { patientDossierHistoryDetailParagraphsFr } from "@/lib/patient-request-history-audit";
import { usePatientArchiveOutcomeCopy } from "@/lib/i18n/use-patient-archive-outcome-copy";
import { isRequestKindId } from "@/lib/request-kinds/registry";
import type { RequestKindId } from "@/lib/request-kinds/types";

export const PATIENT_PRODUCT_ARCHIVE_STATUSES = [
  "cancelled",
  "abandoned",
  "expired",
  "completed",
  "partially_collected",
  "fully_collected",
] as const;

export type PatientProductArchiveStatus = (typeof PATIENT_PRODUCT_ARCHIVE_STATUSES)[number];

export function isPatientProductArchiveStatus(status: string): status is PatientProductArchiveStatus {
  return (PATIENT_PRODUCT_ARCHIVE_STATUSES as readonly string[]).includes(status);
}

export type OutcomeHistoryRow = {
  id: string;
  created_at: string;
  old_status: string | null;
  new_status: string;
  reason: string | null;
};

/** Résumé structuré pour le bandeau dossier terminé (lecture seule). */
export type PatientOutcomeDetailContext = {
  pharmacyLine: string | null;
  retainedCount: number;
  totalLines: number;
  /** Au moins un message dans le fil conversation (hors interne). */
  hasConversationMessages: boolean;
  lastUpdatedLabel: string | null;
  /** Libellés lignes : défaut = demande produits. */
  linesMode?: "product" | "prescription";
  /** Clôture comptoir (completed / partially_collected / fully_collected). */
  closedRecap?: {
    pickedUpCount: number;
    retainedCount: number;
    totalLines: number;
    closedAtLabel: string;
  };
};

function archiveHubKey(status: PatientProductArchiveStatus): string {
  if (status === "partially_collected") return "partially_collected";
  if (status === "fully_collected") return "fully_collected";
  if (status === "completed") return "completed";
  return status;
}

function outcomeKickerKey(status: PatientProductArchiveStatus): string {
  switch (status) {
    case "cancelled":
      return "cancellation";
    case "abandoned":
      return "abandonment";
    case "expired":
      return "expiration";
    case "partially_collected":
      return "partialPickup";
    case "fully_collected":
      return "fullPickup";
    default:
      return "closure";
  }
}

/**
 * Bloc mis en avant en tête de fiche patient pour dossiers produits terminés
 * (annulé, abandonné, expiré, clôturé).
 */
export function PatientRequestOutcomeBanner({
  status,
  historyRows,
  detailContext,
  closedFooterNote,
  requestKindId = "product_request",
  children,
}: {
  status: string;
  historyRows: OutcomeHistoryRow[];
  /** Infos disponibles à l'écran (officine, lignes, messages) — optionnel. */
  detailContext?: PatientOutcomeDetailContext | null;
  /** Surcharge du texte de clôture (ex. ordonnance). */
  closedFooterNote?: string | null;
  requestKindId?: RequestKindId;
  children?: ReactNode;
}) {
  const locale = useLocale() as AppLocale;
  const tOutcome = useTranslations("demandes.archive.outcome");
  const tHubArchive = useTranslations("hub.archive");
  const statLabel = usePatientRequestStatusLabel(status);
  const archiveCopy = usePatientArchiveOutcomeCopy();

  if (!isPatientProductArchiveStatus(status)) return null;

  const kindId: RequestKindId =
    isRequestKindId(requestKindId) && requestKindId !== "free_consultation" ? requestKindId : "product_request";

  const entry = historyRows.find((h) => h.new_status === status) ?? historyRows[0] ?? null;

  const paras = entry?.reason ? patientDossierHistoryDetailParagraphsFr(entry.reason) : [];
  const actorLine = archiveCopy.terminalActorLine(entry);
  const hubKey = archiveHubKey(status);
  const kicker = tOutcome(`kickers.${outcomeKickerKey(status)}`);

  const theme =
    status === "cancelled"
      ? { title: "text-rose-950", accent: "text-rose-900/90" }
      : status === "abandoned"
        ? { title: "text-orange-950", accent: "text-orange-950/88" }
        : status === "expired"
          ? { title: "text-amber-950", accent: "text-amber-950/90" }
          : status === "partially_collected"
            ? { title: "text-teal-950", accent: "text-teal-950/90" }
            : status === "fully_collected"
              ? { title: "text-emerald-950", accent: "text-emerald-950/90" }
              : { title: "text-emerald-950", accent: "text-emerald-950/90" };

  const footerNote =
    status === "cancelled"
      ? tOutcome("footerCancelled")
      : status === "abandoned"
        ? tOutcome("footerAbandoned")
        : status === "expired"
          ? tOutcome("footerExpired")
          : status === "partially_collected"
            ? tOutcome("footerPartiallyCollected")
            : status === "fully_collected"
              ? tOutcome("footerFullyCollected")
              : (closedFooterNote ?? tHubArchive(`${hubKey}.lede`));

  return (
    <section className="rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm">
      <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
        {tOutcome("stateLabel", { kicker })}
      </p>
      <h2 className={clsx("mt-1 text-sm font-bold leading-snug sm:text-base", theme.title)}>{statLabel}</h2>
      <p className={clsx("mt-1 text-[11px] leading-snug", theme.accent)}>{tHubArchive(`${hubKey}.lede`)}</p>

      {actorLine && (status === "cancelled" || status === "abandoned" || status === "expired") ? (
        <p className={clsx("mt-2 rounded-md border border-border bg-muted/25 px-2.5 py-1.5 text-[11px] font-semibold leading-snug", theme.accent)}>
          {actorLine}
        </p>
      ) : null}

      {detailContext ? (
        <div className={clsx("mt-2.5 rounded-lg border border-border bg-muted/20 px-2.5 py-2 sm:px-3", theme.accent)}>
          <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{tOutcome("summary")}</p>
          <ul className="mt-1.5 space-y-1 text-[11px] leading-snug">
            {detailContext.closedRecap ? (
              <>
                <li>
                  <span className="font-semibold text-foreground">{tOutcome("productsPickedUp")}</span>
                  {detailContext.closedRecap.retainedCount === 1
                    ? tOutcome("pickedUpOfRetained", {
                        picked: detailContext.closedRecap.pickedUpCount,
                        retained: detailContext.closedRecap.retainedCount,
                      })
                    : tOutcome("pickedUpOfRetainedPlural", {
                        picked: detailContext.closedRecap.pickedUpCount,
                        retained: detailContext.closedRecap.retainedCount,
                      })}
                  {detailContext.closedRecap.totalLines !== detailContext.closedRecap.retainedCount ? (
                    <span className="text-muted-foreground">
                      {detailContext.closedRecap.totalLines === 1
                        ? tOutcome("totalLines", { count: detailContext.closedRecap.totalLines })
                        : tOutcome("totalLinesPlural", { count: detailContext.closedRecap.totalLines })}
                    </span>
                  ) : null}
                </li>
                {detailContext.closedRecap.closedAtLabel ? (
                  <li className="tabular-nums">
                    <span className="font-semibold text-foreground">{tOutcome("closedAt")}</span>
                    {detailContext.closedRecap.closedAtLabel}
                  </li>
                ) : null}
              </>
            ) : (
              <>
                {detailContext.pharmacyLine ? (
                  <li>
                    <span className="font-semibold text-foreground">{tOutcome("pharmacy")}</span>
                    {detailContext.pharmacyLine}
                  </li>
                ) : null}
                <li>
                  <span className="font-semibold text-foreground">
                    {detailContext.linesMode === "prescription" ? tOutcome("prescriptionProducts") : tOutcome("lines")}
                  </span>
                  {detailContext.linesMode === "prescription" ? (
                    <>
                      {detailContext.totalLines === 1
                        ? tOutcome("prescriptionCount", { count: detailContext.totalLines })
                        : tOutcome("prescriptionCountPlural", { count: detailContext.totalLines })}
                      {detailContext.retainedCount !== detailContext.totalLines ? (
                        <span className="text-muted-foreground">
                          {detailContext.retainedCount === 1
                            ? tOutcome("retainedOnValidation", { count: detailContext.retainedCount })
                            : tOutcome("retainedOnValidationPlural", { count: detailContext.retainedCount })}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <>
                      {detailContext.retainedCount === 1
                        ? tOutcome("retainedProducts", { count: detailContext.retainedCount })
                        : tOutcome("retainedProductsPlural", { count: detailContext.retainedCount })}
                      {detailContext.totalLines !== detailContext.retainedCount ? (
                        <span className="text-muted-foreground">
                          {detailContext.totalLines - detailContext.retainedCount === 1
                            ? tOutcome("otherNotRetained", {
                                count: detailContext.totalLines - detailContext.retainedCount,
                              })
                            : tOutcome("otherNotRetainedPlural", {
                                count: detailContext.totalLines - detailContext.retainedCount,
                              })}
                        </span>
                      ) : null}
                    </>
                  )}
                </li>
              </>
            )}
            {detailContext.hasConversationMessages ? (
              <li className="text-muted-foreground">{tOutcome("conversationKept")}</li>
            ) : null}
            {detailContext.lastUpdatedLabel ? (
              <li className="tabular-nums text-muted-foreground">
                {tOutcome("lastUpdate")}
                <span className="font-medium text-foreground">{detailContext.lastUpdatedLabel}</span>
              </li>
            ) : null}
          </ul>
          <p className="mt-2 border-t border-border/60 pt-2 text-[10px] leading-snug text-muted-foreground">{footerNote}</p>
        </div>
      ) : null}

      {status === "expired" && paras.length === 0 ? (
        <p className={clsx("mt-2 text-[11px] leading-snug", theme.accent)}>{archiveCopy.expiredOutcomeHint(kindId)}</p>
      ) : null}

      {paras.length > 0 ? (
        <div className={clsx("mt-2 space-y-1.5 text-[11px] leading-snug", theme.accent)}>
          {paras.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      ) : entry && status !== "expired" ? (
        <p className={clsx("mt-2 text-[11px] leading-snug", theme.accent)}>
          {tOutcome("lastRecorded", {
            date: formatDateTimeShortForLocale(entry.created_at, locale),
          })}
        </p>
      ) : !entry && status !== "expired" ? (
        <p className={clsx("mt-2 text-[11px] leading-snug", theme.accent)}>{tOutcome("closedNoHistory")}</p>
      ) : null}

      {entry && !actorLine && status !== "expired" ? (
        <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[9px] text-muted-foreground">
          <span>
            <strong className="font-medium text-foreground">{archiveCopy.patientHistoryActorLabel(entry.reason)}</strong>
          </span>
          <span aria-hidden>·</span>
          <time dateTime={entry.created_at} className="tabular-nums">
            {formatDateTimeShortForLocale(entry.created_at, locale)}
          </time>
        </p>
      ) : null}

      {children ? <div className="mt-3">{children}</div> : null}
    </section>
  );
}
