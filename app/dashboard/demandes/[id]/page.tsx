"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  availabilityStatusFr,
  counterOutcomeFr,
  formatShortId,
  requestStatusFr,
  requestTypeFr,
} from "@/lib/request-display";
import { one } from "@/lib/embed";
import { PatientProductRequestActions } from "./PatientProductRequestActions";

type PharmacyEmbed = { nom: string; ville: string; adresse: string; telephone: string | null };
type ProductRequestEmbed = { patient_note: string | null };

type AltEmbed = {
  id: string;
  rank: number;
  availability_status: string | null;
  available_qty: number | null;
  unit_price: number | null;
  pharmacist_comment: string | null;
  products: { name: string } | { name: string }[] | null;
};

function normalizeAlternatives(raw: AltEmbed | AltEmbed[] | null | undefined): AltEmbed[] {
  if (!raw) return [];
  return Array.isArray(raw) ? [...raw].sort((a, b) => a.rank - b.rank) : [raw];
}

type RequestDetail = {
  id: string;
  created_at: string;
  status: string;
  request_type: string;
  pharmacy_id: string;
  submitted_at: string | null;
  responded_at: string | null;
  confirmed_at: string | null;
  pharmacies: PharmacyEmbed | PharmacyEmbed[] | null;
  product_requests: ProductRequestEmbed | ProductRequestEmbed[] | null;
};

type RequestItemRow = {
  id: string;
  product_id: string;
  requested_qty: number;
  selected_qty: number | null;
  is_selected_by_patient: boolean;
  availability_status: string | null;
  available_qty: number | null;
  unit_price: number | null;
  pharmacist_comment: string | null;
  counter_outcome: string;
  products: { name: string } | { name: string }[] | null;
  request_item_alternatives: AltEmbed | AltEmbed[] | null;
};

