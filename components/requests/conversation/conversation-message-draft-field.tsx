"use client";

import { useEffect } from "react";
import { Mic, Square, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { REQUEST_CONVERSATION_AUDIO_MAX_SECONDS, REQUEST_CONVERSATION_MESSAGE_MAX } from "@/lib/patient-request-form-limits";
import {
  type ConversationAudioDraft,
  useConversationAudioRecorder,
} from "@/lib/use-conversation-audio-recorder";
import { cn } from "@/lib/utils";

export function ConversationAudioDraftPreview({
  draft,
  className,
}: {
  draft: ConversationAudioDraft;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-border/80 bg-muted/20 px-3 py-2", className)}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Message vocal</p>
      <p className="mt-0.5 text-sm text-foreground">{draft.durationSeconds} s</p>
    </div>
  );
}

type Props = {
  draft: string;
  onDraftChange: (value: string) => void;
  maxLength?: number;
  disabled?: boolean;
  placeholder?: string;
  onAudioDraftChange?: (draft: ConversationAudioDraft | null) => void;
  textareaClassName?: string;
  counterClassName?: string;
  /** Affiche le libellé « Votre message » au-dessus du textarea. */
  showFieldLabel?: boolean;
  showCounter?: boolean;
  micButtonVariant?: "outline" | "default";
  micButtonClassName?: string;
  /** Boutons à droite du compteur / Vocal (ex. Envoyer dans le fil conversation). */
  trailingActions?: React.ReactNode;
  /** Affiche le textarea ; false = bouton Vocal seul (ex. consultation avec texte ailleurs). */
  textEnabled?: boolean;
  /** Incrémenter après envoi réussi pour vider le brouillon vocal interne. */
  audioDraftClearSignal?: number;
};

export function ConversationMessageDraftField({
  draft,
  onDraftChange,
  maxLength = REQUEST_CONVERSATION_MESSAGE_MAX,
  disabled = false,
  placeholder = "Précision, question…",
  onAudioDraftChange,
  textareaClassName,
  counterClassName,
  showFieldLabel = false,
  showCounter = true,
  textEnabled = true,
  micButtonVariant = "outline",
  micButtonClassName,
  trailingActions,
  audioDraftClearSignal = 0,
}: Props) {
  const recorder = useConversationAudioRecorder();

  useEffect(() => {
    onAudioDraftChange?.(recorder.draft);
  }, [recorder.draft, onAudioDraftChange]);

  useEffect(() => {
    if (audioDraftClearSignal <= 0) return;
    recorder.clearDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clear signal only
  }, [audioDraftClearSignal]);

  const textarea = (
    <textarea
      value={draft}
      onChange={(e) => onDraftChange(e.target.value.slice(0, maxLength))}
      rows={3}
      maxLength={maxLength}
      placeholder={placeholder}
      disabled={disabled}
      className={textareaClassName}
    />
  );

  return (
    <>
      {recorder.error ? (
        <p className="mb-2 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-[10px] text-destructive">
          {recorder.error}
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
              disabled={disabled}
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

      {textEnabled ? (
        showFieldLabel ? (
          <label className="block text-[10px] font-semibold text-foreground">
            Votre message
            <div className="mt-1">{textarea}</div>
          </label>
        ) : (
          textarea
        )
      ) : null}

      <div
        className={cn(
          "flex items-center justify-between gap-2",
          textEnabled ? "mt-1" : "mt-0",
          !showCounter && !textEnabled && "justify-end"
        )}
      >
        {showCounter && textEnabled ? (
          <span className={cn("text-[9px] tabular-nums text-muted-foreground", counterClassName)}>
            {draft.length}/{maxLength}
          </span>
        ) : (
          <span className="min-w-0 flex-1" />
        )}
        {recorder.supported ? (
          <Button
            type="button"
            size="sm"
            variant={micButtonVariant}
            disabled={disabled || recorder.recording || Boolean(recorder.draft)}
            onClick={() => void recorder.startRecording()}
            className={cn("h-8 gap-1 px-2 text-xs", micButtonClassName)}
            title={`Enregistrer un message vocal (max ${REQUEST_CONVERSATION_AUDIO_MAX_SECONDS} s)`}
            aria-label="Enregistrer un message vocal"
          >
            <Mic className="size-3.5" aria-hidden />
            Vocal
          </Button>
        ) : null}
        {trailingActions}
      </div>
    </>
  );
}
