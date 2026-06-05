"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  REQUEST_CONVERSATION_AUDIO_MAX_SECONDS,
  clampConversationAudioDurationSeconds,
  conversationRecorderSupported,
  pickConversationRecorderMimeType,
} from "@/lib/conversation-audio-media";

export type ConversationAudioDraft = {
  blob: Blob;
  mimeType: string;
  durationSeconds: number;
  previewUrl: string;
};

export type UseConversationAudioRecorderResult = {
  supported: boolean;
  recording: boolean;
  elapsedSeconds: number;
  draft: ConversationAudioDraft | null;
  error: string;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  clearDraft: () => void;
};

function revokePreviewUrl(url: string | null) {
  if (url) URL.revokeObjectURL(url);
}

export function useConversationAudioRecorder(): UseConversationAudioRecorderResult {
  const supported = conversationRecorderSupported();
  const [recording, setRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [draft, setDraft] = useState<ConversationAudioDraft | null>(null);
  const [error, setError] = useState("");

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeRef = useRef<string>("");
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const clearTick = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const clearDraft = useCallback(() => {
    setDraft((prev) => {
      revokePreviewUrl(prev?.previewUrl ?? null);
      return null;
    });
    setError("");
  }, []);

  const finalizeRecording = useCallback(() => {
    clearTick();
    setRecording(false);
    const rec = recorderRef.current;
    recorderRef.current = null;
    if (rec && rec.state !== "inactive") {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    }
  }, [clearTick]);

  const stopRecording = useCallback(() => {
    if (!recording) return;
    finalizeRecording();
  }, [finalizeRecording, recording]);

  const startRecording = useCallback(async () => {
    setError("");
    if (!supported) {
      setError("Enregistrement vocal non disponible sur ce navigateur.");
      return;
    }
    if (recording) return;

    clearDraft();

    const mimeType = pickConversationRecorderMimeType();
    if (!mimeType) {
      setError("Enregistrement vocal non disponible sur ce navigateur.");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Accès au micro refusé. Autorisez le micro ou utilisez le texte.");
      return;
    }

    streamRef.current = stream;
    chunksRef.current = [];
    mimeRef.current = mimeType;

    const rec = new MediaRecorder(stream, { mimeType });
    recorderRef.current = rec;
    startedAtRef.current = Date.now();
    setElapsedSeconds(0);
    setRecording(true);

    rec.ondataavailable = (ev) => {
      if (ev.data.size > 0) chunksRef.current.push(ev.data);
    };

    rec.onstop = () => {
      cleanupStream();
      const blob = new Blob(chunksRef.current, { type: mimeRef.current });
      chunksRef.current = [];
      const durationSeconds = clampConversationAudioDurationSeconds(
        (Date.now() - startedAtRef.current) / 1000
      );
      if (blob.size === 0) {
        setError("Enregistrement vide. Réessayez.");
        return;
      }
      const previewUrl = URL.createObjectURL(blob);
      setDraft({ blob, mimeType: mimeRef.current, durationSeconds, previewUrl });
      setElapsedSeconds(durationSeconds);
    };

    rec.onerror = () => {
      cleanupStream();
      clearTick();
      setRecording(false);
      setError("Erreur d'enregistrement. Réessayez.");
    };

    rec.start(250);

    clearTick();
    tickRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAtRef.current) / 1000);
      setElapsedSeconds(elapsed);
      if (elapsed >= REQUEST_CONVERSATION_AUDIO_MAX_SECONDS) {
        finalizeRecording();
      }
    }, 200);
  }, [clearDraft, clearTick, cleanupStream, finalizeRecording, recording, supported]);

  useEffect(() => {
    return () => {
      clearTick();
      cleanupStream();
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        try {
          recorderRef.current.stop();
        } catch {
          /* ignore */
        }
      }
      setDraft((prev) => {
        revokePreviewUrl(prev?.previewUrl ?? null);
        return null;
      });
    };
  }, [cleanupStream, clearTick]);

  return {
    supported,
    recording,
    elapsedSeconds,
    draft,
    error,
    startRecording,
    stopRecording,
    clearDraft,
  };
}
