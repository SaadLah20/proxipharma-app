"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { DemandeStatDashboard } from "@/components/requests/demande-stat-dashboard";
import { ADMIN_ACTIVE_REQUEST_STATUSES, snapshotRowsForStatDashboard } from "@/lib/admin-dashboard";
import { loadAdminEmailQueueStats } from "@/lib/admin-email-queue";
import { PHARMACIST_DASHBOARD_BUCKETS, PHARMACIST_STAT_BUCKET_GROUPS, bucketForStatusParam } from "@/lib/demandes-hub-buckets";
import { formatDateTimeShort24hFr } from "@/lib/datetime-fr";
import { formatShortId, requestStatusFr, requestTypeFr } from "@/lib/request-display";
import { platformDashboardChrome as p } from "@/lib/platform-dashboard-chrome";
import { one } from "@/lib/embed";
import { supabase } from "@/lib/supabase";

type Pharmacy = { id: string; nom: string; ville: string };

type RequestPilotRow = {
  id: string;
  created_at: string;
  status: string;
  request_type: string;
  pharmacy_id: string;
  patient_id: string;
  pharmacies: { nom: string; ville: string } | { nom: string; ville: string }[] | null;
};

const STATUS_OPTIONS = [
  "",
  "submitted",
  "in_review",
  "responded",
  "confirmed",
  "treated",
  "completed",
  "cancelled",
  "abandoned",
  "expired",
  "draft",
];

function resolveInitialStatusFilter(raw: string | null): string {
  if (!raw) return "";
  if (raw === "actives") return "__active__";
  return raw;
}

