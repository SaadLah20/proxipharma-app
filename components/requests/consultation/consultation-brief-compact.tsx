"use client";

import { useEffect, useState } from "react";
import { Maximize2 } from "lucide-react";
import {
  type ConsultationImagePaths,
  createConsultationSignedUrl,
} from "@/lib/consultation-media";

/** Rappel compact du message patient (onglet Produits). */
export function ConsultationBriefCompact({
  text,
  paths,
  onOpenConversation,
}: {
  text: string;
  paths: ConsultationImagePaths;
  onOpenConversation?: () => void;
}) {
  const [thumbs, setThumbs] = useState<{ slot: number; url: string }[]>([]);
  const preview = text.trim().length > 160 ? `${text.trim().slice(0, 160)}…` : text.trim();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const slots: (keyof ConsultationImagePaths)[] = ["photo1", "photo2", "photo3"];
      const next: { slot: number; url: string }[] = [];
      for (let i = 0; i < slots.length; i++) {
        const path = paths[slots[i]];
        if (!path) continue;
        const { url } = await createConsultationSignedUrl(path);
        if (url) next.push({ slot: i + 1, url });
      }
      if (!cancelled) setThumbs(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [paths]);

  return (
    <section className="rounded-lg border border-violet-200/70 bg-violet-50/40 px-2.5 py-2 ring-1 ring-violet-200/40">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[9px] font-bold uppercase tracking-wide text-violet-900/85">Message du patient</p>
        {onOpenConversation ? (
          <button
            type="button"
            onClick={onOpenConversation}
            className="shrink-0 text-[10px] font-semibold text-violet-800 underline decoration-violet-400/80 underline-offset-2 hover:text-violet-950"
          >
            Voir tout
          </button>
        ) : null}
      </div>
      <p className="mt-1 whitespace-pre-wrap text-[11px] leading-snug text-foreground">{preview}</p>
      {thumbs.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {thumbs.map((t) => (
            <div
              key={t.slot}
              className="relative size-11 overflow-hidden rounded-md border border-violet-200/70 bg-muted"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={t.url} alt="" className="size-full object-cover" />
              <span className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center bg-black/45 py-px">
                <Maximize2 className="size-2.5 text-white" aria-hidden />
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
