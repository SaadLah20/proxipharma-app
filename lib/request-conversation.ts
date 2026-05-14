import { formatDateTimeShort24hFr } from "@/lib/datetime-fr";

export type RequestCommentRow = {
  id: string;
  created_at: string;
  author_id: string | null;
  author_role: "patient" | "pharmacien" | "admin" | "system";
  comment_text: string;
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
