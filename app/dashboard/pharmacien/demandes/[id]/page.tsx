"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { PHARMACIST_AVAILABILITY_OPTIONS } from "@/lib/pharmacist-availability";
import {
  availabilityStatusFr,
  counterOutcomeFr,
  formatShortId,
  pharmacistRequestIsClosedSuccess,
  pharmacistRequestIsHardStopped,
  requestStatusFr,
  requestTypeFr,
} from "@/lib/request-display";
import { one } from "@/lib/embed";
import { pphLabel } from "@/lib/product-price";

type RequestRow = {
  id: string;
  status: string;
  request_type: string;
  pharmacy_id: string;
  patient_id: string;
  created_at: string;
  submitted_at: string | null;
  responded_at: string | null;
  patient_planned_visit_date: string | null;
  patient_planned_visit_time: string | null;
  product_requests: { patient_note: string | null } | { patient_note: string | null }[] | null;
};

type ProdEmbedDb = { name: string; price_pph?: number | null };

type AltRowDb = {
  id: string;
  rank: number;
  product_id: string;
  availability_status: string | null;
  available_qty: number | null;
  unit_price: number | null;
  pharmacist_comment: string | null;
  expected_availability_date: string | null;
  products: ProdEmbedDb | ProdEmbedDb[] | null;
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
  counter_outcome: string;
  is_selected_by_patient: boolean;
  selected_qty: number | null;
  patient_chosen_alternative_id?: string | null;
  products: ProdEmbedDb | ProdEmbedDb[] | null;
  request_item_alternatives: AltRowDb | AltRowDb[] | null;
};

type ItemDraft = {
  availability_status: string;
  available_qty: string;
  unit_price: string;
  pharmacist_comment: string;
  expected_availability_date: string;
};

type Draft = Record<string, ItemDraft>;

type ProductCatalogHit = {
  id: string;
  name: string;
  product_type: string;
  laboratory: string | null;
  price_pph?: number | null;
};

function normalizeAlts(raw: ItemRow["request_item_alternatives"]): AltRowDb[] {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  return [...list].sort((a, b) => a.rank - b.rank);
}

