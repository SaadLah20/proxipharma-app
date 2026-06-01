"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessagesSquare, Send, Trash2, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import { REQUEST_CONVERSATION_MESSAGE_MAX } from "@/lib/patient-request-form-limits";
import { cn } from "@/lib/utils";
import { STICKY_FOOTER_FAB_DEFAULT_BOTTOM_PX } from "@/lib/platform-sticky-footer";
import { Z_FLOATING_ABOVE_STICKY_FOOTER } from "@/lib/ui-z-index";
import {
  type RequestCommentRow,
  conversationAuthorLabelFr,
  formatConversationTimestamp,
} from "@/lib/request-conversation";

const CONVERSATION_FAB_POS_KEY = "proxipharma:conversationFabInset";

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

function readFabInset(): { right: number; bottom: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CONVERSATION_FAB_POS_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as { right?: unknown; bottom?: unknown };
    if (typeof j.right === "number" && typeof j.bottom === "number" && Number.isFinite(j.right) && Number.isFinite(j.bottom)) {
      return { right: j.right, bottom: j.bottom };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function writeFabInset(pos: { right: number; bottom: number }) {
  try {
    sessionStorage.setItem(CONVERSATION_FAB_POS_KEY, JSON.stringify(pos));
  } catch {
    /* ignore */
  }
}

/** Petit bouton rond « Messages » : glisser pour déplacer, tap pour ouvrir ; position en session. */
export function RequestConversationFabDock({
  hasUnread,
  onOpen,
  tone,
  /** Marge basse minimale (px) pour dégager le footer sticky du dossier. */
  minBottomPx = STICKY_FOOTER_FAB_DEFAULT_BOTTOM_PX,
}: {
  hasUnread: boolean;
  onOpen: () => void;
  tone: "patient" | "pharmacien" | "consultation";
  minBottomPx?: number;
}) {
  const fabRef = useRef<HTMLDivElement>(null);
  const suppressClickRef = useRef(false);
  const sessionRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startRight: number;
    startBottom: number;
    dragging: boolean;
  } | null>(null);

  const clampFabBottom = useCallback(
    (bottom: number) => {
      const h = fabRef.current?.offsetHeight ?? 56;
      return clamp(bottom, minBottomPx, window.innerHeight - h - 8);
    },
    [minBottomPx]
  );

  const [inset, setInset] = useState<{ right: number; bottom: number } | null>(() => {
    const saved = readFabInset();
    if (!saved || typeof window === "undefined") return null;
    return { right: saved.right, bottom: Math.max(saved.bottom, minBottomPx) };
  });

  useEffect(() => {
    setInset((prev) => {
      if (prev == null) return prev;
      const bottom = clampFabBottom(prev.bottom);
      if (bottom === prev.bottom) return prev;
      const pos = { right: prev.right, bottom };
      writeFabInset(pos);
      return pos;
    });
  }, [clampFabBottom, minBottomPx]);

  useEffect(() => {
    const onResize = () => {
      const el = fabRef.current;
      if (!el) return;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const rect = el.getBoundingClientRect();
      let right = window.innerWidth - rect.right;
      let bottom = window.innerHeight - rect.bottom;
      right = clamp(right, 8, window.innerWidth - w - 8);
      bottom = clampFabBottom(bottom);
      setInset((prev) => {
        if (prev?.right === right && prev.bottom === bottom) return prev;
        const pos = { right, bottom };
        writeFabInset(pos);
        return pos;
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clampFabBottom]);

  const toneRing =
    tone === "pharmacien"
      ? "border-emerald-400/90 bg-gradient-to-br from-emerald-50 to-white text-emerald-900 hover:bg-emerald-50/90"
      : tone === "consultation"
        ? "border-violet-400/90 bg-gradient-to-br from-violet-50 to-white text-violet-900 hover:bg-violet-50/90"
        : "border-sky-400/90 bg-gradient-to-br from-sky-50 to-white text-sky-900 hover:bg-sky-50/90";

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    const el = fabRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    sessionRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startRight: window.innerWidth - rect.right,
      startBottom: window.innerHeight - rect.bottom,
      dragging: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const s = sessionRef.current;
    if (!s || e.pointerId !== s.pointerId) return;
    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    if (!s.dragging) {
      // Seuil ~15px : un tap au-dessus d’éléments cliquables ne doit pas être lu comme un glissement.
      if (dx * dx + dy * dy < 225) return;
      s.dragging = true;
    }
    const w = fabRef.current?.offsetWidth ?? 48;
    const h = fabRef.current?.offsetHeight ?? 48;
    setInset({
      right: clamp(s.startRight - dx, 8, window.innerWidth - w - 8),
      bottom: clampFabBottom(s.startBottom - dy),
    });
    if (s.dragging) e.preventDefault();
  };

  const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const s = sessionRef.current;
    if (!s || e.pointerId !== s.pointerId) return;
    const wasDrag = s.dragging;
    sessionRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* déjà relâché */
    }
    suppressClickRef.current = true;
    if (wasDrag) {
      const el = fabRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const pos = {
          right: window.innerWidth - rect.right,
          bottom: clampFabBottom(window.innerHeight - rect.bottom),
        };
        setInset(pos);
        writeFabInset(pos);
      }
    } else {
      onOpen();
    }
  };

  const onPointerCancel = (e: React.PointerEvent<HTMLButtonElement>) => {
    sessionRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* */
    }
  };

  const onClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    // Clavier / lecteur d’écran (pas de séquence pointer sur le bouton).
    onOpen();
  };

  const defaultInset = { right: 16, bottom: minBottomPx };
  const style =
    inset != null
      ? { right: inset.right, bottom: inset.bottom }
      : {
          right: defaultInset.right,
          bottom: `calc(${minBottomPx}px + env(safe-area-inset-bottom, 0px))`,
        };

  return (
    <div
      ref={fabRef}
      style={style}
      className={cn(
        "pointer-events-auto fixed isolate flex size-14 items-center justify-center sm:size-16",
        Z_FLOATING_ABOVE_STICKY_FOOTER
      )}
    >
      <button
        type="button"
        className={cn(
          "relative flex size-14 touch-none select-none items-center justify-center rounded-full border-2 shadow-lg transition active:scale-[0.97] sm:size-16",
          toneRing,
          hasUnread && "ring-2 ring-destructive/40 ring-offset-2 ring-offset-background"
        )}
        title={
          hasUnread
            ? "Nouveaux messages — ouvrir (glisser pour déplacer le bouton)"
            : "Conversation — ouvrir (glisser pour déplacer)"
        }
        aria-label={hasUnread ? "Conversation — nouveaux messages" : "Ouvrir la conversation"}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onClick={onClick}
      >
        <MessagesSquare className="size-6 shrink-0 sm:size-7" strokeWidth={2.5} aria-hidden />
        {hasUnread ? (
          <span className="absolute end-1 top-1 size-2.5 rounded-full bg-destructive shadow-sm ring-2 ring-card" aria-hidden />
        ) : null}
      </button>
    </div>
  );
}

