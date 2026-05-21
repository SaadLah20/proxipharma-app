"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessagesSquare, Send, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { REQUEST_CONVERSATION_MESSAGE_MAX } from "@/lib/patient-request-form-limits";
import { cn } from "@/lib/utils";
import {
  type RequestCommentRow,
  conversationAuthorLabelFr,
  formatConversationTimestamp,
} from "@/lib/request-conversation";

type Props = {
  requestId: string;
  viewerRole: "patient" | "pharmacien";
  currentUserId: string;
  onMarkedRead?: () => void;
  variant?: "default" | "consultation";
};

/** Fil de conversation intégré (onglet Conversation — pas de FAB / modal). */
export function RequestConversationInline({
  requestId,
  viewerRole,
  currentUserId,
  onMarkedRead,
  variant = "default",
}: Props) {
  const [rows, setRows] = useState<RequestCommentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [err, setErr] = useState("");
  const onMarkedReadRef = useRef(onMarkedRead);
  useEffect(() => {
    onMarkedReadRef.current = onMarkedRead;
  }, [onMarkedRead]);

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

  const markRead = useCallback(async () => {
    const { error } = await supabase.rpc("mark_request_conversation_read", { p_request_id: requestId });
    if (!error) onMarkedReadRef.current?.();
  }, [requestId]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      await load();
      if (!cancelled) await markRead();
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [requestId, load, markRead]);

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

  const softDelete = async (commentId: string) => {
    setErr("");
    const { error } = await supabase.rpc("request_comment_soft_delete", { p_comment_id: commentId });
    if (error) {
      setErr(error.message);
      return;
    }
    await load({ silent: true });
  };

  const isConsultation = variant === "consultation";
  const selfBubble =
    viewerRole === "pharmacien"
      ? "ms-4 border-emerald-200/90 bg-emerald-50/80"
      : "ms-4 border-sky-200/90 bg-sky-50/80";
  const otherBubble = "me-4 border-violet-200/60 bg-violet-50/30";

  return (
    <section
      className={cn(
        "flex min-h-[min(24rem,50vh)] flex-col overflow-hidden rounded-xl border-2 shadow-sm",
        isConsultation
          ? "border-violet-200/80 bg-gradient-to-b from-violet-50/50 to-white ring-1 ring-violet-200/45"
          : "border-border bg-card"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 border-b px-3 py-2.5",
          isConsultation ? "border-violet-200/70 bg-violet-50/60" : "border-border bg-muted/20"
        )}
      >
        <MessagesSquare
          className={cn("size-5 shrink-0", isConsultation ? "text-violet-800" : "text-foreground")}
          strokeWidth={2.35}
          aria-hidden
        />
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Messagerie</p>
          <p className="truncate text-[12px] font-semibold text-foreground">
            {viewerRole === "pharmacien" ? "Échanges avec le patient" : "Échanges avec l'officine"}
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-3 py-2.5">
        {loading ? (
          <p className="text-[11px] text-muted-foreground">Chargement…</p>
        ) : rows.length === 0 ? (
          <p className="text-[11px] leading-snug text-muted-foreground">
            Aucun message pour l&apos;instant. Écrivez le premier ci-dessous.
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((m) => {
              const self = m.author_id === currentUserId;
              const deleted = Boolean(m.deleted_at);
              return (
                <li
                  key={m.id}
                  className={cn("rounded-lg border px-3 py-2.5 text-[12px] leading-snug", self ? selfBubble : otherBubble)}
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

      <div
        className={cn(
          "border-t px-3 py-2.5",
          isConsultation ? "border-violet-200/70 bg-violet-50/25" : "border-border bg-muted/20"
        )}
      >
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
            className={cn("h-8 gap-1 text-xs", isConsultation && "bg-violet-700 hover:bg-violet-800")}
          >
            <Send className="size-3.5" aria-hidden />
            {sending ? "Envoi…" : "Envoyer"}
          </Button>
        </div>
      </div>
    </section>
  );
}
