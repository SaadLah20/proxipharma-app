"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { clsx } from "clsx";
import { X, ZoomIn, ZoomOut } from "lucide-react";

export type PromoProductPhotoLightboxState = { label: string; url: string } | null;

export function PromoProductPhotoLightbox({
  state,
  onClose,
}: {
  state: PromoProductPhotoLightboxState;
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (!state) return;
    setZoom(1);
  }, [state?.url]);

  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, onClose]);

  if (!state) return null;

  return (
    <div
      className="fixed inset-0 z-[10060] flex flex-col bg-black/88 p-3 md:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Visualisation ${state.label}`}
      onClick={onClose}
    >
      <div
        className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="line-clamp-2 text-sm font-semibold">{state.label}</p>
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
            className="rounded-lg bg-white/15 p-2 hover:bg-white/25"
            aria-label="Fermer"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      </div>
      <div
        className="flex min-h-0 flex-1 items-center justify-center overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- lightbox plein écran */}
        <img
          src={state.url}
          alt={state.label}
          className="max-h-[min(85vh,900px)] w-auto max-w-full object-contain transition-transform duration-150"
          style={{ transform: `scale(${zoom})` }}
        />
      </div>
    </div>
  );
}

export function ClickablePromoProductPhoto({
  url,
  label,
  size,
  className,
  imageClassName,
  unoptimized = true,
  onOpen,
}: {
  url: string;
  label: string;
  size: number;
  className?: string;
  imageClassName?: string;
  unoptimized?: boolean;
  onOpen: (payload: { label: string; url: string }) => void;
}) {
  return (
    <button
      type="button"
      className={clsx(
        "relative shrink-0 overflow-hidden rounded-md border border-slate-200/80 bg-white",
        "cursor-zoom-in ring-offset-2 hover:ring-2 hover:ring-sky-400/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500",
        className
      )}
      style={{ width: size, height: size }}
      aria-label={`Agrandir ${label}`}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onOpen({ label, url });
      }}
    >
      <Image
        src={url}
        alt=""
        width={size}
        height={size}
        className={clsx("size-full object-cover", imageClassName)}
        unoptimized={unoptimized}
      />
    </button>
  );
}
