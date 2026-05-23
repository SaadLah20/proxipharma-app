"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
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
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/80 bg-card px-3 py-2.5 shadow-sm"
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
          className={cn(
            "inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold transition",
            page <= 1 ? "cursor-not-allowed opacity-40" : "hover:bg-muted/60"
          )}
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
          className={cn(
            "inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold transition",
            page >= totalPages ? "cursor-not-allowed opacity-40" : "hover:bg-muted/60"
          )}
        >
          Suiv.
          <ChevronRight className="size-3.5" />
        </button>
      </div>
    </nav>
  );
}
