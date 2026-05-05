"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { formatDateTimeShort24hFr, formatPlannedVisitFr } from "@/lib/datetime-fr";
import {
  availabilityStatusFr,
  counterOutcomeFr,
  formatShortId,
  requestStatusFr,
  requestTypeFr,
} from "@/lib/request-display";
import { one } from "@/lib/embed";

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

export default function AdminDemandeDetailPage() {
  const router = useRouter();
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

    const { data: authData } = await supabase.auth.getSession();
    const user = authData.session?.user;
    if (!user) {
      router.replace("/auth");
      return;
    }

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if ((profile as { role?: string } | null)?.role !== "admin") {
      router.replace("/");
      return;
    }

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
  }, [id, router]);

  useEffect(() => {
    const tid = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(tid);
  }, [load]);

  const ph = request ? one(request.pharmacies) : null;

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <p className="text-sm text-gray-600">Chargement…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Vue admin — demande</h1>
          <p className="text-sm text-gray-600">Lecture seule pilote.</p>
        </div>
        <Link href="/admin" className="text-sm text-blue-700 underline">
          ← Panneau admin
        </Link>
      </div>

      {error ? <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}

      {request ? (
        <div className="space-y-4 text-sm">
          <dl className="grid gap-1 rounded-xl border bg-white p-4">
            <div>
              <dt className="text-xs uppercase text-gray-500">Réf.</dt>
              <dd className="font-mono text-xs">{request.id}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-gray-500">Statut</dt>
              <dd>{requestStatusFr[request.status] ?? request.status}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-gray-500">Type</dt>
              <dd>{requestTypeFr[request.request_type] ?? request.request_type}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-gray-500">Pharmacie</dt>
              <dd>{ph ? `${ph.nom} (${ph.ville})` : request.pharmacy_id}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-gray-500">Patient</dt>
              <dd className="font-mono text-xs">{formatShortId(request.patient_id)} — {request.patient_id}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-gray-500">Créé</dt>
              <dd>{formatDateTimeShort24hFr(request.created_at)}</dd>
            </div>
            {request.submitted_at ? (
              <div>
                <dt className="text-xs uppercase text-gray-500">Soumis</dt>
                <dd>{formatDateTimeShort24hFr(request.submitted_at)}</dd>
              </div>
            ) : null}
            {request.responded_at ? (
              <div>
                <dt className="text-xs uppercase text-gray-500">Répondu</dt>
                <dd>{formatDateTimeShort24hFr(request.responded_at)}</dd>
              </div>
            ) : null}
            {request.confirmed_at ? (
              <div>
                <dt className="text-xs uppercase text-gray-500">Confirmé patient</dt>
                <dd>{formatDateTimeShort24hFr(request.confirmed_at)}</dd>
              </div>
            ) : null}
            {request.patient_planned_visit_date ? (
              <div>
                <dt className="text-xs uppercase text-gray-500">Passage prévu</dt>
                <dd>{formatPlannedVisitFr(request.patient_planned_visit_date, request.patient_planned_visit_time)}</dd>
              </div>
            ) : null}
          </dl>

          <section>
            <h2 className="mb-2 text-base font-semibold">Lignes produits ({items.length})</h2>
            <ul className="space-y-2">
              {items.map((it) => {
                const pname = one(it.products)?.name ?? "?";
                return (
                  <li key={it.id} className="rounded-lg border bg-white px-3 py-2">
                    <p className="font-medium">{pname}</p>
                    <p className="text-xs text-gray-600">
                      Qté demandée: {it.requested_qty} · Dispo:{" "}
                      {it.availability_status ? availabilityStatusFr[it.availability_status] ?? it.availability_status : "—"}
                      {it.available_qty != null ? ` (${it.available_qty})` : ""}
                      {it.unit_price != null ? ` · PU ${it.unit_price}` : ""}
                    </p>
                    <p className="text-xs text-gray-500">
                      Comptoir: {counterOutcomeFr[it.counter_outcome] ?? it.counter_outcome} · Ligne #
                      {formatShortId(it.id)}
                    </p>
                  </li>
                );
              })}
            </ul>
          </section>

          <div className="flex flex-wrap gap-3 text-sm">
            <Link href="/admin" className="text-blue-700 underline">
              Retour panneau admin
            </Link>
          </div>
        </div>
      ) : null}
    </main>
  );
}
