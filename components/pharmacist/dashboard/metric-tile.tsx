"use client";

import Link from "next/link";
import { clsx } from "clsx";
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { platformDashboardChrome as chrome } from "@/lib/platform-dashboard-chrome";

export function DashboardMetricTile({
  icon: Icon,
  label,
  value,
  hint,
  href,
  muted = false,
  emphasize = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  hint?: string;
  href: string;
  muted?: boolean;
  emphasize?: boolean;
}) {
  return (
    <Link
      href={href}
      className={clsx(
        "group flex min-h-[5.25rem] flex-col justify-between rounded-xl border bg-card p-3 shadow-sm transition",
        chrome.cardHover,
        muted && !emphasize && "opacity-80",
        emphasize && "border-amber-300/80 bg-amber-50/40 ring-1 ring-amber-200/60"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={chrome.statLabel}>{label}</p>
          <p className={clsx(chrome.statValue, "text-xl sm:text-2xl")}>{value}</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-1.5">
          <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={2} aria-hidden />
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        {hint ? <p className="truncate text-[11px] text-muted-foreground">{hint}</p> : <span />}
        <span className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-semibold text-primary">
          Voir tout
          <ChevronRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" aria-hidden />
        </span>
      </div>
    </Link>
  );
}