type Props = {
  requestId: string;
  viewerRole: "patient" | "pharmacien";
  currentUserId: string;
  open: boolean;
  onClose: () => void;
  /** Après marquage lu (ouverture) — rafraîchir le point non lu parent */
  onMarkedRead?: () => void;
  /** Dossier fermé (ex. expiré) : lecture seule, pas d’envoi ni retrait. */
  composerDisabled?: boolean;
};

export function RequestConversationPanel({
  requestId,
  viewerRole,
  currentUserId,
  open,
  onClose,
  onMarkedRead,
  composerDisabled = false,
}: Props) {
  const [rows, setRows] = useState<RequestCommentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [err, setErr] = useState("");

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setErr("");
    const { data, error } = await supabase
      .from("request_comments")
      .select("id,created_at,author_id,author_role,comment_text,deleted_at")
      .eq("request_id", requestId)
      .eq("is_internal", false)
      .order("created_at", { ascending: true });
    if (!opts?.silent) setLoading(false);
    if (error) {
      setErr(error.message);
      setRows([]);
      return;
    }
    setRows((data as RequestCommentRow[]) ?? []);
  }, [requestId]);

  const onMarkedReadRef = useRef(onMarkedRead);
  useEffect(() => {
    onMarkedReadRef.current = onMarkedRead;
  }, [onMarkedRead]);

  const markRead = useCallback(async () => {
    const { error } = await supabase.rpc("mark_request_conversation_read", { p_request_id: requestId });
    if (!error) onMarkedReadRef.current?.();
  }, [requestId]);

  useEffect(() => {
    if (!open) return;
    // Hors du tick de l'effet : évite react-hooks/set-state-in-effect (load() met loading à jour tout de suite).
    const id = window.setTimeout(() => {
      void load();
      void markRead();
    }, 0);
    return () => window.clearTimeout(id);
  }, [open, load, markRead]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const send = async () => {
    const text = draft.trim();
    if (text.length === 0) return;
    setSending(true);
    setErr("");
    const { error } = await supabase.from("request_comments").insert({
      request_id: requestId,
      author_id: currentUserId,
      author_role: viewerRole,
      comment_text: text.slice(0, REQUEST_CONVERSATION_MESSAGE_MAX),
      is_internal: false,
    });
    setSending(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setDraft("");
    await load({ silent: true });
    await markRead();
  };

  const softDelete = async (id: string) => {
    setErr("");
    const { error } = await supabase.rpc("request_comment_soft_delete", { p_comment_id: id });
    if (error) {
      setErr(error.message);
      return;
    }
    await load({ silent: true });
  };

  const visibleRows = useMemo(() => rows, [rows]);

  if (!open) return null;

  return (
    <AppModalOverlay open={open} aria-label="Conversation sur la demande" onBackdropClick={onClose}>
      <div className="relative z-10 flex max-h-[min(calc(100dvh-3.5rem),44rem)] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-xl sm:max-h-[min(92dvh,44rem)] sm:rounded-2xl">
        <div
          className={cn(
            "flex items-start justify-between gap-2 border-b border-border px-4 py-3",
            viewerRole === "pharmacien" ? "bg-emerald-50/40" : "bg-sky-50/40"
          )}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <span
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-full border-2 bg-white shadow-sm",
                viewerRole === "pharmacien"
                  ? "border-emerald-300/85 text-emerald-800"
                  : "border-sky-300/85 text-sky-800"
              )}
            >
              <MessagesSquare className="size-5" strokeWidth={2.35} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Conversation</p>
              <p className="truncate text-[13px] font-semibold leading-tight">
                {viewerRole === "pharmacien" ? "Échanges avec le patient" : "Échanges avec l'officine"}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 rounded-lg p-1.5 text-foreground hover:bg-muted" aria-label="Fermer">
            <X className="size-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-4 py-3">
          {loading ? (
            <p className="text-[11px] text-muted-foreground">Chargement…</p>
          ) : visibleRows.length === 0 ? (
            <p className="text-[11px] leading-snug text-muted-foreground">
              Aucun message pour l&apos;instant. Écrivez le premier ci-dessous.
            </p>
          ) : (
            <ul className="space-y-2">
              {visibleRows.map((m) => {
                const self = m.author_id === currentUserId;
                const deleted = Boolean(m.deleted_at);
                return (
                  <li
                    key={m.id}
                    className={`rounded-lg border px-3 py-2.5 text-[12px] leading-snug ${
                      self ? "ms-4 border-sky-200/90 bg-sky-50/80" : "me-4 border-border bg-muted/25"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
                      <span className="font-semibold text-foreground">
                        {conversationAuthorLabelFr(m.author_role, self)}
                      </span>
                      <time className="shrink-0 text-[9px] tabular-nums text-muted-foreground" dateTime={m.created_at}>
                        {formatConversationTimestamp(m.created_at)}
                      </time>
                    </div>
                    {deleted ? (
                      <p className="mt-1 italic text-muted-foreground">Message retiré.</p>
                    ) : (
                      <p className="mt-1 whitespace-pre-wrap text-foreground">{m.comment_text}</p>
                    )}
                    {self && !deleted && !composerDisabled ? (
                      <div className="mt-1.5 flex justify-end">
                        <button
                          type="button"
                          onClick={() => void softDelete(m.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-destructive/25 bg-background px-2 py-1 text-[9px] font-semibold text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="size-3" aria-hidden />
                          Retirer
                        </button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-border bg-muted/20 px-4 py-3">
          {composerDisabled ? (
            <p className="text-[11px] leading-snug text-muted-foreground">
              Cette demande est fermée — la conversation est en lecture seule. Pour échanger à nouveau, créez une
              nouvelle demande de produits si besoin.
            </p>
          ) : (
            <>
              {err ? (
                <p className="mb-2 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-[10px] text-destructive">
                  {err}
                </p>
              ) : null}
              <label className="block text-[10px] font-semibold text-foreground">
                Votre message
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value.slice(0, REQUEST_CONVERSATION_MESSAGE_MAX))}
                  rows={3}
                  maxLength={REQUEST_CONVERSATION_MESSAGE_MAX}
                  placeholder="Précision, question…"
                  className="mt-1 w-full resize-y rounded-lg border border-input bg-background px-2 py-2 text-[12px] leading-relaxed text-foreground placeholder:text-muted-foreground/70"
                />
              </label>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="text-[9px] tabular-nums text-muted-foreground">
                  {draft.length}/{REQUEST_CONVERSATION_MESSAGE_MAX}
                </span>
                <Button
                  type="button"
                  size="sm"
                  disabled={sending || draft.trim().length === 0}
                  onClick={() => void send()}
                  className="h-8 gap-1 text-xs"
                >
                  <Send className="size-3.5" aria-hidden />
                  {sending ? "Envoi…" : "Envoyer"}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </AppModalOverlay>
  );
}
