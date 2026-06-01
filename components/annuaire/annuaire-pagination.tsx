"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { uiAnnuairePaginationBtn } from "@/lib/ui-action-buttons";
import { uiSurfaceCard } from "@/lib/ui-surfaces";
import { cn } from "@/lib/utils";

export function AnnuairePagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPage,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPage: (p: number) => void;
}) {
  if (totalItems <= pageSize) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);

  return (
    <nav
      className={cn(uiSurfaceCard, "flex flex-wrap items-center justify-between gap-3 px-3 py-2.5")}
      aria-label="Pagination de l’annuaire"
    >
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">
          {from}–{to}
        </span>{" "}
        sur {totalItems} officine{totalItems > 1 ? "s" : ""}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className={cn(uiAnnuairePaginationBtn(), page <= 1 && "cursor-not-allowed opacity-40")}
        >
          <ChevronLeft className="size-3.5" />
          Préc.
        </button>
        <span className="min-w-[4.5rem] text-center text-xs font-medium tabular-nums text-foreground">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
          className={cn(uiAnnuairePaginationBtn(), page >= totalPages && "cursor-not-allowed opacity-40")}
        >
          Suiv.
          <ChevronRight className="size-3.5" />
        </button>
      </div>
    </nav>
  );
}