export function AdminPilotBlock({
  pharmacies,
  initialStatusFilter,
  initialBucketKey,
}: {
  pharmacies: Pharmacy[];
  initialStatusFilter?: string | null;
  initialBucketKey?: string | null;
}) {
  const bucketFromUrl = bucketForStatusParam(initialBucketKey ?? null, PHARMACIST_DASHBOARD_BUCKETS);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState<RequestPilotRow[]>([]);
  const [pharmacyFilter, setPharmacyFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState(() =>
    bucketFromUrl ? "" : resolveInitialStatusFilter(initialStatusFilter ?? null)
  );
  const [bucketFilterKey, setBucketFilterKey] = useState<string | null>(() => bucketFromUrl?.key ?? null);
  const [typeFilter, setTypeFilter] = useState("product_request");

  const [emailPending, setEmailPending] = useState<number | null>(null);
  const [emailFailed, setEmailFailed] = useState<number | null>(null);
  const [emailSent24h, setEmailSent24h] = useState<number | null>(null);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});

  const loadQueue = useCallback(async () => {
    const stats = await loadAdminEmailQueueStats(supabase);
    setEmailPending(stats.pending);
    setEmailFailed(stats.failed);
    setEmailSent24h(stats.sent24h);
  }, []);

  const loadStatusCounts = useCallback(async () => {
    const { data } = await supabase.from("requests").select("status").limit(5000);
    const counts: Record<string, number> = {};
    for (const row of data ?? []) {
      const status = (row as { status: string }).status;
      counts[status] = (counts[status] ?? 0) + 1;
    }
    setStatusCounts(counts);
  }, []);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setErr("");
    let q = supabase
      .from("requests")
      .select("id,created_at,status,request_type,pharmacy_id,patient_id,pharmacies(nom,ville)")
      .order("created_at", { ascending: false })
      .limit(200);

    if (typeFilter !== "all") {
      q = q.eq("request_type", typeFilter);
    }
    if (pharmacyFilter) {
      q = q.eq("pharmacy_id", pharmacyFilter);
    }
    if (statusFilter === "__active__") {
      q = q.in("status", [...ADMIN_ACTIVE_REQUEST_STATUSES]);
    } else if (statusFilter) {
      q = q.eq("status", statusFilter);
    } else if (bucketFilterKey) {
      const bucket = PHARMACIST_DASHBOARD_BUCKETS.find((b) => b.key === bucketFilterKey);
      if (bucket && bucket.statuses.length > 0) {
        q = q.in("status", [...bucket.statuses]);
      }
    }

    const { data, error } = await q;
    setLoading(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setRows((data ?? []) as unknown as RequestPilotRow[]);
  }, [typeFilter, pharmacyFilter, statusFilter, bucketFilterKey]);

  useEffect(() => {
    const bucket = bucketForStatusParam(initialBucketKey ?? null, PHARMACIST_DASHBOARD_BUCKETS);
    if (bucket) {
      setBucketFilterKey(bucket.key);
      setStatusFilter("");
      return;
    }
    setBucketFilterKey(null);
    setStatusFilter(resolveInitialStatusFilter(initialStatusFilter ?? null));
  }, [initialStatusFilter, initialBucketKey]);

  useEffect(() => {
    const t1 = window.setTimeout(() => {
      void loadQueue();
      void loadStatusCounts();
    }, 0);
    return () => window.clearTimeout(t1);
  }, [loadQueue, loadStatusCounts]);

  useEffect(() => {
    const t2 = window.setTimeout(() => {
      void loadRows();
    }, 0);
    return () => window.clearTimeout(t2);
  }, [loadRows]);

  const statRows = useMemo(() => snapshotRowsForStatDashboard(statusCounts), [statusCounts]);

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-3">
        <div className={p.statCard}>
          <p className={p.statLabel}>E-mail en file</p>
          <p className={p.statValue}>{emailPending ?? "—"}</p>
        </div>
        <div className={clsx(p.statCard, (emailFailed ?? 0) > 0 && "border-rose-200 ring-rose-100/40")}>
          <p className={p.statLabel}>E-mail échoués</p>
          <p className={p.statValue}>{emailFailed ?? "—"}</p>
        </div>
        <div className={p.statCard}>
          <p className={p.statLabel}>E-mail envoyés (24 h)</p>
          <p className={p.statValue}>{emailSent24h ?? "—"}</p>
        </div>
      </div>

      <DemandeStatDashboard
        rows={statRows}
        buckets={PHARMACIST_DASHBOARD_BUCKETS}
        bucketGroups={PHARMACIST_STAT_BUCKET_GROUPS}
        basePath="/admin/demandes"
        density="compact"
        dashboardTitle="Répartition des demandes"
        dashboardSubtitle="Vue globale toutes officines — cliquez un bloc pour filtrer le tableau."
        viewerRole="pharmacien"
      />

      <section className={clsx(p.filterShell, "space-y-3")}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">Liste des demandes</h2>
          <button
            type="button"
            className={p.headerAction}
            onClick={() => {
              void loadRows();
              void loadQueue();
              void loadStatusCounts();
            }}
          >
            Rafraîchir
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            className="rounded-lg border border-input bg-background px-2 py-1.5 text-sm"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="product_request">Demande produits</option>
            <option value="all">Tous types</option>
            <option value="prescription">Ordonnance</option>
            <option value="free_consultation">Consultation libre</option>
          </select>
          <select
            className="rounded-lg border border-input bg-background px-2 py-1.5 text-sm"
            value={pharmacyFilter}
            onChange={(e) => setPharmacyFilter(e.target.value)}
          >
            <option value="">Toutes pharmacies</option>
            {pharmacies.map((ph) => (
              <option key={ph.id} value={ph.id}>
                {ph.nom} ({ph.ville})
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border border-input bg-background px-2 py-1.5 text-sm"
            value={bucketFilterKey ? `bucket:${bucketFilterKey}` : statusFilter}
            onChange={(e) => {
              const value = e.target.value;
              if (value.startsWith("bucket:")) {
                setBucketFilterKey(value.slice("bucket:".length));
                setStatusFilter("");
                return;
              }
              setBucketFilterKey(null);
              setStatusFilter(value);
            }}
          >
            <option value="">Tous statuts</option>
            <option value="__active__">Actives (envoyées → validées)</option>
            {PHARMACIST_DASHBOARD_BUCKETS.map((bucket) => (
              <option key={bucket.key} value={`bucket:${bucket.key}`}>
                Bloc · {bucket.label}
              </option>
            ))}
            {STATUS_OPTIONS.filter(Boolean).map((s) => (
              <option key={s} value={s}>
                {requestStatusFr[s] ?? s}
              </option>
            ))}
          </select>
        </div>

        {err ? <p className="text-sm text-red-700">{err}</p> : null}
        {loading ? <p className="text-sm text-muted-foreground">Chargement…</p> : null}

        {!loading && rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune demande pour ces filtres.</p>
        ) : null}

        {!loading && rows.length > 0 ? (
          <div className="max-h-[28rem] overflow-auto rounded-lg border border-border/80">
            <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="py-2 pl-3 pr-2">Date</th>
                  <th className="py-2 pr-2">Statut</th>
                  <th className="py-2 pr-2">Type</th>
                  <th className="py-2 pr-2">Pharmacie</th>
                  <th className="py-2 pr-2">Patient</th>
                  <th className="py-2 pr-3">Lien</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const ph = one(r.pharmacies);
                  return (
                    <tr key={r.id} className="border-b border-border/60 hover:bg-muted/30">
                      <td className="whitespace-nowrap py-2 pl-3 pr-2 text-xs">{formatDateTimeShort24hFr(r.created_at)}</td>
                      <td className="py-2 pr-2">{requestStatusFr[r.status] ?? r.status}</td>
                      <td className="py-2 pr-2 text-xs">{requestTypeFr[r.request_type] ?? r.request_type}</td>
                      <td className="max-w-[140px] truncate py-2 pr-2 text-xs" title={ph ? `${ph.nom} (${ph.ville})` : r.pharmacy_id}>
                        {ph ? ph.nom : r.pharmacy_id.slice(0, 8)}
                      </td>
                      <td className="py-2 pr-2 font-mono text-xs">{formatShortId(r.patient_id)}</td>
                      <td className="py-2 pr-3">
                        <Link href={`/admin/demandes/${r.id}`} className={p.linkInline}>
                          Détail
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