export default function DemandeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [items, setItems] = useState<RequestItemRow[]>([]);

  const loadDetail = useCallback(
    async (silent?: boolean) => {
      if (!id) {
        setLoading(false);
        setError("Demande introuvable.");
        return;
      }
      if (!silent) {
        setLoading(true);
        setError("");
      }

      const { data: authData } = await supabase.auth.getSession();
      const user = authData.session?.user;
      if (!user) {
        router.replace(`/auth?redirect=/dashboard/demandes/${id}`);
        return;
      }

      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();

      if (profile && (profile as { role: string }).role !== "patient") {
        setError("Cette page concerne les patients.");
        setLoading(false);
        return;
      }

      const { data: reqRow, error: reqErr } = await supabase
        .from("requests")
        .select(
          "id,created_at,status,request_type,pharmacy_id,submitted_at,responded_at,confirmed_at,pharmacies(nom,ville,adresse,telephone),product_requests(patient_note)"
        )
        .eq("id", id)
        .eq("patient_id", user.id)
        .maybeSingle();

      if (reqErr) {
        setError(reqErr.message);
        setLoading(false);
        return;
      }

      if (!reqRow) {
        setError("Demande introuvable ou elle ne t’appartient pas.");
        setLoading(false);
        return;
      }

      setRequest(reqRow as RequestDetail);

      const { data: itemsData, error: itemsErr } = await supabase
        .from("request_items")
        .select(
          "id,product_id,requested_qty,selected_qty,is_selected_by_patient,availability_status,available_qty,unit_price,pharmacist_comment,counter_outcome,products(name),request_item_alternatives(id,rank,availability_status,available_qty,unit_price,pharmacist_comment,products(name))"
        )
        .eq("request_id", id)
        .order("created_at", { ascending: true });

      if (itemsErr) {
        setError(itemsErr.message);
      } else if (Array.isArray(itemsData)) {
        setItems(itemsData as RequestItemRow[]);
      }

      setLoading(false);
    },
    [id, router]
  );

  useEffect(() => {
    const tid = window.setTimeout(() => {
      void loadDetail();
    }, 0);
    return () => window.clearTimeout(tid);
  }, [loadDetail]);

  if (loading) {
    return (
      <main className="mx-auto min-h-screen max-w-lg p-6">
        <p className="text-gray-600">Chargement…</p>
      </main>
    );
  }

  if (error || !request) {
    return (
      <main className="mx-auto min-h-screen max-w-lg p-6">
        <p className="rounded-lg bg-red-50 p-4 text-sm text-red-800">{error || "Erreur."}</p>
        <Link href="/dashboard" className="mt-4 inline-block text-sm font-medium text-blue-700 underline">
          Retour au tableau de bord
        </Link>
      </main>
    );
  }

  const pharmacy = one(request.pharmacies);
  const productReq = one(request.product_requests);
  const note = productReq?.patient_note ?? null;

  return (
    <main className="mx-auto min-h-screen max-w-lg p-6 pb-12">
      <Link href="/dashboard" className="mb-4 inline-block text-sm font-medium text-blue-700 underline">
        ← Mes demandes
      </Link>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-700">
          #{formatShortId(request.id)}
        </span>
        <span className="rounded-full bg-blue-100 px-3 py-0.5 text-xs font-semibold text-blue-900">
          {requestStatusFr[request.status] ?? request.status}
        </span>
      </div>

      <h1 className="text-xl font-bold text-blue-950">
        {requestTypeFr[request.request_type] ?? request.request_type}
      </h1>

      {pharmacy ? (
        <section className="mt-4 rounded-xl border bg-white p-4 text-sm shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Pharmacie</h2>
          <p className="mt-1 font-medium text-gray-900">{pharmacy.nom}</p>
          <p className="text-gray-600">{pharmacy.ville} · {pharmacy.adresse}</p>
          {pharmacy.telephone ? (
            <a href={`tel:${pharmacy.telephone}`} className="mt-2 inline-block text-blue-700 underline">
              {pharmacy.telephone}
            </a>
          ) : null}
          <div className="mt-3">
            <Link
              href={`/pharmacie/${request.pharmacy_id}`}
              className="text-sm font-medium text-blue-700 underline"
            >
              Ouvrir la fiche pharmacie
            </Link>
          </div>
        </section>
      ) : null}

      <section className="mt-4 rounded-xl border bg-white p-4 text-sm shadow-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Dates</h2>
        <dl className="mt-2 space-y-1 text-gray-700">
          <div>
            <dt className="inline text-gray-500">Créée : </dt>
            <dd className="inline">{new Date(request.created_at).toLocaleString("fr-FR")}</dd>
          </div>
          {request.submitted_at ? (
            <div>
              <dt className="inline text-gray-500">Envoyée : </dt>
              <dd className="inline">{new Date(request.submitted_at).toLocaleString("fr-FR")}</dd>
            </div>
          ) : null}
          {request.responded_at ? (
            <div>
              <dt className="inline text-gray-500">Réponse pharmacien : </dt>
              <dd className="inline">{new Date(request.responded_at).toLocaleString("fr-FR")}</dd>
            </div>
          ) : null}
          {request.confirmed_at ? (
            <div>
              <dt className="inline text-gray-500">Confirmée par toi : </dt>
              <dd className="inline">{new Date(request.confirmed_at).toLocaleString("fr-FR")}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      {note ? (
        <section className="mt-4 rounded-xl border bg-amber-50/60 p-4 text-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-amber-900/80">Ton message</h2>
          <p className="mt-2 whitespace-pre-wrap text-gray-900">{note}</p>
        </section>
      ) : null}

      {items.length > 0 ? (
        <section className="mt-4">
          <h2 className="mb-2 text-sm font-semibold text-gray-800">Produits</h2>
          <ul className="space-y-3">
            {items.map((row) => {
              const prod = one(row.products);
              const altList = normalizeAlternatives(row.request_item_alternatives);
              return (
              <li key={row.id} className="rounded-xl border border-gray-100 bg-white p-3 text-sm shadow-sm">
                <p className="font-medium text-gray-900">{prod?.name ?? "Produit"}</p>
                <p className="mt-1 text-gray-600">
                  Demandé : <strong>{row.requested_qty}</strong>
                  {row.selected_qty != null ? (
                    <>
                      {" "}
                      · Sélectionné : <strong>{row.selected_qty}</strong>
                      {!row.is_selected_by_patient ? (
                        <span className="text-gray-400"> (décoché)</span>
                      ) : null}
                    </>
                  ) : null}
                </p>
                {row.availability_status ? (
                  <p className="mt-1 text-xs text-blue-900">
                    <span className="font-medium">{availabilityStatusFr[row.availability_status] ?? row.availability_status}</span>
                    {row.available_qty != null ? ` (${row.available_qty})` : ""}
                    {row.unit_price != null ? ` · ${Number(row.unit_price).toFixed(2)} MAD` : ""}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-gray-500">En attente de réponse pharmacien</p>
                )}
                {row.pharmacist_comment ? (
                  <p className="mt-2 rounded-lg bg-blue-50/80 px-2 py-1 text-xs text-gray-800">
                    {row.pharmacist_comment}
                  </p>
                ) : null}
                {altList.length > 0 ? (
                  <div className="mt-3 rounded-lg border border-dashed border-amber-200 bg-amber-50/40 p-2">
                    <p className="text-xs font-semibold text-amber-900/90">Alternatives proposées</p>
                    <ul className="mt-2 space-y-2">
                      {altList.map((alt) => {
                        const altProd = one(alt.products);
                        return (
                          <li key={alt.id} className="rounded-md bg-white px-2 py-1.5 text-xs">
                            <p className="font-medium text-gray-900">{altProd?.name ?? "Produit alternatif"}</p>
                            {alt.availability_status ? (
                              <p className="mt-1 text-blue-900">
                                {availabilityStatusFr[alt.availability_status] ?? alt.availability_status}
                                {alt.available_qty != null ? ` (${alt.available_qty})` : ""}
                                {alt.unit_price != null ? ` · ${Number(alt.unit_price).toFixed(2)} MAD` : ""}
                              </p>
                            ) : (
                              <p className="mt-1 text-gray-500">Disponibilité à préciser en pharmacie</p>
                            )}
                            {alt.pharmacist_comment ? (
                              <p className="mt-1 text-gray-700">{alt.pharmacist_comment}</p>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
                {(request.status === "confirmed" ||
                  request.status === "completed" ||
                  row.counter_outcome !== "unset") && (
                  <p className="mt-2 text-xs text-gray-600">
                    Comptoir :{" "}
                    <span className="font-medium">{counterOutcomeFr[row.counter_outcome] ?? row.counter_outcome}</span>
                  </p>
                )}
              </li>
              );
            })}
          </ul>
        </section>
      ) : request.request_type === "product_request" ? (
        <p className="mt-4 text-sm text-gray-500">Aucune ligne produit enregistrée pour cette demande.</p>
      ) : null}

      {request.request_type === "product_request" && (request.status === "responded" || request.status === "confirmed") ? (
        <PatientProductRequestActions
          key={[note ?? "", ...items.map((i) => [i.id, i.selected_qty, i.is_selected_by_patient, i.available_qty, i.requested_qty, i.counter_outcome].join(":"))].join("|")}
          requestId={request.id}
          status={request.status}
          items={items}
          initialPatientNote={note}
          onReload={async () => {
            await loadDetail(true);
          }}
        />
      ) : null}
    </main>
  );
}
