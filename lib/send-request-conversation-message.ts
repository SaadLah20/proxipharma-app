import type { SupabaseClient } from "@supabase/supabase-js";
import { uploadConversationAudioBlob } from "@/lib/conversation-audio-media";
import { REQUEST_CONVERSATION_MESSAGE_MAX } from "@/lib/patient-request-form-limits";

export type PendingConversationAudio = {
  blob: Blob;
  mimeType: string;
  durationSeconds: number;
};

export type SendRequestConversationMessageInput = {
  supabase: SupabaseClient;
  requestId: string;
  authorId: string;
  authorRole: "patient" | "pharmacien";
  text: string;
  pendingAudio?: PendingConversationAudio | null;
};

export type SendRequestConversationMessageResult =
  | { ok: true; commentId: string }
  | { ok: false; error: string };

export async function sendRequestConversationMessage(
  input: SendRequestConversationMessageInput
): Promise<SendRequestConversationMessageResult> {
  const textTrim = input.text.trim().slice(0, REQUEST_CONVERSATION_MESSAGE_MAX);
  const hasText = textTrim.length > 0;
  const hasAudio = Boolean(input.pendingAudio?.blob);

  if (!hasText && !hasAudio) {
    return { ok: false, error: "Saisissez un message ou enregistrez un vocal." };
  }

  const commentId = crypto.randomUUID();
  let audioPath: string | null = null;
  let audioDuration: number | null = null;

  if (hasAudio && input.pendingAudio) {
    const { path, error: upErr } = await uploadConversationAudioBlob(
      input.requestId,
      commentId,
      input.pendingAudio.blob,
      input.pendingAudio.mimeType
    );
    if (upErr) return { ok: false, error: upErr };
    audioPath = path;
    audioDuration = input.pendingAudio.durationSeconds;
  }

  const { error } = await input.supabase.from("request_comments").insert({
    id: commentId,
    request_id: input.requestId,
    author_id: input.authorId,
    author_role: input.authorRole,
    comment_text: hasText ? textTrim : null,
    audio_path: audioPath,
    audio_duration_seconds: audioDuration,
    is_internal: false,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, commentId };
}

export const REQUEST_COMMENT_SELECT_FIELDS =
  "id,created_at,author_id,author_role,comment_text,audio_path,audio_duration_seconds,deleted_at" as const;
