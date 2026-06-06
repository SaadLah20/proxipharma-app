import { formatDateTimeShort24hFr } from "@/lib/datetime-fr";
import { formatDateTimeShortForLocale } from "@/lib/datetime-locale";
import { collectProductLineEvents } from "@/lib/product-line-history/collect-line-events";
import { LINE_HISTORY_PHASE_LABELS } from "@/lib/product-line-history/line-event-labels-fr";
import type {
  ProductLineHistoryBlockFr,
  ProductLineHistoryContext,
} from "@/lib/product-line-history/types";

/** Convertit le contexte en blocs UI avec chapitres. */
export function buildProductLineHistoryBlocksFr(ctx: ProductLineHistoryContext): ProductLineHistoryBlockFr[] {
  const events = collectProductLineEvents(ctx);
  const audience = ctx.audience;
  let lastPhase: string | null = null;

  return events.map((e, i) => {
    const phaseLabel =
      ctx.phaseLabels?.[e.phase] ?? LINE_HISTORY_PHASE_LABELS[e.phase][audience];
    const isPhaseStart = e.phase !== lastPhase;
    lastPhase = e.phase;

    return {
      id: e.id || `line-hist-${i + 1}`,
      atIso: e.atIso,
      atLabel: ctx.locale
        ? formatDateTimeShortForLocale(e.atIso, ctx.locale)
        : formatDateTimeShort24hFr(e.atIso),
      title: e.title,
      body: e.bodyLines.join("\n"),
      actorLabel: e.actorLabel,
      actorTone: e.actorTone,
      isCurrent: e.isCurrent,
      phase: e.phase,
      phaseLabel,
      isPhaseStart,
    };
  });
}

export type { ProductLineHistoryContext, ProductLineHistoryBlockFr };
