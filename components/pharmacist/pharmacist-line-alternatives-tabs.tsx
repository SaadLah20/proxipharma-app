"use client";

import { clsx } from "clsx";
import { Plus } from "lucide-react";
import { PHARMACIST_ALT_TAB_ADD, type PharmacistLineAltTabId } from "@/lib/pharmacist-line-alt-tabs";

/** Onglets demande / alternatives — grille fixe, alignée parcours patient répondue. */
export function PharmacistLineAlternativesTabs({
  tabs,
  activeTab,
  onTabChange,
  canAddAlt,
  onAddAlt,
  addBusy,
  maxAlts = 3,
  altCount,
}: {
  tabs: { id: PharmacistLineAltTabId; label: string }[];
  activeTab: PharmacistLineAltTabId;
  onTabChange: (id: PharmacistLineAltTabId) => void;
  canAddAlt: boolean;
  onAddAlt: () => void;
  addBusy?: boolean;
  maxAlts?: number;
  altCount: number;
}) {
  const activeLabel = tabs.find((t) => t.id === activeTab)?.label ?? "Option";
  const tabCells = [
    ...tabs.map((tab) => ({ id: tab.id, label: tab.label, isAdd: false })),
    ...(canAddAlt && activeTab !== PHARMACIST_ALT_TAB_ADD
      ? [{ id: PHARMACIST_ALT_TAB_ADD as PharmacistLineAltTabId, label: "+ Alt.", isAdd: true }]
      : []),
  ];

  return (
    <div className="space-y-1.5 border-b border-border/55 bg-muted/15 px-2 py-2 sm:px-2.5">
      <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
        Demande patient · {altCount}/{maxAlts} alternative{maxAlts > 1 ? "s" : ""}
      </p>
      <div
        className="grid min-w-0 gap-1"
        style={{ gridTemplateColumns: `repeat(${Math.max(tabCells.length, 1)}, minmax(0, 1fr))` }}
        role="tablist"
        aria-label="Demande patient et alternatives"
      >
        {tabCells.map((cell) => {
          const active = activeTab === cell.id;
          if (cell.isAdd) {
            return (
              <button
                key={cell.id}
                type="button"
                disabled={addBusy || altCount >= maxAlts}
                onClick={onAddAlt}
                className="flex min-w-0 flex-col items-center justify-center rounded-lg border border-dashed border-teal-500/70 bg-white px-1 py-1.5 text-[10px] font-bold text-teal-900 transition hover:bg-teal-50/80 disabled:opacity-45"
                title="Ajouter une alternative"
              >
                <Plus className="size-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
                <span className="mt-0.5 truncate">Alt.</span>
              </button>
            );
          }
          return (
            <button
              key={cell.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onTabChange(cell.id)}
              className={clsx(
                "flex min-w-0 flex-col items-center justify-center rounded-lg border px-1 py-1.5 text-center transition",
                active
                  ? "border-foreground/30 bg-white text-foreground shadow-sm ring-1 ring-foreground/10"
                  : "border-transparent bg-muted/25 text-muted-foreground hover:bg-muted/45"
              )}
            >
              <span className="w-full truncate text-[10px] font-semibold leading-tight">{cell.label}</span>
              <span
                className={clsx(
                  "mt-0.5 size-1.5 shrink-0 rounded-full",
                  active ? "bg-sky-600" : "bg-transparent ring-1 ring-muted-foreground/35"
                )}
                aria-hidden
              />
            </button>
          );
        })}
      </div>
      <p className="text-[10px] leading-snug text-muted-foreground" aria-live="polite">
        Consulté : <span className="font-semibold text-foreground">{activeLabel}</span>
      </p>
    </div>
  );
}
