"use client";

import { Trash2 } from "lucide-react";
import {
  type RequestCommentRow,
  conversationAuthorLabelFr,
  conversationMessageHasAudio,
  conversationMessageHasText,
  formatConversationTimestamp,
} from "@/lib/request-conversation";
import { cn } from "@/lib/utils";
import { ConversationAudioPlayer } from "@/components/requests/conversation/conversation-audio-player";

type BubbleTone = "selfPatient" | "selfPharmacien" | "otherDefault" | "otherConsultation";

function bubbleClass(tone: BubbleTone): string {
  switch (tone) {
    case "selfPatient":
      return "ms-4 border-sky-200/90 bg-sky-50/80";
    case "selfPharmacien":
      return "ms-4 border-emerald-200/90 bg-emerald-50/80";
    case "otherConsultation":
      return "me-4 border-violet-200/60 bg-violet-50/30";
    default:
      return "me-4 border-border bg-muted/25";
  }
}

export function ConversationMessageBubble({
  message,
  currentUserId,
  viewerRole,
  variant = "default",
  composerDisabled = false,
  onSoftDelete,
}: {
  message: RequestCommentRow;
  currentUserId: string;
  viewerRole: "patient" | "pharmacien";
  variant?: "default" | "consultation";
  composerDisabled?: boolean;
  onSoftDelete?: (commentId: string) => void;
}) {
  const self = message.author_id === currentUserId;
  const deleted = Boolean(message.deleted_at);
  const hasText = conversationMessageHasText(message);
  const hasAudio = conversationMessageHasAudio(message);

  const tone: BubbleTone = self
    ? viewerRole === "pharmacien"
      ? "selfPharmacien"
      : "selfPatient"
    : variant === "consultation"
      ? "otherConsultation"
      : "otherDefault";

  return (
    <li className={cn("rounded-lg border px-3 py-2.5 text-[12px] leading-snug", bubbleClass(tone))}>
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
        <span className="font-semibold text-foreground">
          {conversationAuthorLabelFr(message.author_role, self)}
        </span>
        <time className="shrink-0 text-[9px] tabular-nums text-muted-foreground" dateTime={message.created_at}>
          {formatConversationTimestamp(message.created_at)}
        </time>
      </div>
      {deleted ? (
        <p className="mt-1 italic text-muted-foreground">Message retiré.</p>
      ) : (
        <>
          {hasText ? (
            <p className="mt-1 whitespace-pre-wrap text-foreground">{message.comment_text}</p>
          ) : null}
          {hasAudio && message.audio_path ? (
            <ConversationAudioPlayer
              audioPath={message.audio_path}
              durationSeconds={message.audio_duration_seconds}
            />
          ) : null}
        </>
      )}
      {self && !deleted && !composerDisabled && onSoftDelete ? (
        <div className="mt-1.5 flex justify-end">
          <button
            type="button"
            onClick={() => onSoftDelete(message.id)}
            className="inline-flex items-center gap-1 rounded-md border border-destructive/25 bg-background px-2 py-1 text-[9px] font-semibold text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="size-3" aria-hidden />
            Retirer
          </button>
        </div>
      ) : null}
    </li>
  );
}
