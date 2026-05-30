"use client";

import { clsx } from "clsx";
import type { FormattedHistoryEventFr, HistoryActorTone } from "@/lib/request-history-fr";
import type { LineHistoryPhase } from "@/lib/product-line-history/types";

export type HistoryTimelineBlockFr = {
  id: string;
  atIso: string | null;
  atLabel: string;
  title: string;
  body: string;
  actorLabel: string;
  actorTone?: HistoryActorTone;
  isCurrent?: boolean;
  phase?: LineHistoryPhase;
  phaseLabel?: string;
  isPhaseStart?: boolean;
};

function actorToneClasses(tone: HistoryActorTone | undefined, isCurrent?: boolean): string {
  if (isCurrent) return "border-emerald-300/90 bg-emerald-50 text-emerald-950";
  switch (tone) {
    case "patient":
      return "border-sky-300/85 bg-sky-50/90 text-sky-950";
    case "pharmacy":
      return "border-violet-300/80 bg-violet-50/85 text-violet-950";
    case "system":
      return "border-slate-300/80 bg-slate-50/90 text-slate-800";
    default:
      return "border-border/80 bg-muted/25 text-foreground";
  }
}

function actorBadgeClasses(tone: HistoryActorTone | undefined): string {
  switch (tone) {
    case "patient":
      return "bg-sky-700 text-white";
    case "pharmacy":
      return "bg-violet-700 text-white";
    case "system":
      return "bg-slate-600 text-white";
    default:
      return "bg-muted-foreground text-background";
  }
}

function phaseAccentClasses(phase: LineHistoryPhase | undefined): string {
  switch (phase) {
    case "origin":
      return "text-sky-800/90";
    case "response":
      return "text-violet-800/90";
    case "validation":
      return "text-indigo-800/90";
    case "preparation":
      return "text-amber-900/85";
    case "counter":
      return "text-teal-800/90";
    case "epilogue":
      return "text-emerald-800/90";
    default:
      return "text-muted-foreground";
  }
}

function blocksFromDossierEvents(events: FormattedHistoryEventFr[]): HistoryTimelineBlockFr[] {
  return events.map((e) => ({
    id: e.id,
    atIso: e.atIso,
    atLabel: e.atLabel,
    title: e.headline,
    body: e.detailLines.join("\n"),
    actorLabel: e.actorLabel,
    actorTone: e.actorTone,
    isCurrent: false,
  }));
}

export function HistoryTimelineFr({
  blocks,
  dossierEvents,
  emptyLabel = "Aucun événement à afficher pour le moment.",
  className,
  showPhaseChapters = true,
}: {
  blocks?: HistoryTimelineBlockFr[];
  dossierEvents?: FormattedHistoryEventFr[];
  emptyLabel?: string;
  className?: string;
  /** Affiche les en-têtes de chapitre (Début, Réponse, Préparation…). */
  showPhaseChapters?: boolean;
}) {
  const list = blocks ?? (dossierEvents ? blocksFromDossierEvents(dossierEvents) : []);

  if (list.length === 0) {
    return <p className="text-[12px] leading-snug text-muted-foreground">{emptyLabel}</p>;
  }

  const hasPhases = showPhaseChapters && list.some((b) => b.phase && b.isPhaseStart);

  return (
    <ol className={clsx("relative ms-1.5 space-y-2.5 border-s border-border/80 ps-4", className)}>
      {list.map((b) => (
        <li key={b.id} className="relative">
          {hasPhases && b.isPhaseStart && b.phaseLabel ? (
            <p
              className={clsx(
                "-ms-4 mb-1.5 text-[9px] font-bold uppercase tracking-wider",
                phaseAccentClasses(b.phase)
              )}
            >
              {b.phaseLabel}
            </p>
          ) : null}
          <span
            className={clsx(
              "absolute -start-[21px] top-3 size-2.5 rounded-full border-2 bg-background shadow-sm",
              b.isCurrent ? "border-emerald-500" : "border-muted-foreground/35"
            )}
            aria-hidden
          />
          <article
            className={clsx(
              "rounded-lg border px-2.5 py-2 shadow-sm sm:px-3",
              actorToneClasses(b.actorTone, b.isCurrent)
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
              <h4 className="min-w-0 flex-1 text-[12px] font-semibold leading-snug">{b.title}</h4>
              {!b.isCurrent && b.atLabel ? (
                <time
                  className="shrink-0 text-[10px] font-medium tabular-nums text-muted-foreground"
                  dateTime={b.atIso ?? undefined}
                >
                  {b.atLabel}
                </time>
              ) : null}
            </div>
            <p className="mt-1.5">
              <span
                className={clsx(
                  "inline-flex rounded-full px-1.5 py-px text-[9px] font-bold uppercase tracking-wide",
                  actorBadgeClasses(b.actorTone)
                )}
              >
                {b.actorLabel}
              </span>
            </p>
            {b.body.trim() ? (
              <div className="mt-2 space-y-1 text-[11px] leading-relaxed text-foreground/95">
                {b.body.split("\n").map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            ) : null}
          </article>
        </li>
      ))}
    </ol>
  );
}
