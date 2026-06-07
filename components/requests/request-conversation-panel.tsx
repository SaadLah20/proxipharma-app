"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessagesSquare, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import { cn } from "@/lib/utils";
import {
  CONVERSATION_FAB_SIZE_PX,
  clampConversationFabInset,
} from "@/lib/conversation-fab-position";
import { platformBottomNavFabMinBottomPx } from "@/lib/platform-bottom-nav";
import { Z_FLOATING_ABOVE_STICKY_FOOTER } from "@/lib/ui-z-index";
import { type RequestCommentRow } from "@/lib/request-conversation";
import {
  REQUEST_COMMENT_SELECT_FIELDS,
  sendRequestConversationMessage,
} from "@/lib/send-request-conversation-message";
import { ConversationComposer } from "@/components/requests/conversation/conversation-composer";
import { ConversationMessageBubble } from "@/components/requests/conversation/conversation-message-bubble";

const CONVERSATION_FAB_POS_KEY = "proxipharma:conversationFabInset";

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
  /** Marge basse minimale (px) pour dégager la barre de navigation basse. */
  minBottomPx = platformBottomNavFabMinBottomPx(),
  hidden = false,
}: {
  hasUnread: boolean;
  onOpen: () => void;
  tone: "patient" | "pharmacien" | "consultation";
  minBottomPx?: number;
  /** Masque le FAB pendant la lightbox ordonnance (saisie sur image). */
  hidden?: boolean;
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

  const clampFabPosition = useCallback(
    (right: number, bottom: number, enforceMinBottom = false) => {
      const el = fabRef.current;
      const w = el?.offsetWidth ?? CONVERSATION_FAB_SIZE_PX;
      const h = el?.offsetHeight ?? CONVERSATION_FAB_SIZE_PX;
      return clampConversationFabInset(right, bottom, w, h, minBottomPx, {
        enforceMinBottom,
      });
    },
    [minBottomPx]
  );

  const [inset, setInset] = useState<{ right: number; bottom: number } | null>(() => {
    const saved = readFabInset();
    if (!saved || typeof window === "undefined") return null;
    return clampConversationFabInset(
      saved.right,
      saved.bottom,
      CONVERSATION_FAB_SIZE_PX,
      CONVERSATION_FAB_SIZE_PX,
      minBottomPx,
      { enforceMinBottom: false }
    );
  });

  useEffect(() => {
    const onResize = () => {
      const el = fabRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const right = window.innerWidth - rect.right;
      const bottom = window.innerHeight - rect.bottom;
      setInset((prev) => {
        const pos = clampFabPosition(right, bottom, false);
        if (prev?.right === pos.right && prev.bottom === pos.bottom) return prev;
        writeFabInset(pos);
        return pos;
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clampFabPosition]);

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
      if (dx * dx + dy * dy < 225) return;
      s.dragging = true;
    }
    setInset(clampFabPosition(s.startRight - dx, s.startBottom - dy, false));
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
        const pos = clampFabPosition(
          window.innerWidth - rect.right,
          window.innerHeight - rect.bottom,
          false
        );
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
    onOpen();
  };

  const defaultInset = clampConversationFabInset(
    16,
    minBottomPx,
    CONVERSATION_FAB_SIZE_PX,
    CONVERSATION_FAB_SIZE_PX,
    minBottomPx,
    { enforceMinBottom: true }
  );
  const displayInset =
    inset != null
      ? clampConversationFabInset(
          inset.right,
          inset.bottom,
          CONVERSATION_FAB_SIZE_PX,
          CONVERSATION_FAB_SIZE_PX,
          minBottomPx,
          { enforceMinBottom: false }
        )
      : defaultInset;
  const style = {
    right: displayInset.right,
    bottom: displayInset.bottom,
  };

  return (
    <div
      ref={fabRef}
      style={style}
      className={cn(
        "pointer-events-auto fixed isolate flex size-14 touch-none items-center justify-center sm:size-16",
        Z_FLOATING_ABOVE_STICKY_FOOTER,
        hidden && "pointer-events-none invisible opacity-0"
      )}
      aria-hidden={hidden}
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
      .select(REQUEST_COMMENT_SELECT_FIELDS)
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
    const id = window.setTimeout(() => {
      void load();
      void markRead();
    }, 0);
    return () => window.clearTimeout(id);
  }, [open, load, markRead]);

  useEffect(() => {
    if (!open) return;
    const channel = supabase
      .channel(`request_comments_panel:${requestId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "request_comments",
          filter: `request_id=eq.${requestId}`,
        },
        () => {
          void load({ silent: true });
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [open, requestId, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const send = async (pendingAudio: { blob: Blob; mimeType: string; durationSeconds: number } | null) => {
    setSending(true);
    setErr("");
    const result = await sendRequestConversationMessage({
      supabase,
      requestId,
      authorId: currentUserId,
      authorRole: viewerRole,
      text: draft,
      pendingAudio: pendingAudio ?? undefined,
    });
    setSending(false);
    if (!result.ok) {
      setErr(result.error);
      return false;
    }
    setDraft("");
    await load({ silent: true });
    await markRead();
    return true;
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
              {visibleRows.map((m) => (
                <ConversationMessageBubble
                  key={m.id}
                  message={m}
                  currentUserId={currentUserId}
                  viewerRole={viewerRole}
                  composerDisabled={composerDisabled}
                  onSoftDelete={(commentId) => void softDelete(commentId)}
                />
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-border bg-muted/20 px-4 py-3">
          <ConversationComposer
            draft={draft}
            onDraftChange={setDraft}
            sending={sending}
            disabled={composerDisabled}
            error={err}
            onSend={send}
            readonlyMessage="Cette demande est fermée — la conversation est en lecture seule. Pour échanger à nouveau, créez une nouvelle demande de produits si besoin."
          />
        </div>
      </div>
    </AppModalOverlay>
  );
}
