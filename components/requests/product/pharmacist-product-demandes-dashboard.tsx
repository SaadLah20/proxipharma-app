"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { ChevronRight, Sparkles } from "lucide-react";
import type { PharmacistRequestRow } from "@/components/requests/demande-hub-ui";
import { PharmacistProductDemandeHubCard } from "@/components/requests/product/pharmacist-product-demande-hub-card";
import {
  countInPharmacistProductHubSection,
  PHARMACIST_PRODUCT_HUB_DASHBOARD_PREVIEW,
  PHARMACIST_PRODUCT_HUB_SECTIONS,
  pharmacistProductHubListHref,
  pickRecentActivePharmacistProductRequests,
  rowsInPharmacistProductHubSection,
  type PharmacistProductHubSectionId,
} from "@/lib/pharmacist-product-hub-sections";

const SECTION_ACCENT: Record<
  PharmacistProductHubSectionId,
  { border: string; badge: string; title: string; statHover: string }
> = {
  action_required: {
    border: "border-l-amber-500",
    badge: "bg-amber-100 text-amber-950 ring-amber-200/80",
    title: "text-amber-950",
    statHover: "hover:bg-amber-50/80",
  },
  in_preparation: {
    border: "border-l-teal-500",
    badge: "bg-teal-100 text-teal-950 ring-teal-200/80",
    title: "text-teal-950",
    statHover: "hover:bg-teal-50/80",
  },
  archives: {
    border: "border-l-slate-400",
    badge: "bg-slate-100 text-slate-800 ring-slate-200/80",
    title: "text-slate-800",
    statHover: "hover:bg-slate-50/80",
  },
};

const SECTION_ORDER: PharmacistProductHubSectionId[] = ["action_required", "in_preparation", "archives"];

