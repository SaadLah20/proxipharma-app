"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { formatDateTimeShort24hFr, formatPlannedVisitFr } from "@/lib/datetime-fr";
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
import { PageShell } from "@/components/ui/compact-shell";

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
      <PageShell maxWidthClass="max-w-4xl">
        <p className="text-muted-foreground">Chargement…</p>
      </PageShell>
    );
  }

  if (error && !request) {
    return (
      <PageShell maxWidthClass="max-w-4xl">
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">{error}</p>
        <Link href="/dashboard/pharmacien/demandes" className="mt-3 inline-block text-xs font-medium text-emerald-900 underline">
          Demandes pharmacie
        </Link>
      </PageShell>
    );
  }

  if (!request) return null;

  const pr = one(request.product_requests);
  const patientNote = pr?.patient_note;

  return (
    <PageShell maxWidthClass="max-w-4xl" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/dashboard/pharmacien/demandes" className="text-xs font-medium text-emerald-900 underline">
          ← Demandes
        </Link>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[10px] text-muted-foreground">#{formatShortId(request.id)}</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-foreground sm:text-xs">
            {requestStatusFr[request.status] ?? request.status}
          </span>
        </div>
      </div>

      {(pharmacistRequestIsHardStopped(request.status) || pharmacistRequestIsClosedSuccess(request.status)) && isProduct ? (
        <section className="rounded-lg border border-border bg-muted/25 px-2.5 py-2 text-[11px] text-muted-foreground">
          <p className="font-semibold text-foreground">
            {pharmacistRequestIsHardStopped(request.status) ? "Sans suite" : "Terminé (comptoir)"}
          </p>
          <p className="mt-0.5 leading-snug">
            {pharmacistRequestIsHardStopped(request.status)
              ? "Lecture seule."
              : "Clôturé — lecture seule."}
          </p>
        </section>
      ) : null}

      <div>
        <h1 className="text-base font-bold text-foreground sm:text-lg">
          {requestTypeFr[request.request_type] ?? request.request_type}
        </h1>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          Patient <span className="font-mono">{formatShortId(request.patient_id)}</span>
          <span className="hidden sm:inline"> · créée {formatDateTimeShort24hFr(request.created_at)}</span>
        </p>
      </div>

      {patientNote ? (
        <section className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-2.5 py-2">
          <h2 className="text-[10px] font-bold uppercase tracking-wide text-amber-950">Message patient</h2>
          <p className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap text-[11px] leading-snug">{patientNote}</p>
        </section>
      ) : null}

      {request.patient_planned_visit_date ? (
        <section className="rounded-lg border border-teal-500/25 bg-teal-500/5 px-2.5 py-2">
          <h2 className="text-[10px] font-bold uppercase tracking-wide text-teal-950">Passage patient</h2>
          <p className="mt-1 text-xs font-medium text-teal-950">
            {formatPlannedVisitFr(request.patient_planned_visit_date, request.patient_planned_visit_time)}
          </p>
        </section>
      ) : null}

      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-[11px] text-destructive">{error}</p>
      ) : null}

      {!isProduct ? (
        <p className="mt-2 rounded-md border border-border bg-muted/30 p-2 text-[11px] text-muted-foreground">
          Type de demande non géré dans cet écran (hors produits).
        </p>
      ) : items.length === 0 ? (
        <p className="mt-2 text-[11px] text-muted-foreground">Aucune ligne produit.</p>
      ) : (
        <>
          <h2 className="mt-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Lignes produits</h2>
          <ul className="mt-2 space-y-2">
            {items.map((row) => {
              const prod = one(row.products);
              const linePph = pphLabel(prod?.price_pph);
              const f = draft[row.id];
              if (!f) return null;
              return (
                <li key={row.id} className="overflow-hidden rounded-lg border border-border/90 bg-card shadow-sm">
                  <div className="border-b border-border/60 bg-muted/20 px-2 py-1.5">
                    <p className="text-xs font-semibold text-foreground sm:text-sm">{prod?.name ?? "Produit"}</p>
                    {linePph ? <p className="text-[10px] font-medium text-teal-800 sm:text-xs">{linePph}</p> : null}
                    <p className="text-[10px] text-muted-foreground">Demandé {row.requested_qty}</p>
                  </div>
                  {row.is_selected_by_patient &&
                  row.selected_qty != null &&
                  row.patient_chosen_alternative_id &&
                  normalizeAlts(row.request_item_alternatives).some((a) => a.id === row.patient_chosen_alternative_id) ? (
                    <p className="border-b border-border/40 bg-emerald-500/5 px-2 py-1 text-[10px] font-semibold text-emerald-950 sm:text-[11px]">
                      Patient : alternative{" "}
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
                    <p className="border-b border-border/40 bg-muted/30 px-2 py-1 text-[10px] text-muted-foreground">
                      Patient : produit principal.
                    </p>
                  ) : null}
                  <div className="grid gap-2 p-2 sm:grid-cols-2">
                  <label className="block sm:col-span-2">
                    <span className="text-[10px] font-medium text-muted-foreground">Dispo</span>
                    <select
                      disabled={!canEditResponse}
                      value={f.availability_status}
                      onChange={(e) => setField(row.id, "availability_status", e.target.value)}
                      className="mt-0.5 w-full rounded-md border border-input bg-background px-2 py-1 text-xs disabled:opacity-60"
                    >
                      {PHARMACIST_AVAILABILITY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-[10px] font-medium text-muted-foreground">Qté dispo</span>
                    <input
                      type="number"
                      min={0}
                      disabled={!canEditResponse}
                      value={f.available_qty}
                      onChange={(e) => setField(row.id, "available_qty", e.target.value)}
                      className="mt-0.5 w-full rounded-md border border-input bg-background px-2 py-1 text-xs disabled:opacity-60"
                    />
                  </label>

                  <label className="block">
                    <span className="text-[10px] font-medium text-muted-foreground">Prix unit. (MAD)</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="45.50"
                      disabled={!canEditResponse}
                      value={f.unit_price}
                      onChange={(e) => setField(row.id, "unit_price", e.target.value)}
                      className="mt-0.5 w-full rounded-md border border-input bg-background px-2 py-1 text-xs disabled:opacity-60"
                    />
                  </label>

                  {f.availability_status === "to_order" ? (
                    <label className="block sm:col-span-2">
                      <span className="text-[10px] font-medium text-muted-foreground">Date prévision « à commander »</span>
                      <input
                        type="date"
                        disabled={!canEditResponse}
                        value={f.expected_availability_date}
                        onChange={(e) => setField(row.id, "expected_availability_date", e.target.value)}
                        className="mt-0.5 w-full rounded-md border border-input bg-background px-2 py-1 text-xs disabled:opacity-60"
                      />
                    </label>
                  ) : null}

                  <label className="block sm:col-span-2">
                    <span className="text-[10px] font-medium text-muted-foreground">Commentaire patient</span>
                    <textarea
                      rows={2}
                      disabled={!canEditResponse}
                      value={f.pharmacist_comment}
                      onChange={(e) => setField(row.id, "pharmacist_comment", e.target.value)}
                      className="mt-0.5 w-full rounded-md border border-input bg-background px-2 py-1 text-xs disabled:opacity-60"
                    />
                  </label>
                  </div>

                  {!canEditResponse ? (
                    <p className="border-t border-border/50 px-2 py-1.5 text-[10px] text-muted-foreground">
                      Dernière dispo :{" "}
                      <strong className="text-foreground">{row.availability_status ? availabilityStatusFr[row.availability_status] : "—"}</strong>
                    </p>
                  ) : null}

                  <div className="border-t border-border/50 bg-amber-500/5 px-2 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-amber-950">Alternatives</p>
                      <span className="text-[9px] text-amber-900/80">max 3</span>
                    </div>
                    {normalizeAlts(row.request_item_alternatives).length === 0 ? (
                      <p className="mt-1 text-[10px] text-muted-foreground">Aucune alternative.</p>
                    ) : (
                      <ul className="mt-1 space-y-1">
                        {normalizeAlts(row.request_item_alternatives).map((alt) => {
                          const altProd = one(alt.products);
                          const altName = altProd?.name ?? "Alternative";
                          const altPph = pphLabel(altProd?.price_pph);
                          return (
                            <li
                              key={alt.id}
                              className="flex flex-wrap items-center justify-between gap-1 rounded border border-border/60 bg-card px-1.5 py-1 text-[10px] sm:text-[11px]"
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
              className="mt-3 w-full rounded-md bg-emerald-700 py-2.5 text-xs font-semibold text-white shadow-sm disabled:opacity-50 sm:text-sm"
            >
              {busy ? "Publication…" : "Envoyer la réponse au patient"}
            </button>
          ) : (
            <p className="mt-3 rounded-md border border-border bg-muted/30 p-2 text-[11px] text-muted-foreground">
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
            <section className="mt-4 rounded-lg border border-border bg-muted/15 p-2.5 sm:p-3">
              <h2 className="text-[10px] font-bold uppercase tracking-wide text-foreground">Comptoir</h2>
              <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
                Issue par ligne ; clôture quand plus de « pas encore vu » ni « report » sur les lignes gardées par le patient.
              </p>
              <ul className="mt-2 space-y-2">
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
                    <li key={`co-${row.id}`} className="rounded-md border border-border/80 bg-card px-2 py-2 text-[11px] shadow-sm">
                      <p className="font-semibold text-foreground">{prod?.name ?? "Produit"}</p>
                      {counterPph ? <p className="text-[10px] font-medium text-teal-800">{counterPph}</p> : null}
                      {!selected ? (
                        <p className="mt-2 text-xs text-gray-600">
                          Ligne retirée par le patient après ta réponse (annulée côté comptoir automatiquement). État&nbsp;:{" "}
                          <strong>{counterOutcomeFr[co] ?? co}</strong>
                        </p>
                      ) : (
                        <label className="mt-1.5 block text-[10px] font-medium text-muted-foreground">
                          Issue comptoir
                          <select
                            value={co}
                            disabled={outcomeSelectDisabled}
                            onChange={(e) => void saveCounterOutcome(row.id, e.target.value)}
                            className={`mt-0.5 w-full rounded-md border border-input bg-background px-2 py-1 text-xs ${
                              request.status === "completed" ? "cursor-not-allowed opacity-60" : ""
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
                  className={`mt-2 w-full rounded-md py-2 text-xs font-semibold disabled:opacity-50 sm:text-sm ${
                    canCompleteCounter
                      ? "bg-foreground text-background shadow-sm"
                      : "border border-border bg-muted/40 text-muted-foreground"
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
    </PageShell>
  );
}
