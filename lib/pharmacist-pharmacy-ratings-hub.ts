import { formatDateTimeShort24hFr } from "@/lib/datetime-fr";
import { rowMatchesPublicRefQuery } from "@/lib/public-ref";

export type PharmacistPharmacyRatingRow = {
  rating_id: string;
  author_id: string;
  patient_display_name: string;
  patient_ref: string;
  score: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
  was_updated: boolean;
};

export type PharmacistPharmacyRatingsSnapshot = {
  rating_avg: number;
  rating_count: number;
  with_comment: number;
  last_7_days: number;
  last_30_days: number;
  by_score: Partial<Record<"1" | "2" | "3" | "4" | "5", number>>;
};

export type PharmacyRatingScoreFilter = "all" | 1 | 2 | 3 | 4 | 5;
export type PharmacyRatingPeriodFilter = "all" | "7d" | "30d";

export function normalizePharmacistPharmacyRatingRow(raw: Record<string, unknown>): PharmacistPharmacyRatingRow {
  return {
    rating_id: String(raw.rating_id),
    author_id: String(raw.author_id),
    patient_display_name: String(raw.patient_display_name ?? "").trim() || "Patient",
    patient_ref: String(raw.patient_ref ?? "").trim(),
    score: Number(raw.score) || 0,
    comment: raw.comment != null && String(raw.comment).trim() ? String(raw.comment).trim() : null,
    created_at: String(raw.created_at),
    updated_at: String(raw.updated_at),
    was_updated: Boolean(raw.was_updated),
  };
}

export function normalizePharmacistPharmacyRatingsSnapshot(raw: unknown): PharmacistPharmacyRatingsSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const byScoreRaw = o.by_score;
  const by_score: PharmacistPharmacyRatingsSnapshot["by_score"] = {};
  if (byScoreRaw && typeof byScoreRaw === "object") {
    for (const k of ["1", "2", "3", "4", "5"] as const) {
      const v = (byScoreRaw as Record<string, unknown>)[k];
      if (v != null) by_score[k] = Number(v) || 0;
    }
  }
  return {
    rating_avg: Number(o.rating_avg) || 0,
    rating_count: Number(o.rating_count) || 0,
    with_comment: Number(o.with_comment) || 0,
    last_7_days: Number(o.last_7_days) || 0,
    last_30_days: Number(o.last_30_days) || 0,
    by_score,
  };
}

export function formatPharmacyRatingAvgFr(avg: number): string {
  if (!avg || avg <= 0) return "—";
  return avg.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function formatPharmacyRatingDate(iso: string, wasUpdated: boolean, updatedAt: string): string {
  const label = formatDateTimeShort24hFr(wasUpdated ? updatedAt : iso);
  return wasUpdated ? `${label} (modifié)` : label;
}

export function pharmacistPharmacyRatingPatientHref(authorId: string): string {
  return `/dashboard/pharmacien/clients/${authorId}`;
}

export function filterPharmacistPharmacyRatings(
  rows: PharmacistPharmacyRatingRow[],
  opts: {
    searchQuery: string;
    score: PharmacyRatingScoreFilter;
    period: PharmacyRatingPeriodFilter;
    withCommentOnly: boolean;
  }
): PharmacistPharmacyRatingRow[] {
  let list = rows;

  if (opts.score !== "all") {
    list = list.filter((r) => r.score === opts.score);
  }

  if (opts.withCommentOnly) {
    list = list.filter((r) => Boolean(r.comment?.trim()));
  }

  if (opts.period !== "all") {
    const cutoffMs =
      opts.period === "7d" ? Date.now() - 7 * 86_400_000 : Date.now() - 30 * 86_400_000;
    list = list.filter((r) => new Date(r.created_at).getTime() >= cutoffMs);
  }

  const q = opts.searchQuery.trim();
  if (q.length >= 2) {
    list = list.filter((r) =>
      rowMatchesPublicRefQuery(q, [r.patient_ref, r.patient_display_name, r.comment ?? ""])
    );
  }

  return list;
}

export function scoreDistributionPercents(
  snapshot: PharmacistPharmacyRatingsSnapshot
): { score: 1 | 2 | 3 | 4 | 5; count: number; pct: number }[] {
  const total = snapshot.rating_count || 0;
  return ([5, 4, 3, 2, 1] as const).map((score) => {
    const count = snapshot.by_score[String(score) as keyof typeof snapshot.by_score] ?? 0;
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return { score, count, pct };
  });
}
