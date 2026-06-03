"use client";

import { clsx } from "clsx";
import { Plus } from "lucide-react";
import { PHARMACIST_ALT_TAB_ADD, type PharmacistLineAltTabId } from "@/lib/pharmacist-line-alt-tabs";

/** Onglets demandé / alternatives — une seule ligne compacte, sans scroll horizontal. */
export function PharmacistLineAlternativesTabs({
  tabs,
  activeTab,
  onTabChange,
  canAddAlt,
  onAddAlt,
  addBusy,
  maxAlts = 3,
  altCount,
  principalTabLabel = "Demandé",
}: {
  tabs: { id: PharmacistLineAltTabId; label: string }[];
  activeTab: PharmacistLineAltTabId;
  onTabChange: (id: PharmacistLineAltTabId) => void;
  canAddAlt: boolean;
  onAddAlt: () => void;
  addBusy?: boolean;
  maxAlts?: number;
  altCount: number;
  /** Onglet variante principale : « Demandé » (ligne patient) ou « Proposé » (officine). */
  principalTabLabel?: "Demandé" | "Proposé";
}) {
  const tabCells: { id: PharmacistLineAltTabId; label: string; isAdd: boolean }[] = [
    { id: "principal", label: principalTabLabel, isAdd: false },
    ...tabs
      .filter((t) => t.id !== "principal")
      .map((t) => ({ id: t.id, label: t.label, isAdd: false as const })),
    ...(canAddAlt && altCount < maxAlts && activeTab !== PHARMACIST_ALT_TAB_ADD
      ? [{ id: PHARMACIST_ALT_TAB_ADD, label: "Alternative", isAdd: true as const }]
      : []),
  ];
  const colCount = Math.max(tabCells.length, 1);

  return (
    <div
      className="grid min-w-0 gap-0.5 border-b border-border/55 bg-muted/10 px-1.5 py-1 sm:px-2"
      style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` }}
      role="tablist"
      aria-label={
        principalTabLabel === "Proposé" ? "Proposé et alternatives" : "Demandé et alternatives"
      }
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
              className={clsx(
                "flex min-h-7 min-w-0 items-center justify-center gap-0.5 rounded-md border border-dashed px-0.5 py-1 text-[9px] font-bold leading-none transition disabled:opacity-45 sm:text-[10px]",
                active
                  ? "border-sky-500/80 bg-white text-sky-950 shadow-sm ring-1 ring-sky-200/70"
                  : "border-sky-400/60 bg-white/80 text-sky-900 hover:bg-sky-50/90"
              )}
              title="Ajouter une alternative"
            >
              <Plus className="size-3 shrink-0" strokeWidth={2.5} aria-hidden />
              <span className="truncate">Alternative</span>
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
              "flex min-h-7 min-w-0 items-center justify-center rounded-md border px-0.5 py-1 text-center text-[9px] font-semibold leading-tight transition sm:text-[10px]",
              active
                ? "border-border/80 bg-card text-foreground shadow-sm ring-1 ring-sky-200/60"
                : "border-transparent bg-transparent text-muted-foreground hover:bg-muted/35"
            )}
          >
            <span className="w-full truncate">{cell.label}</span>
          </button>
        );
      })}
    </div>
  );
}
