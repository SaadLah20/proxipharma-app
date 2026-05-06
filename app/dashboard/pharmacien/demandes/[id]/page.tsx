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
  requestItemLineSourceFr,
  requestStatusFr,
  requestTypeFr,
} from "@/lib/request-display";
import { displayRequestPublicRef } from "@/lib/public-ref";
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
  request_public_ref?: string | null;
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
  client_comment: string | null;
  line_source: string | null;
  pharmacist_proposal_reason: string | null;
  expected_availability_date: string | null;
  counter_outcome: string;
  is_selected_by_patient: boolean;
  selected_qty: number | null;
  patient_chosen_alternative_id?: string | null;
  updated_at: string;
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

type PatientBrief = {
  full_name: string | null;
  whatsapp: string | null;
  email: string | null;
  patient_ref: string | null;
};

function patientHeadingName(profile: PatientBrief | null, patientId: string): string {
  const n = profile?.full_name?.trim();
  if (n) return n;
  return `Patient #${formatShortId(patientId)}`;
}

function telHref(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 8) return `tel:${digits}`;
  return `tel:${raw.trim()}`;
}

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

function counterOutcomeLabelPharmacien(outcome: string): string {
  if (outcome === "cancelled_at_counter") return "Annulé à la demande du client";
  return counterOutcomeFr[outcome] ?? outcome;
}

