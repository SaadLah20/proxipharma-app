"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { clsx } from "clsx";
import { AdminAccountPageHeader } from "@/components/admin/admin-account-page-header";
import { formatDateTimeShort24hFr, formatPlannedVisitFr } from "@/lib/datetime-fr";
import {
  availabilityStatusFr,
  counterOutcomeFr,
  formatShortId,
  requestStatusFr,
  requestTypeFr,
} from "@/lib/request-display";
import { one } from "@/lib/embed";
import { platformDashboardChrome as p } from "@/lib/platform-dashboard-chrome";
import { REQUEST_DETAIL_REFRESH_EVENT, type RequestDetailRefreshDetail } from "@/lib/request-detail-refresh-bus";
import { supabase } from "@/lib/supabase";

type PharmacyEmbed = { nom: string; ville: string; adresse: string; telephone: string | null };

type RequestHead = {
  id: string;
  created_at: string;
  status: string;
  request_type: string;
  pharmacy_id: string;
  patient_id: string;
  submitted_at: string | null;
  responded_at: string | null;
  confirmed_at: string | null;
  patient_planned_visit_date: string | null;
  patient_planned_visit_time: string | null;
  pharmacies: PharmacyEmbed | PharmacyEmbed[] | null;
};

type ItemRow = {
  id: string;
  requested_qty: number;
  availability_status: string | null;
  available_qty: number | null;
  unit_price: number | null;
  counter_outcome: string;
  line_source: string | null;
  products: { name: string } | { name: string }[] | null;
};

function MetaCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
      <dt className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm text-foreground">{children}</dd>
    </div>
  );
}

export default function AdminDemandeDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [request, setRequest] = useState<RequestHead | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);

  const load = useCallback(async () => {
    if (!id) {
      setError("ID manquant.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");

    const { data: reqData, error: reqErr } = await supabase
      .from("requests")
      .select(
        "id,created_at,status,request_type,pharmacy_id,patient_id,submitted_at,responded_at,confirmed_at,patient_planned_visit_date,patient_planned_visit_time,pharmacies(nom,ville,adresse,telephone)"
      )
      .eq("id", id)
      .maybeSingle();

    if (reqErr) {
      setError(reqErr.message);
      setLoading(false);
      return;
    }
    if (!reqData) {
      setError("Demande introuvable.");
      setLoading(false);
      return;
    }

    setRequest(reqData as unknown as RequestHead);

    const { data: itemsData, error: itemsErr } = await supabase
      .from("request_items")
      .select("id,requested_qty,availability_status,available_qty,unit_price,counter_outcome,line_source,products(name)")
      .eq("request_id", id)
      .order("created_at", { ascending: true });

    if (itemsErr) {
      setError(itemsErr.message);
    } else {
      setItems((itemsData ?? []) as unknown as ItemRow[]);
    }

    setLoading(false);
  }, [id]);

  useEffect(() => {
    const tid = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(tid);
  }, [load]);

  useEffect(() => {
    const listener = (ev: Event) => {
      const detail = (ev as CustomEvent<RequestDetailRefreshDetail>).detail;
      if (detail?.requestId !== id) return;
      void load();
    };
    window.addEventListener(REQUEST_DETAIL_REFRESH_EVENT, listener);
    return () => window.removeEventListener(REQUEST_DETAIL_REFRESH_EVENT, listener);
  }, [id, load]);

  const ph = request ? one(request.pharmacies) : null;

  if (loading) {
    return <p className="text-sm text-muted-foreground">Chargement…</p>;
  }

  return (
    <div className="space-y-4">
      <AdminAccountPageHeader
        title="Détail demande"
        subtitle="Vue lecture seule pour le pilotage Pharmeto."
        backHref="/admin/demandes"
        backLabel="← Demandes pilote"
      />

      {error ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p> : null}

      {request ? (
        <>
          <p className="text-xs text-muted-foreground">
            <Link href="/admin/demandes" className={p.linkInline}>
              Demandes
            </Link>
            <span className="mx-1.5">›</span>
            <span className="font-mono">{formatShortId(request.id)}</span>
          </p>

          <section className={clsx(p.hero, "grid gap-2 sm:grid-cols-2")}>
            <MetaCard label="Statut">{requestStatusFr[request.status] ?? request.status}</MetaCard>
            <MetaCard label="Type">{requestTypeFr[request.request_type] ?? request.request_type}</MetaCard>
            <MetaCard label="Pharmacie">{ph ? `${ph.nom} (${ph.ville})` : request.pharmacy_id}</MetaCard>
            <MetaCard label="Patient">
              <span className="font-mono text-xs">{formatShortId(request.patient_id)}</span>
            </MetaCard>
            <MetaCard label="Créé">{formatDateTimeShort24hFr(request.created_at)}</MetaCard>
            {request.submitted_at ? (
              <MetaCard label="Soumis">{formatDateTimeShort24hFr(request.submitted_at)}</MetaCard>
            ) : null}
            {request.responded_at ? (
              <MetaCard label="Répondu">{formatDateTimeShort24hFr(request.responded_at)}</MetaCard>
            ) : null}
            {request.confirmed_at ? (
              <MetaCard label="Confirmé patient">{formatDateTimeShort24hFr(request.confirmed_at)}</MetaCard>
            ) : null}
            {request.patient_planned_visit_date ? (
              <MetaCard label="Passage prévu">
                {formatPlannedVisitFr(request.patient_planned_visit_date, request.patient_planned_visit_time)}
              </MetaCard>
            ) : null}
            <MetaCard label="Réf. complète">
              <span className="break-all font-mono text-[11px]">{request.id}</span>
            </MetaCard>
          </section>

          {ph ? (
            <section className={clsx(p.filterShell, "space-y-1 text-sm")}>
              <h2 className="font-semibold text-foreground">Officine</h2>
              <p>{ph.adresse}</p>
              {ph.telephone ? <p className="text-muted-foreground">Tél. {ph.telephone}</p> : null}
            </section>
          ) : null}

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground">Lignes produits ({items.length})</h2>
            <ul className="space-y-2">
              {items.map((it) => {
                const pname = one(it.products)?.name ?? "?";
                return (
                  <li key={it.id} className="rounded-xl border border-border/90 bg-card px-3 py-2.5 shadow-sm">
                    <p className="font-medium text-foreground">{pname}</p>
                    <p className="text-xs text-muted-foreground">
                      Qté demandée : {it.requested_qty} · Dispo :{" "}
                      {it.availability_status
                        ? availabilityStatusFr[it.availability_status] ?? it.availability_status
                        : "—"}
                      {it.available_qty != null ? ` (${it.available_qty})` : ""}
                      {it.unit_price != null ? ` · PU ${it.unit_price}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Comptoir : {counterOutcomeFr[it.counter_outcome] ?? it.counter_outcome} · Ligne #
                      {formatShortId(it.id)}
                    </p>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      ) : null}
    </div>
  );
}
