"use client";

import { clsx } from "clsx";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

export function PatientSettingsSection({
  title,
  subtitle,
  defaultOpen = true,
  children,
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-xl border border-border/90 bg-card shadow-sm ring-1 ring-primary/10"
    >
      <summary className="flex cursor-pointer list-none items-start justify-between gap-2 px-4 py-3 marker:content-none [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{subtitle}</p> : null}
        </div>
        <ChevronDown
          className="mt-0.5 size-4 shrink-0 text-muted-foreground transition group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className={clsx("border-t border-border/60 px-4 pb-4 pt-3")}>{children}</div>
    </details>
  );
}
