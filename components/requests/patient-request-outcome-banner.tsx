"use client";

import type { ReactNode } from "react";
import { clsx } from "clsx";
import { formatDateTimeShort24hFr } from "@/lib/datetime-fr";
import { patientDossierHistoryDetailParagraphsFr } from "@/lib/patient-request-history-audit";
import { historyActorLabel, requestStatusFr } from "@/lib/request-display";
import { patientOutcomeExpiredHint } from "@/lib/request-kinds/hub-and-terminal-copy";
import {
  patientArchiveTerminalActorLineFr,
  patientArchiveTerminalMotiveParagraphsFr,
} from "@/lib/patient-archive-outcome-fr";
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
  /** Infos disponibles à l’écran (officine, lignes, messages) — optionnel. */
  detailContext?: PatientOutcomeDetailContext | null;
  /** Surcharge du texte de clôture (ex. ordonnance). */
  closedFooterNote?: string | null;
  requestKindId?: RequestKindId;
  children?: ReactNode;
}) {
  if (!isPatientProductArchiveStatus(status)) return null;

  const kindId: RequestKindId =
    isRequestKindId(requestKindId) && requestKindId !== "free_consultation" ? requestKindId : "product_request";

  const entry = historyRows.find((h) => h.new_status === status) ?? historyRows[0] ?? null;

  const paras = patientArchiveTerminalMotiveParagraphsFr(entry);
  const actorLine = patientArchiveTerminalActorLineFr(entry);
  const statLabel = requestStatusFr[status] ?? status;

  const theme =
    status === "cancelled"
      ? {
          border: "border-rose-300/85",
          bg: "bg-gradient-to-br from-rose-50/95 via-white to-rose-50/30",
          title: "text-rose-950",
          accent: "text-rose-900/90",
          kicker: "Annulation",
        }
      : status === "abandoned"
        ? {
            border: "border-orange-300/80",
            bg: "bg-gradient-to-br from-orange-50/90 via-white to-amber-50/35",
            title: "text-orange-950",
            accent: "text-orange-950/88",
            kicker: "Abandon",
          }
        : status === "expired"
          ? {
              border: "border-amber-300/85",
              bg: "bg-gradient-to-br from-amber-50/95 via-white to-amber-50/40",
              title: "text-amber-950",
              accent: "text-amber-950/90",
              kicker: "Expiration",
            }
          : status === "partially_collected"
            ? {
                border: "border-teal-300/80",
                bg: "bg-gradient-to-br from-teal-50/90 via-white to-cyan-50/35",
                title: "text-teal-950",
                accent: "text-teal-950/90",
                kicker: "Retrait partiel",
              }
            : status === "fully_collected"
              ? {
                  border: "border-emerald-300/85",
                  bg: "bg-gradient-to-br from-emerald-50/92 via-white to-teal-50/40",
                  title: "text-emerald-950",
                  accent: "text-emerald-950/90",
                  kicker: "Tout retiré",
                }
              : {
                  border: "border-emerald-300/85",
                  bg: "bg-gradient-to-br from-emerald-50/92 via-white to-teal-50/35",
                  title: "text-emerald-950",
                  accent: "text-emerald-950/90",
                  kicker: "Clôture",
                };

  return (
    <section
      className={clsx(
        "rounded-xl border-2 px-3 py-2.5 shadow-md shadow-black/[0.04] ring-1 ring-black/[0.03]",
        theme.border,
        theme.bg
      )}
    >
      <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">État du dossier · {theme.kicker}</p>
      <h2 className={clsx("mt-1 text-sm font-bold leading-snug sm:text-base", theme.title)}>{statLabel}</h2>

      {actorLine && (status === "cancelled" || status === "abandoned" || status === "expired") ? (
        <p className={clsx("mt-2 rounded-md border border-black/[0.06] bg-white/60 px-2.5 py-1.5 text-[11px] font-semibold leading-snug", theme.accent)}>
          {actorLine}
        </p>
      ) : null}

      {detailContext ? (
        <div
          className={clsx(
            "mt-2.5 rounded-lg border border-black/[0.06] bg-white/55 px-2.5 py-2 shadow-sm ring-1 ring-black/[0.03] backdrop-blur-[1px] sm:px-3",
            theme.accent
          )}
        >
          <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Résumé</p>
          <ul className="mt-1.5 space-y-1 text-[11px] leading-snug">
            {detailContext.closedRecap ? (
              <>
                <li>
                  <span className="font-semibold text-foreground">Produits récupérés : </span>
                  {detailContext.closedRecap.pickedUpCount} sur {detailContext.closedRecap.retainedCount} retenu
                  {detailContext.closedRecap.retainedCount !== 1 ? "s" : ""}
                  {detailContext.closedRecap.totalLines !== detailContext.closedRecap.retainedCount ? (
                    <span className="text-muted-foreground">
                      {" "}
                      · {detailContext.closedRecap.totalLines} ligne
                      {detailContext.closedRecap.totalLines !== 1 ? "s" : ""} au total
                    </span>
                  ) : null}
                </li>
                {detailContext.closedRecap.closedAtLabel ? (
                  <li className="tabular-nums">
                    <span className="font-semibold text-foreground">Clôturée le : </span>
                    {detailContext.closedRecap.closedAtLabel}
                  </li>
                ) : null}
              </>
            ) : (
              <>
                {detailContext.pharmacyLine ? (
                  <li>
                    <span className="font-semibold text-foreground">Officine : </span>
                    {detailContext.pharmacyLine}
                  </li>
                ) : null}
                <li>
                  <span className="font-semibold text-foreground">
                    {detailContext.linesMode === "prescription" ? "Produits saisis : " : "Lignes : "}
                  </span>
                  {detailContext.linesMode === "prescription" ? (
                    <>
                      {detailContext.totalLines} produit{detailContext.totalLines !== 1 ? "s" : ""} sur l’ordonnance
                      {detailContext.retainedCount !== detailContext.totalLines ? (
                        <span className="text-muted-foreground">
                          {" "}
                          · {detailContext.retainedCount} retenu{detailContext.retainedCount !== 1 ? "s" : ""} lors de
                          votre validation
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <>
                      {detailContext.retainedCount} produit{detailContext.retainedCount !== 1 ? "s" : ""} retenu
                      {detailContext.retainedCount !== 1 ? "s" : ""}
                      {detailContext.totalLines !== detailContext.retainedCount ? (
                        <span className="text-muted-foreground">
                          {" "}
                          · {detailContext.totalLines - detailContext.retainedCount} autre
                          {detailContext.totalLines - detailContext.retainedCount > 1 ? "s" : ""} non retenu
                          {detailContext.totalLines - detailContext.retainedCount > 1 ? "s" : ""}
                        </span>
                      ) : null}
                    </>
                  )}
                </li>
              </>
            )}
            {detailContext.hasConversationMessages ? (
              <li className="text-muted-foreground">Des messages d&apos;échange patient / officine sont conservés (conversation).</li>
            ) : null}
            {detailContext.lastUpdatedLabel ? (
              <li className="tabular-nums text-muted-foreground">
                Dernière mise à jour enregistrée :{" "}
                <span className="font-medium text-foreground">{detailContext.lastUpdatedLabel}</span>
              </li>
            ) : null}
          </ul>
          <p className={clsx("mt-2 border-t border-black/[0.05] pt-2 text-[10px] leading-snug text-muted-foreground")}>
            {status === "cancelled"
              ? "Demande annulée — consultation seule. Les produits ci-dessous reprennent l’état du dossier avant fermeture."
              : status === "abandoned"
                ? "Demande abandonnée — consultation seule. Les produits ci-dessous reprennent l’état du dossier avant fermeture."
                : status === "expired"
                  ? "Demande expirée — vous n’avez pas validé à temps. Les produits ci-dessous reprennent la réponse de la pharmacie."
                  : status === "partially_collected"
                    ? "Une partie des produits retenus a été retirée au comptoir ; le reste figure comme non retiré dans l’archive."
                    : status === "fully_collected"
                      ? "Tous les produits retenus ont été enregistrés comme retirés au comptoir."
                      : (closedFooterNote ??
                        "Le dossier est clos côté officine. Les montants et libellés reflètent l’état au moment de la clôture.")}
          </p>
        </div>
      ) : null}

      {status === "expired" && paras.length === 0 ? (
        <p className={clsx("mt-2 text-[11px] leading-snug", theme.accent)}>{patientOutcomeExpiredHint(kindId)}</p>
      ) : null}

      {paras.length > 0 ? (
        <div className={clsx("mt-2 space-y-1.5 text-[11px] leading-snug", theme.accent)}>
          {paras.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      ) : entry && status !== "expired" ? (
        <p className={clsx("mt-2 text-[11px] leading-snug", theme.accent)}>
          Dernier enregistrement le {formatDateTimeShort24hFr(entry.created_at)}.
        </p>
      ) : !entry && status !== "expired" ? (
        <p className={clsx("mt-2 text-[11px] leading-snug", theme.accent)}>
          Ce dossier est fermé. L’historique du dossier en bas de page reprend les étapes et précisions enregistrées.
        </p>
      ) : null}

      {entry && !actorLine && status !== "expired" ? (
        <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[9px] text-muted-foreground">
          <span>
            <strong className="font-medium text-foreground">{historyActorLabel("patient", entry.reason)}</strong>
          </span>
          <span aria-hidden>·</span>
          <time dateTime={entry.created_at} className="tabular-nums">
            {formatDateTimeShort24hFr(entry.created_at)}
          </time>
        </p>
      ) : null}

      {children ? <div className="mt-3">{children}</div> : null}
    </section>
  );
}
