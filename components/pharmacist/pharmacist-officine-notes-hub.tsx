"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import {
  ChevronRight,
  ClipboardList,
  MessageSquare,
  Search,
  StickyNote,
  User,
} from "lucide-react";
import { PharmacistAccountPageHeader } from "@/components/pharmacist/pharmacist-account-page-header";
import { PageShell } from "@/components/ui/compact-shell";
import { platformDashboardChrome as chrome } from "@/lib/platform-dashboard-chrome";
import {
  filterOfficineNotes,
  formatOfficineNoteDate,
  normalizeOfficineNoteRow,
  normalizeOfficineNotesSnapshot,
  officineNoteKindMeta,
  officineNotePatientHref,
  officineNoteRequestStatusLabel,
  officineNoteRequestTypeLabel,
  officineNoteSourceHref,
  type OfficineNoteFilterSide,
  type OfficineNoteKind,
  type OfficineNotePeriodFilter,
  type OfficineNoteRow,
  type OfficineNotesSnapshot,
} from "@/lib/pharmacist-officine-notes-hub";
import { supabase } from "@/lib/supabase";

function KpiCard({
  label,
  value,
  hint,
  accentClass,
}: {
  label: string;
  value: number;
  hint?: string;
  accentClass: string;
}) {
  return (
    <div className={clsx("rounded-xl border bg-card p-3 shadow-sm", accentClass)}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function NoteCard({ row }: { row: OfficineNoteRow }) {
  const meta = officineNoteKindMeta[row.note_kind];
  const isPharmacy = meta.side === "pharmacy";
  const sourceHref = officineNoteSourceHref(row);
  const patientHref = officineNotePatientHref(row.patient_id);

  return (
    <li>
      <article
        className={clsx(
          "rounded-xl border bg-card shadow-sm transition hover:shadow-md",
          isPharmacy ? "border-emerald-200/80 hover:border-emerald-300/80" : "border-sky-200/80 hover:border-sky-300/80"
        )}
      >
        <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={clsx(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                  isPharmacy ? "bg-emerald-100 text-emerald-900" : "bg-sky-100 text-sky-900"
                )}
              >
                {meta.shortLabel}
              </span>
              <span className="text-[10px] font-medium text-muted-foreground">{meta.label}</span>
              <span className="text-[10px] text-muted-foreground">·</span>
              <time className="text-[10px] font-medium tabular-nums text-muted-foreground" dateTime={row.noted_at}>
                {formatOfficineNoteDate(row.noted_at)}
              </time>
            </div>

            <p className="whitespace-pre-wrap text-sm leading-snug text-foreground">{row.note_body}</p>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
              {row.patient_ref ? (
                <span className="font-mono font-bold text-emerald-900">{row.patient_ref}</span>
              ) : null}
              {patientHref ? (
                <Link href={patientHref} className="inline-flex items-center gap-1 font-semibold text-foreground hover:underline">
                  <User className="h-3 w-3" aria-hidden />
                  {row.patient_display_name}
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                  <User className="h-3 w-3" aria-hidden />
                  {row.patient_display_name}
                </span>
              )}
              <span aria-hidden>·</span>
              <span>{row.context_label}</span>
              {row.request_public_ref ? (
                <>
                  <span aria-hidden>·</span>
                  <span className="font-mono font-semibold">{row.request_public_ref}</span>
                </>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-1.5">
              <span className="rounded-md border border-border/80 bg-muted/30 px-1.5 py-0.5 text-[10px] font-medium">
                {officineNoteRequestTypeLabel(row.request_type)}
              </span>
              {row.request_status ? (
                <span className="rounded-md border border-border/80 bg-muted/30 px-1.5 py-0.5 text-[10px] font-medium">
                  {officineNoteRequestStatusLabel(row.request_status)}
                </span>
              ) : null}
            </div>
          </div>

          {sourceHref ? (
            <Link
              href={sourceHref}
              className="inline-flex shrink-0 items-center gap-1 self-start rounded-lg border border-border bg-muted/20 px-2.5 py-1.5 text-[11px] font-semibold hover:bg-muted/50"
            >
              Voir le dossier
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          ) : null}
        </div>
      </article>
    </li>
  );
}

export function PharmacistOfficineNotesHub() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [migrationNote, setMigrationNote] = useState("");
  const [rows, setRows] = useState<OfficineNoteRow[]>([]);
  const [snapshot, setSnapshot] = useState<OfficineNotesSnapshot | null>(null);
  const [pharmacyNom, setPharmacyNom] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sideFilter, setSideFilter] = useState<OfficineNoteFilterSide>("all");
  const [periodFilter, setPeriodFilter] = useState<OfficineNotePeriodFilter>("all");
  const [kindFilter, setKindFilter] = useState<OfficineNoteKind | "all">("all");

  const load = useCallback(async () => {
    setError("");
    setMigrationNote("");
    const { data: auth } = await supabase.auth.getSession();
    const user = auth.session?.user;
    if (!user) {
      router.replace("/auth?redirect=/dashboard/pharmacien/notes-officine");
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
      supabase.rpc("pharmacist_officine_notes_feed", { p_limit: 300, p_offset: 0 }),
      supabase.rpc("pharmacist_officine_notes_snapshot"),
    ]);

    if (feedRes.error) {
      if (feedRes.error.message.includes("pharmacist_officine_notes_feed")) {
        setMigrationNote(
          "Hub notes indisponible : appliquez la migration `20260832_001_pharmacist_officine_notes_hub.sql` dans Supabase."
        );
      } else {
        setError(feedRes.error.message);
      }
      setRows([]);
      setSnapshot(null);
    } else {
      setRows(((feedRes.data ?? []) as Record<string, unknown>[]).map(normalizeOfficineNoteRow));
      setSnapshot(snapRes.error ? null : normalizeOfficineNotesSnapshot(snapRes.data));
    }

    setLoading(false);
  }, [router]);

  useEffect(() => {
    const tid = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(tid);
  }, [load]);

  const filteredRows = useMemo(
    () =>
      filterOfficineNotes(rows, {
        searchQuery,
        side: sideFilter,
        period: periodFilter,
        kind: kindFilter,
      }),
    [rows, searchQuery, sideFilter, periodFilter, kindFilter]
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
        eyebrow="Officine"
        title="Notes officine"
        subtitle="Suivi centralisé des notes patient et officine (lignes de demande, messages à l’envoi, réservations packs)."
        pharmacyName={pharmacyNom || undefined}
      />

      {snapshot ? (
        <section aria-label="Indicateurs notes" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <KpiCard label="Total notes" value={snapshot.total_notes} accentClass="border-border/80" />
          <KpiCard
            label="Notes officine"
            value={snapshot.pharmacy_notes}
            accentClass="border-emerald-200/80 bg-emerald-50/30"
          />
          <KpiCard label="Notes patient" value={snapshot.patient_notes} accentClass="border-sky-200/80 bg-sky-50/30" />
          <KpiCard label="Patients concernés" value={snapshot.distinct_patients} accentClass="border-border/80" />
          <KpiCard label="7 derniers jours" value={snapshot.last_7_days} accentClass="border-border/80" />
          <KpiCard label="30 derniers jours" value={snapshot.last_30_days} accentClass="border-border/80" />
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
              placeholder="Patient, réf. dossier, contenu de note…"
              className={clsx(
                "w-full rounded-lg border border-input bg-background py-2 pl-8 pr-2 text-xs font-normal normal-case tracking-normal text-foreground",
                chrome.searchInput
              )}
            />
          </span>
        </label>

        <div className="flex flex-wrap items-end gap-3">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Origine
            <select
              value={sideFilter}
              onChange={(e) => setSideFilter(e.target.value as OfficineNoteFilterSide)}
              className="ml-1 rounded-md border border-input bg-background px-2 py-1.5 text-xs font-normal normal-case"
            >
              <option value="all">Toutes</option>
              <option value="pharmacy">Officine</option>
              <option value="patient">Patient</option>
            </select>
          </label>

          <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Période
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value as OfficineNotePeriodFilter)}
              className="ml-1 rounded-md border border-input bg-background px-2 py-1.5 text-xs font-normal normal-case"
            >
              <option value="all">Tout l’historique</option>
              <option value="7d">7 jours</option>
              <option value="30d">30 jours</option>
            </select>
          </label>

          <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Type
            <select
              value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value as OfficineNoteKind | "all")}
              className="ml-1 max-w-[12rem] rounded-md border border-input bg-background px-2 py-1.5 text-xs font-normal normal-case"
            >
              <option value="all">Tous les types</option>
              {(Object.keys(officineNoteKindMeta) as OfficineNoteKind[]).map((k) => (
                <option key={k} value={k}>
                  {officineNoteKindMeta[k].label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      {migrationNote && !error ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50/90 p-3 text-sm text-amber-950">{migrationNote}</p>
      ) : null}

      {rows.length === 0 && !error && !migrationNote ? (
        <p className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          <StickyNote className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
          Aucune note enregistrée pour l’instant. Les notes apparaîtront dès qu’un patient ou votre équipe en saisira
          sur une demande ou une réservation pack.
        </p>
      ) : filteredRows.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Aucune note ne correspond à ces critères.
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {filteredRows.length} note{filteredRows.length > 1 ? "s" : ""} affichée{filteredRows.length > 1 ? "s" : ""}
            {filteredRows.length < rows.length ? ` sur ${rows.length}` : ""}, triées par date décroissante.
          </p>
          <ul className="space-y-2">
            {filteredRows.map((row) => (
              <NoteCard key={row.note_key} row={row} />
            ))}
          </ul>
        </>
      )}

      <section className="rounded-xl border border-border/80 bg-muted/20 p-4 text-xs leading-relaxed text-muted-foreground">
        <p className="flex items-center gap-1.5 font-semibold text-foreground">
          <ClipboardList className="h-3.5 w-3.5" aria-hidden />
          Sources agrégées
        </p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>Notes par ligne produit (patient et officine) sur les dossiers</li>
          <li>Messages à l’envoi sur demandes produits et ordonnances</li>
          <li>Notes sur les réservations packs promo</li>
        </ul>
        <p className="mt-2 flex items-start gap-1.5">
          <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          Les messages du fil conversation dossier restent accessibles depuis chaque demande.
        </p>
      </section>
    </PageShell>
  );
}
