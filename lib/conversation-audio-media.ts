import { fetchPrivateMediaSignedUrl } from "@/lib/private-media-signed-url-client";
import {
  REQUEST_CONVERSATION_AUDIO_MAX_BYTES,
  REQUEST_CONVERSATION_AUDIO_MAX_SECONDS,
} from "@/lib/patient-request-form-limits";
import { supabase } from "@/lib/supabase";
import { STORAGE_BUCKET_PRIVATE, conversationAudioObjectPath } from "@/lib/storage-media";

export { REQUEST_CONVERSATION_AUDIO_MAX_BYTES, REQUEST_CONVERSATION_AUDIO_MAX_SECONDS };

export type ConversationAudioExt = "webm" | "mp4" | "m4a";

export function conversationAudioExtFromMime(mime: string): ConversationAudioExt | null {
  const m = mime.toLowerCase().split(";")[0]?.trim() ?? "";
  if (m.includes("webm")) return "webm";
  if (m.includes("mp4") || m.includes("mpeg")) return "mp4";
  if (m.includes("m4a") || m.includes("aac")) return "m4a";
  if (m.includes("ogg")) return "webm";
  return null;
}

/** Content-Type Storage (sans param codecs) — doit être dans allowed_mime_types du bucket. */
export function conversationAudioUploadContentType(mimeType: string, ext: ConversationAudioExt): string {
  const base = mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (base === "audio/webm" || base === "audio/mp4" || base === "audio/m4a" || base === "audio/aac") {
    return base;
  }
  if (base === "audio/x-m4a") return "audio/m4a";
  if (base === "audio/ogg") return "audio/ogg";
  if (ext === "m4a") return "audio/mp4";
  return `audio/${ext}`;
}

export function pickConversationRecorderMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/aac"];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return null;
}

export function conversationRecorderSupported(): boolean {
  return pickConversationRecorderMimeType() != null;
}

export async function createConversationAudioSignedUrl(
  objectPath: string,
  expiresInSeconds = 3600
): Promise<{ url: string | null; error: string | null }> {
  const viaApi = await fetchPrivateMediaSignedUrl(objectPath);
  if (viaApi.url) return viaApi;

  const path = objectPath.replace(/^\//, "");
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET_PRIVATE)
    .createSignedUrl(path, expiresInSeconds);
  if (error) return { url: null, error: viaApi.error ?? error.message };
  return { url: data.signedUrl ?? null, error: null };
}

export async function uploadConversationAudioBlob(
  requestId: string,
  commentId: string,
  blob: Blob,
  mimeType: string
): Promise<{ path: string; error: string | null }> {
  if (blob.size > REQUEST_CONVERSATION_AUDIO_MAX_BYTES) {
    return {
      path: "",
      error: `Message vocal trop volumineux (max ${Math.round(REQUEST_CONVERSATION_AUDIO_MAX_BYTES / 1024)} Ko).`,
    };
  }

  const ext = conversationAudioExtFromMime(mimeType) ?? conversationAudioExtFromMime(blob.type);
  if (!ext) {
    return { path: "", error: "Format audio non pris en charge." };
  }

  const objectPath = conversationAudioObjectPath(requestId, commentId, ext);
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return { path: objectPath, error: "Session expirée. Reconnectez-vous." };
  }

  const { error } = await supabase.storage.from(STORAGE_BUCKET_PRIVATE).upload(objectPath, blob, {
    upsert: true,
    contentType: conversationAudioUploadContentType(mimeType || blob.type, ext),
  });

  if (error) {
    const hint =
      error.message.toLowerCase().includes("row-level security") ||
      error.message.toLowerCase().includes("policy")
        ? " Appliquez la migration 20260706_001_conversation_audio_messages.sql sur Supabase."
        : "";
    return { path: objectPath, error: `${error.message}${hint}` };
  }

  return { path: objectPath, error: null };
}

export function clampConversationAudioDurationSeconds(seconds: number): number {
  const s = Math.max(1, Math.min(REQUEST_CONVERSATION_AUDIO_MAX_SECONDS, Math.round(seconds)));
  return s;
}
