"use client";

import { clsx } from "clsx";
import { ImageOff } from "lucide-react";

/** Zone photo de la modale fiche produit catalogue (visuel pas encore disponible). */
export function ProductPhotoComingSoonFrame({ className }: { className?: string }) {
  return (
    <div
      className={clsx(
        "flex min-h-[min(32dvh,280px)] w-full max-w-md flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border/80 bg-muted/20 px-6 py-10 text-center sm:min-h-[min(40dvh,360px)]",
        className
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-full border border-border/70 bg-card text-muted-foreground shadow-sm">
        <ImageOff className="size-6" strokeWidth={1.75} aria-hidden />
      </span>
      <p className="max-w-[16rem] text-sm font-semibold leading-snug text-foreground">
        Photo disponible prochainement
      </p>
    </div>
  );
}
