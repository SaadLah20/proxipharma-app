"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { PHARMACIST_AVAILABILITY_OPTIONS } from "@/lib/pharmacist-availability";
import { availabilityStatusFr, formatShortId, requestStatusFr, requestTypeFr } from "@/lib/request-display";
import { one } from "@/lib/embed";

type RequestRow = {
  id: string;
  status: string;
  request_type: string;
  pharmacy_id: string;
  patient_id: string;
  created_at: string;
  submitted_at: string | null;
  responded_at: string | null;
  product_requests: { patient_note: string | null } | { patient_note: string | null }[] | null;
};

type ItemRow = {
  id: string;
  product_id: string;
  requested_qty: number;
  availability_status: string | null;
  available_qty: number | null;
  unit_price: number | null;
  pharmacist_comment: string | null;
  expected_availability_date: string | null;
  products: { name: string } | { name: string }[] | null;
};

type ItemDraft = {
  availability_status: string;
  available_qty: string;
  unit_price: string;
  pharmacist_comment: string;
  expected_availability_date: string;
};

type Draft = Record<string, ItemDraft>;

async function logHistory(requestId: string, oldS: string | null, newS: string, reason?: string) {
  const { data: userData } = await supabase.auth.getUser();
  return supabase.from("request_status_history").insert({
    request_id: requestId,
    old_status: oldS,
    new_status: newS,
    changed_by: userData.user?.id ?? null,
    reason: reason ?? "pharmacien_ui",
  });
}

