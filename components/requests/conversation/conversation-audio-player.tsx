"use client";

import { useEffect, useState } from "react";
import { createConversationAudioSignedUrl } from "@/lib/conversation-audio-media";
import { cn } from "@/lib/utils";

type Props = {
  audioPath: string;
  durationSeconds?: number | null;
  className?: string;
};

function ConversationAudioPlayerInner({ audioPath, durationSeconds, className }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { url, error } = await createConversationAudioSignedUrl(audioPath);
      if (cancelled) return;
      if (url) setSrc(url);
      else setLoadErr(error ?? "Impossible de charger le message vocal.");
    })();
    return () => {
      cancelled = true;
    };
  }, [audioPath]);

  if (loadErr) {
    return <p className={cn("text-[10px] text-destructive", className)}>{loadErr}</p>;
  }

  if (!src) {
    return <p className={cn("text-[10px] text-muted-foreground", className)}>Chargement audio…</p>;
  }

  return (
    <div className={cn("mt-1.5 flex flex-wrap items-center gap-2", className)}>
      <audio controls preload="none" src={src} className="h-8 max-w-full min-w-[12rem] flex-1" />
      {durationSeconds != null ? (
        <span className="text-[9px] tabular-nums text-muted-foreground">{durationSeconds} s</span>
      ) : null}
    </div>
  );
}

export function ConversationAudioPlayer(props: Props) {
  return <ConversationAudioPlayerInner key={props.audioPath} {...props} />;
}
