"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown, MessageCircleReply } from "lucide-react";
import { clsx } from "clsx";

type Props = {
  lineId: string;
  /** Brouillon note / réponse officine sur la ligne */
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
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverBox, setPopoverBox] = useState({ top: 0, left: 0, width: 320 });
  const menuId = useId();

  useLayoutEffect(() => {
    if (!open || !wrapRef.current) return undefined;
    const update = () => {
      const el = wrapRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const width = Math.min(22 * 16, Math.max(17 * 16, vw - 24));
      let left = r.right - width;
      left = Math.max(12, Math.min(left, vw - width - 12));
      const top = r.bottom + 8;
      setPopoverBox({ top, left, width });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onDocMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      if (popoverRef.current?.contains(t)) return;
      if (mode === "custom") {
        onReplyChange(customText.trim());
      }
      setOpen(false);
      setMode("menu");
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open, mode, customText, onReplyChange]);

  const confirmNote = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      onReplyChange(trimmed);
      setOpen(false);
      setMode("menu");
    },
    [onReplyChange]
  );

  const clearReply = useCallback(() => {
    onReplyChange("");
    setCustomText("");
    setOpen(false);
    setMode("menu");
  }, [onReplyChange]);

  const hasReply = pharmacistReply.trim().length > 0;

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
          setOpen((o) => {
            const nextOpen = !o;
            if (nextOpen) {
              setCustomText(pharmacistReply);
              setMode("menu");
            }
            return nextOpen;
          });
        }}
        className={clsx(
          "inline-flex h-8 max-w-full items-center gap-1 rounded-lg border border-sky-300/90 bg-white px-2.5 text-[10px] font-semibold text-sky-900 shadow-sm transition hover:bg-sky-50 disabled:opacity-50 sm:text-[11px]"
        )}
      >
        <MessageCircleReply className="size-3.5 shrink-0" aria-hidden />
        <span className="truncate">{hasReply ? "Note confirmée" : "Note produit"}</span>
        <ChevronDown className={clsx("size-3.5 shrink-0 opacity-70 transition", open && "rotate-180")} aria-hidden />
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={popoverRef}
              role="dialog"
              aria-labelledby={`${menuId}-${lineId}`}
              data-pharmacist-react-popover={lineId}
              style={{
                position: "fixed",
                top: popoverBox.top,
                left: popoverBox.left,
                width: popoverBox.width,
                zIndex: 10050,
                maxHeight: "min(70vh, 24rem)",
              }}
              className="flex flex-col overflow-hidden rounded-xl border border-border bg-card py-2 shadow-xl ring-1 ring-black/10"
            >
              {mode === "menu" ? (
                <div className="flex min-h-0 flex-col px-1.5">
                  {hasReply ? (
                    <button
                      type="button"
                      className="rounded-lg bg-primary px-3 py-2.5 text-left text-sm font-semibold text-primary-foreground hover:opacity-95"
                      onClick={() => confirmNote(pharmacistReply)}
                    >
                      Confirmer la note
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-foreground hover:bg-muted/60"
                    onClick={() => {
                      setCustomText(pharmacistReply);
                      setMode("custom");
                    }}
                  >
                    {hasReply ? "Modifier la note…" : "Écrire une note…"}
                  </button>
                  {hasReply ? (
                    <button
                      type="button"
                      className="rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-destructive hover:bg-destructive/10"
                      onClick={() => clearReply()}
                    >
                      Retirer la note
                    </button>
                  ) : null}
                </div>
              ) : (
                <div className="flex min-h-0 flex-col gap-2 px-3 py-2">
                  <textarea
                    rows={5}
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    placeholder="Note visible par le patient avec votre réponse…"
                    className="min-h-[6.5rem] w-full shrink resize-y rounded-lg border border-input bg-background px-2.5 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:min-h-[5rem]"
                    autoFocus
                  />
                  <div className="flex shrink-0 flex-wrap justify-end gap-2 pb-0.5">
                    <button
                      type="button"
                      className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted/50"
                      onClick={() => {
                        setCustomText(pharmacistReply);
                        setMode("menu");
                      }}
                    >
                      Retour
                    </button>
                    <button
                      type="button"
                      className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:opacity-95 disabled:opacity-50"
                      disabled={!customText.trim()}
                      onClick={() => confirmNote(customText)}
                    >
                      Confirmer la note
                    </button>
                  </div>
                </div>
              )}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