function SectionBlock({
  sectionId,
  rows,
  basePath,
  unreadById,
  defaultCollapsed,
}: {
  sectionId: PharmacistProductHubSectionId;
  rows: PharmacistRequestRow[];
  basePath: string;
  unreadById: Record<string, boolean>;
  defaultCollapsed?: boolean;
}) {
  const section = PHARMACIST_PRODUCT_HUB_SECTIONS.find((s) => s.id === sectionId)!;
  const sectionRows = rowsInPharmacistProductHubSection(rows, sectionId);
  const count = sectionRows.length;
  const accent = SECTION_ACCENT[sectionId];
  const preview = sectionRows.slice(0, PHARMACIST_PRODUCT_HUB_DASHBOARD_PREVIEW);
  const listHref = pharmacistProductHubListHref(basePath, { sectionId });

  if (count === 0) return null;

  const body = (
    <ul className="space-y-2">
      {preview.map((r) => (
        <li key={r.id}>
          <PharmacistProductDemandeHubCard row={r} conversationUnread={unreadById[r.id] === true} />
        </li>
      ))}
    </ul>
  );

  return (
    <section
      className={clsx(
        "rounded-xl border border-border/80 bg-card shadow-sm ring-1 ring-black/[0.03]",
        "border-l-4",
        accent.border
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border/60 px-3 py-2.5 sm:px-3.5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={clsx("text-sm font-bold sm:text-base", accent.title)}>{section.title}</h3>
            <span
              className={clsx(
                "inline-flex min-w-[1.75rem] items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ring-1",
                accent.badge
              )}
            >
              {count}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground sm:text-xs">{section.subtitle}</p>
        </div>
        {count > PHARMACIST_PRODUCT_HUB_DASHBOARD_PREVIEW ? (
          <Link
            href={listHref}
            className="inline-flex shrink-0 items-center gap-0.5 rounded-lg border border-emerald-300/70 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-900 hover:bg-emerald-100"
          >
            Tout voir ({count})
            <ChevronRight className="size-3.5" aria-hidden />
          </Link>
        ) : null}
      </div>

      <div className="p-2.5 sm:p-3">
        {defaultCollapsed && count > 0 ? (
          <details className="group" open={count <= 2}>
            <summary className="mb-2 cursor-pointer list-none text-[11px] font-semibold text-muted-foreground marker:content-none [&::-webkit-details-marker]:hidden">
              Afficher les dossiers ({count})
            </summary>
            {body}
          </details>
        ) : (
          body
        )}
      </div>
    </section>
  );
}

export function PharmacistProductDemandesDashboard({
  rows,
  basePath,
  unreadById,
}: {
  rows: PharmacistRequestRow[];
  basePath: string;
  unreadById: Record<string, boolean>;
}) {
  const router = useRouter();
  const recent = pickRecentActivePharmacistProductRequests(rows, unreadById, 5);
  const actionCount = countInPharmacistProductHubSection(rows, "action_required");
  const prepCount = countInPharmacistProductHubSection(rows, "in_preparation");
  const archiveCount = countInPharmacistProductHubSection(rows, "archives");

  const openSectionList = (sectionId: PharmacistProductHubSectionId) => {
    router.push(pharmacistProductHubListHref(basePath, { sectionId }), { scroll: false });
  };

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border-2 border-emerald-300/55 bg-gradient-to-br from-emerald-50/95 via-white to-teal-50/35 shadow-md ring-1 ring-emerald-200/50">
        <div className="bg-gradient-to-r from-emerald-700 to-teal-700 px-3.5 py-3 text-white sm:px-4 sm:py-3.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-100/90">
            Demandes de produits
          </p>
          <p className="mt-1 text-sm font-semibold leading-snug sm:text-base">
            {actionCount > 0
              ? `${actionCount} dossier${actionCount > 1 ? "s" : ""} à traiter en priorité`
              : prepCount > 0
                ? `${prepCount} dossier${prepCount > 1 ? "s" : ""} en préparation validée`
                : "Tout est à jour — consultez les archives si besoin"}
          </p>
        </div>
        <div className="grid grid-cols-3 divide-x divide-emerald-200/60 border-t border-emerald-200/50 bg-white/80">
          <button
            type="button"
            onClick={() => openSectionList("action_required")}
            className={clsx("px-2 py-2.5 text-center transition sm:px-3", SECTION_ACCENT.action_required.statHover)}
          >
            <p className="text-lg font-bold tabular-nums text-amber-800 sm:text-xl">{actionCount}</p>
            <p className="text-[9px] font-semibold uppercase tracking-wide text-amber-900/85 sm:text-[10px]">
              À traiter
            </p>
          </button>
          <button
            type="button"
            onClick={() => openSectionList("in_preparation")}
            className={clsx("px-2 py-2.5 text-center transition sm:px-3", SECTION_ACCENT.in_preparation.statHover)}
          >
            <p className="text-lg font-bold tabular-nums text-teal-800 sm:text-xl">{prepCount}</p>
            <p className="text-[9px] font-semibold uppercase tracking-wide text-teal-900/85 sm:text-[10px]">
              Validées
            </p>
          </button>
          <button
            type="button"
            onClick={() => openSectionList("archives")}
            className={clsx("px-2 py-2.5 text-center transition sm:px-3", SECTION_ACCENT.archives.statHover)}
          >
            <p className="text-lg font-bold tabular-nums text-slate-700 sm:text-xl">{archiveCount}</p>
            <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-600 sm:text-[10px]">
              Archives
            </p>
          </button>
        </div>
      </div>

      {recent.length > 0 ? (
        <section className="rounded-xl border-2 border-emerald-200/70 bg-emerald-50/30 p-3 ring-1 ring-emerald-100/80 sm:p-3.5">
          <div className="mb-2.5 flex items-center gap-2">
            <Sparkles className="size-4 shrink-0 text-emerald-700" aria-hidden />
            <div>
              <h2 className="text-sm font-bold text-emerald-950">Reprendre rapidement</h2>
              <p className="text-[11px] text-emerald-900/85">Dossiers récents ou messages non lus</p>
            </div>
          </div>
          <ul className="flex gap-2.5 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
            {recent.map((r) => (
              <li key={r.id} className="w-[min(100%,280px)] shrink-0 sm:w-[min(85%,300px)]">
                <PharmacistProductDemandeHubCard
                  row={r}
                  compact
                  conversationUnread={unreadById[r.id] === true}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {SECTION_ORDER.map((sectionId) => (
        <SectionBlock
          key={sectionId}
          sectionId={sectionId}
          rows={rows}
          basePath={basePath}
          unreadById={unreadById}
          defaultCollapsed={sectionId === "archives"}
        />
      ))}
    </div>
  );
}