function nextAltRank(existing: AltRowDb[]): number | null {
  const used = new Set(existing.map((a) => a.rank));
  for (let r = 1; r <= 3; r += 1) {
    if (!used.has(r)) return r;
  }
  return null;
}

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
  const [altPickerOpenFor, setAltPickerOpenFor] = useState<string | null>(null);
  const [altQuery, setAltQuery] = useState("");
  const [altHits, setAltHits] = useState<ProductCatalogHit[]>([]);
  const [altBusyRow, setAltBusyRow] = useState<string | null>(null);
  const [counterBusyId, setCounterBusyId] = useState<string | null>(null);
  const [completeBusy, setCompleteBusy] = useState(false);

  const altDebounced = useMemo(() => altQuery.trim(), [altQuery]);
  const altVisibleHits = altDebounced.length < 2 ? [] : altHits;

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
      .select(
        "id,status,request_type,pharmacy_id,patient_id,created_at,submitted_at,responded_at,patient_planned_visit_date,patient_planned_visit_time,product_requests(patient_note)"
      )
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
        "id,product_id,requested_qty,availability_status,available_qty,unit_price,pharmacist_comment,expected_availability_date,counter_outcome,is_selected_by_patient,selected_qty,patient_chosen_alternative_id,products(name,price_pph),request_item_alternatives!request_item_alternatives_request_item_id_fkey(id,rank,product_id,availability_status,available_qty,unit_price,pharmacist_comment,expected_availability_date,products(name,price_pph))"
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
      const catalogPph = one(row.products)?.price_pph;
      d[row.id] = {
        availability_status: row.availability_status ?? "available",
        available_qty:
          row.available_qty != null ? String(row.available_qty) : String(row.requested_qty),
        unit_price:
          row.unit_price != null
            ? String(row.unit_price)
            : catalogPph != null
              ? String(catalogPph)
              : "",
        pharmacist_comment: row.pharmacist_comment ?? "",
        expected_availability_date: row.expected_availability_date ?? "",
      };
    }
    setDraft(d);
    setLoading(false);
  }, [id, router]);

  useEffect(() => {
    const tid = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(tid);
  }, [load]);

  useEffect(() => {
    if (altDebounced.length < 2 || !altPickerOpenFor) {
      return;
    }
    const t = window.setTimeout(() => {
      void (async () => {
        const { data, error } = await supabase
          .from("products")
          .select("id,name,product_type,laboratory,price_pph")
          .eq("is_active", true)
          .ilike("name", `%${altDebounced}%`)
          .order("name")
          .limit(12);
        if (error || !Array.isArray(data)) {
          setAltHits([]);
          return;
        }
        setAltHits(data as ProductCatalogHit[]);
      })();
    }, 280);
    return () => window.clearTimeout(t);
  }, [altDebounced, altPickerOpenFor]);

  const setField = (itemId: string, field: keyof ItemDraft, value: string) => {
    setDraft((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], [field]: value },
    }));
  };

  const resetAltPicker = () => {
    setAltPickerOpenFor(null);
    setAltQuery("");
    setAltHits([]);
  };

  const insertAlternative = async (parentRow: ItemRow, pick: ProductCatalogHit) => {
    const existing = normalizeAlts(parentRow.request_item_alternatives);
    const rank = nextAltRank(existing);
    const catalogProductId = pick.id;
    setError("");
    if (catalogProductId === parentRow.product_id) {
      setError("Choisis un produit différent de la ligne principale.");
      return;
    }
    if (existing.some((a) => a.product_id === catalogProductId)) {
      setError("Cette alternative figure déjà sur la liste.");
      return;
    }
    if (rank == null) {
      setError("Maximum 3 alternatives par ligne.");
      return;
    }
    setAltBusyRow(parentRow.id);
    const prefPrice = pick.price_pph != null && !Number.isNaN(Number(pick.price_pph)) ? Number(pick.price_pph) : null;
    const { error: insErr } = await supabase.from("request_item_alternatives").insert({
      request_item_id: parentRow.id,
      rank,
      product_id: catalogProductId,
      availability_status: "available",
      available_qty: Math.max(1, parentRow.requested_qty),
      pharmacist_comment: null,
      unit_price: prefPrice,
      expected_availability_date: null,
    });
    setAltBusyRow(null);
    if (insErr) {
      setError(insErr.message);
      return;
    }
    resetAltPicker();
    await load();
  };

  const deleteAlternativeRow = async (altId: string, parentRowId?: string) => {
    setError("");
    setAltBusyRow(altId);
    const { error: delErr } = await supabase.from("request_item_alternatives").delete().eq("id", altId);
    setAltBusyRow(null);
    if (delErr) {
      setError(delErr.message);
      return;
    }
    if (altPickerOpenFor === parentRowId) resetAltPicker();
    await load();
  };

  const saveCounterOutcome = async (requestItemId: string, outcome: string) => {
    setCounterBusyId(requestItemId);
    setError("");
    const { error: rpcErr } = await supabase.rpc("pharmacist_set_item_counter_outcome", {
      p_request_item_id: requestItemId,
      p_outcome: outcome,
    });
    setCounterBusyId(null);
    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }
    await load();
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

      /* Pilote Q38/Q6 : pas d’expiration +7 j après réponse ; l’état passe par abandon 24 h (cron) après `responded` si aucune confirmation. */
      const { error: u2 } = await supabase
        .from("requests")
        .update({
          status: "responded",
          responded_at: new Date().toISOString(),
          expires_at: null,
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

  const runCompleteAfterCounter = async () => {
    if (!id) return;
    setCompleteBusy(true);
    setError("");
    const { error: rpcErr } = await supabase.rpc("pharmacist_complete_request_after_counter", {
      p_request_id: id,
      p_reason: "pharmacist_ui_confirm_close",
    });
    setCompleteBusy(false);
    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }
    await load();
  };

  const canEditResponse = request && ["submitted", "in_review"].includes(request.status);
  const isProduct = request?.request_type === "product_request";

  let canCompleteCounter = false;
  if (request && isProduct && (request.status === "responded" || request.status === "confirmed")) {
    const selectedLines = items.filter((i) => i.is_selected_by_patient);
    const blockingSelected = selectedLines.filter(
      (i) =>
        String(i.counter_outcome ?? "unset") === "unset" ||
        String(i.counter_outcome ?? "unset") === "deferred_next_visit"
    );
    canCompleteCounter = selectedLines.length > 0 && blockingSelected.length === 0;
  }

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
        <Link href="/dashboard/pharmacien/demandes" className="mt-4 inline-block text-sm text-emerald-900 underline">
          Retour aux demandes
        </Link>
      </main>
    );
  }

  if (!request) return null;

  const pr = one(request.product_requests);
  const patientNote = pr?.patient_note;

  return (
    <main className="mx-auto min-h-screen max-w-lg p-6 pb-12">
      <Link href="/dashboard/pharmacien/demandes" className="text-sm font-medium text-emerald-900 underline">
        ← Demandes pharmacie
      </Link>

      {(pharmacistRequestIsHardStopped(request.status) || pharmacistRequestIsClosedSuccess(request.status)) && isProduct ? (
        <section className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
          <p className="font-semibold text-slate-900">
            {pharmacistRequestIsHardStopped(request.status) ? "Dossier sans suite" : "Dossier terminé"}
          </p>
          <p className="mt-1 text-slate-700">
            {pharmacistRequestIsHardStopped(request.status)
              ? "Cette demande ne peut plus être modifiée. Les informations restent disponibles ci-dessous en lecture seule."
              : "Clôturée côté comptoir. Les informations ci-dessous sont en lecture seule."}
          </p>
        </section>
      ) : null}

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

      {request.patient_planned_visit_date ? (
        <section className="mt-4 rounded-xl border border-teal-100 bg-teal-50/60 p-3 text-sm">
          <h2 className="text-xs font-bold uppercase text-teal-900/85">Passage annoncé par le patient</h2>
          <p className="mt-2 text-teal-950">
            {new Date(`${request.patient_planned_visit_date}T12:00:00`).toLocaleDateString("fr-FR", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
            {request.patient_planned_visit_time
              ? ` · vers ${String(request.patient_planned_visit_time).slice(0, 5)}`
              : ""}
          </p>
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
              const linePph = pphLabel(prod?.price_pph);
              const f = draft[row.id];
              if (!f) return null;
              return (
                <li key={row.id} className="rounded-xl border bg-white p-3 text-sm shadow-sm">
                  <p className="font-medium text-gray-900">{prod?.name ?? "Produit"}</p>
                  {linePph ? <p className="mt-0.5 text-xs font-medium text-teal-800">{linePph}</p> : null}
                  <p className="mt-1 text-xs text-gray-600">Demandé&nbsp;: {row.requested_qty}</p>
                  {row.is_selected_by_patient &&
                  row.selected_qty != null &&
                  row.patient_chosen_alternative_id &&
                  normalizeAlts(row.request_item_alternatives).some((a) => a.id === row.patient_chosen_alternative_id) ? (
                    <p className="mt-1 text-xs font-semibold text-emerald-900">
                      Patient a choisi l’alternative&nbsp;:{" "}
                      {one(
                        normalizeAlts(row.request_item_alternatives).find(
                          (a) => a.id === row.patient_chosen_alternative_id
                        )?.products
                      )?.name ?? "—"}
                    </p>
                  ) : row.is_selected_by_patient &&
                    row.selected_qty != null &&
                    !row.patient_chosen_alternative_id &&
                    normalizeAlts(row.request_item_alternatives).length > 0 ? (
                    <p className="mt-1 text-xs text-gray-700">Patient a gardé le produit principal.</p>
                  ) : null}

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
                    <span className="text-xs font-medium text-gray-700">
                      Prix unitaire (réponse patient — prérempli PPH catalogue si disponible)
                    </span>
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

                  <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50/50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-bold uppercase tracking-wide text-amber-900/85">Alternatives</p>
                      <span className="text-[10px] text-amber-800/70">maximum 3</span>
                    </div>
                    {normalizeAlts(row.request_item_alternatives).length === 0 ? (
                      <p className="mt-2 text-xs text-gray-600">Aucune alternative ajoutée.</p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {normalizeAlts(row.request_item_alternatives).map((alt) => {
                          const altProd = one(alt.products);
                          const altName = altProd?.name ?? "Alternative";
                          const altPph = pphLabel(altProd?.price_pph);
                          return (
                            <li
                              key={alt.id}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-white/80 bg-white px-2 py-2 text-xs"
                            >
                              <div>
                                <p className="font-medium text-gray-900">
                                  {altName}
                                  {altPph ? <span className="ml-1 font-normal text-teal-800">· {altPph}</span> : null}
                                </p>
                                <p className="mt-1 text-[11px] text-gray-600">
                                  Rang {alt.rank} ·{" "}
                                  {alt.availability_status
                                    ? availabilityStatusFr[alt.availability_status]
                                    : "—"}
                                  {alt.available_qty != null ? ` · Qté ${alt.available_qty}` : ""}
                                </p>
                              </div>
                              {canEditResponse ? (
                                <button
                                  type="button"
                                  disabled={altBusyRow === alt.id}
                                  onClick={() => void deleteAlternativeRow(alt.id, row.id)}
                                  className="shrink-0 text-[11px] font-medium text-red-700 underline disabled:opacity-50"
                                >
                                  Retirer
                                </button>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    {canEditResponse && normalizeAlts(row.request_item_alternatives).length < 3 ? (
                      <>
                        {altPickerOpenFor === row.id ? (
                          <div className="mt-3 rounded-md border border-amber-200 bg-white p-2">
                            <div className="flex items-center justify-between gap-2">
                              <label className="flex-1 text-xs font-medium text-gray-700">Rechercher un produit</label>
                              <button
                                type="button"
                                className="text-[11px] text-gray-600 underline"
                                onClick={resetAltPicker}
                              >
                                Fermer
                              </button>
                            </div>
                            <input
                              type="search"
                              value={altQuery}
                              onChange={(e) => setAltQuery(e.target.value)}
                              placeholder="Nom (min. 2 caractères)"
                              className="mt-1 w-full rounded border px-2 py-1 text-sm"
                            />
                            {altVisibleHits.length > 0 ? (
                              <ul className="mt-2 max-h-40 space-y-1 overflow-auto rounded border border-gray-100 bg-gray-50 p-1">
                                {altVisibleHits.map((h) => (
                                  <li key={h.id}>
                                    <button
                                      type="button"
                                      disabled={altBusyRow === row.id}
                                      onClick={() => void insertAlternative(row, h)}
                                      className="flex w-full flex-col rounded px-2 py-1 text-left hover:bg-white disabled:opacity-50"
                                    >
                                      <span className="text-sm font-medium text-gray-900">{h.name}</span>
                                      {pphLabel(h.price_pph) ? (
                                        <span className="text-[11px] font-medium text-teal-800">{pphLabel(h.price_pph)}</span>
                                      ) : null}
                                      <span className="text-[11px] text-gray-500">
                                        {h.product_type}
                                        {h.laboratory ? ` · ${h.laboratory}` : ""}
                                      </span>
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            ) : altDebounced.length >= 2 ? (
                              <p className="mt-2 text-[11px] text-gray-500">Aucun résultat.</p>
                            ) : null}
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={altBusyRow === row.id}
                            onClick={() => {
                              setAltPickerOpenFor(row.id);
                              setAltQuery("");
                              setAltHits([]);
                            }}
                            className="mt-3 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-950 disabled:opacity-50"
                          >
                            Ajouter une alternative…
                          </button>
                        )}
                      </>
                    ) : null}
                  </div>
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
                ? "Demande confirmée par le patient. À traiter ensuite au comptoir ci-dessous."
                : null}
              {request.status !== "responded" &&
              request.status !== "confirmed" &&
              request.status !== "completed" ? (
                <span>Résumé disponible uniquement dans cet écran selon statut ({request.status}).</span>
              ) : null}
              {request.status === "completed" ? (
                <span>Dossier clôturé côté comptoir. Les lignes ne sont plus modifiables ici.</span>
              ) : null}
            </p>
          )}

          {(request.status === "responded" ||
            request.status === "confirmed" ||
            request.status === "completed") &&
          items.length > 0 ? (
            <section className="mt-8 rounded-2xl border-2 border-slate-200 bg-slate-50/50 p-4">
              <h2 className="text-sm font-bold text-slate-900">Comptoir magasin</h2>
              <p className="mt-2 text-xs text-slate-700">
                Une fois le patient présent ou contacté au comptoir, indique l’issue par ligne (« récupéré », « pas
                venu », etc.). Pour clôturer le dossier, toutes les lignes encore suivies dans la préparation doivent être
                au statut <strong>Récupéré</strong>, <strong>Non récupéré</strong>, ou avoir été désélectionnées par le patient.
              </p>
              <ul className="mt-4 space-y-3">
                {items.map((row) => {
                  const prod = one(row.products);
                  const counterPph = pphLabel(prod?.price_pph);
                  const co = row.counter_outcome ?? "unset";
                  const selected = Boolean(row.is_selected_by_patient);
                  const outcomeSelectDisabled =
                    request.status === "completed" ||
                    counterBusyId === row.id ||
                    !selected;

                  return (
                    <li key={`co-${row.id}`} className="rounded-xl border bg-white px-3 py-3 text-sm shadow-sm">
                      <p className="font-medium text-gray-900">{prod?.name ?? "Produit"}</p>
                      {counterPph ? <p className="text-xs font-medium text-teal-800">{counterPph}</p> : null}
                      {!selected ? (
                        <p className="mt-2 text-xs text-gray-600">
                          Ligne retirée par le patient après ta réponse (annulée côté comptoir automatiquement). État&nbsp;:{" "}
                          <strong>{counterOutcomeFr[co] ?? co}</strong>
                        </p>
                      ) : (
                        <label className="mt-2 block text-xs font-medium text-gray-700">
                          Issue au comptoir
                          <select
                            value={co}
                            disabled={outcomeSelectDisabled}
                            onChange={(e) => void saveCounterOutcome(row.id, e.target.value)}
                            className={`mt-1 w-full rounded-lg border px-2 py-2 text-sm ${
                              request.status === "completed" ? "cursor-not-allowed bg-gray-100" : ""
                            }`}
                          >
                            <option value="unset">{counterOutcomeFr.unset ?? "unset"}</option>
                            <option value="picked_up">{counterOutcomeFr.picked_up}</option>
                            <option value="cancelled_at_counter">{counterOutcomeFr.cancelled_at_counter}</option>
                            <option value="deferred_next_visit">{counterOutcomeFr.deferred_next_visit}</option>
                          </select>
                          {counterBusyId === row.id ? (
                            <span className="mt-1 block text-[11px] text-gray-500">Enregistrement…</span>
                          ) : null}
                        </label>
                      )}
                    </li>
                  );
                })}
              </ul>
              {(request.status === "responded" || request.status === "confirmed") && (
                <button
                  type="button"
                  disabled={completeBusy || !canCompleteCounter}
                  onClick={() => void runCompleteAfterCounter()}
                  className={`mt-4 w-full rounded-xl py-3 text-sm font-semibold disabled:opacity-50 ${
                    canCompleteCounter
                      ? "bg-slate-900 text-white shadow-sm"
                      : "border border-slate-200 bg-gray-50 text-gray-700"
                  }`}
                >
                  {completeBusy
                    ? "Clôture…"
                    : "Clôturer le dossier (comptoir OK)"}
                </button>
              )}
              {!canCompleteCounter && (request.status === "responded" || request.status === "confirmed") ? (
                <p className="mt-2 text-[11px] text-amber-900">
                  Réglages requis avant clôture : chaque ligne gardée doit être marquée (plus de « pas encore vu » ni « à
                  récupérer plus tard »).
                </p>
              ) : null}
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}
