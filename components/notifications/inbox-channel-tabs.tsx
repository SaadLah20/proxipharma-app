"use client";

import { clsx } from "clsx";

export type InboxChannelTab = "notifications" | "messages";

export function InboxChannelTabs({
  active,
  onChange,
  alertCount,
  messageCount,
  notificationsLabel,
  messagesLabel,
  compact,
}: {
  active: InboxChannelTab;
  onChange: (tab: InboxChannelTab) => void;
  alertCount: number;
  messageCount: number;
  notificationsLabel: string;
  messagesLabel: string;
  compact?: boolean;
}) {
  const tabs: { key: InboxChannelTab; label: string; count: number }[] = [
    { key: "notifications", label: notificationsLabel, count: alertCount },
    { key: "messages", label: messagesLabel, count: messageCount },
  ];

  return (
    <div
      className={clsx(
        "flex gap-1 rounded-lg bg-muted/60 p-0.5",
        compact ? "text-[11px]" : "text-xs",
      )}
      role="tablist"
      aria-label={notificationsLabel}
    >
      {tabs.map((tab) => {
        const selected = active === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={selected}
            className={clsx(
              "flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 font-semibold transition",
              selected
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => onChange(tab.key)}
          >
            <span className="truncate">{tab.label}</span>
            {tab.count > 0 ? (
              <span
                className={clsx(
                  "inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full px-1 text-[10px] font-bold",
                  selected ? "bg-primary text-primary-foreground" : "bg-red-500 text-white",
                )}
              >
                {tab.count > 99 ? "99+" : tab.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
