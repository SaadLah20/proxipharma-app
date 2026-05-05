"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { formatDateTimeShort24hFr } from "@/lib/datetime-fr";
import { formatShortId, requestStatusFr, requestTypeFr } from "@/lib/request-display";
import { one } from "@/lib/embed";

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
  "completed",
  "cancelled",
  "abandoned",
  "expired",
  "draft",
];

export function AdminPilotBlock({ pharmacies }: { pharmacies: Pharmacy[] }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState<RequestPilotRow[]>([]);
  const [pharmacyFilter, setPharmacyFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("product_request");

  const [emailPending, setEmailPending] = useState<number | null>(null);
  const [emailFailed, setEmailFailed] = useState<number | null>(null);
  const [emailSent24h, setEmailSent24h] = useState<number | null>(null);

  const loadQueue = useCallback(async () => {
    const [pRes, fRes, sRes] = await Promise.all([
      supabase.from("notification_external_queue").select("*", { count: "exact", head: true }).eq("channel", "email").eq("status", "pending"),
      supabase.from("notification_external_queue").select("*", { count: "exact", head: true }).eq("channel", "email").eq("status", "failed"),
      supabase
        .from("notification_external_queue")
        .select("*", { count: "exact", head: true })
        .eq("channel", "email")
        .eq("status", "sent")
        .gte("sent_at", new Date(Date.now() - 86400000).toISOString()),
    ]);
    setEmailPending(pRes.count ?? null);
    setEmailFailed(fRes.count ?? null);
    setEmailSent24h(sRes.count ?? null);
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
    if (statusFilter) {
      q = q.eq("status", statusFilter);
    }

    const { data, error } = await q;
    setLoading(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setRows((data ?? []) as unknown as RequestPilotRow[]);
  }, [typeFilter, pharmacyFilter, statusFilter]);

  useEffect(() => {
    const t1 = window.setTimeout(() => {
      void loadQueue();
    }, 0);
    return () => window.clearTimeout(t1);
  }, [loadQueue]);

  useEffect(() => {
    const t2 = window.setTimeout(() => {
      void loadRows();
    }, 0);
    return () => window.clearTimeout(t2);
  }, [loadRows]);

  return (
    <section className="mb-6 rounded-xl border bg-white p-4">
      <h2 className="mb-3 text-lg font-semibold">Pilotage MVP</h2>

      <div className="mb-6 grid gap-2 rounded-lg bg-slate-50 p-3 text-sm sm:grid-cols-3">
        <p>
          <span className="font-medium">E-mail en file (pending)</span>
          <span className="ml-1 font-mono">{emailPending ?? "—"}</span>
        </p>
        <p>
          <span className="font-medium">E-mail échoués</span>
          <span className="ml-1 font-mono">{emailFailed ?? "—"}</span>
        </p>
        <p>
          <span className="font-medium">E-mail envoyés (24 h)</span>
          <span className="ml-1 font-mono">{emailSent24h ?? "—"}</span>
        </p>
        <p className="text-xs text-gray-600 sm:col-span-3">Compteurs sur `notification_external_queue` (canal e-mail).</p>
      </div>

      <h3 className="mb-2 text-base font-semibold">Demandes</h3>

      <div className="mb-3 flex flex-wrap gap-2">
        <select
          className="rounded-lg border px-2 py-1.5 text-sm"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="product_request">Demande produits</option>
          <option value="all">Tous types</option>
          <option value="prescription">Ordonnance</option>
          <option value="free_consultation">Consultation libre</option>
        </select>
        <select
          className="rounded-lg border px-2 py-1.5 text-sm"
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
          className="rounded-lg border px-2 py-1.5 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Tous statuts</option>
          {STATUS_OPTIONS.filter(Boolean).map((s) => (
            <option key={s} value={s}>
              {requestStatusFr[s] ?? s}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
          onClick={() => {
            void loadRows();
            void loadQueue();
          }}
        >
          Rafraîchir
        </button>
      </div>

      {err ? <p className="mb-2 text-sm text-red-700">{err}</p> : null}
      {loading ? <p className="text-sm text-gray-600">Chargement…</p> : null}

      {!loading && rows.length === 0 ? (
        <p className="text-sm text-gray-700">Aucune demande pour ces filtres.</p>
      ) : null}

      {!loading && rows.length > 0 ? (
        <div className="max-h-[28rem] overflow-auto text-sm">
          <table className="w-full min-w-[36rem] border-collapse text-left">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b text-xs text-gray-500">
                <th className="py-2 pr-2">Date</th>
                <th className="py-2 pr-2">Statut</th>
                <th className="py-2 pr-2">Type</th>
                <th className="py-2 pr-2">Pharmacie</th>
                <th className="py-2 pr-2">Patient</th>
                <th className="py-2">Lien</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const ph = one(r.pharmacies);
                return (
                  <tr key={r.id} className="border-b border-gray-100">
                    <td className="whitespace-nowrap py-1.5 pr-2 text-xs">{formatDateTimeShort24hFr(r.created_at)}</td>
                    <td className="py-1.5 pr-2">{requestStatusFr[r.status] ?? r.status}</td>
                    <td className="py-1.5 pr-2 text-xs">{requestTypeFr[r.request_type] ?? r.request_type}</td>
                    <td className="max-w-[140px] truncate py-1.5 pr-2 text-xs" title={ph ? `${ph.nom} (${ph.ville})` : r.pharmacy_id}>
                      {ph ? ph.nom : r.pharmacy_id.slice(0, 8)}
                    </td>
                    <td className="font-mono text-xs">{formatShortId(r.patient_id)}</td>
                    <td className="py-1.5">
                      <Link href={`/admin/demandes/${r.id}`} className="text-blue-700 underline">
                        Vue admin
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
  );
}
