"use client";

import { clsx } from "clsx";
import { Check, Plus } from "lucide-react";
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
  chosenAltId = null,
}: {
  tabs: { id: PharmacistLineAltTabId; label: string; title?: string }[];
  activeTab: PharmacistLineAltTabId;
  onTabChange: (id: PharmacistLineAltTabId) => void;
  canAddAlt: boolean;
  onAddAlt: () => void;
  addBusy?: boolean;
  maxAlts?: number;
  altCount: number;
  /** Onglet variante principale : « Demandé » (ligne patient), « Ordonnance », « Produit » (consultation) ou « Proposé » (officine). */
  principalTabLabel?: "Demandé" | "Ordonnance" | "Produit" | "Proposé";
  /** Alternative retenue par le patient — indicateur discret sur l’onglet. */
  chosenAltId?: string | null;
}) {
  const tabCells: {
    id: PharmacistLineAltTabId;
    label: string;
    title?: string;
    isAdd: boolean;
    isPrincipal: boolean;
  }[] = [
    { id: "principal", label: principalTabLabel, isAdd: false, isPrincipal: true },
    ...tabs
      .filter((t) => t.id !== "principal")
      .map((t) => ({ id: t.id, label: t.label, title: t.title, isAdd: false as const, isPrincipal: false })),
    ...(canAddAlt && altCount < maxAlts && activeTab !== PHARMACIST_ALT_TAB_ADD
      ? [{ id: PHARMACIST_ALT_TAB_ADD, label: "+ Alt.", isAdd: true as const, isPrincipal: false, title: "Ajouter une alternative" }]
      : []),
  ];
  const colCount = Math.max(tabCells.length, 1);

  return (
    <div
      className="grid min-w-0 gap-0.5 border-b border-border/55 bg-muted/10 px-1.5 py-1 sm:px-2"
      style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` }}
      role="tablist"
      aria-label={
        principalTabLabel === "Proposé"
          ? "Proposé et alternatives"
          : principalTabLabel === "Ordonnance"
            ? "Ordonnance et alternatives"
            : principalTabLabel === "Produit"
              ? "Produit et alternatives"
              : "Demandé et alternatives"
      }
    >
      {tabCells.map((cell) => {
        const active = activeTab === cell.id;
        const patientChoseThis = !cell.isAdd && !cell.isPrincipal && chosenAltId === cell.id;

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
              title={cell.title ?? "Ajouter une alternative"}
            >
              <Plus className="size-3 shrink-0" strokeWidth={2.5} aria-hidden />
              <span className="truncate">{cell.label}</span>
            </button>
          );
        }

        return (
          <button
            key={cell.id}
            type="button"
            role="tab"
            aria-selected={active}
            title={cell.title ?? cell.label}
            onClick={() => onTabChange(cell.id)}
            className={clsx(
              "flex min-h-7 min-w-0 items-center justify-center gap-0.5 rounded-md border px-0.5 py-1 text-center text-[9px] font-semibold leading-tight transition sm:text-[10px]",
              patientChoseThis && "border-emerald-500/70 bg-emerald-50/40 font-bold text-emerald-950 ring-1 ring-emerald-500/20",
              active && !patientChoseThis && "border-border/80 bg-card text-foreground shadow-sm ring-1 ring-sky-200/60",
              !active && !patientChoseThis && "border-transparent bg-transparent text-muted-foreground hover:bg-muted/35"
            )}
          >
            {patientChoseThis ? (
              <Check className="size-3 shrink-0 text-emerald-600" strokeWidth={3} aria-hidden />
            ) : null}
            <span className="w-full truncate">{cell.label}</span>
          </button>
        );
      })}
    </div>
  );
}
