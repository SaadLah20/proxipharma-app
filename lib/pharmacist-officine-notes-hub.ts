import { formatDateTimeShort24hFr } from "@/lib/datetime-fr";
import { requestStatusShortFrPharmacien, requestTypeFr } from "@/lib/request-display";
import { rowMatchesPublicRefQuery } from "@/lib/public-ref";

export type OfficineNoteKind =
  | "pharmacy_line"
  | "patient_line"
  | "pharmacy_alternative"
  | "dossier_patient_product"
  | "dossier_patient_prescription"
  | "promo_patient"
  | "promo_pharmacy";

export type OfficineNoteRow = {
  note_key: string;
  note_kind: OfficineNoteKind;
  note_body: string;
  noted_at: string;
  patient_id: string | null;
  patient_display_name: string;
  patient_ref: string;
  request_id: string | null;
  request_public_ref: string;
  request_type: string;
  request_status: string;
  context_label: string;
  source_id: string;
  promo_reservation_id: string | null;
};

export type OfficineNotesSnapshot = {
  total_notes: number;
  pharmacy_notes: number;
  patient_notes: number;
  distinct_patients: number;
  last_7_days: number;
  last_30_days: number;
  by_kind: Partial<Record<OfficineNoteKind, number>>;
};

export type OfficineNoteSide = "pharmacy" | "patient";

export type OfficineNoteKindMeta = {
  label: string;
  shortLabel: string;
  side: OfficineNoteSide;
};

export const officineNoteKindMeta: Record<OfficineNoteKind, OfficineNoteKindMeta> = {
  pharmacy_line: { label: "Note officine (ligne)", shortLabel: "Officine", side: "pharmacy" },
  patient_line: { label: "Note patient (ligne)", shortLabel: "Patient", side: "patient" },
  pharmacy_alternative: { label: "Note officine (alternative)", shortLabel: "Alt. officine", side: "pharmacy" },
  dossier_patient_product: { label: "Message patient (demande)", shortLabel: "Patient", side: "patient" },
  dossier_patient_prescription: { label: "Message patient (ordonnance)", shortLabel: "Patient", side: "patient" },
  promo_patient: { label: "Note patient (pack promo)", shortLabel: "Patient", side: "patient" },
  promo_pharmacy: { label: "Note officine (pack promo)", shortLabel: "Officine", side: "pharmacy" },
};

const OFFICINE_NOTE_KINDS = new Set<string>(Object.keys(officineNoteKindMeta));

export function normalizeOfficineNoteRow(raw: Record<string, unknown>): OfficineNoteRow {
  const kindRaw = String(raw.note_kind ?? "pharmacy_line");
  const note_kind = OFFICINE_NOTE_KINDS.has(kindRaw) ? (kindRaw as OfficineNoteKind) : "pharmacy_line";

  return {
    note_key: String(raw.note_key),
    note_kind,
    note_body: String(raw.note_body ?? "").trim(),
    noted_at: String(raw.noted_at),
    patient_id: raw.patient_id != null ? String(raw.patient_id) : null,
    patient_display_name: String(raw.patient_display_name ?? "").trim() || "Patient",
    patient_ref: String(raw.patient_ref ?? "").trim(),
    request_id: raw.request_id != null ? String(raw.request_id) : null,
    request_public_ref: String(raw.request_public_ref ?? "").trim(),
    request_type: String(raw.request_type ?? ""),
    request_status: String(raw.request_status ?? ""),
    context_label: String(raw.context_label ?? "").trim() || "Contexte",
    source_id: String(raw.source_id),
    promo_reservation_id: raw.promo_reservation_id != null ? String(raw.promo_reservation_id) : null,
  };
}

export function normalizeOfficineNotesSnapshot(raw: unknown): OfficineNotesSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const byKindRaw = o.by_kind;
  const by_kind: Partial<Record<OfficineNoteKind, number>> = {};
  if (byKindRaw && typeof byKindRaw === "object") {
    for (const [k, v] of Object.entries(byKindRaw as Record<string, unknown>)) {
      if (OFFICINE_NOTE_KINDS.has(k)) {
        by_kind[k as OfficineNoteKind] = Number(v) || 0;
      }
    }
  }
  return {
    total_notes: Number(o.total_notes) || 0,
    pharmacy_notes: Number(o.pharmacy_notes) || 0,
    patient_notes: Number(o.patient_notes) || 0,
    distinct_patients: Number(o.distinct_patients) || 0,
    last_7_days: Number(o.last_7_days) || 0,
    last_30_days: Number(o.last_30_days) || 0,
    by_kind,
  };
}

export function formatOfficineNoteDate(iso: string): string {
  return formatDateTimeShort24hFr(iso);
}

export function officineNoteRequestTypeLabel(requestType: string): string {
  if (requestType === "promo_reservation") return "Réservation pack";
  return requestTypeFr[requestType] ?? requestType;
}

export function officineNoteRequestStatusLabel(status: string): string {
  return requestStatusShortFrPharmacien(status);
}

export function officineNoteSourceHref(row: OfficineNoteRow): string | null {
  if (row.promo_reservation_id) {
    return `/dashboard/pharmacien/reservations-packs/${row.promo_reservation_id}`;
  }
  if (row.request_id) {
    return `/dashboard/pharmacien/demandes/${row.request_id}`;
  }
  return null;
}

export function officineNotePatientHref(patientId: string | null): string | null {
  if (!patientId) return null;
  return `/dashboard/pharmacien/clients/${patientId}`;
}

export type OfficineNoteFilterSide = "all" | OfficineNoteSide;
export type OfficineNotePeriodFilter = "all" | "7d" | "30d";

export function filterOfficineNotes(
  rows: OfficineNoteRow[],
  opts: {
    searchQuery: string;
    side: OfficineNoteFilterSide;
    period: OfficineNotePeriodFilter;
    kind: OfficineNoteKind | "all";
  }
): OfficineNoteRow[] {
  let list = rows;

  if (opts.side !== "all") {
    list = list.filter((r) => officineNoteKindMeta[r.note_kind].side === opts.side);
  }

  if (opts.kind !== "all") {
    list = list.filter((r) => r.note_kind === opts.kind);
  }

  if (opts.period !== "all") {
    const cutoffMs =
      opts.period === "7d"
        ? Date.now() - 7 * 86_400_000
        : Date.now() - 30 * 86_400_000;
    list = list.filter((r) => new Date(r.noted_at).getTime() >= cutoffMs);
  }

  const q = opts.searchQuery.trim();
  if (q.length >= 2) {
    list = list.filter((r) =>
      rowMatchesPublicRefQuery(q, [
        r.patient_ref,
        r.patient_display_name,
        r.request_public_ref,
        r.context_label,
        r.note_body,
      ])
    );
  }

  return list;
}
