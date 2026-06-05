import { formatDateTimeShort24hFr } from "@/lib/datetime-fr";

export type RequestCommentRow = {
  id: string;
  created_at: string;
  author_id: string | null;
  author_role: "patient" | "pharmacien" | "admin" | "system";
  comment_text: string | null;
  audio_path: string | null;
  audio_duration_seconds: number | null;
  deleted_at: string | null;
};

export function conversationAuthorLabelFr(role: RequestCommentRow["author_role"], isSelf: boolean): string {
  if (isSelf) return "Vous";
  if (role === "pharmacien") return "Pharmacie";
  if (role === "patient") return "Patient";
  if (role === "admin") return "Équipe";
  return "Système";
}

export function formatConversationTimestamp(iso: string): string {
  return formatDateTimeShort24hFr(iso);
}

export function conversationMessageHasAudio(row: Pick<RequestCommentRow, "audio_path" | "deleted_at">): boolean {
  return Boolean(!row.deleted_at && row.audio_path?.trim());
}

export function conversationMessageHasText(row: Pick<RequestCommentRow, "comment_text" | "deleted_at">): boolean {
  return Boolean(!row.deleted_at && row.comment_text?.trim());
}

/** Aperçu court (notif / listes). */
export function conversationMessagePreviewFr(
  row: Pick<RequestCommentRow, "comment_text" | "audio_duration_seconds" | "deleted_at">
): string {
  if (row.deleted_at) return "Message retiré.";
  const text = row.comment_text?.trim() ?? "";
  const dur = row.audio_duration_seconds;
  if (dur != null && !text) return `Message vocal (${dur} s)`;
  if (dur != null && text) return `${text.slice(0, 80)} · vocal (${dur} s)`;
  return text || "Message";
}
