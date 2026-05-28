"use client";

import { clsx } from "clsx";
import { Plus } from "lucide-react";
import { PHARMACIST_ALT_TAB_ADD, type PharmacistLineAltTabId } from "@/lib/pharmacist-line-alt-tabs";

/** Barre d’onglets au-dessus du bloc produit : Demande patient + alternatives + ajout. */
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
  return (
    <div className="space-y-1.5 border-b border-sky-200/55 bg-sky-50/35 px-2 py-2 sm:px-2.5">
      <p className="text-[9px] font-semibold uppercase tracking-wide text-sky-800/85">
        Produit demandé · {altCount}/{maxAlts} alternative{maxAlts > 1 ? "s" : ""}
      </p>
      <div
        className="flex gap-1.5 overflow-x-auto overscroll-x-contain pb-0.5 [-webkit-overflow-scrolling:touch]"
        role="tablist"
        aria-label="Demande patient et alternatives"
      >
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onTabChange(tab.id)}
              className={clsx(
                "shrink-0 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold leading-tight shadow-sm transition",
                active
                  ? tab.id === PHARMACIST_ALT_TAB_ADD
                    ? "border-teal-600 bg-teal-600 text-white ring-2 ring-teal-300/60"
                    : "border-sky-500 bg-white text-sky-950 ring-2 ring-sky-300/70"
                  : tab.id === PHARMACIST_ALT_TAB_ADD
                    ? "border-teal-300/90 bg-teal-50 text-teal-900 hover:bg-teal-100/80"
                    : "border-sky-300/80 bg-sky-100/90 text-sky-900 hover:border-sky-400 hover:bg-white"
              )}
            >
              {tab.label}
            </button>
          );
        })}
        {canAddAlt && activeTab !== PHARMACIST_ALT_TAB_ADD ? (
          <button
            type="button"
            disabled={addBusy || altCount >= maxAlts}
            onClick={onAddAlt}
            className="inline-flex shrink-0 items-center gap-0.5 rounded-lg border border-dashed border-teal-500/80 bg-white px-2.5 py-1.5 text-[10px] font-bold text-teal-900 shadow-sm hover:bg-teal-50 disabled:opacity-45"
            title="Ajouter une alternative"
          >
            <Plus className="size-3.5" strokeWidth={2.5} aria-hidden />
            Alternative
          </button>
        ) : null}
      </div>
    </div>
  );
}
