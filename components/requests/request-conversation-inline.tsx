"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize2, MessagesSquare } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { ConsultationPhotoLightbox } from "@/components/requests/consultation/consultation-photo-lightbox";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { type RequestCommentRow } from "@/lib/request-conversation";
import {
  type ConsultationImagePaths,
  createConsultationSignedUrl,
} from "@/lib/consultation-media";
import { formatDateTimeShortForLocale } from "@/lib/datetime-locale";
import type { AppLocale } from "@/lib/i18n/config";
import {
  REQUEST_COMMENT_SELECT_FIELDS,
  sendRequestConversationMessage,
} from "@/lib/send-request-conversation-message";
import { ConversationComposer } from "@/components/requests/conversation/conversation-composer";
import { ConversationMessageBubble } from "@/components/requests/conversation/conversation-message-bubble";

export type ConsultationConversationSeed = {
  text: string;
  paths: ConsultationImagePaths;
  createdAt?: string | null;
  /** Dernière modification patient (texte ou photos). */
  modifiedAt?: string | null;
};

type Props = {
  requestId: string;
  viewerRole: "patient" | "pharmacien";
  currentUserId: string;
  onMarkedRead?: () => void;
  variant?: "default" | "consultation";
  /** Message initial consultation (première bulle du fil, avant les commentaires). */
  consultationSeed?: ConsultationConversationSeed | null;
  /** Incrémenter pour recharger le fil (notif / refresh bus). */
  refreshToken?: number;
  /** Onglet consultation : contraindre la hauteur pour scroll interne tactile. */
  fillViewport?: boolean;
  /** Hauteur minimale du bloc (patient — page scrollable, scroll chaining au bord du fil). */
  minHeightClass?: string;
  /** Dossier fermé : lecture seule. */
  composerDisabled?: boolean;
};

/** Fil de conversation intégré (onglet Conversation — pas de FAB / modal). */
function ConsultationSeedBubble({
  seed,
  viewerRole,
  locale,
}: {
  seed: ConsultationConversationSeed;
  viewerRole: "patient" | "pharmacien";
  locale: AppLocale;
}) {
  const t = useTranslations("conversation");
  const [thumbs, setThumbs] = useState<{ slot: number; url: string }[]>([]);
  const [lightbox, setLightbox] = useState<{ label: string; url: string } | null>(null);
  const sentAtLabel = seed.createdAt ? formatDateTimeShortForLocale(seed.createdAt, locale) : null;
  const modifiedAtLabel = seed.modifiedAt ? formatDateTimeShortForLocale(seed.modifiedAt, locale) : null;
  const showModified = Boolean(modifiedAtLabel);
  const patientBubble = viewerRole === "patient" ? "ms-4 border-sky-200/90 bg-sky-50/80" : "me-4 border-sky-200/70 bg-sky-50/50";

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const keys: (keyof ConsultationImagePaths)[] = ["photo1", "photo2", "photo3"];
      const next: { slot: number; url: string }[] = [];
      for (let i = 0; i < keys.length; i++) {
        const path = seed.paths[keys[i]];
        if (!path) continue;
        const { url } = await createConsultationSignedUrl(path);
        if (url) next.push({ slot: i + 1, url });
      }
      if (!cancelled) setThumbs(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [seed.paths]);

  return (
    <li className={cn("rounded-lg border px-3 py-2.5 text-[12px] leading-snug", patientBubble)}>
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
        <span className="font-semibold text-foreground">
          {viewerRole === "patient" ? t("you") : t("patientLabel")}
          <span className="ml-1.5 font-normal text-muted-foreground">· {t("initialMessage")}</span>
        </span>
        {showModified ? (
          <time className="shrink-0 text-[9px] tabular-nums text-amber-800/90">
            {t("modifiedAt", { date: modifiedAtLabel ?? "" })}
          </time>
        ) : sentAtLabel ? (
          <time className="shrink-0 text-[9px] tabular-nums text-muted-foreground">{sentAtLabel}</time>
        ) : null}
      </div>
      {showModified && sentAtLabel ? (
        <p className="mt-0.5 text-[9px] text-muted-foreground">
          {t("sentInitially", { date: sentAtLabel })}
        </p>
      ) : null}
      <p className="mt-1 whitespace-pre-wrap text-foreground">{seed.text.trim()}</p>
      {thumbs.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {thumbs.map((thumb) => (
            <button
              key={thumb.slot}
              type="button"
              title={t("photoN", { n: thumb.slot })}
              onClick={() => setLightbox({ label: t("photoN", { n: thumb.slot }), url: thumb.url })}
              className="relative size-16 overflow-hidden rounded-lg border border-violet-200/70 bg-muted sm:size-20"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={thumb.url} alt="" className="size-full object-cover" />
              <span className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center bg-black/45 py-px">
                <Maximize2 className="size-2.5 text-white" aria-hidden />
              </span>
            </button>
          ))}
        </div>
      ) : null}
      {lightbox ? (
        <ConsultationPhotoLightbox label={lightbox.label} url={lightbox.url} onClose={() => setLightbox(null)} />
      ) : null}
    </li>
  );
}

