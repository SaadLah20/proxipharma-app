"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MessageCircle, Send, Trash2, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { REQUEST_CONVERSATION_MESSAGE_MAX } from "@/lib/patient-request-form-limits";
import {
  type RequestCommentRow,
  conversationAuthorLabelFr,
  formatConversationTimestamp,
} from "@/lib/request-conversation";

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
    void load();
    void markRead();
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

export function RequestConversationFab({
  hasUnread,
  onClick,
  className,
}: {
  hasUnread: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "relative inline-flex size-11 items-center justify-center rounded-full border-2 border-sky-400/80 bg-gradient-to-br from-sky-500 to-sky-700 text-white shadow-lg ring-2 ring-white/40 transition hover:brightness-110 active:scale-[0.98] " +
        (className ?? "")
      }
      aria-label={hasUnread ? "Conversation — nouveaux messages" : "Ouvrir la conversation"}
    >
      <MessageCircle className="size-5" strokeWidth={2} aria-hidden />
      {hasUnread ? (
        <span className="absolute -end-0.5 -top-0.5 flex size-3.5 items-center justify-center rounded-full bg-rose-500 text-[0] ring-2 ring-white">
          <span className="sr-only">Nouveaux messages</span>
        </span>
      ) : null}
    </button>
  );
}
