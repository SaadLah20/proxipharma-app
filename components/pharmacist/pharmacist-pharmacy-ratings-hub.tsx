"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { ChevronRight, MessageSquare, Search, Star, User } from "lucide-react";
import { PharmacistAccountPageHeader } from "@/components/pharmacist/pharmacist-account-page-header";
import { PageShell } from "@/components/ui/compact-shell";
import { platformDashboardChrome as chrome } from "@/lib/platform-dashboard-chrome";
import {
  filterPharmacistPharmacyRatings,
  formatPharmacyRatingAvgFr,
  formatPharmacyRatingDate,
  normalizePharmacistPharmacyRatingRow,
  normalizePharmacistPharmacyRatingsSnapshot,
  pharmacistPharmacyRatingPatientHref,
  scoreDistributionPercents,
  type PharmacistPharmacyRatingRow,
  type PharmacistPharmacyRatingsSnapshot,
  type PharmacyRatingPeriodFilter,
  type PharmacyRatingScoreFilter,
} from "@/lib/pharmacist-pharmacy-ratings-hub";
import { supabase } from "@/lib/supabase";

function StarScore({ score, size = "sm" }: { score: number; size?: "sm" | "md" }) {
  const iconClass = size === "sm" ? "size-3.5" : "size-4";
  return (
    <div className="flex gap-0.5" role="img" aria-label={`${score} sur 5 étoiles`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={clsx(
            iconClass,
            n <= score ? "fill-amber-400 text-amber-500" : "text-muted-foreground/30"
          )}
          aria-hidden
        />
      ))}
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  accentClass,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accentClass?: string;
}) {
  return (
    <div className={clsx("rounded-xl border bg-card p-3 shadow-sm", accentClass ?? "border-border/80")}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function RatingCard({ row }: { row: PharmacistPharmacyRatingRow }) {
  const patientHref = pharmacistPharmacyRatingPatientHref(row.author_id);

  return (
    <li>
      <article className="rounded-xl border border-amber-200/70 bg-card shadow-sm transition hover:border-amber-300/80 hover:shadow-md">
        <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <StarScore score={row.score} />
              <span className="text-xs font-bold tabular-nums text-amber-900">{row.score}/5</span>
              <span className="text-[10px] text-muted-foreground">·</span>
              <time className="text-[10px] font-medium tabular-nums text-muted-foreground" dateTime={row.created_at}>
                {formatPharmacyRatingDate(row.created_at, row.was_updated, row.updated_at)}
              </time>
            </div>

            {row.comment ? (
              <p className="whitespace-pre-wrap text-sm leading-snug text-foreground">{row.comment}</p>
            ) : (
              <p className="text-xs italic text-muted-foreground">Avis sans commentaire écrit.</p>
            )}

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
              {row.patient_ref ? (
                <span className="font-mono font-bold text-emerald-900">{row.patient_ref}</span>
              ) : null}
              <Link href={patientHref} className="inline-flex items-center gap-1 font-semibold text-foreground hover:underline">
                <User className="h-3 w-3" aria-hidden />
                {row.patient_display_name}
              </Link>
            </div>
          </div>

          <Link
            href={patientHref}
            className="inline-flex shrink-0 items-center gap-1 self-start rounded-lg border border-border bg-muted/20 px-2.5 py-1.5 text-[11px] font-semibold hover:bg-muted/50"
          >
            Fiche client
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </article>
    </li>
  );
}

export function PharmacistPharmacyRatingsHub() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [migrationNote, setMigrationNote] = useState("");
  const [rows, setRows] = useState<PharmacistPharmacyRatingRow[]>([]);
  const [snapshot, setSnapshot] = useState<PharmacistPharmacyRatingsSnapshot | null>(null);
  const [pharmacyNom, setPharmacyNom] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [scoreFilter, setScoreFilter] = useState<PharmacyRatingScoreFilter>("all");
  const [periodFilter, setPeriodFilter] = useState<PharmacyRatingPeriodFilter>("all");
  const [withCommentOnly, setWithCommentOnly] = useState(false);

  const load = useCallback(async () => {
    setError("");
    setMigrationNote("");
    setLoading(true);

    const { data: auth } = await supabase.auth.getSession();
    const user = auth.session?.user;
    if (!user) {
      router.replace("/auth?redirect=/dashboard/pharmacien/avis-patients");
      return;
    }

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if ((profile as { role?: string } | null)?.role !== "pharmacien") {
      setError("Cet écran est réservé aux pharmaciens.");
      setLoading(false);
      return;
    }

    const { data: staff } = await supabase
      .from("pharmacy_staff")
      .select("pharmacy_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    if (staff?.pharmacy_id) {
      const { data: ph } = await supabase.from("pharmacies").select("nom").eq("id", staff.pharmacy_id).maybeSingle();
      setPharmacyNom(((ph as { nom?: string } | null)?.nom ?? "").trim());
    }

    const [feedRes, snapRes] = await Promise.all([
      supabase.rpc("pharmacist_pharmacy_ratings_for_my_pharmacy", { p_limit: 300, p_offset: 0 }),
      supabase.rpc("pharmacist_pharmacy_ratings_snapshot"),
    ]);

    if (feedRes.error) {
      if (feedRes.error.message.includes("pharmacist_pharmacy_ratings")) {
        setMigrationNote(
          "Hub avis indisponible : appliquez la migration `20260834_001_pharmacist_pharmacy_ratings_hub.sql` dans Supabase."
        );
      } else {
        setError(feedRes.error.message);
      }
      setRows([]);
      setSnapshot(null);
    } else {
      setRows(((feedRes.data ?? []) as Record<string, unknown>[]).map(normalizePharmacistPharmacyRatingRow));
      setSnapshot(snapRes.error ? null : normalizePharmacistPharmacyRatingsSnapshot(snapRes.data));
    }

    setLoading(false);
  }, [router]);

  useEffect(() => {
    const tid = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(tid);
  }, [load]);

  const filteredRows = useMemo(
    () =>
      filterPharmacistPharmacyRatings(rows, {
        searchQuery,
        score: scoreFilter,
        period: periodFilter,
        withCommentOnly,
      }),
    [rows, searchQuery, scoreFilter, periodFilter, withCommentOnly]
  );

  const distribution = useMemo(
    () => (snapshot ? scoreDistributionPercents(snapshot) : []),
    [snapshot]
  );

  if (loading) {
    return (
      <PageShell maxWidthClass="max-w-5xl">
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </PageShell>
    );
  }

  return (
    <PageShell maxWidthClass="max-w-5xl" className="space-y-5">
      <PharmacistAccountPageHeader
        eyebrow="Officine & visibilité"
        title="Avis patients"
        subtitle="Notes et commentaires laissés sur votre fiche publique Pharmeto (1 avis par patient)."
        pharmacyName={pharmacyNom || undefined}
      />

      {snapshot ? (
        <section aria-label="Indicateurs avis" className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            <KpiCard
              label="Note moyenne"
              value={`${formatPharmacyRatingAvgFr(snapshot.rating_avg)} / 5`}
              accentClass="border-amber-200/80 bg-amber-50/40"
            />
            <KpiCard label="Total avis" value={snapshot.rating_count} />
            <KpiCard label="Avec commentaire" value={snapshot.with_comment} />
            <KpiCard label="7 derniers jours" value={snapshot.last_7_days} />
            <KpiCard label="30 derniers jours" value={snapshot.last_30_days} />
          </div>

          {snapshot.rating_count > 0 ? (
            <div className="rounded-xl border border-border/80 bg-card p-3 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Répartition</p>
              <ul className="mt-2 space-y-1.5">
                {distribution.map(({ score, count, pct }) => (
                  <li key={score}>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="w-8 font-semibold tabular-nums">{score} ★</span>
                      <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-amber-400/80 transition-all"
                          style={{ width: `${Math.max(count > 0 ? 6 : 0, pct)}%` }}
                        />
                      </div>
                      <span className="w-16 shrink-0 text-right tabular-nums text-muted-foreground">
                        {count} ({pct}%)
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      <div className={clsx(chrome.filterShell, "flex flex-col gap-3")}>
        <label className="flex min-w-0 flex-col gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Recherche
          <span className="relative block">
            <Search className={clsx("pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2", chrome.searchIcon)} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Patient, code client, commentaire…"
              className={clsx(
                "w-full rounded-lg border border-input bg-background py-2 pl-8 pr-2 text-xs font-normal normal-case tracking-normal text-foreground",
                chrome.searchInput
              )}
            />
          </span>
        </label>

        <div className="flex flex-wrap items-end gap-3">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Note
            <select
              value={scoreFilter === "all" ? "all" : String(scoreFilter)}
              onChange={(e) => {
                const v = e.target.value;
                setScoreFilter(v === "all" ? "all" : (Number(v) as PharmacyRatingScoreFilter));
              }}
              className="ml-1 rounded-md border border-input bg-background px-2 py-1.5 text-xs font-normal normal-case"
            >
              <option value="all">Toutes</option>
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {n} étoile{n > 1 ? "s" : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Période
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value as PharmacyRatingPeriodFilter)}
              className="ml-1 rounded-md border border-input bg-background px-2 py-1.5 text-xs font-normal normal-case"
            >
              <option value="all">Tout l&apos;historique</option>
              <option value="7d">7 jours</option>
              <option value="30d">30 jours</option>
            </select>
          </label>

          <label className="flex cursor-pointer items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              checked={withCommentOnly}
              onChange={(e) => setWithCommentOnly(e.target.checked)}
              className="rounded border-input"
            />
            Avec commentaire
          </label>
        </div>
      </div>

      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      {migrationNote && !error ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50/90 p-3 text-sm text-amber-950">{migrationNote}</p>
      ) : null}

      {rows.length === 0 && !error && !migrationNote ? (
        <p className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          <Star className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
          Aucun avis pour l&apos;instant. Les patients peuvent noter votre officine depuis votre fiche publique Pharmeto.
        </p>
      ) : filteredRows.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Aucun avis ne correspond à ces critères.
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {filteredRows.length} avis affiché{filteredRows.length > 1 ? "s" : ""}
            {filteredRows.length < rows.length ? ` sur ${rows.length}` : ""}, du plus récent au plus ancien.
          </p>
          <ul className="space-y-2">
            {filteredRows.map((row) => (
              <RatingCard key={row.rating_id} row={row} />
            ))}
          </ul>
        </>
      )}

      <section className="rounded-xl border border-border/80 bg-muted/20 p-4 text-xs leading-relaxed text-muted-foreground">
        <p className="flex items-center gap-1.5 font-semibold text-foreground">
          <MessageSquare className="h-3.5 w-3.5" aria-hidden />
          Rappel
        </p>
        <p className="mt-2">
          Chaque patient connecté peut laisser une note de 1 à 5 étoiles et un commentaire optionnel (500 caractères max.).
          La note moyenne alimente votre fiche publique et l&apos;annuaire Pharmeto.
        </p>
      </section>
    </PageShell>
  );
}
