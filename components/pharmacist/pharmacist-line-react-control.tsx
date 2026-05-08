"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ChevronDown, MessageCircleReply } from "lucide-react";
import { clsx } from "clsx";

const QUICK = "C'est noté";

type Props = {
  lineId: string;
  /** Brouillon réponse pharmaceutique à un commentaire patient */
  pharmacistReply: string;
  disabled: boolean;
  onReplyChange: (text: string) => void;
};

export function PharmacistLineReactControl({
  lineId,
  pharmacistReply,
  disabled,
  onReplyChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"menu" | "custom">("menu");
  const [customText, setCustomText] = useState(pharmacistReply);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setMode("menu");
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const applyQuick = useCallback(() => {
    onReplyChange(QUICK);
    setOpen(false);
    setMode("menu");
  }, [onReplyChange]);

  const applyCustom = useCallback(() => {
    onReplyChange(customText.trim());
    setOpen(false);
    setMode("menu");
  }, [customText, onReplyChange]);

  return (
    <div ref={wrapRef} className="relative flex min-w-0 shrink-0 items-start justify-end">
      <button
        type="button"
        disabled={disabled}
        id={`${menuId}-${lineId}`}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => {
          if (disabled) return;
          setOpen((o) => !o);
          setMode("menu");
        }}
        className={clsx(
          "inline-flex h-8 max-w-full items-center gap-1 rounded-lg border border-sky-300/90 bg-white px-2.5 text-[10px] font-semibold text-sky-900 shadow-sm transition hover:bg-sky-50 disabled:opacity-50 sm:text-[11px]"
        )}
      >
        <MessageCircleReply className="size-3.5 shrink-0" aria-hidden />
        <span className="truncate">Réagir</span>
        <ChevronDown className={clsx("size-3.5 shrink-0 opacity-70 transition", open && "rotate-180")} aria-hidden />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-labelledby={`${menuId}-${lineId}`}
          className="absolute right-0 top-full z-40 mt-1 w-[min(100%,18rem)] rounded-xl border border-border bg-card py-1.5 shadow-lg ring-1 ring-black/5"
        >
          {mode === "menu" ? (
            <div className="flex flex-col px-1.5">
              <button
                type="button"
                className="rounded-lg px-2.5 py-2 text-left text-[11px] font-semibold text-foreground hover:bg-muted/60"
                onClick={() => applyQuick()}
              >
                « {QUICK} »
              </button>
              <button
                type="button"
                className="rounded-lg px-2.5 py-2 text-left text-[11px] font-semibold text-foreground hover:bg-muted/60"
                onClick={() => {
                  setCustomText(pharmacistReply);
                  setMode("custom");
                }}
              >
                Écrire un message…
              </button>
            </div>
          ) : (
            <div className="space-y-2 px-2.5 py-2">
              <textarea
                rows={3}
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Réponse au client…"
                className="w-full resize-none rounded-lg border border-input bg-background px-2 py-1.5 text-[11px] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                autoFocus
              />
              <div className="flex justify-end gap-1.5">
                <button
                  type="button"
                  className="rounded-lg border border-border px-2.5 py-1 text-[10px] font-semibold text-muted-foreground hover:bg-muted/50"
                  onClick={() => {
                    setMode("menu");
                  }}
                >
                  Retour
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-primary px-2.5 py-1 text-[10px] font-semibold text-primary-foreground shadow-sm hover:opacity-95"
                  onClick={() => applyCustom()}
                >
                  OK
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
