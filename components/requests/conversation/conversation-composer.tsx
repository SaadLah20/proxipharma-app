"use client";

import { Mic, Send, Square, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { REQUEST_CONVERSATION_AUDIO_MAX_SECONDS, REQUEST_CONVERSATION_MESSAGE_MAX } from "@/lib/patient-request-form-limits";
import { useConversationAudioRecorder } from "@/lib/use-conversation-audio-recorder";
import { cn } from "@/lib/utils";

type Props = {
  draft: string;
  onDraftChange: (value: string) => void;
  sending: boolean;
  disabled?: boolean;
  error?: string;
  onSend: (pendingAudio: ReturnType<typeof useConversationAudioRecorder>["draft"]) => Promise<boolean> | boolean;
  sendButtonClassName?: string;
  readonlyMessage?: string;
};

export function ConversationComposer({
  draft,
  onDraftChange,
  sending,
  disabled = false,
  error = "",
  onSend,
  sendButtonClassName,
  readonlyMessage,
}: Props) {
  const recorder = useConversationAudioRecorder();
  const canSend = !disabled && !sending && (draft.trim().length > 0 || recorder.draft != null);
  const displayErr = error || recorder.error;

  if (disabled && readonlyMessage) {
    return <p className="text-[11px] leading-snug text-muted-foreground">{readonlyMessage}</p>;
  }

  return (
    <>
      {displayErr ? (
        <p className="mb-2 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-[10px] text-destructive">
          {displayErr}
        </p>
      ) : null}

      {recorder.draft ? (
        <div className="mb-2 rounded-lg border border-border/80 bg-muted/30 px-2.5 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] font-semibold text-foreground">
              Message vocal · {recorder.draft.durationSeconds} s
            </p>
            <button
              type="button"
              onClick={recorder.clearDraft}
              disabled={sending}
              className="inline-flex items-center gap-1 rounded-md border border-destructive/25 px-2 py-0.5 text-[9px] font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
            >
              <Trash2 className="size-3" aria-hidden />
              Supprimer
            </button>
          </div>
          <audio controls preload="none" src={recorder.draft.previewUrl} className="mt-1.5 h-8 w-full max-w-full" />
        </div>
      ) : null}

      {recorder.recording ? (
        <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-2.5 py-2">
          <p className="text-[10px] font-semibold text-destructive tabular-nums">
            Enregistrement… {recorder.elapsedSeconds}/{REQUEST_CONVERSATION_AUDIO_MAX_SECONDS} s
          </p>
          <button
            type="button"
            onClick={recorder.stopRecording}
            className="inline-flex items-center gap-1 rounded-md border border-destructive/40 bg-background px-2 py-1 text-[9px] font-semibold text-destructive"
          >
            <Square className="size-3 fill-current" aria-hidden />
            Arrêter
          </button>
        </div>
      ) : null}

      <label className="block text-[10px] font-semibold text-foreground">
        Votre message
        <textarea
          value={draft}
          onChange={(e) => onDraftChange(e.target.value.slice(0, REQUEST_CONVERSATION_MESSAGE_MAX))}
          rows={3}
          maxLength={REQUEST_CONVERSATION_MESSAGE_MAX}
          placeholder="Précision, question…"
          disabled={disabled || sending}
          className="mt-1 w-full resize-y rounded-lg border border-input bg-background px-2 py-2 text-[12px] leading-relaxed text-foreground placeholder:text-muted-foreground/70 disabled:opacity-60"
        />
      </label>

      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="text-[9px] tabular-nums text-muted-foreground">
          {draft.length}/{REQUEST_CONVERSATION_MESSAGE_MAX}
        </span>
        <div className="flex items-center gap-1.5">
          {recorder.supported ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled || sending || recorder.recording || Boolean(recorder.draft)}
              onClick={() => void recorder.startRecording()}
              className="h-8 gap-1 px-2 text-xs"
              title={`Enregistrer un message vocal (max ${REQUEST_CONVERSATION_AUDIO_MAX_SECONDS} s)`}
              aria-label="Enregistrer un message vocal"
            >
              <Mic className="size-3.5" aria-hidden />
              Vocal
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            disabled={!canSend}
            onClick={() => {
              void (async () => {
                const ok = await onSend(recorder.draft);
                if (ok) recorder.clearDraft();
              })();
            }}
            className={cn("h-8 gap-1 text-xs", sendButtonClassName)}
          >
            <Send className="size-3.5" aria-hidden />
            {sending ? "Envoi…" : "Envoyer"}
          </Button>
        </div>
      </div>
    </>
  );
}
