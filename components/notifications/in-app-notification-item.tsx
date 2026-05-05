"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  Bell,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Package,
  UserRound,
  XCircle,
} from "lucide-react";
import { clsx } from "clsx";

function NotificationGlyph({
  eventType,
  compact,
}: {
  eventType: string | null | undefined;
  compact?: boolean;
}) {
  const t = (eventType ?? "").toLowerCase();
  const cls = clsx(compact ? "h-4 w-4" : "h-5 w-5");
  if (t.includes("confirmed") || t.includes("completed")) {
    return <CheckCircle2 className={cls} strokeWidth={2} />;
  }
  if (t.includes("submitted")) {
    return <ClipboardList className={cls} strokeWidth={2} />;
  }
  if (t.includes("cancelled") || t.includes("abandoned") || t.includes("expired")) {
    return <XCircle className={cls} strokeWidth={2} />;
  }
  if (t.includes("responded")) {
    return <Package className={cls} strokeWidth={2} />;
  }
  if (t.includes("in_review")) {
    return <Building2 className={cls} strokeWidth={2} />;
  }
  return <Bell className={cls} strokeWidth={2} />;
}

export function InAppNotificationItem({
  title,
  body,
  createdAt,
  eventType,
  href,
  onNavigate,
  compact,
}: {
  title: string;
  body: string | null;
  createdAt: string;
  eventType?: string | null;
  href: string;
  onNavigate?: () => void;
  /** Liste déroulante : texte un peu plus condensé */
  compact?: boolean;
}) {
  const commonClass = clsx(
    "flex w-full gap-3 rounded-xl border border-border/80 bg-card p-3 text-left shadow-sm transition hover:bg-muted/30",
    href && "cursor-pointer"
  );

  const inner = (
    <>
      <div
        className={clsx(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary",
          compact && "h-9 w-9"
        )}
      >
        <NotificationGlyph eventType={eventType} compact={compact} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={clsx("font-semibold leading-snug text-foreground", compact ? "text-xs" : "text-sm")}>{title}</p>
        {body ? (
          <p
            className={clsx(
              "mt-1.5 whitespace-pre-wrap text-muted-foreground",
              compact ? "line-clamp-4 text-[11px] leading-relaxed" : "text-xs leading-relaxed"
            )}
          >
            {body}
          </p>
        ) : null}
        <p className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
          <CalendarClock className="h-3 w-3 shrink-0" />
          {new Date(createdAt).toLocaleString("fr-FR", {
            dateStyle: "short",
            timeStyle: "short",
          })}
        </p>
      </div>
    </>
  );

  if (href) {
    return (
      <Link href={href} onClick={onNavigate} className={commonClass}>
        {inner}
      </Link>
    );
  }

  return <div className={commonClass}>{inner}</div>;
}

/** Ligne métadonnées optionnelle (ex. rôle destinataire) */
export function NotificationContextHint({ children }: { children: ReactNode }) {
  return (
    <p className="mt-1 flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
      <UserRound className="h-3 w-3" />
      {children}
    </p>
  );
}
