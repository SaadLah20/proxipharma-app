"use client";

import Link from "next/link";
import { CalendarRange, ChevronRight } from "lucide-react";
import { clsx } from "clsx";
import {
  formatOnCallRangeFr,
  onCallKindLabelFr,
  type PharmacistDashboardSnapshot,
} from "@/lib/pharmacist-dashboard";
import { platformDashboardChrome as chrome } from "@/lib/platform-dashboard-chrome";

const HORAIRES_PATH = "/dashboard/pharmacien/horaires-garde";

export function PharmacistDashboardGardeBanner({ snapshot }: { snapshot: PharmacistDashboardSnapshot }) {
  const { schedule } = snapshot;
  const onCall = schedule.next_on_call;
  const activeToday = schedule.on_call_active_today;

  if (!onCall) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-dashed border-border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-card p-2 shadow-sm">
            <CalendarRange className="h-5 w-5 text-muted-foreground" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Prochaine garde</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Renseignez vos périodes de garde pour informer les patients sur l&apos;annuaire.
            </p>
          </div>
        </div>
        <Link href={HORAIRES_PATH} className={clsx(chrome.ctaOutline, "inline-flex shrink-0 items-center gap-1 text-center")}>
          Configurer la garde
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    );
  }

  const rangeLabel = formatOnCallRangeFr(onCall.starts_at, onCall.ends_at);

  return (
    <Link
      href={HORAIRES_PATH}
      className={clsx(
        "flex flex-col gap-2 rounded-xl border p-4 shadow-sm transition hover:shadow-md sm:flex-row sm:items-center sm:justify-between",
        activeToday
          ? "border-emerald-300/80 bg-emerald-50/50 hover:border-emerald-400/80"
          : "border-border bg-card hover:border-primary/25"
      )}
    >
      <div className="flex items-start gap-3">
        <div className={clsx("rounded-lg p-2 shadow-inner", activeToday ? "bg-emerald-100/80" : "bg-muted/40")}>
          <CalendarRange
            className={clsx("h-5 w-5", activeToday ? "text-emerald-800" : "text-muted-foreground")}
            aria-hidden
          />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">
              {activeToday ? "Garde en cours" : "Prochaine garde"}
            </p>
            {activeToday ? (
              <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                Aujourd&apos;hui
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs font-medium text-foreground">{onCallKindLabelFr(onCall.kind)}</p>
          {rangeLabel ? <p className="mt-0.5 text-xs text-muted-foreground">{rangeLabel}</p> : null}
          {onCall.note?.trim() ? (
            <p className="mt-1 text-[11px] text-muted-foreground">{onCall.note.trim()}</p>
          ) : null}
        </div>
      </div>
      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary">
        Horaires et garde
        <ChevronRight className="h-4 w-4" aria-hidden />
      </span>
    </Link>
  );
}
