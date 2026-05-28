import { formatDateTimeShort24hFr } from "@/lib/datetime-fr";
import type { PatientOutcomeDetailContext } from "@/components/requests/patient-request-outcome-banner";
import type { PatientProductArchiveStatus } from "@/components/requests/patient-request-outcome-banner";
import { historyActorLabel } from "@/lib/request-display";
import { patientDossierHistoryDetailParagraphsFr } from "@/lib/patient-request-history-audit";

export type ArchiveHistoryRow = {
  id: string;
  created_at: string;
  old_status: string | null;
  new_status: string;
  reason: string | null;
};

export function findTerminalStatusHistoryEntry(
  rows: ArchiveHistoryRow[],
  terminalStatus: string
): ArchiveHistoryRow | null {
  return rows.find((h) => h.new_status === terminalStatus) ?? null;
}

/** Texte du bandeau dossier (statut Expirée) côté patient. */
export function patientExpiredDossierStatusHintFr(input: {
  expiredAt?: string | null;
  expiresAt?: string | null;
  respondedAt?: string | null;
}): string {
  const when = formatDateTimeShort24hFr(
    input.expiredAt?.trim() || input.expiresAt?.trim() || input.respondedAt?.trim() || ""
  );
  if (when) {
    return `Vous n'avez pas validé cette demande dans le délai de 24 h après la réponse de l'officine. Elle a été expirée automatiquement le ${when}.`;
  }
  return "Vous n'avez pas validé cette demande dans le délai de 24 h après la réponse de l'officine. Elle a été expirée automatiquement.";
}

/** Texte du bandeau dossier (statut Annulée) — qui, quand, motif. */
export function patientCancelledDossierStatusHintFr(entry: ArchiveHistoryRow | null): string {
  const actorLine = patientArchiveTerminalActorLineFr(entry);
  const motiveParts = patientArchiveTerminalMotiveParagraphsFr(entry);
  const motive =
    motiveParts.length > 0 ? ` Motif : ${motiveParts.join(" ")}` : "";
  if (actorLine) {
    return `Demande annulée · ${actorLine}.${motive} Les produits ci-dessous reprennent l'état du dossier avant annulation.`;
  }
  if (motive.trim()) {
    return `Demande annulée.${motive} Les produits ci-dessous reprennent l'état du dossier avant annulation.`;
  }
  return "Demande annulée. Les produits ci-dessous reprennent l'état du dossier avant annulation.";
}

/** Texte du bandeau dossier (statut Abandonnée) — qui, quand, motif. */
export function patientAbandonedDossierStatusHintFr(entry: ArchiveHistoryRow | null): string {
  const actorLine = patientArchiveTerminalActorLineFr(entry);
  const motiveParts = patientArchiveTerminalMotiveParagraphsFr(entry);
  const motive =
    motiveParts.length > 0 ? ` Motif : ${motiveParts.join(" ")}` : "";
  if (actorLine) {
    return `Demande abandonnée · ${actorLine}.${motive} Les produits ci-dessous reprennent l'état du dossier avant abandon.`;
  }
  if (motive.trim()) {
    return `Demande abandonnée.${motive} Les produits ci-dessous reprennent l'état du dossier avant abandon.`;
  }
  return "Demande abandonnée. Les produits ci-dessous reprennent l'état du dossier avant abandon.";
}

export type PatientProductClosedArchiveStatus =
  | "completed"
  | "partially_collected"
  | "fully_collected";

export function isPatientProductClosedArchiveStatus(
  status: string
): status is PatientProductClosedArchiveStatus {
  return status === "completed" || status === "partially_collected" || status === "fully_collected";
}

function isClosedCollectionStatus(status: PatientProductArchiveStatus): boolean {
  return isPatientProductClosedArchiveStatus(status);
}

type ClosedRecapItem = {
  is_selected_by_patient: boolean;
  counter_outcome?: string | null;
};

/** Texte du bandeau dossier (clôture comptoir) — récap + contexte. */
export function patientClosedDossierStatusHintFr(input: {
  terminalStatus: PatientProductClosedArchiveStatus;
  items: ClosedRecapItem[];
  historyEntry?: ArchiveHistoryRow | null;
}): string {
  const { terminalStatus, items, historyEntry } = input;
  const totalLines = items.length;
  const retainedCount = items.filter((r) => r.is_selected_by_patient).length;
  const pickedUpCount = items.filter(
    (r) => r.is_selected_by_patient && (r.counter_outcome ?? "unset") === "picked_up"
  ).length;
  const closedAt = historyEntry ? formatDateTimeShort24hFr(historyEntry.created_at) : "";

  const recap: string[] = [
    `${pickedUpCount} produit${pickedUpCount !== 1 ? "s" : ""} récupéré${pickedUpCount !== 1 ? "s" : ""} sur ${retainedCount} retenu${retainedCount !== 1 ? "s" : ""}`,
  ];
  if (totalLines !== retainedCount) {
    recap.push(`${totalLines} ligne${totalLines !== 1 ? "s" : ""} au total`);
  }
  if (closedAt) recap.push(`clôturée le ${closedAt}`);

  const head = `Dossier clôturé par votre officine — ${recap.join(" · ")}.`;
  if (terminalStatus === "fully_collected") {
    return `${head} Tous les produits retenus ont été retirés au comptoir.`;
  }
  if (terminalStatus === "partially_collected") {
    return `${head} Une partie des produits retenus a été retirée au comptoir.`;
  }
  return head;
}

/** Libellé « qui » + date pour le bandeau archive (annulée, expirée, abandonnée). */
export function patientArchiveTerminalActorLineFr(entry: ArchiveHistoryRow | null): string | null {
  if (!entry) return null;
  const who = historyActorLabel("patient", entry.reason);
  const when = formatDateTimeShort24hFr(entry.created_at);
  if (!when) return who;
  return `${who} · ${when}`;
}

export function buildPatientArchiveOutcomeDetailContext(_input: {
  terminalStatus: PatientProductArchiveStatus;
  items: { is_selected_by_patient: boolean; counter_outcome?: string | null }[];
  pharmacyName?: string | null;
  historyEntry?: ArchiveHistoryRow | null;
}): PatientOutcomeDetailContext | null {
  /** Résumé déplacé dans le bandeau dossier (`patient*DossierStatusHintFr`). */
  return null;
}

export function patientArchiveTerminalMotiveParagraphsFr(
  entry: ArchiveHistoryRow | null
): string[] {
  if (!entry?.reason?.trim()) return [];
  return patientDossierHistoryDetailParagraphsFr(entry.reason);
}
