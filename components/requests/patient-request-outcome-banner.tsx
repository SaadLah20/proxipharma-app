"use client";

import type { ReactNode } from "react";
import { clsx } from "clsx";
import { formatDateTimeShort24hFr } from "@/lib/datetime-fr";
import { patientDossierHistoryDetailParagraphsFr } from "@/lib/patient-request-history-audit";
import { historyActorLabel, requestStatusFr } from "@/lib/request-display";

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

/**
 * Bloc mis en avant en tête de fiche patient pour dossiers produits terminés
 * (annulé, abandonné, expiré, clôturé).
 */
export function PatientRequestOutcomeBanner({
  status,
  historyRows,
  children,
}: {
  status: string;
  historyRows: OutcomeHistoryRow[];
  children?: ReactNode;
}) {
  if (!isPatientProductArchiveStatus(status)) return null;

  const entry = historyRows.find((h) => h.new_status === status) ?? historyRows[0] ?? null;

  const paras = entry ? patientDossierHistoryDetailParagraphsFr(entry.reason) : [];
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

      {status === "expired" && paras.length === 0 ? (
        <p className={clsx("mt-2 text-[11px] leading-snug", theme.accent)}>
          Vous n&apos;avez pas validé la réponse de la pharmacie dans le délai prévu. Vous pouvez créer une nouvelle demande avec les
          mêmes produits si besoin.
        </p>
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

      {entry ? (
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
