"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { X, ZoomIn, ZoomOut } from "lucide-react";
import { Z_PRESCRIPTION_LIGHTBOX } from "@/lib/ui-z-index";

type ConsultationPhotoLightboxProps = {
  label: string;
  url: string;
  onClose: () => void;
};

/** Lightbox consultation : bouton Fermer + retour navigateur / téléphone ferme l’image seulement. */
export function ConsultationPhotoLightbox({ label, url, onClose }: ConsultationPhotoLightboxProps) {
  const tCommon = useTranslations("common");
  const [zoom, setZoom] = useState(1);
  const historyPushedRef = useRef(false);
  const closingViaButtonRef = useRef(false);

  const closeLightbox = useCallback(() => {
    closingViaButtonRef.current = true;
    onClose();
    if (historyPushedRef.current) {
      historyPushedRef.current = false;
      history.back();
    }
  }, [onClose]);

  useEffect(() => {
    historyPushedRef.current = true;
    history.pushState({ ppConsultationLightbox: true }, "");
    const onPop = () => {
      if (closingViaButtonRef.current) {
        closingViaButtonRef.current = false;
        return;
      }
      historyPushedRef.current = false;
      onClose();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeLightbox]);

  return (
    <div
      className={`fixed inset-0 z-[80] flex flex-col bg-black/85 p-3 md:p-6 ${Z_PRESCRIPTION_LIGHTBOX}`}
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
            aria-label={tCommon("zoomOut")}
          >
            <ZoomOut className="size-4" aria-hidden />
          </button>
          <span className="min-w-[3rem] text-center text-xs tabular-nums">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
            className="rounded-lg bg-white/15 p-2 hover:bg-white/25"
            aria-label={tCommon("zoomIn")}
          >
            <ZoomIn className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={closeLightbox}
            className="ml-1 rounded-lg bg-white/15 p-2 hover:bg-white/25"
            aria-label={tCommon("closeAria")}
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={label}
          className="max-h-full max-w-full object-contain ring-2 ring-violet-300/60 transition-transform duration-150"
          style={{ transform: `scale(${zoom})` }}
        />
      </div>
    </div>
  );
}
