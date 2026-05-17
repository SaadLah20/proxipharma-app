"use client";

import { useCallback, useEffect, useState } from "react";
import { clsx } from "clsx";
import { Maximize2, Plus, X, ZoomIn, ZoomOut } from "lucide-react";
import { createPrescriptionSignedUrl, type PrescriptionPagePaths } from "@/lib/prescription-media";

type PrescriptionImageViewerProps = {
  paths: PrescriptionPagePaths;
  accent?: "amber" | "sky";
  className?: string;
  /** Sur grand écran : images plus hautes + lightbox zoom. */
  layout?: "default" | "desktop-comfort";
  /** Permet l’agrandissement au tap sur mobile (fiche pharmacien ordonnance). */
  allowMobileExpand?: boolean;
  /** Saisie rapide produits ordonnance (pharmacien). */
  ordonnanceQuickAdd?: {
    lineCount: number;
    onOpenAdd: () => void;
    showMainHint?: boolean;
  };
};

export function PrescriptionImageViewer({
  paths,
  accent = "amber",
  className,
  layout = "default",
  allowMobileExpand = false,
  ordonnanceQuickAdd,
}: PrescriptionImageViewerProps) {
  const [urls, setUrls] = useState<{ page1: string | null; page2: string | null }>({ page1: null, page2: null });
  const [err, setErr] = useState("");
  const [activeTab, setActiveTab] = useState<1 | 2>(1);
  const [lightbox, setLightbox] = useState<{ label: string; url: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setErr("");
      const next = { page1: null as string | null, page2: null as string | null };
      if (paths.page1) {
        const r = await createPrescriptionSignedUrl(paths.page1);
        if (r.error) setErr(r.error);
        next.page1 = r.url;
      }
      if (paths.page2) {
        const r = await createPrescriptionSignedUrl(paths.page2);
        if (r.error) setErr(r.error);
        next.page2 = r.url;
      }
      if (!cancelled) setUrls(next);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [paths.page1, paths.page2]);

  const border = accent === "amber" ? "border-amber-200/80" : "border-sky-200/80";
  const tabActive = accent === "amber" ? "bg-amber-100 text-amber-950" : "bg-sky-100 text-sky-950";
  const hasTwo = Boolean(paths.page2 && urls.page2);
  const comfort = layout === "desktop-comfort";
  const canExpandImages = comfort || allowMobileExpand;

  const openLightbox = useCallback((label: string, url: string | null) => {
    if (!url) return;
    setLightbox({ label, url });
  }, []);

  return (
    <>
      <section className={clsx("rounded-xl border-2 bg-white p-2 shadow-sm", border, className)}>
        <p className="px-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Ordonnance scannée</p>
        {ordonnanceQuickAdd?.showMainHint ? (
          <p className="mt-1.5 rounded-lg border border-amber-300/70 bg-amber-50/80 px-2 py-1.5 text-[11px] leading-snug text-amber-950">
            <strong className="font-semibold">Saisie des produits :</strong> touchez l’ordonnance pour l’agrandir, puis le
            bouton <span className="font-bold text-amber-900">+</span> pour ajouter chaque produit (
            <span className="tabular-nums font-semibold">{ordonnanceQuickAdd.lineCount}</span> saisi
            {ordonnanceQuickAdd.lineCount !== 1 ? "s" : ""}).
          </p>
        ) : null}
        {err ? <p className="mt-1 text-xs text-destructive">{err}</p> : null}
        {hasTwo ? (
          <PageTabs
            activeTab={activeTab}
            onSelect={setActiveTab}
            tabActiveClass={tabActive}
            className={clsx("mt-2 flex gap-1", comfort && hasTwo && "md:hidden")}
          />
        ) : null}
        <div
          className={clsx(
            "mt-2 grid gap-2",
            hasTwo ? (comfort ? "grid-cols-1 md:grid-cols-2" : "md:grid-cols-2") : "grid-cols-1"
          )}
        >
          {(paths.page1 && (!hasTwo || activeTab === 1)) || !hasTwo ? (
            <PrescriptionImageSlot
              label="Page 1"
              url={urls.page1}
              canExpand={canExpandImages}
              comfort={comfort}
              onExpand={openLightbox}
            />
          ) : null}
          {hasTwo && paths.page2 ? (
            <div className={clsx(activeTab === 2 ? "block" : "hidden md:block")}>
              <PrescriptionImageSlot
                label="Page 2"
                url={urls.page2}
                canExpand={canExpandImages}
                comfort={comfort}
                onExpand={openLightbox}
              />
            </div>
          ) : null}
        </div>
        {canExpandImages ? (
          <p className="mt-2 text-[10px] text-muted-foreground">
            Touchez une page pour l’agrandir{ordonnanceQuickAdd ? " et saisir les produits ordonnance" : ""}.
          </p>
        ) : null}
      </section>
      {lightbox ? (
        <PrescriptionLightbox
          label={lightbox.label}
          url={lightbox.url}
          accent={accent}
          onClose={() => setLightbox(null)}
          ordonnanceQuickAdd={ordonnanceQuickAdd}
        />
      ) : null}
    </>
  );
}

