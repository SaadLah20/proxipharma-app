/** Fenêtres d’édition des notes par ligne (`client_comment` / `pharmacist_comment`). */

const PHARMACIST_NOTE_EDIT_STATUSES = new Set(["submitted", "in_review"]);

const LOCKED_LINE_NOTE_REQUEST_STATUSES = new Set([
  "confirmed",
  "treated",
  "completed",
  "partially_collected",
  "fully_collected",
  "cancelled",
  "abandoned",
  "expired",
]);

/** Patient : note ligne produit à l’envoi ou en modification avant réponse officine. */
export function patientCanEditLineProductNotes(status: string | null | undefined): boolean {
  if (!status) return false;
  return status === "submitted" || status === "in_review";
}

/** Pharmacien : note ligne à la première réponse ou en « Modifier » sur une réponse `responded`. */
export function pharmacistCanEditLineProductNotes(
  status: string | null | undefined,
  opts?: { respondedEditMode?: boolean; archiveFrozen?: boolean }
): boolean {
  if (opts?.archiveFrozen || !status) return false;
  if (PHARMACIST_NOTE_EDIT_STATUSES.has(status)) return true;
  if (status === "responded" && opts?.respondedEditMode) return true;
  return false;
}

export function requestStatusLocksLineProductNotes(status: string | null | undefined): boolean {
  if (!status) return false;
  return LOCKED_LINE_NOTE_REQUEST_STATUSES.has(status);
}