export function RequestConversationInline({
  requestId,
  viewerRole,
  currentUserId,
  onMarkedRead,
  variant = "default",
  consultationSeed = null,
  refreshToken = 0,
  fillViewport = false,
  minHeightClass,
  composerDisabled = false,
}: Props) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("conversation");
  const tCommon = useTranslations("common");
  const [rows, setRows] = useState<RequestCommentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [err, setErr] = useState("");
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLLIElement>(null);
  const pendingScrollRef = useRef<"always" | "if-sticky" | null>(null);
  const onMarkedReadRef = useRef(onMarkedRead);
  useEffect(() => {
    onMarkedReadRef.current = onMarkedRead;
  }, [onMarkedRead]);

  const isNearBottom = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight <= 80;
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    bottomSentinelRef.current?.scrollIntoView({ behavior, block: "end" });
  }, []);

  const load = useCallback(async (opts?: { silent?: boolean; scroll?: "always" | "if-sticky" }) => {
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
      pendingScrollRef.current = null;
      return;
    }
    setRows((data as RequestCommentRow[]) ?? []);
    pendingScrollRef.current = opts?.scroll ?? (opts?.silent ? "if-sticky" : "always");
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

  useEffect(() => {
    if (!refreshToken) return;
    void (async () => {
      await load({ silent: true, scroll: "if-sticky" });
      await markRead();
    })();
  }, [refreshToken, load, markRead]);

  useEffect(() => {
    const channel = supabase
      .channel(`request_comments_inline:${requestId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "request_comments",
          filter: `request_id=eq.${requestId}`,
        },
        () => {
          void load({ silent: true, scroll: "if-sticky" });
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [requestId, load]);

  useEffect(() => {
    if (loading) return;
    const mode = pendingScrollRef.current;
    if (!mode) return;
    pendingScrollRef.current = null;
    if (mode === "always" || (mode === "if-sticky" && isNearBottom())) {
      requestAnimationFrame(() => {
        scrollToBottom(mode === "always" ? "auto" : "smooth");
      });
    }
  }, [loading, rows, isNearBottom, scrollToBottom]);

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
    await load({ silent: true, scroll: "always" });
    await markRead();
    return true;
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
  const hasSeed = Boolean(consultationSeed?.text?.trim());

  return (
    <section
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border-2 shadow-sm",
        fillViewport ? "min-h-0 flex-1" : minHeightClass ?? "min-h-[min(24rem,50vh)]",
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
          <p className="truncate text-[12px] font-semibold text-foreground">
            {isConsultation
              ? viewerRole === "pharmacien"
                ? t("title")
                : t("exchangesWithPharmacy")
              : viewerRole === "pharmacien"
                ? t("exchangesWithPatient")
                : t("exchangesWithOffice")}
          </p>
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        className="min-h-[14rem] flex-1 touch-pan-y overflow-y-auto overscroll-y-auto px-3 py-2.5 [-webkit-overflow-scrolling:touch]"
        style={{ touchAction: "pan-y" }}
      >
        {loading ? (
          <p className="text-[11px] text-muted-foreground">{tCommon("loading")}</p>
        ) : !hasSeed && rows.length === 0 ? (
          <p className="text-[11px] leading-snug text-muted-foreground">{t("emptyWriteFirst")}</p>
        ) : (
          <ul className="space-y-2">
            {hasSeed && consultationSeed ? (
              <ConsultationSeedBubble seed={consultationSeed} viewerRole={viewerRole} locale={locale} />
            ) : null}
            {rows.map((m) => (
              <ConversationMessageBubble
                key={m.id}
                message={m}
                currentUserId={currentUserId}
                viewerRole={viewerRole}
                variant={variant}
                composerDisabled={composerDisabled}
                onSoftDelete={(commentId) => void softDelete(commentId)}
              />
            ))}
            <li ref={bottomSentinelRef} className="h-px shrink-0" aria-hidden />
          </ul>
        )}
      </div>

      <div
        className={cn(
          "border-t px-3 py-2.5",
          isConsultation ? "border-violet-200/70 bg-violet-50/25" : "border-border bg-muted/20"
        )}
      >
        <ConversationComposer
          draft={draft}
          onDraftChange={setDraft}
          sending={sending}
          disabled={composerDisabled}
          error={err}
          onSend={send}
          sendButtonClassName={isConsultation ? "bg-violet-700 hover:bg-violet-800" : undefined}
          readonlyMessage={t("readonlyClosed")}
        />
      </div>
    </section>
  );
}