export default function PharmacienDemandeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [myPharmacyId, setMyPharmacyId] = useState<string | null>(null);
  const [request, setRequest] = useState<RequestRow | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [draft, setDraft] = useState<Draft>({});

  const load = useCallback(async () => {
    if (!id) return;
    setError("");
    const { data: auth } = await supabase.auth.getSession();
    const user = auth.session?.user;
    if (!user) {
      router.replace(`/auth?redirect=/dashboard/pharmacien/demandes/${id}`);
      return;
    }

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (!profile || (profile as { role: string }).role !== "pharmacien") {
      setError("Accès pharmacien uniquement.");
      setLoading(false);
      return;
    }

    const { data: staff } = await supabase
      .from("pharmacy_staff")
      .select("pharmacy_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!staff?.pharmacy_id) {
      setError("Pharmacie non rattachée.");
      setLoading(false);
      return;
    }

    setMyPharmacyId(staff.pharmacy_id);

    const { data: reqRow, error: reqErr } = await supabase
      .from("requests")
      .select("id,status,request_type,pharmacy_id,patient_id,created_at,submitted_at,responded_at,product_requests(patient_note)")
      .eq("id", id)
      .maybeSingle();

    if (reqErr || !reqRow) {
      setError(reqErr?.message ?? "Demande introuvable.");
      setLoading(false);
      return;
    }

    const r = reqRow as RequestRow;
    if (r.pharmacy_id !== staff.pharmacy_id) {
      setError("Cette demande n’appartient pas à ta pharmacie.");
      setLoading(false);
      return;
    }

    setRequest(r);

    const { data: itemsData, error: itemsErr } = await supabase
      .from("request_items")
      .select(
        "id,product_id,requested_qty,availability_status,available_qty,unit_price,pharmacist_comment,expected_availability_date,products(name)"
      )
      .eq("request_id", id)
      .order("created_at", { ascending: true });

    if (itemsErr) {
      setError(itemsErr.message);
      setLoading(false);
      return;
    }

    const list = (itemsData as ItemRow[]) ?? [];
    setItems(list);

    const d: Draft = {};
    for (const row of list) {
      d[row.id] = {
        availability_status: row.availability_status ?? "available",
        available_qty:
          row.available_qty != null ? String(row.available_qty) : String(row.requested_qty),
        unit_price: row.unit_price != null ? String(row.unit_price) : "",
        pharmacist_comment: row.pharmacist_comment ?? "",
        expected_availability_date: row.expected_availability_date ?? "",
      };
    }
    setDraft(d);
    setLoading(false);
  }, [id, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const setField = (itemId: string, field: keyof ItemDraft, value: string) => {
    setDraft((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], [field]: value },
    }));
  };

  const publishResponse = async () => {
    if (!request || !myPharmacyId) return;
    if (request.request_type !== "product_request") {
      setError("Pour l’instant, seules les demandes « Produits » sont traitées ici.");
      return;
    }
    if (items.length === 0) {
      setError("Aucune ligne produit à renseigner.");
      return;
    }

    for (const row of items) {
      const f = draft[row.id];
      if (!f?.availability_status) {
        setError("Choisis une disponibilité pour chaque ligne.");
        return;
      }
      const qty = Number(f.available_qty);
      if (Number.isNaN(qty) || qty < 0) {
        setError("Quantité disponible invalide sur une ligne.");
        return;
      }
    }

    setBusy(true);
    setError("");

    let currentStatus = request.status;

    try {
      if (currentStatus === "submitted") {
        const { error: u1 } = await supabase.from("requests").update({ status: "in_review" }).eq("id", id);
        if (u1) throw new Error(u1.message);
        const { error: h1 } = await logHistory(id, "submitted", "in_review");
        if (h1) throw new Error(h1.message);
        currentStatus = "in_review";
      }

      if (currentStatus !== "in_review") {
        throw new Error(`Statut inattendu pour envoyer la réponse: ${currentStatus}`);
      }

      for (const row of items) {
        const f = draft[row.id]!;
        const availQty = Number(f.available_qty);
        const price =
          f.unit_price.trim() === "" ? null : Number(f.unit_price.replace(",", "."));
        if (f.unit_price.trim() !== "" && (price == null || Number.isNaN(price) || price < 0)) {
          throw new Error("Prix unitaire invalide.");
        }

        const { error: up } = await supabase
          .from("request_items")
          .update({
            availability_status: f.availability_status,
            available_qty: availQty,
            unit_price: price,
            pharmacist_comment: f.pharmacist_comment.trim() || null,
            expected_availability_date:
              f.expected_availability_date.trim() !== "" ? f.expected_availability_date : null,
          })
          .eq("id", row.id);

        if (up) throw new Error(up.message);
      }

      const expires = new Date();
      expires.setDate(expires.getDate() + 7);

      const { error: u2 } = await supabase
        .from("requests")
        .update({
          status: "responded",
          responded_at: new Date().toISOString(),
          expires_at: expires.toISOString(),
        })
        .eq("id", id);

      if (u2) throw new Error(u2.message);

      const { error: h2 } = await logHistory(id, "in_review", "responded", "publication_disponibilites");
      if (h2) throw new Error(h2.message);

      setError("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Une erreur est survenue.");
    }

    setBusy(false);
  };

  const canEditResponse = request && ["submitted", "in_review"].includes(request.status);
  const isProduct = request?.request_type === "product_request";

  if (loading) {
    return (
      <main className="mx-auto min-h-screen max-w-lg p-6">
        <p className="text-gray-600">Chargement…</p>
      </main>
    );
  }

  if (error && !request) {
    return (
      <main className="mx-auto min-h-screen max-w-lg p-6">
        <p className="rounded-lg bg-red-50 p-4 text-sm text-red-800">{error}</p>
        <Link href="/dashboard/pharmacien/demandes" className="mt-4 inline-block text-sm text-blue-700 underline">
          Retour à la liste
        </Link>
      </main>
    );
  }

  if (!request) return null;

  const pr = one(request.product_requests);
  const patientNote = pr?.patient_note;

  return (
    <main className="mx-auto min-h-screen max-w-lg p-6 pb-12">
      <Link href="/dashboard/pharmacien/demandes" className="text-sm font-medium text-blue-700 underline">
        ← Liste des demandes
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-gray-500">#{formatShortId(request.id)}</span>
        <span className="rounded-full bg-slate-100 px-3 py-0.5 text-xs font-semibold text-slate-800">
          {requestStatusFr[request.status] ?? request.status}
        </span>
      </div>

      <h1 className="mt-2 text-xl font-bold text-blue-950">
        {requestTypeFr[request.request_type] ?? request.request_type}
      </h1>

      <p className="mt-1 text-xs text-gray-500">
        Patient&nbsp;: <span className="font-mono">{request.patient_id}</span>
        <span className="text-gray-400"> (identifiant interne)</span>
      </p>

      {patientNote ? (
        <section className="mt-4 rounded-xl border bg-amber-50/70 p-3 text-sm">
          <h2 className="text-xs font-bold uppercase text-amber-900/80">Message du patient</h2>
          <p className="mt-2 whitespace-pre-wrap">{patientNote}</p>
        </section>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">{error}</p>
      ) : null}

      {!isProduct ? (
        <p className="mt-6 text-sm text-gray-600">
          Ce type de demande n’est pas encore géré dans cet écran. Utilise tes outils habituels en attendant une
          prochaine version.
        </p>
      ) : items.length === 0 ? (
        <p className="mt-6 text-sm text-gray-600">Aucune ligne produit pour cette demande.</p>
      ) : (
        <>
          <h2 className="mt-6 text-sm font-semibold text-gray-800">Disponibilité par produit</h2>
          <ul className="mt-3 space-y-4">
            {items.map((row) => {
              const prod = one(row.products);
              const f = draft[row.id];
              if (!f) return null;
              return (
                <li key={row.id} className="rounded-xl border bg-white p-3 text-sm shadow-sm">
                  <p className="font-medium text-gray-900">{prod?.name ?? "Produit"}</p>
                  <p className="mt-1 text-xs text-gray-600">Demandé&nbsp;: {row.requested_qty}</p>

                  <label className="mt-2 block">
                    <span className="text-xs font-medium text-gray-700">Dispo pharmacie</span>
                    <select
                      disabled={!canEditResponse}
                      value={f.availability_status}
                      onChange={(e) => setField(row.id, "availability_status", e.target.value)}
                      className="mt-1 w-full rounded-lg border px-2 py-1.5 text-sm disabled:bg-gray-50"
                    >
                      {PHARMACIST_AVAILABILITY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="mt-2 block">
                    <span className="text-xs font-medium text-gray-700">Quantité disponible (0 si rien)</span>
                    <input
                      type="number"
                      min={0}
                      disabled={!canEditResponse}
                      value={f.available_qty}
                      onChange={(e) => setField(row.id, "available_qty", e.target.value)}
                      className="mt-1 w-full rounded-lg border px-2 py-1.5 text-sm disabled:bg-gray-50"
                    />
                  </label>

                  <label className="mt-2 block">
                    <span className="text-xs font-medium text-gray-700">Prix unitaire (optionnel)</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="ex. 45.50"
                      disabled={!canEditResponse}
                      value={f.unit_price}
                      onChange={(e) => setField(row.id, "unit_price", e.target.value)}
                      className="mt-1 w-full rounded-lg border px-2 py-1.5 text-sm disabled:bg-gray-50"
                    />
                  </label>

                  {f.availability_status === "to_order" ? (
                    <label className="mt-2 block">
                      <span className="text-xs font-medium text-gray-700">Date prévisionnelle (optionnel)</span>
                      <input
                        type="date"
                        disabled={!canEditResponse}
                        value={f.expected_availability_date}
                        onChange={(e) => setField(row.id, "expected_availability_date", e.target.value)}
                        className="mt-1 w-full rounded-lg border px-2 py-1.5 text-sm disabled:bg-gray-50"
                      />
                    </label>
                  ) : null}

                  <label className="mt-2 block">
                    <span className="text-xs font-medium text-gray-700">Commentaire pour le patient</span>
                    <textarea
                      rows={2}
                      disabled={!canEditResponse}
                      value={f.pharmacist_comment}
                      onChange={(e) => setField(row.id, "pharmacist_comment", e.target.value)}
                      className="mt-1 w-full rounded-lg border px-2 py-1.5 text-sm disabled:bg-gray-50"
                    />
                  </label>

                  {!canEditResponse ? (
                    <p className="mt-2 text-xs text-gray-600">
                      Dernière dispo envoyée&nbsp;:{" "}
                      <strong>{row.availability_status ? availabilityStatusFr[row.availability_status] : "—"}</strong>
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>

          {canEditResponse ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void publishResponse()}
              className="mt-6 w-full rounded-xl bg-green-700 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Publication…" : "Envoyer la réponse au patient"}
            </button>
          ) : (
            <p className="mt-6 rounded-lg bg-slate-50 p-3 text-sm text-slate-800">
              {request.status === "responded"
                ? "Réponse déjà envoyée. Le patient traite depuis son espace (validation, modifications éventuelles)."
                : null}
              {request.status === "confirmed"
                ? "Demande confirmée par le patient. Suit le retrait en officine dans ton écran métier prévu ou via la base (`counter_outcome`)."
                : null}
              {request.status !== "responded" && request.status !== "confirmed" ? (
                <span>Résumé disponible uniquement dans cet écran selon statut ({request.status}).</span>
              ) : null}
            </p>
          )}
        </>
      )}
    </main>
  );
}
