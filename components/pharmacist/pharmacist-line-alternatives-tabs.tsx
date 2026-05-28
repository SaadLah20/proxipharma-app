"use client";

import type { ReactNode } from "react";
import { clsx } from "clsx";
import { Layers, Plus } from "lucide-react";

export type PharmacistAltTabId = "principal" | string;

/** Onglets principal / alternatives (miroir patient, côté saisie officine). */
export function PharmacistLineAlternativesTabs({
  tabs,
  activeTab,
  onTabChange,
  canAddAlt,
  onAddAlt,
  addBusy,
  children,
}: {
  tabs: { id: PharmacistAltTabId; label: string; disabled?: boolean }[];
  activeTab: PharmacistAltTabId;
  onTabChange: (id: PharmacistAltTabId) => void;
  canAddAlt: boolean;
  onAddAlt: () => void;
  addBusy?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="mt-1.5 space-y-2 border-l-[3px] border-l-teal-500/60 pl-0">
      <div className="flex min-w-0 items-center gap-1">
        <Layers className="size-3.5 shrink-0 text-teal-600" strokeWidth={2} aria-hidden />
        <span className="text-[9px] font-bold uppercase tracking-wide text-teal-950">Variantes proposées</span>
      </div>
      <div
        className="flex gap-1 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch]"
        role="tablist"
        aria-label="Principal et alternatives"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            disabled={tab.disabled}
            onClick={() => onTabChange(tab.id)}
            className={clsx(
              "shrink-0 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold transition",
              activeTab === tab.id
                ? "border-teal-600 bg-teal-600 text-white shadow-sm"
                : "border-teal-200/80 bg-white text-teal-950 hover:bg-teal-50/80",
              tab.disabled && "opacity-45"
            )}
          >
            {tab.label}
          </button>
        ))}
        {canAddAlt ? (
          <button
            type="button"
            disabled={addBusy}
            onClick={onAddAlt}
            className="inline-flex shrink-0 items-center gap-0.5 rounded-lg border border-dashed border-teal-400/90 bg-teal-50/50 px-2 py-1.5 text-[10px] font-bold text-teal-900 hover:bg-teal-100/80 disabled:opacity-50"
            title="Ajouter une alternative"
          >
            <Plus className="size-3.5" strokeWidth={2.5} aria-hidden />
            Alt.
          </button>
        ) : null}
      </div>
      <div role="tabpanel" className="min-w-0">
        {children}
      </div>
    </div>
  );
}