function PageTabs({
  activeTab,
  onSelect,
  tabActiveClass,
  className,
}: {
  activeTab: 1 | 2;
  onSelect: (t: 1 | 2) => void;
  tabActiveClass: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => onSelect(1)}
        className={clsx(
          "flex-1 rounded-lg py-1.5 text-xs font-semibold",
          activeTab === 1 ? tabActiveClass : "bg-muted/40 text-muted-foreground"
        )}
      >
        Page 1
      </button>
      <button
        type="button"
        onClick={() => onSelect(2)}
        className={clsx(
          "flex-1 rounded-lg py-1.5 text-xs font-semibold",
          activeTab === 2 ? tabActiveClass : "bg-muted/40 text-muted-foreground"
        )}
      >
        Page 2
      </button>
    </div>
  );
}

function PrescriptionImageSlot({
  label,
  url,
  comfort,
  canExpand,
  onExpand,
}: {
  label: string;
  url: string | null;
  comfort: boolean;
  canExpand: boolean;
  onExpand: (label: string, url: string | null) => void;
}) {
  const [loadErr, setLoadErr] = useState(false);
  const expandable = canExpand && Boolean(url) && !loadErr;
  const imgMaxH = comfort ? "max-h-[min(52vh,420px)] md:max-h-[min(68vh,720px)]" : "max-h-[min(52vh,420px)]";

  return (
    <div className="overflow-hidden rounded-lg border border-border/70 bg-muted/20">
      <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-muted/30 px-2 py-1">
        <p className="text-[10px] font-medium text-muted-foreground">{label}</p>
        {expandable ? (
          <button
            type="button"
            onClick={() => onExpand(label, url)}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-foreground hover:bg-muted/60"
            aria-label={`Agrandir ${label}`}
          >
            <Maximize2 className="size-3" aria-hidden />
            Agrandir
          </button>
        ) : null}
      </div>
      {url && !loadErr ? (
        <button
          type="button"
          disabled={!expandable}
          onClick={() => (expandable ? onExpand(label, url) : undefined)}
          className={clsx("block w-full bg-white", expandable && "cursor-zoom-in")}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- URL signée Supabase */}
          <img
            src={url}
            alt={label}
            className={clsx("w-full object-contain", imgMaxH)}
            onError={() => setLoadErr(true)}
          />
        </button>
      ) : url && loadErr ? (
        <p className="p-4 text-center text-xs text-destructive">
          Image illisible (fichier absent ou envoi incomplet).
        </p>
      ) : (
        <p className="p-4 text-center text-xs text-muted-foreground">Chargement de l’image…</p>
      )}
    </div>
  );
}

function PrescriptionLightbox({
  label,
  url,
  accent,
  onClose,
  ordonnanceQuickAdd,
}: {
  label: string;
  url: string;
  accent: "amber" | "sky";
  onClose: () => void;
  ordonnanceQuickAdd?: PrescriptionImageViewerProps["ordonnanceQuickAdd"];
}) {
  const [zoom, setZoom] = useState(1);
  const ring = accent === "amber" ? "ring-amber-300/60" : "ring-sky-300/60";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-black/85 p-3 md:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Visualisation ${label}`}
    >
      <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2 text-white">
        <p className="text-sm font-semibold">{label}</p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
            className="rounded-lg bg-white/15 p-2 hover:bg-white/25"
            aria-label="Zoom arrière"
          >
            <ZoomOut className="size-4" aria-hidden />
          </button>
          <span className="min-w-[3rem] text-center text-xs tabular-nums">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
            className="rounded-lg bg-white/15 p-2 hover:bg-white/25"
            aria-label="Zoom avant"
          >
            <ZoomIn className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="ml-1 rounded-lg bg-white/15 p-2 hover:bg-white/25"
            aria-label="Fermer"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={label}
          className={clsx("max-h-full max-w-full object-contain transition-transform duration-150", ring, "ring-2")}
          style={{ transform: `scale(${zoom})` }}
        />
        {ordonnanceQuickAdd ? (
          <button
            type="button"
            onClick={ordonnanceQuickAdd.onOpenAdd}
            className="fixed bottom-6 right-4 z-[81] flex min-h-12 items-center gap-2 rounded-full border-2 border-amber-300/90 bg-gradient-to-br from-amber-50 to-white px-4 py-2.5 text-sm font-bold text-amber-950 shadow-lg ring-2 ring-amber-400/40 hover:bg-amber-100/90 sm:bottom-8 sm:right-8"
          >
            <Plus className="size-5 shrink-0" strokeWidth={2.5} aria-hidden />
            Produit
            <span className="rounded-full bg-amber-700 px-2 py-0.5 text-[11px] font-bold tabular-nums text-white">
              {ordonnanceQuickAdd.lineCount}
            </span>
          </button>
        ) : null}
      </div>
    </div>
  );
}