function buildItemUpdatePayload(f: ItemDraft) {
  const availQty = Number(f.available_qty);
  if (Number.isNaN(availQty) || availQty < 0) {
    throw new Error("Quantité disponible invalide sur une ligne.");
  }
  const price = f.unit_price.trim() === "" ? null : Number(f.unit_price.replace(",", "."));
  if (f.unit_price.trim() !== "" && (price == null || Number.isNaN(price) || price < 0)) {
    throw new Error("Prix unitaire invalide.");
  }
  return {
    availability_status: f.availability_status,
    available_qty: availQty,
    unit_price: price,
    pharmacist_comment: f.pharmacist_comment.trim() || null,
    expected_availability_date: f.expected_availability_date.trim() !== "" ? f.expected_availability_date : null,
  };
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
  const [patientProfile, setPatientProfile] = useState<PatientBrief | null>(null);

  const altDebounced = useMemo(() => altQuery.trim(), [altQuery]);
  const altVisibleHits = altDebounced.length < 2 ? [] : altHits;

  const [propOpen, setPropOpen] = useState(false);
  const [propQuery, setPropQuery] = useState("");
  const [propHits, setPropHits] = useState<ProductCatalogHit[]>([]);
  const [propReason, setPropReason] = useState("");
  const [propQty, setPropQty] = useState("1");
  const [propBusy, setPropBusy] = useState(false);
  const propDebounced = useMemo(() => propQuery.trim(), [propQuery]);
  const propVisibleHits = propDebounced.length < 2 ? [] : propHits;

  const load = useCallback(async () => {
    if (!id) return;
    setError("");
    setPatientProfile(null);
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
        "id,status,request_type,pharmacy_id,patient_id,created_at,submitted_at,responded_at,patient_planned_visit_date,patient_planned_visit_time,request_public_ref,product_requests(patient_note)"
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
    const { data: contactRpc, error: patErr } = await supabase.rpc("pharmacist_patient_contact_for_request", {
      p_request_id: id,
    });
    if (!patErr && contactRpc != null) {
      const rows = Array.isArray(contactRpc) ? contactRpc : [contactRpc];
      const first = rows[0] as PatientBrief | undefined;
      if (first) {
        setPatientProfile({
          full_name: first.full_name ?? null,
          whatsapp: first.whatsapp ?? null,
          email: first.email ?? null,
          patient_ref: first.patient_ref ?? null,
        });
      }
    }

    const { data: itemsData, error: itemsErr } = await supabase
      .from("request_items")
      .select(
        "id,product_id,requested_qty,availability_status,available_qty,unit_price,pharmacist_comment,expected_availability_date,counter_outcome,is_selected_by_patient,selected_qty,patient_chosen_alternative_id,line_source,pharmacist_proposal_reason,client_comment,updated_at,products(name,price_pph),request_item_alternatives!request_item_alternatives_request_item_id_fkey(id,rank,product_id,availability_status,available_qty,unit_price,pharmacist_comment,expected_availability_date,products(name,price_pph))"
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

  useEffect(() => {
    if (propDebounced.length < 2 || !propOpen) {
      return;
    }
    const t = window.setTimeout(() => {
      void (async () => {
        const { data, error } = await supabase
          .from("products")
          .select("id,name,product_type,laboratory,price_pph")
          .eq("is_active", true)
          .ilike("name", `%${propDebounced}%`)
          .order("name")
          .limit(12);
        if (error || !Array.isArray(data)) {
          setPropHits([]);
          return;
        }
        setPropHits(data as ProductCatalogHit[]);
      })();
    }, 280);
    return () => window.clearTimeout(t);
  }, [propDebounced, propOpen]);

  const setField = (itemId: string, field: keyof ItemDraft, value: string) => {
    setDraft((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], [field]: value },
    }));
  };

  const setAvailableQty = (itemId: string, raw: string) => {
    const digits = raw.replace(/[^\d]/g, "");
    setField(itemId, "available_qty", digits === "" ? "" : String(Number(digits)));
  };

  const nudgeAvailableQty = (itemId: string, delta: number) => {
    const current = Number(draft[itemId]?.available_qty ?? "0");
    const next = Math.max(0, Number.isFinite(current) ? current + delta : delta > 0 ? 1 : 0);
    setField(itemId, "available_qty", String(next));
  };

  const resetAltPicker = () => {
    setAltPickerOpenFor(null);
    setAltQuery("");
    setAltHits([]);
  };

  const resetPropForm = () => {
    setPropQuery("");
    setPropHits([]);
    setPropReason("");
    setPropQty("1");
  };

  const insertPharmacistProposedLine = async (pick: ProductCatalogHit) => {
    if (!id) return;
    setError("");
    const reason = propReason.trim();
    if (reason.length < 3) {
      setError("Indique un motif d’au moins 3 caractères pour proposer ce produit.");
      return;
    }
    const qty = Math.min(10, Math.max(1, parseInt(propQty, 10) || 1));
    if (items.some((i) => i.product_id === pick.id)) {
      setError("Ce produit figure déjà dans la demande.");
      return;
    }
    setPropBusy(true);
    const { error: insErr } = await supabase.from("request_items").insert({
      request_id: id,
      product_id: pick.id,
      requested_qty: qty,
      line_source: "pharmacist_proposed",
      pharmacist_proposal_reason: reason,
      is_selected_by_patient: true,
      selected_qty: qty,
      counter_outcome: "unset",
    });
    setPropBusy(false);
    if (insErr) {
      setError(insErr.message);
      return;
    }
    if (request?.status === "confirmed") {
      const { error: h } = await logHistory(id, "confirmed", "confirmed", "counter_product_added");
      if (h) {
        setError(h.message);
        return;
      }
    }
    setPropOpen(false);
    resetPropForm();
    await load();
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
    if (request?.status === "confirmed") {
      const { error: h } = await logHistory(id, "confirmed", "confirmed", "counter_alternative_added");
      if (h) {
        setError(h.message);
        return;
      }
    }
    resetAltPicker();

    const { data: altRows, error: fetchErr } = await supabase
      .from("request_item_alternatives")
      .select(
        "id,rank,product_id,availability_status,available_qty,unit_price,pharmacist_comment,expected_availability_date,products(name,price_pph)"
      )
      .eq("request_item_id", parentRow.id)
      .order("rank", { ascending: true });

    if (fetchErr) {
      setError(fetchErr.message);
      return;
    }

    setItems((prev) =>
      prev.map((r) => (r.id === parentRow.id ? { ...r, request_item_alternatives: altRows ?? [] } : r))
    );
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
    if (request?.status === "confirmed") {
      const { error: h } = await logHistory(id, "confirmed", "confirmed", "counter_alternative_removed");
      if (h) {
        setError(h.message);
        return;
      }
    }
    if (altPickerOpenFor === parentRowId) resetAltPicker();

    if (parentRowId) {
      const { data: altRows, error: fetchErr } = await supabase
        .from("request_item_alternatives")
        .select(
          "id,rank,product_id,availability_status,available_qty,unit_price,pharmacist_comment,expected_availability_date,products(name,price_pph)"
        )
        .eq("request_item_id", parentRowId)
        .order("rank", { ascending: true });
      if (!fetchErr) {
        setItems((prev) =>
          prev.map((r) => (r.id === parentRowId ? { ...r, request_item_alternatives: altRows ?? [] } : r))
        );
      }
    }
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
    if (request?.status === "confirmed") {
      const { error: h } = await logHistory(id, "confirmed", "confirmed", `counter_outcome:${outcome}`);
      if (h) {
        setError(h.message);
        return;
      }
    }
    await load();
  };

  const saveConfirmedAdjustments = async () => {
    if (!request || request.status !== "confirmed") return;
    setBusy(true);
    setError("");
    try {
      for (const row of items) {
        const f = draft[row.id];
        if (!f?.availability_status) throw new Error("Choisis une disponibilité pour chaque ligne.");
        const { error: up } = await supabase
          .from("request_items")
          .update(buildItemUpdatePayload(f))
          .eq("id", row.id);
        if (up) throw new Error(up.message);
      }
      const { error: h } = await logHistory(id, "confirmed", "confirmed", "pharmacist_adjustments_after_confirmation");
      if (h) throw new Error(h.message);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Une erreur est survenue.");
    }
    setBusy(false);
  };

  const saveRespondedAdjustments = async () => {
    if (!request || request.status !== "responded") return;
    setBusy(true);
    setError("");
    try {
      for (const row of items) {
        const f = draft[row.id];
        if (!f?.availability_status) throw new Error("Choisis une disponibilité pour chaque ligne.");
        const { error: up } = await supabase
          .from("request_items")
          .update(buildItemUpdatePayload(f))
          .eq("id", row.id);
        if (up) throw new Error(up.message);
      }
      const { error: h } = await logHistory(id, "responded", "responded", "pharmacist_response_updated");
      if (h) throw new Error(h.message);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Une erreur est survenue.");
    }
    setBusy(false);
  };

  const cancelLineAtCounter = async (row: ItemRow) => {
    if (!request || request.status !== "confirmed") return;
    setCounterBusyId(row.id);
    setError("");
    const currentComment = (row.pharmacist_comment ?? "").trim();
    const nextComment = currentComment
      ? `${currentComment}\nAnnulé au comptoir à la demande du client.`
      : "Annulé au comptoir à la demande du client.";
    const { error: upErr } = await supabase
      .from("request_items")
      .update({
        is_selected_by_patient: false,
        selected_qty: null,
        counter_outcome: "cancelled_at_counter",
        pharmacist_comment: nextComment,
      })
      .eq("id", row.id);
    if (upErr) {
      setCounterBusyId(null);
      setError(upErr.message);
      return;
    }
    const { error: h } = await logHistory(id, "confirmed", "confirmed", "counter_line_cancelled");
    setCounterBusyId(null);
    if (h) {
      setError(h.message);
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
  const canManageConfirmed = request?.status === "confirmed";
  const canManageResponded = request?.status === "responded";
  const canEditLines = Boolean(canEditResponse || canManageResponded || canManageConfirmed);
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
      <PageShell maxWidthClass="max-w-5xl">
        <p className="text-muted-foreground">Chargement…</p>
      </PageShell>
    );
  }

  if (error && !request) {
    return (
      <PageShell maxWidthClass="max-w-5xl">
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

  const patientPhone = patientProfile?.whatsapp?.trim();
  const patientEmail = patientProfile?.email?.trim();
  const selectedLinesCount = items.filter((i) => i.is_selected_by_patient).length;
  const pendingCounterCount = items.filter(
    (i) => i.is_selected_by_patient && (i.counter_outcome ?? "unset") === "unset"
  ).length;
  const pickedUpCount = items.filter(
    (i) => i.is_selected_by_patient && (i.counter_outcome ?? "unset") === "picked_up"
  ).length;

  return (
    <PageShell maxWidthClass="max-w-5xl" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/dashboard/pharmacien/demandes" className="text-xs font-medium text-emerald-900 underline">
          ← Demandes de produits
        </Link>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[10px] font-semibold text-foreground">{displayRequestPublicRef(request)}</span>
          <span className="rounded-full border border-border/80 bg-muted/50 px-2.5 py-0.5 text-[10px] font-semibold text-foreground sm:text-xs">
            {requestStatusFr[request.status] ?? request.status}
          </span>
        </div>
      </div>

      {(pharmacistRequestIsHardStopped(request.status) || pharmacistRequestIsClosedSuccess(request.status)) && isProduct ? (
        <section className="rounded-xl border border-border bg-muted/25 px-3 py-2.5 text-[11px] text-muted-foreground">
          <p className="font-semibold text-foreground">
            {pharmacistRequestIsHardStopped(request.status) ? "Sans suite" : "Dossier terminé"}
          </p>
          <p className="mt-0.5 leading-snug">
            {pharmacistRequestIsHardStopped(request.status)
              ? "Lecture seule."
              : "Clôturé — lecture seule."}
          </p>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm ring-1 ring-black/[0.04]">
        <div className="flex flex-col gap-3 border-b border-border/60 bg-gradient-to-br from-emerald-50/80 via-card to-card p-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:p-4">
          <div className="flex min-w-0 gap-3">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-teal-700 text-sm font-bold text-white shadow-md"
              aria-hidden
            >
              {patientHeadingName(patientProfile, request.patient_id)
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-900/80">
                {requestTypeFr[request.request_type] ?? request.request_type}
              </p>
              <h1 className="truncate text-lg font-bold tracking-tight text-foreground sm:text-xl">
                {patientHeadingName(patientProfile, request.patient_id)}
              </h1>
              {patientProfile?.patient_ref?.trim() ? (
                <p className="mt-0.5 font-mono text-[10px] font-semibold text-emerald-900/90">
                  Code client {patientProfile.patient_ref.trim()}
                </p>
              ) : null}
              <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">ID technique · {formatShortId(request.patient_id)}</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
                {patientPhone ? (
                  <a
                    href={telHref(patientPhone)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700/10 px-2.5 py-1 font-semibold text-emerald-900 ring-1 ring-emerald-700/15 hover:bg-emerald-700/15"
                  >
                    <span className="text-[10px] font-medium uppercase tracking-wide text-emerald-800/90">Tél.</span>
                    {patientPhone}
                  </a>
                ) : (
                  <span className="text-[11px] text-muted-foreground">Téléphone non renseigné sur le profil.</span>
                )}
                {patientEmail ? (
                  <a href={`mailto:${patientEmail}`} className="text-[11px] font-medium text-sky-800 underline">
                    {patientEmail}
                  </a>
                ) : null}
              </div>
            </div>
          </div>
          <div className="shrink-0 text-left text-[11px] text-muted-foreground sm:text-right">
            <p>
              <span className="font-medium text-foreground">Créée</span> {formatDateTimeShort24hFr(request.created_at)}
            </p>
            {request.submitted_at ? (
              <p className="mt-0.5">
                <span className="font-medium text-foreground">Envoyée</span> {formatDateTimeShort24hFr(request.submitted_at)}
              </p>
            ) : null}
          </div>
        </div>
      </section>
      <section className="rounded-lg border border-border/70 bg-muted/20 px-2.5 py-1.5">
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-900">
            Lignes {items.length}
          </span>
          <span className="rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 font-semibold text-sky-900">
            Sélection {selectedLinesCount}
          </span>
          <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 font-semibold text-amber-900">
            Comptoir {pendingCounterCount}
          </span>
          <span className="text-[10px] text-emerald-900/80">Récupérés {pickedUpCount}</span>
        </div>
      </section>

      {patientNote ? (
        <section className="rounded-lg border border-amber-200/60 bg-amber-50/40 px-2.5 py-1.5 shadow-sm">
          <h2 className="text-[10px] font-bold uppercase tracking-wide text-amber-950">Message du client</h2>
          <p className="mt-0.5 max-h-20 overflow-auto whitespace-pre-wrap text-[11px] leading-snug text-amber-950/90">{patientNote}</p>
        </section>
      ) : null}

      {request.patient_planned_visit_date ? (
        <section className="rounded-xl border border-teal-200/60 bg-teal-50/40 px-3 py-2.5 shadow-sm">
          <h2 className="text-[10px] font-bold uppercase tracking-wide text-teal-950">Passage prévu</h2>
          <p className="mt-1 text-xs font-semibold text-teal-950">
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
      ) : (
        <>
          {items.length === 0 ? (
            <p className="mt-2 text-[11px] text-muted-foreground">Aucune ligne produit.</p>
          ) : (
            <>
              <div className="flex items-end justify-between gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Lignes à traiter</h2>
            <span className="text-[10px] text-muted-foreground">{items.length} article(s)</span>
          </div>
          <ul className="mt-2 space-y-2">
            {items.map((row) => {
              const prod = one(row.products);
              const linePph = pphLabel(prod?.price_pph);
              const f = draft[row.id];
              if (!f) return null;
              const co = row.counter_outcome ?? "unset";
              const selected = Boolean(row.is_selected_by_patient);
              const showInlineCounter =
                request.status === "responded" || request.status === "confirmed" || request.status === "completed";
              const outcomeSelectDisabled =
                request.status === "completed" ||
                counterBusyId === row.id ||
                !selected;
              return (
                <li
                  key={row.id}
                  className="overflow-hidden rounded-lg border border-border/80 bg-card shadow-sm ring-1 ring-black/[0.03]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-1.5 border-b border-border/60 bg-muted/15 px-2.5 py-1.5 sm:px-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold leading-snug text-foreground">{prod?.name ?? "Produit"}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
                        {linePph ? <span className="font-medium text-teal-800">{linePph}</span> : null}
                        <span>
                          Demandé <strong className="text-foreground">{row.requested_qty}</strong>
                        </span>
                        {row.is_selected_by_patient ? (
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-900">Retenu client</span>
                        ) : (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700">Retiré client</span>
                        )}
                      </div>
                      {row.line_source === "pharmacist_proposed" ? (
                        <p className="mt-1 rounded-md bg-violet-100/90 px-1.5 py-0.5 text-[10px] font-medium text-violet-950">
                          {requestItemLineSourceFr.pharmacist_proposed}
                          {row.pharmacist_proposal_reason ? (
                            <>
                              {" "}
                              — <span className="font-normal">{row.pharmacist_proposal_reason}</span>
                            </>
                          ) : null}
                        </p>
                      ) : null}
                      {row.client_comment ? (
                        <p className="mt-1 text-[10px] text-sky-950/90">
                          <span className="font-semibold">Note patient :</span> {row.client_comment}
                        </p>
                      ) : null}
                      <p className="mt-0.5 text-[9px] text-muted-foreground">
                        Mis à jour {formatDateTimeShort24hFr(row.updated_at)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1 p-1.5 sm:p-2">
                    <div className="grid grid-cols-2 gap-1 sm:grid-cols-6 lg:grid-cols-12 lg:gap-1.5">
                      <label className="col-span-2 flex min-w-0 flex-col gap-0.5 sm:col-span-3 lg:col-span-4">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Dispo</span>
                        <select
                          disabled={!canEditLines}
                          value={f.availability_status}
                          onChange={(e) => setField(row.id, "availability_status", e.target.value)}
                          className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs shadow-sm disabled:opacity-60"
                        >
                          {PHARMACIST_AVAILABILITY_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="col-span-1 flex min-w-0 flex-col gap-0.5 sm:col-span-1 lg:col-span-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Qté</span>
                        <div className="flex h-8 items-center overflow-hidden rounded-md border border-input bg-background shadow-sm">
                          <button
                            type="button"
                            disabled={!canEditLines}
                            onClick={() => nudgeAvailableQty(row.id, -1)}
                            className="h-full w-7 border-r border-input text-xs font-bold text-muted-foreground disabled:opacity-50"
                            aria-label="Diminuer la quantité"
                          >
                            −
                          </button>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            disabled={!canEditLines}
                            value={f.available_qty}
                            onChange={(e) => setAvailableQty(row.id, e.target.value)}
                            className="h-full w-full border-0 px-2 text-xs tabular-nums shadow-none focus:outline-none"
                          />
                          <button
                            type="button"
                            disabled={!canEditLines}
                            onClick={() => nudgeAvailableQty(row.id, 1)}
                            className="h-full w-7 border-l border-input text-xs font-bold text-muted-foreground disabled:opacity-50"
                            aria-label="Augmenter la quantité"
                          >
                            +
                          </button>
                        </div>
                      </label>
                      <label className="col-span-1 flex min-w-0 flex-col gap-0.5 sm:col-span-2 lg:col-span-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Prix MAD</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="0.00"
                          disabled={!canEditLines}
                          value={f.unit_price}
                          onChange={(e) => setField(row.id, "unit_price", e.target.value)}
                          className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs tabular-nums shadow-sm disabled:opacity-60"
                        />
                      </label>
                      <label className="col-span-2 flex min-w-0 flex-col gap-0.5 sm:col-span-6 lg:col-span-4">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Note au patient</span>
                        <textarea
                          rows={1}
                          disabled={!canEditLines}
                          value={f.pharmacist_comment}
                          onChange={(e) => setField(row.id, "pharmacist_comment", e.target.value)}
                          placeholder="Optionnel"
                          className="h-8 min-h-[2rem] w-full resize-none rounded-md border border-input bg-background px-2 py-1 text-xs leading-snug shadow-sm disabled:opacity-60"
                        />
                      </label>
                    </div>

                    {f.availability_status === "to_order" ? (
                      <label className="flex max-w-sm flex-col gap-0.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Date prévision « à commander »
                        </span>
                        <input
                          type="date"
                          disabled={!canEditLines}
                          value={f.expected_availability_date}
                          onChange={(e) => setField(row.id, "expected_availability_date", e.target.value)}
                          className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs shadow-sm disabled:opacity-60 sm:w-auto sm:min-w-[9.5rem]"
                        />
                      </label>
                    ) : null}

                    {!canEditLines ? (
                      <p className="rounded-md border border-border/60 bg-muted/20 px-2 py-0.5 text-[10px] text-muted-foreground">
                        Dernière dispo enregistrée :{" "}
                        <strong className="text-foreground">
                          {row.availability_status ? availabilityStatusFr[row.availability_status] : "—"}
                        </strong>
                      </p>
                    ) : null}
                  </div>

                  <div className="border-t border-amber-200/40 bg-amber-50/30 px-2 py-1.5 sm:px-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-amber-950">Alternatives</p>
                      <span className="rounded bg-amber-100/80 px-1.5 py-0.5 text-[9px] font-medium text-amber-900">max 3</span>
                    </div>
                    {normalizeAlts(row.request_item_alternatives).length === 0 ? (
                      <p className="mt-1 text-[10px] text-muted-foreground">Aucune alternative.</p>
                    ) : (
                      <ul className="mt-1.5 flex flex-col gap-1 sm:flex-row sm:flex-wrap">
                        {normalizeAlts(row.request_item_alternatives).map((alt) => {
                          const altProd = one(alt.products);
                          const altName = altProd?.name ?? "Alternative";
                          const altPph = pphLabel(altProd?.price_pph);
                          return (
                            <li
                              key={alt.id}
                              className="flex min-w-0 flex-1 basis-full items-center justify-between gap-1.5 rounded-md border border-amber-200/50 bg-card/90 px-1.5 py-1 text-[10px] shadow-sm sm:basis-[calc(50%-0.25rem)] lg:basis-[calc(33.333%-0.35rem)]"
                            >
                              <div className="min-w-0">
                                <p className="truncate font-medium text-foreground">{altName}</p>
                                <p className="mt-0.5 text-[10px] text-muted-foreground">
                                  #{alt.rank} ·{" "}
                                  {alt.availability_status ? availabilityStatusFr[alt.availability_status] : "—"}
                                  {alt.available_qty != null ? ` · Qté ${alt.available_qty}` : ""}
                                  {altPph ? <span className="text-teal-800"> · {altPph}</span> : null}
                                </p>
                              </div>
                              {canEditLines ? (
                                <button
                                  type="button"
                                  disabled={altBusyRow === alt.id}
                                  onClick={() => void deleteAlternativeRow(alt.id, row.id)}
                                  className="shrink-0 rounded-md border border-red-200/80 bg-white px-2 py-1 text-[10px] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                                >
                                  Retirer
                                </button>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    {canEditLines && normalizeAlts(row.request_item_alternatives).length < 3 ? (
                      <>
                        {altPickerOpenFor === row.id ? (
                          <div className="mt-2 rounded-lg border border-amber-200 bg-white p-2 shadow-sm">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-foreground">Catalogue</span>
                              <button type="button" className="text-[11px] font-medium text-muted-foreground hover:text-foreground" onClick={resetAltPicker}>
                                Fermer
                              </button>
                            </div>
                            <input
                              type="search"
                              value={altQuery}
                              onChange={(e) => setAltQuery(e.target.value)}
                              placeholder="Nom (2 caractères min.)"
                              className="mt-1.5 h-9 w-full rounded-lg border border-input px-2 text-sm"
                            />
                            {altVisibleHits.length > 0 ? (
                              <ul className="mt-2 max-h-36 space-y-0.5 overflow-auto rounded-lg border border-border/60 bg-muted/20 p-1">
                                {altVisibleHits.map((h) => (
                                  <li key={h.id}>
                                    <button
                                      type="button"
                                      disabled={altBusyRow === row.id}
                                      onClick={() => void insertAlternative(row, h)}
                                      className="flex w-full flex-col rounded-md px-2 py-1.5 text-left text-sm hover:bg-card disabled:opacity-50"
                                    >
                                      <span className="font-medium text-foreground">{h.name}</span>
                                      {pphLabel(h.price_pph) ? (
                                        <span className="text-[11px] font-medium text-teal-800">{pphLabel(h.price_pph)}</span>
                                      ) : null}
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            ) : altDebounced.length >= 2 ? (
                              <p className="mt-2 text-[11px] text-muted-foreground">Aucun résultat.</p>
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
                            className="mt-2 inline-flex h-9 items-center justify-center rounded-lg border border-amber-300/90 bg-white px-3 text-xs font-semibold text-amber-950 shadow-sm hover:bg-amber-50 disabled:opacity-50"
                          >
                            + Alternative
                          </button>
                        )}
                      </>
                    ) : null}
                    {canManageConfirmed ? (
                      <div className="mt-1.5 border-t border-border/60 pt-1.5">
                        <button
                          type="button"
                          disabled={counterBusyId === row.id}
                          onClick={() => void cancelLineAtCounter(row)}
                          className="inline-flex h-7 items-center justify-center rounded-md border border-rose-300/90 bg-white px-2.5 text-[10px] font-semibold text-rose-800 hover:bg-rose-50 disabled:opacity-50"
                        >
                          {counterBusyId === row.id ? "Annulation…" : "Annuler cette ligne"}
                        </button>
                      </div>
                    ) : null}
                    {showInlineCounter ? (
                      <div className="mt-1.5 border-t border-border/60 pt-1.5">
                        {!selected ? (
                          <p className="text-[10px] text-muted-foreground">
                            Ligne retirée par votre client · <strong className="text-foreground">{counterOutcomeLabelPharmacien(co)}</strong>
                          </p>
                        ) : (
                          <label className="flex max-w-[260px] flex-col gap-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Résultat comptoir
                            <select
                              value={co}
                              disabled={outcomeSelectDisabled}
                              onChange={(e) => void saveCounterOutcome(row.id, e.target.value)}
                              className={`h-8 w-full rounded-md border border-input bg-background px-2 text-[11px] ${
                                request.status === "completed" ? "cursor-not-allowed opacity-60" : ""
                              }`}
                            >
                              <option value="unset">{counterOutcomeLabelPharmacien("unset")}</option>
                              <option value="picked_up">{counterOutcomeLabelPharmacien("picked_up")}</option>
                              <option value="cancelled_at_counter">{counterOutcomeLabelPharmacien("cancelled_at_counter")}</option>
                              <option value="deferred_next_visit">{counterOutcomeLabelPharmacien("deferred_next_visit")}</option>
                            </select>
                            {counterBusyId === row.id ? <span className="text-[10px] text-muted-foreground">Enregistrement…</span> : null}
                          </label>
                        )}
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>

          {canEditLines ? (
            <section className="mt-2 rounded-lg border border-violet-200/80 bg-violet-50/45 px-2.5 py-2 shadow-sm ring-1 ring-violet-900/5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-[10px] font-bold uppercase tracking-wide text-violet-950">Proposer un produit</h2>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">Ajouter un produit après la dernière ligne.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPropOpen((o) => !o);
                    setError("");
                    resetPropForm();
                  }}
                  className="shrink-0 rounded-md border border-violet-400/80 bg-white px-2.5 py-1 text-[11px] font-semibold text-violet-950 shadow-sm hover:bg-violet-100/60"
                >
                  {propOpen ? "Fermer" : "Ouvrir"}
                </button>
              </div>
              {propOpen ? (
                <div className="mt-2 space-y-1.5">
                  <label className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Motif
                    <textarea
                      rows={2}
                      value={propReason}
                      onChange={(e) => setPropReason(e.target.value.slice(0, 1000))}
                      placeholder="Motif visible client"
                      className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                    />
                  </label>
                  <label className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Quantité
                    <div className="mt-1 flex h-8 w-32 items-center overflow-hidden rounded-md border border-input bg-background">
                      <button
                        type="button"
                        onClick={() => setPropQty((q) => String(Math.max(1, (parseInt(q, 10) || 1) - 1)))}
                        className="h-full w-7 border-r border-input text-xs font-bold text-muted-foreground"
                        aria-label="Diminuer la quantité proposée"
                      >
                        −
                      </button>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={propQty}
                        onChange={(e) => setPropQty(e.target.value.replace(/[^\d]/g, ""))}
                        className="h-full w-full border-0 px-2 text-xs tabular-nums focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setPropQty((q) => String(Math.min(10, (parseInt(q, 10) || 1) + 1)))}
                        className="h-full w-7 border-l border-input text-xs font-bold text-muted-foreground"
                        aria-label="Augmenter la quantité proposée"
                      >
                        +
                      </button>
                    </div>
                  </label>
                  <input
                    type="search"
                    value={propQuery}
                    onChange={(e) => setPropQuery(e.target.value)}
                    placeholder="Catalogue (2 caractères min.)"
                    className="h-8 w-full rounded-md border border-input px-2 text-sm"
                  />
                  {propVisibleHits.length > 0 ? (
                    <ul className="max-h-36 space-y-0.5 overflow-auto rounded-md border border-border/60 bg-muted/20 p-1">
                      {propVisibleHits.map((h) => (
                        <li key={h.id}>
                          <button
                            type="button"
                            disabled={propBusy}
                            onClick={() => void insertPharmacistProposedLine(h)}
                            className="flex w-full flex-col rounded-md px-2 py-1.5 text-left text-sm hover:bg-card disabled:opacity-50"
                          >
                            <span className="font-medium text-foreground">{h.name}</span>
                            {pphLabel(h.price_pph) ? (
                              <span className="text-[11px] font-medium text-teal-800">{pphLabel(h.price_pph)}</span>
                            ) : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : propDebounced.length >= 2 ? (
                    <p className="text-[11px] text-muted-foreground">Aucun résultat.</p>
                  ) : null}
                </div>
              ) : null}
            </section>
          ) : null}

          {canEditResponse || canManageResponded || canManageConfirmed ? (
            <section className="mt-4 rounded-xl border border-emerald-200/70 bg-emerald-50/35 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-950">Actions globales</p>
              <p className="mt-0.5 text-[11px] text-emerald-900/85">Valider vos modifications de dossier ou publier la réponse.</p>
              <div className="mt-2 flex flex-wrap gap-2">
              {canEditResponse ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void publishResponse()}
                  className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white shadow-md transition hover:bg-emerald-800 disabled:opacity-50 sm:w-auto sm:min-w-[220px]"
                >
                  {busy ? "Publication…" : "Envoyer la réponse au patient"}
                </button>
              ) : null}
              {canManageResponded ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void saveRespondedAdjustments()}
                  className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-sky-300 bg-sky-50 px-4 text-sm font-semibold text-sky-900 shadow-sm transition hover:bg-sky-100 disabled:opacity-50 sm:w-auto sm:min-w-[220px]"
                >
                  {busy ? "Enregistrement…" : "Enregistrer la réponse modifiée"}
                </button>
              ) : null}
              {canManageConfirmed ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void saveConfirmedAdjustments()}
                  className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-sky-300 bg-sky-50 px-4 text-sm font-semibold text-sky-900 shadow-sm transition hover:bg-sky-100 disabled:opacity-50 sm:w-auto sm:min-w-[220px]"
                >
                  {busy ? "Enregistrement…" : "Enregistrer les ajustements"}
                </button>
              ) : null}
              </div>
            </section>
          ) : (
            <p className="mt-3 rounded-md border border-border bg-muted/30 p-2 text-[11px] text-muted-foreground">
              {request.status === "responded"
                ? "Réponse déjà envoyée. Le patient traite depuis son espace (validation, modifications éventuelles)."
                : null}
              {request.status === "confirmed"
                ? "Demande confirmée par votre client. À traiter ensuite au comptoir ci-dessous."
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

          {(request.status === "responded" || request.status === "confirmed") && items.length > 0 ? (
            <section className="mt-2">
              <button
                type="button"
                disabled={completeBusy || !canCompleteCounter}
                onClick={() => void runCompleteAfterCounter()}
                className={`w-full rounded-md py-2 text-xs font-semibold disabled:opacity-50 sm:text-sm ${
                  canCompleteCounter
                    ? "bg-foreground text-background shadow-sm"
                    : "border border-border bg-muted/40 text-muted-foreground"
                }`}
              >
                {completeBusy ? "Clôture…" : "Clôturer le dossier (comptoir OK)"}
              </button>
              {!canCompleteCounter ? (
                <p className="mt-2 text-[11px] text-amber-900">
                  Avant clôture, chaque ligne retenue doit recevoir un résultat comptoir.
                </p>
              ) : null}
            </section>
          ) : null}
            </>
          )}
        </>
      )}
    </PageShell>
  );
}
