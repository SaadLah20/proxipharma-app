"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { REQUEST_CONVERSATION_MESSAGE_MAX } from "@/lib/patient-request-form-limits";
import { type ConversationAudioDraft } from "@/lib/use-conversation-audio-recorder";
import { cn } from "@/lib/utils";
import { ConversationMessageDraftField } from "@/components/requests/conversation/conversation-message-draft-field";

type Props = {
  draft: string;
  onDraftChange: (value: string) => void;
  sending: boolean;
  disabled?: boolean;
  error?: string;
  onSend: (pendingAudio: ConversationAudioDraft | null) => Promise<boolean> | boolean;
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
  const t = useTranslations("conversation");
  const tCommon = useTranslations("common");
  const [pendingAudio, setPendingAudio] = useState<ConversationAudioDraft | null>(null);
  const [audioDraftClearSignal, setAudioDraftClearSignal] = useState(0);

  if (disabled && readonlyMessage) {
    return <p className="text-[11px] leading-snug text-muted-foreground">{readonlyMessage}</p>;
  }

  const canSend = !disabled && !sending && (draft.trim().length > 0 || pendingAudio != null);

  return (
    <>
      {error ? (
        <p className="mb-2 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-[10px] text-destructive">
          {error}
        </p>
      ) : null}

      <ConversationMessageDraftField
        draft={draft}
        onDraftChange={onDraftChange}
        disabled={disabled || sending}
        onAudioDraftChange={setPendingAudio}
        audioDraftClearSignal={audioDraftClearSignal}
        showFieldLabel
        maxLength={REQUEST_CONVERSATION_MESSAGE_MAX}
        textareaClassName="mt-1 w-full resize-y rounded-lg border border-input bg-background px-2 py-2 text-[12px] leading-relaxed text-foreground placeholder:text-muted-foreground/70 disabled:opacity-60"
        trailingActions={
          <Button
            type="button"
            size="sm"
            disabled={!canSend}
            onClick={() => {
              void (async () => {
                const ok = await onSend(pendingAudio);
                if (ok) {
                  setPendingAudio(null);
                  setAudioDraftClearSignal((n) => n + 1);
                }
              })();
            }}
            className={cn("h-8 gap-1 text-xs", sendButtonClassName)}
          >
            <Send className="size-3.5" aria-hidden />
            {sending ? tCommon("sending") : t("send")}
          </Button>
        }
      />
    </>
  );
}
