"use client";

import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { createPrescriptionSignedUrl, type PrescriptionPagePaths } from "@/lib/prescription-media";

type PrescriptionImageViewerProps = {
  paths: PrescriptionPagePaths;
  accent?: "amber" | "sky";
  className?: string;
};

export function PrescriptionImageViewer({ paths, accent = "amber", className }: PrescriptionImageViewerProps) {
  const [urls, setUrls] = useState<{ page1: string | null; page2: string | null }>({ page1: null, page2: null });
  const [err, setErr] = useState("");
  const [activeTab, setActiveTab] = useState<1 | 2>(1);

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
  const hasTwo = Boolean(paths.page2 && urls.page2);

  return (
    <section className={clsx("rounded-xl border-2 bg-white p-2 shadow-sm", border, className)}>
      <p className="px-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Ordonnance scannée</p>
      {err ? <p className="mt-1 text-xs text-destructive">{err}</p> : null}
      {hasTwo ? (
        <div className="mt-2 flex gap-1 md:hidden">
          <button
            type="button"
            onClick={() => setActiveTab(1)}
            className={clsx(
              "flex-1 rounded-lg py-1.5 text-xs font-semibold",
              activeTab === 1 ? "bg-amber-100 text-amber-950" : "bg-muted/40 text-muted-foreground"
            )}
          >
            Page 1
          </button>
          <button
            type="button"
            onClick={() => setActiveTab(2)}
            className={clsx(
              "flex-1 rounded-lg py-1.5 text-xs font-semibold",
              activeTab === 2 ? "bg-amber-100 text-amber-950" : "bg-muted/40 text-muted-foreground"
            )}
          >
            Page 2
          </button>
        </div>
      ) : null}
      <div className={clsx("mt-2 grid gap-2", hasTwo ? "md:grid-cols-2" : "grid-cols-1")}>
        {(paths.page1 && (!hasTwo || activeTab === 1)) || !hasTwo ? (
          <PrescriptionImageSlot label="Page 1" url={urls.page1} />
        ) : null}
        {hasTwo && paths.page2 ? (
          <div className={clsx(activeTab === 2 ? "block" : "hidden md:block")}>
            <PrescriptionImageSlot label="Page 2" url={urls.page2} />
          </div>
        ) : null}
      </div>
    </section>
  );
}

function PrescriptionImageSlot({ label, url }: { label: string; url: string | null }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border/70 bg-muted/20">
      <p className="border-b border-border/60 bg-muted/30 px-2 py-1 text-[10px] font-medium text-muted-foreground">{label}</p>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- URL signée Supabase
        <img src={url} alt={label} className="max-h-[min(52vh,420px)] w-full object-contain bg-white" />
      ) : (
        <p className="p-4 text-center text-xs text-muted-foreground">Chargement de l’image…</p>
      )}
    </div>
  );
}
