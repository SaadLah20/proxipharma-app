"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GripVertical, MessagesSquare, Send, Trash2, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { REQUEST_CONVERSATION_MESSAGE_MAX } from "@/lib/patient-request-form-limits";
import { cn } from "@/lib/utils";
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

/** Bouton flottant « Messages » : style selon le rôle, pastille non lu, poignée pour déplacer (position mémorisée en session). */
export function RequestConversationFabDock({
  hasUnread,
  onOpen,
  tone,
}: {
  hasUnread: boolean;
  onOpen: () => void;
  tone: "patient" | "pharmacien";
}) {
  const dockRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; startRight: number; startBottom: number } | null>(null);
  const [inset, setInset] = useState<{ right: number; bottom: number } | null>(() => readFabInset());

  useEffect(() => {
    const onResize = () => {
      const el = dockRef.current;
      if (!el) return;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const rect = el.getBoundingClientRect();
      let right = window.innerWidth - rect.right;
      let bottom = window.innerHeight - rect.bottom;
      right = clamp(right, 8, window.innerWidth - w - 8);
      bottom = clamp(bottom, 8, window.innerHeight - h - 8);
      setInset((prev) => {
        if (prev?.right === right && prev.bottom === bottom) return prev;
        const pos = { right, bottom };
        writeFabInset(pos);
        return pos;
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const toneWrap = tone === "pharmacien"
    ? "border-emerald-200/90 bg-card shadow-lg ring-1 ring-emerald-200/45"
    : "border-sky-200/90 bg-card shadow-lg ring-1 ring-sky-200/45";

  const toneIcon = tone === "pharmacien" ? "text-emerald-800" : "text-sky-800";

  const onGripPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const el = dockRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startRight: window.innerWidth - rect.right,
      startBottom: window.innerHeight - rect.bottom,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onGripPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    const w = dockRef.current?.offsetWidth ?? 120;
    const h = dockRef.current?.offsetHeight ?? 48;
    const nextRight = clamp(d.startRight - dx, 8, window.innerWidth - w - 8);
    const nextBottom = clamp(d.startBottom - dy, 8, window.innerHeight - h - 8);
    setInset({ right: nextRight, bottom: nextBottom });
  };

  const endGrip = (e: React.PointerEvent<HTMLButtonElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* déjà relâché */
    }
    dragRef.current = null;
    const el = dockRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      const pos = {
        right: window.innerWidth - rect.right,
        bottom: window.innerHeight - rect.bottom,
      };
      setInset(pos);
      writeFabInset(pos);
    }
  };

  const defaultInset = { right: 16, bottom: 96 };

  const style =
    inset != null
      ? { right: inset.right, bottom: inset.bottom }
      : { right: defaultInset.right, bottom: defaultInset.bottom };

  return (
    <div
      ref={dockRef}
      className="pointer-events-auto fixed z-[10050] flex select-none"
      style={style}
    >
      <div
        className={cn(
          "flex max-w-[min(100vw-1rem,20rem)] items-stretch overflow-hidden rounded-2xl border bg-card/95 backdrop-blur-sm",
          toneWrap
        )}
      >
        <button
          type="button"
          className="flex w-8 shrink-0 touch-none cursor-grab items-center justify-center border-r border-border/60 bg-muted/25 text-muted-foreground hover:bg-muted/45 active:cursor-grabbing"
          aria-label="Déplacer le bouton Messages"
          title="Glisser pour déplacer"
          onPointerDown={onGripPointerDown}
          onPointerMove={onGripPointerMove}
          onPointerUp={endGrip}
          onPointerCancel={endGrip}
        >
          <GripVertical className="size-4 shrink-0 opacity-80" strokeWidth={2} aria-hidden />
        </button>
        <button
          type="button"
          onClick={onOpen}
          className={cn(
            "relative flex min-w-0 flex-1 items-center gap-2 py-2.5 ps-2 pe-3 text-left transition hover:bg-muted/30 active:bg-muted/45",
            tone === "pharmacien" ? "hover:text-emerald-950" : "hover:text-sky-950"
          )}
          title={hasUnread ? "Nouveaux messages — ouvrir la conversation" : "Ouvrir la conversation"}
          aria-label={hasUnread ? "Conversation — nouveaux messages" : "Ouvrir la conversation"}
        >
          <span className="relative flex size-9 shrink-0 items-center justify-center rounded-xl bg-background/90 shadow-inner ring-1 ring-border/50">
            <MessagesSquare className={cn("size-[1.15rem]", toneIcon)} strokeWidth={2.25} aria-hidden />
            {hasUnread ? (
              <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-destructive shadow-sm ring-2 ring-card" aria-hidden />
            ) : null}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-bold leading-none text-foreground">Messages</span>
            <span className="mt-0.5 block truncate text-[9px] font-medium leading-tight text-muted-foreground">
              {hasUnread ? "Nouveau(x) message(s)" : "Fil avec l’officine"}
            </span>
          </span>
        </button>
      </div>
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
};

export function RequestConversationPanel({
  requestId,
  viewerRole,
  currentUserId,
  open,
  onClose,
  onMarkedRead,
}: Props) {
  const [rows, setRows] = useState<RequestCommentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    const { data, error } = await supabase
      .from("request_comments")
      .select("id,created_at,author_id,author_role,comment_text,deleted_at")
      .eq("request_id", requestId)
      .eq("is_internal", false)
      .order("created_at", { ascending: true });
    setLoading(false);
    if (error) {
      setErr(error.message);
      setRows([]);
      return;
    }
    setRows((data as RequestCommentRow[]) ?? []);
  }, [requestId]);

  const markRead = useCallback(async () => {
    const { error } = await supabase.rpc("mark_request_conversation_read", { p_request_id: requestId });
    if (!error) onMarkedRead?.();
  }, [requestId, onMarkedRead]);

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
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

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
    await load();
    await markRead();
  };

  const softDelete = async (id: string) => {
    setErr("");
    const { error } = await supabase.rpc("request_comment_soft_delete", { p_comment_id: id });
    if (error) {
      setErr(error.message);
      return;
    }
    await load();
  };

  const visibleRows = useMemo(() => rows, [rows]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[10080] flex items-end justify-center pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:items-center sm:p-4 sm:pb-4"
      role="dialog"
      aria-modal="true"
      aria-label="Conversation sur la demande"
    >
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Fermer" onClick={onClose} />
      <div className="relative z-10 flex max-h-[min(calc(100dvh-4rem),40rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-xl sm:max-h-[min(92dvh,40rem)] sm:rounded-2xl">
        <div className="flex items-start justify-between gap-2 border-b border-border px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Conversation</p>
            <p className="truncate text-[12px] font-semibold leading-tight">Échanges avec l&apos;officine</p>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 rounded-lg p-1 text-foreground hover:bg-muted" aria-label="Fermer">
            <X className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-3 py-2">
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
                    className={`rounded-lg border px-2.5 py-2 text-[11px] leading-snug ${
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
                    {self && !deleted ? (
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

        <div className="border-t border-border bg-muted/20 px-3 py-2.5">
          {err ? (
            <p className="mb-2 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-[10px] text-destructive">{err}</p>
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
            <Button type="button" size="sm" disabled={sending || draft.trim().length === 0} onClick={() => void send()} className="h-8 gap-1 text-xs">
              <Send className="size-3.5" aria-hidden />
              {sending ? "Envoi…" : "Envoyer"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
