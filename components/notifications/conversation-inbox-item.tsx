"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarClock, MessageSquare } from "lucide-react";
import { clsx } from "clsx";
import type { ConversationInboxRow } from "@/lib/conversation-inbox";
import {
  dispatchRequestDetailRefresh,
  notificationHrefTargetsCurrentPath,
  requestIdFromNotificationDemandeHref,
} from "@/lib/request-detail-refresh-bus";
import { supabase } from "@/lib/supabase";

export function ConversationInboxItem({
  row,
  onNavigate,
  compact,
}: {
  row: ConversationInboxRow;
  onNavigate?: () => void;
  compact?: boolean;
}) {
  const pathname = usePathname();
  const refLabel = row.requestPublicRef?.trim() || `#${row.requestId.slice(0, 8)}`;

  const handleOpen = async () => {
    await supabase.rpc("mark_request_conversation_read", { p_request_id: row.requestId });
    onNavigate?.();
  };

  return (
    <Link
      href={row.href}
      onClick={(e) => {
        void handleOpen();
        if (!notificationHrefTargetsCurrentPath(pathname, row.href)) return;
        const requestId = requestIdFromNotificationDemandeHref(row.href);
        if (requestId) {
          e.preventDefault();
          dispatchRequestDetailRefresh(requestId, { focus: "conversation" });
        }
      }}
      className={clsx(
        "flex w-full max-w-full gap-3 overflow-hidden rounded-xl border p-3 text-left shadow-sm transition hover:bg-muted/30",
        row.hasUnread
          ? "border-sky-200/80 bg-sky-50/35 ring-1 ring-sky-100/70"
          : "border-border/70 bg-card",
      )}
    >
      <div
        className={clsx(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary",
          compact && "h-9 w-9",
        )}
      >
        <MessageSquare className={clsx(compact ? "h-4 w-4" : "h-5 w-5")} strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p
            className={clsx(
              "min-w-0 flex-1 break-words font-semibold leading-snug text-foreground",
              compact ? "text-xs" : "text-sm",
            )}
          >
            {row.counterpartLabel}
          </p>
          {row.hasUnread ? (
            <span className="mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full bg-sky-500" aria-hidden />
          ) : null}
        </div>
        <p
          className={clsx(
            "mt-0.5 text-muted-foreground",
            compact ? "text-[10px]" : "text-[11px]",
          )}
        >
          {refLabel}
        </p>
        <p
          className={clsx(
            "mt-1.5 whitespace-pre-wrap break-words text-muted-foreground",
            compact ? "line-clamp-2 text-[11px] leading-relaxed" : "line-clamp-3 text-xs leading-relaxed",
          )}
        >
          {row.lastMessagePreview}
        </p>
        <p className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
          <CalendarClock className="h-3 w-3 shrink-0" />
          {new Date(row.lastMessageAt).toLocaleString("fr-FR", {
            dateStyle: "short",
            timeStyle: "short",
          })}
        </p>
      </div>
    </Link>
  );
}
