"use client";

import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";

export function SettingsNavLink({
  href,
  label,
  hint,
  icon: Icon,
}: {
  href: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted/40"
    >
      <span className="inline-flex min-w-0 items-center gap-2">
        <Icon className="size-4 shrink-0 text-primary" aria-hidden />
        <span className="min-w-0">
          <span className="block">{label}</span>
          {hint ? <span className="block text-[11px] font-normal text-muted-foreground">{hint}</span> : null}
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}
