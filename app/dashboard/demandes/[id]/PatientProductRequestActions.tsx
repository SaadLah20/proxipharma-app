"use client";

import { useEffect, useMemo, useState } from "react";
import { Minus, Package, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { formatDateShortFr, formatTime24hFr } from "@/lib/datetime-fr";
import {
  PATIENT_CANCEL_REASON_CODES,
  PATIENT_CANCEL_REASON_LABELS,
  type PatientCancelReasonCode,
} from "@/lib/patient-flow-reasons";
import {
  availabilityStatusFr,
  counterOutcomePatientLabel,
  requestItemLineSourceFr,
} from "@/lib/request-display";
import { plannedVisitWindow } from "@/lib/planned-visit";
import {
  groupPatientConfirmedLines,
  patientConfirmedLinesNotInBuckets,
} from "@/lib/patient-confirmed-line-buckets";
import { unitPriceLabel } from "@/lib/product-price";
import { supabase } from "@/lib/supabase";
import { one } from "@/lib/embed";

type ProdBrief = { name: string; price_pph?: number | null; photo_url?: string | null };

export type ActionItemAltRow = {
  id: string;
  rank: number;
  availability_status: string | null;
  available_qty: number | null;
  unit_price: number | null;
  pharmacist_comment: string | null;
  expected_availability_date: string | null;
  products: ProdBrief | ProdBrief[] | null;
};

export type ActionItemRow = {
  id: string;
  product_id: string;
  requested_qty: number;
  selected_qty: number | null;
  is_selected_by_patient: boolean;
  availability_status: string | null;
  available_qty: number | null;
  unit_price: number | null;
  pharmacist_comment: string | null;
  /** Q11 note patient par ligne */
  client_comment?: string | null;
  /** Q20 */
  line_source?: string | null;
  pharmacist_proposal_reason?: string | null;
  counter_outcome: string;
  counter_cancel_reason?: string | null;
  counter_cancel_detail?: string | null;
  expected_availability_date: string | null;
  post_confirm_fulfillment?: string | null;
  products: ProdBrief | ProdBrief[] | null;
  patient_chosen_alternative_id?: string | null;
  request_item_alternatives?: ActionItemAltRow | ActionItemAltRow[] | null;
};

/** null = rien pour cette ligne ; "principal" ; sinon id alternative */
export type LineBranch = null | "principal" | string;

export type LineSelState = { branch: LineBranch; qty: number };

function normalizeAlternatives(raw: ActionItemAltRow | ActionItemAltRow[] | null | undefined): ActionItemAltRow[] {
  if (!raw) return [];
  return Array.isArray(raw) ? [...raw].sort((a, b) => a.rank - b.rank) : [raw];
}

function isMarketShortage(st: string | null | undefined): boolean {
  return st === "market_shortage";
}

function maxQtyPrincipal(row: ActionItemRow): number {
  if (isMarketShortage(row.availability_status)) return 0;
  if (row.availability_status === "unavailable") return 0;
  let cap = row.requested_qty;
  if (row.available_qty != null) cap = Math.min(cap, row.available_qty);
  return Math.max(0, cap);
}

function maxQtyAlt(row: ActionItemRow, alt: ActionItemAltRow): number {
  if (isMarketShortage(alt.availability_status)) return 0;
  if (alt.availability_status === "unavailable") return 0;
  let cap = row.requested_qty;
  if (alt.available_qty != null) cap = Math.min(cap, alt.available_qty);
  return Math.max(0, cap);
}

function maxQtyForBranch(row: ActionItemRow, branch: LineBranch, alts: ActionItemAltRow[]): number {
  if (branch === null) return 0;
  if (branch === "principal") return maxQtyPrincipal(row);
  const alt = alts.find((a) => a.id === branch);
  if (!alt) return 0;
  return maxQtyAlt(row, alt);
}

function counterOutcomeBadgeClass(outcome: string): string {
  switch (outcome) {
    case "picked_up":
      return "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200";
    case "cancelled_at_counter":
      return "bg-rose-100 text-rose-900 ring-1 ring-rose-200";
    case "deferred_next_visit":
      return "bg-amber-100 text-amber-900 ring-1 ring-amber-200";
    default:
      return "bg-sky-100 text-sky-900 ring-1 ring-sky-200";
  }
}

function postConfirmFulfillmentPatientFr(v: string | null | undefined): string {
  if (v === "reserved") return "Réservé en officine";
  if (v === "ordered") return "Commandé";
  return "À préciser par la pharmacie";
}

function ConfirmedPatientLineRow({ row }: { row: ActionItemRow }) {
  const prod = one(row.products);
  const altList = normalizeAlternatives(row.request_item_alternatives);
  const chosenAlt = altList.find((a) => a.id === row.patient_chosen_alternative_id);
  const counterOutcome = row.counter_outcome ?? "unset";
  const counterOutcomeLabel = counterOutcomePatientLabel(counterOutcome, row.counter_cancel_reason ?? null);
  const displayName = chosenAlt ? one(chosenAlt.products)?.name ?? "Alternative" : prod?.name ?? "Produit";
  const displayPrice = chosenAlt?.unit_price ?? row.unit_price;
  const displayStatus = chosenAlt?.availability_status ?? row.availability_status;
  const displayEta = chosenAlt?.expected_availability_date ?? row.expected_availability_date;
  const displayComment = chosenAlt?.pharmacist_comment ?? row.pharmacist_comment;
  const validatedQty = row.selected_qty ?? row.requested_qty;
  const prepQty = row.available_qty;
  const qtyDiffers = prepQty != null && Number(prepQty) !== Number(validatedQty);
  const isSelected = Boolean(row.is_selected_by_patient);
  const counterTouched = counterOutcome !== "unset";
  const isPharmacistProposed = row.line_source === "pharmacist_proposed";

  return (
    <li className="rounded-xl border-2 border-slate-100 bg-white p-2.5 text-[11px] shadow-sm">
      {isPharmacistProposed && isSelected ? (
        <div className="mb-2 rounded-lg border border-violet-300/80 bg-violet-50 px-2 py-2 text-[11px] leading-snug text-violet-950">
          <p className="font-bold text-violet-950">Produit proposé par la pharmacie</p>
          {row.pharmacist_proposal_reason?.trim() ? (
            <p className="mt-1">
              <span className="font-semibold">Motif : </span>
              {row.pharmacist_proposal_reason.trim()}
            </p>
          ) : (
            <p className="mt-1 italic text-violet-800/85">Motif enregistré par la pharmacie (voir le détail).</p>
          )}
          <p className="mt-1 text-[10px] text-violet-900/90">
            Ce produit ne figurait pas dans votre liste initiale ; vous l&apos;avez accepté lors de votre validation.
          </p>
        </div>
      ) : null}
      <p className="text-sm font-semibold text-foreground">{prod?.name ?? "Produit"}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        Demandé <strong className="text-foreground">{row.requested_qty}</strong>
        {row.selected_qty != null ? (
          <>
            {" "}· validé <strong className="text-foreground">{row.selected_qty}</strong>
          </>
        ) : null}
      </p>
      {!isSelected ? (
        <p className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] leading-snug text-slate-700">
          Vous n&apos;avez pas retenu cette ligne lors de votre validation. Aucun suivi pharmacie pour ce produit.
        </p>
      ) : (
        <>
          <div className="mt-2 rounded-lg border border-emerald-200/80 bg-emerald-50/90 px-2 py-1.5">
            <p className="text-[9px] font-bold uppercase tracking-wide text-emerald-900">
              {isPharmacistProposed ? "Ce que vous avez accepté (ajout pharmacie)" : "Ce que vous avez validé"}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-emerald-950">{displayName}</p>
            {displayStatus === "partially_available" ? (
              <p className="mt-1 text-[10px] leading-snug text-emerald-900">
                Quantité <strong>initialement demandée</strong> pour cette ligne :{" "}
                <strong className="tabular-nums">{row.requested_qty}</strong>
              </p>
            ) : null}
            <p className="mt-0.5 text-[11px] leading-snug text-emerald-900/90">
              <span>
                Qté validée · <strong className="tabular-nums">{validatedQty}</strong>
              </span>
              {displayStatus ? (
                <>
                  {" "}· Dispo · <strong>{availabilityStatusFr[displayStatus] ?? displayStatus}</strong>
                </>
              ) : null}
              {displayPrice != null ? (
                <>
                  {" "}· Prix · <strong className="tabular-nums">{Number(displayPrice).toFixed(2)} MAD</strong>
                </>
              ) : null}
              {" "}· État comptoir · <strong>Pas encore récupéré</strong>
            </p>
            {chosenAlt ? (
              <p className="mt-1 text-[10px] text-emerald-900/80">Alternative retenue par rapport au produit demandé.</p>
            ) : altList.length > 0 ? (
              <p className="mt-1 text-[10px] text-emerald-900/80">Produit principal retenu.</p>
            ) : null}
          </div>
          <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
            <p className="text-[9px] font-bold uppercase tracking-wide text-slate-600">Suivi officine</p>
            <p className="mt-0.5 text-[10px] leading-snug text-slate-800">
              Préparation indiquée par la pharmacie :{" "}
              <strong className="text-slate-950">{postConfirmFulfillmentPatientFr(row.post_confirm_fulfillment)}</strong>
            </p>
            {!counterTouched ? (
              <p className="mt-0.5 text-[11px] leading-snug text-slate-700">
                <strong className="text-slate-900">En cours</strong> · détail du retrait dès que la pharmacie mettra à jour le
                comptoir.
              </p>
            ) : (
              <>
                <p className="mt-0.5 text-sm font-semibold text-slate-950">{displayName}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-slate-800">
                  <span>
                    Qté suivie · <strong className="tabular-nums">{prepQty ?? "—"}</strong>
                  </span>
                  {displayStatus ? (
                    <>
                      {" "}· Dispo · <strong>{availabilityStatusFr[displayStatus] ?? displayStatus}</strong>
                    </>
                  ) : null}
                  {displayPrice != null ? (
                    <>
                      {" "}· Prix · <strong className="tabular-nums">{Number(displayPrice).toFixed(2)} MAD</strong>
                    </>
                  ) : null}
                  {displayStatus === "to_order" && displayEta ? (
                    <>
                      {" "}· Disponible le {formatDateShortFr(displayEta)}
                    </>
                  ) : null}
                </p>
                <div className="mt-1.5">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${counterOutcomeBadgeClass(counterOutcome)}`}
                  >
                    {counterOutcomeLabel}
                  </span>
                  {row.counter_cancel_detail ? (
                    <p className="mt-1 text-[10px] text-muted-foreground">{row.counter_cancel_detail}</p>
                  ) : null}
                </div>
                {qtyDiffers ? (
                  <p className="mt-1 text-[10px] leading-snug text-amber-900">
                    Diffère de votre validation — évolution gérée en pharmacie. Détail dans l&apos;historique si la pharmacie met à
                    jour le dossier.
                  </p>
                ) : null}
              </>
            )}
          </div>
          {displayComment ? <p className="mt-2 text-xs text-muted-foreground">{displayComment}</p> : null}
        </>
      )}
    </li>
  );
}

/** Défaut atelier : d’abord le principal disponible, sinon première alternative disponible, sinon rien */
function pickDefaultBranch(row: ActionItemRow, alts: ActionItemAltRow[]): LineBranch {
  if (maxQtyPrincipal(row) > 0) return "principal";
  for (const alt of alts) {
    if (maxQtyAlt(row, alt) > 0) return alt.id;
  }
  return null;
}

function computeSelFromItems(items: ActionItemRow[]): Record<string, LineSelState> {
  const next: Record<string, LineSelState> = {};
  for (const row of items) {
    const alts = normalizeAlternatives(row.request_item_alternatives);
    let branch = pickDefaultBranch(row, alts);
    let cap = maxQtyForBranch(row, branch, alts);
    if (branch !== null && cap < 1) branch = null;
    cap = maxQtyForBranch(row, branch, alts);
    const qty = branch !== null && cap > 0 ? cap : 1;
    next[row.id] = { branch, qty: branch !== null && cap > 0 ? Math.min(qty, cap) : 1 };
  }
  return next;
}

type ResubmitLine = {
  product_id: string;
  name: string;
  photo_url?: string | null;
  qty: number;
  price_pph?: number | null;
  client_comment: string;
  line_source?: string | null;
  pharmacist_proposal_reason?: string | null;
};

function computeResubmitLinesFromItems(items: ActionItemRow[]): ResubmitLine[] {
  return items.map((row) => ({
    product_id: row.product_id,
    name: one(row.products)?.name ?? "Produit",
    photo_url: one(row.products)?.photo_url ?? null,
    qty: Math.min(10, Math.max(1, row.requested_qty)),
    price_pph: one(row.products)?.price_pph ?? null,
    client_comment: row.client_comment ?? "",
    line_source: row.line_source ?? null,
    pharmacist_proposal_reason: row.pharmacist_proposal_reason ?? null,
  }));
}

type ProductHit = {
  id: string;
  name: string;
  product_type: string;
  laboratory: string | null;
  photo_url?: string | null;
  price_pph?: number | null;
};

type Props = {
  requestId: string;
  status: string;
  items: ActionItemRow[];
  initialPatientNote: string | null;
  initialPlannedVisitDate?: string | null;
  initialPlannedVisitTime?: string | null;
  onReload: () => Promise<void>;
};

function clampVisitYmd(ymd: string, minY: string, maxY: string): string {
  if (ymd < minY) return minY;
  if (ymd > maxY) return maxY;
  return ymd;
}

function htmlTimeToPg(t: string): string | null {
  const s = t.trim();
  if (!s) return null;
  if (/^\d{2}:\d{2}$/.test(s)) return `${s}:00`;
  return s;
}

function splitVisitHm(raw: string | null | undefined): { h: string; m: string } {
  if (!raw) return { h: "", m: "" };
  const m = /^(\d{1,2}):(\d{2})/.exec(raw.trim());
  if (!m) return { h: "", m: "" };
  return { h: m[1] ?? "", m: m[2] ?? "" };
}

export function PatientProductRequestActions({
  requestId,
  status,
  items,
  initialPatientNote,
  initialPlannedVisitDate,
  initialPlannedVisitTime,
  onReload,
}: Props) {
  const [actionError, setActionError] = useState("");
  const [busyAction, setBusyAction] = useState<"" | "confirm" | "resubmit" | "abandon" | "visit">("");
  const [abandonCode, setAbandonCode] = useState<PatientCancelReasonCode>("no_longer_needed");
  const [abandonDetail, setAbandonDetail] = useState("");

  /** Confirmation responded -> confirmed — reset via parent `key` when server rows change */
  const [sel, setSel] = useState(() => computeSelFromItems(items));

  /** Créneau de passage officine (`''` = défaut automatique borne min) */
  const [visitDate, setVisitDate] = useState(initialPlannedVisitDate ?? "");
  const [visitHour, setVisitHour] = useState(() => splitVisitHm(initialPlannedVisitTime).h);
  const [visitMinute, setVisitMinute] = useState(() => splitVisitHm(initialPlannedVisitTime).m);

  /** Resubmit draft — idem */
  const [noteDraft, setNoteDraft] = useState(() => initialPatientNote ?? "");
  const [lines, setLines] = useState<ResubmitLine[]>(() => computeResubmitLinesFromItems(items));
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<ProductHit[]>([]);
  const [editMode, setEditMode] = useState(false);

  /** Restaure le brouillon resubmit à l'état initial (sortie du mode édition sans renvoi). */
  const resetResubmitDraft = () => {
    setLines(computeResubmitLinesFromItems(items));
    setNoteDraft(initialPatientNote ?? "");
    setQuery("");
    setHits([]);
    setActionError("");
  };

  const debouncedQuery = useMemo(() => query.trim(), [query]);

  const visitWin = useMemo(() => {
    const linesPayload = items.map((row) => {
      const alts = normalizeAlternatives(row.request_item_alternatives);
      let branch: LineBranch = null;
      let capPositive = false;

      if (status === "confirmed") {
        if (!row.is_selected_by_patient) {
          branch = null;
          capPositive = false;
        } else if (row.patient_chosen_alternative_id) {
          branch = row.patient_chosen_alternative_id;
          capPositive = maxQtyForBranch(row, branch, alts) > 0;
        } else {
          branch = "principal";
          capPositive = maxQtyPrincipal(row) > 0;
        }
      } else {
        const st = sel[row.id] ?? { branch: null, qty: 1 };
        branch = st.branch;
        capPositive = st.branch !== null && maxQtyForBranch(row, st.branch, alts) > 0;
      }

      return {
        capPositive,
        branch,
        principalAvail: row.availability_status,
        principalEta: row.expected_availability_date ?? null,
        alternatives: alts.map((a) => ({
          id: a.id,
          availability_status: a.availability_status,
          expected_availability_date: a.expected_availability_date ?? null,
        })),
      };
    });
    return plannedVisitWindow(linesPayload);
  }, [items, sel, status]);

  const resolvedVisitDate = useMemo(() => {
    const t = visitDate.trim();
    if (t === "") return visitWin.minYmd;
    return clampVisitYmd(t, visitWin.minYmd, visitWin.maxYmd);
  }, [visitDate, visitWin.minYmd, visitWin.maxYmd]);

  const visitTimeComposed = useMemo(() => {
    const h = visitHour.trim();
    const m = visitMinute.trim();
    if (h === "" && m === "") return "";
    const hi = Math.min(23, Math.max(0, Number.parseInt(h, 10) || 0));
    const mi = Math.min(59, Math.max(0, Number.parseInt(m, 10) || 0));
    return `${String(hi).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
  }, [visitHour, visitMinute]);

  const visibleHits = debouncedQuery.length < 2 ? [] : hits;
  const resubmitTotal = useMemo(
    () => lines.reduce((sum, l) => sum + (l.price_pph ?? 0) * l.qty, 0),
    [lines]
  );

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      return;
    }
    const t = setTimeout(() => {
      void (async () => {
        const { data, error } = await supabase
          .from("products")
          .select("id,name,product_type,laboratory,photo_url,price_pph")
          .eq("is_active", true)
          .ilike("name", `%${debouncedQuery}%`)
          .order("name")
          .limit(10);
        if (error || !Array.isArray(data)) {
          setHits([]);
          return;
        }
        setHits(data as ProductHit[]);
      })();
    }, 280);
    return () => clearTimeout(t);
  }, [debouncedQuery]);

  const addProduct = (p: ProductHit) => {
    setLines((prev) => {
      if (prev.some((l) => l.product_id === p.id)) return prev;
      return [
        ...prev,
        {
          product_id: p.id,
          name: p.name,
          photo_url: p.photo_url ?? null,
          qty: 1,
          price_pph: p.price_pph ?? null,
          client_comment: "",
          line_source: "patient_request",
          pharmacist_proposal_reason: null,
        },
      ];
    });
    setQuery("");
    setHits([]);
    setActionError("");
  };

  const setLineBranch = (itemId: string, branch: LineBranch) => {
    setSel((s) => {
      const row = items.find((i) => i.id === itemId);
      if (!row) return s;
      const alts = normalizeAlternatives(row.request_item_alternatives);
      const cap = maxQtyForBranch(row, branch, alts);
      const qty = branch !== null && cap > 0 ? cap : 1;
      return {
        ...s,
        [itemId]: {
          branch,
          qty: branch !== null && cap > 0 ? Math.min(Math.max(1, qty), cap) : 1,
        },
      };
    });
  };

  const setLineQty = (itemId: string, qty: number) => {
    const row = items.find((i) => i.id === itemId);
    if (!row) return;
    const alts = normalizeAlternatives(row.request_item_alternatives);
    const branch = sel[itemId]?.branch ?? null;
    const cap = maxQtyForBranch(row, branch, alts);
    if (branch === null || cap < 1) return;
    setSel((s) => ({
      ...s,
      [itemId]: {
        ...(s[itemId] ?? { branch, qty: 1 }),
        qty: Math.min(Math.max(1, qty), cap),
      },
    }));
  };

  const togglePrincipalOnlyLine = (itemId: string, on: boolean) => {
    setSel((s) => {
      const row = items.find((i) => i.id === itemId);
      if (!row) return s;
      const alts = normalizeAlternatives(row.request_item_alternatives);
      const branch: LineBranch = on ? "principal" : null;
      const cap = maxQtyForBranch(row, branch, alts);
      const qty = on && cap > 0 ? cap : 1;
      return {
        ...s,
        [itemId]: {
          branch,
          qty: on && cap > 0 ? Math.min(Math.max(1, s[itemId]?.qty ?? qty), cap) : 1,
        },
      };
    });
  };

  const runConfirm = async () => {
    setActionError("");
    const payload = items.map((row) => {
      const alts = normalizeAlternatives(row.request_item_alternatives);
      const st = sel[row.id] ?? ({ branch: null, qty: 1 } satisfies LineSelState);
      const cap = maxQtyForBranch(row, st.branch, alts);
      const on = st.branch !== null && cap > 0;
      const qty = on ? Math.min(st.qty, cap) : null;
      const chosenAlt =
        on && st.branch !== null && st.branch !== "principal" ? st.branch : null;
      return {
        request_item_id: row.id,
        is_selected: on,
        selected_qty: qty,
        chosen_alternative_id: chosenAlt,
      };
    });
    const anyOn = payload.some((p) => p.is_selected);
    if (!anyOn) {
      setActionError(
        "Garde au moins une ligne sélectionnée, modifie ta liste avant renvoi, ou abandonne la demande."
      );
      return;
    }

    if (visitWin.missingEtaOnToOrder) {
      setActionError(
        "Une ligne « à commander » n’a pas de date de réception côté pharmacie. Contacte l’officine ou modifie ta sélection."
      );
      return;
    }
    const rawVisit = visitDate.trim();
    if (rawVisit !== "" && rawVisit !== resolvedVisitDate) {
      setActionError(
        visitWin.hasToOrder
          ? `Date hors plage autorisée (jusqu’au ${new Date(visitWin.maxYmd + "T12:00:00").toLocaleDateString("fr-FR")} inclus selon les produits à commander).`
          : `Date hors plage : au plus tard le ${new Date(visitWin.maxYmd + "T12:00:00").toLocaleDateString("fr-FR")} (4 jours).`
      );
      return;
    }

    setBusyAction("confirm");
    const { error } = await supabase.rpc("patient_confirm_after_response", {
      p_request_id: requestId,
      p_selections: payload.map((p) => ({
        request_item_id: p.request_item_id,
        is_selected: p.is_selected,
        selected_qty: p.selected_qty,
        chosen_alternative_id: p.chosen_alternative_id,
      })),
      p_planned_visit_date: resolvedVisitDate,
      p_planned_visit_time: htmlTimeToPg(visitTimeComposed),
    });
    setBusyAction("");
    if (error) {
      setActionError(error.message);
      return;
    }
    await onReload();
  };

  const runResubmit = async () => {
    setActionError("");
    if (lines.length === 0) {
      setActionError("Ajoute au moins un produit à la liste.");
      return;
    }

    const seen = new Set<string>();
    for (const l of lines) {
      if (seen.has(l.product_id)) {
        setActionError("Chaque produit ne peut apparaître qu’une seule fois dans ta liste.");
        return;
      }
      seen.add(l.product_id);
      if (l.qty < 1 || l.qty > 10) {
        setActionError("Les quantités doivent être entre 1 et 10 pour chaque produit.");
        return;
      }
    }

    const p_items = lines.map((l) => {
      const cc = l.client_comment.trim().slice(0, 500);
      return {
        product_id: l.product_id,
        requested_qty: l.qty,
        ...(cc.length > 0 ? { client_comment: cc } : {}),
      };
    });
    setBusyAction("resubmit");
    const { error } = await supabase.rpc("patient_resubmit_product_request_after_response", {
      p_request_id: requestId,
      p_patient_note: noteDraft.trim() === "" ? null : noteDraft.trim(),
      p_items,
    });
    setBusyAction("");
    if (error) {
      setActionError(error.message);
      return;
    }
    await onReload();
  };

  const runAbandon = async () => {
    const other = abandonDetail.trim();
    if (abandonCode === "other" && other.length < 8) {
      setActionError("Pour « Autre », précise en au moins 8 caractères.");
      return;
    }

    if (!globalThis.confirm("Annuler cette demande ? Le pharmacien verra cette décision dans l’historique.")) {
      return;
    }
    setActionError("");
    setBusyAction("abandon");
    const { error } = await supabase.rpc("patient_abandon_request", {
      p_request_id: requestId,
      p_reason_code: abandonCode,
      p_reason_other: abandonCode === "other" ? other : null,
    });
    setBusyAction("");
    if (error) {
      setActionError(error.message);
      return;
    }
    await onReload();
  };

  const runUpdateVisit = async () => {
    setActionError("");
    const rawVisit = visitDate.trim();
    if (rawVisit !== "" && rawVisit !== resolvedVisitDate) {
      setActionError(
        visitWin.hasToOrder
          ? `Date hors plage autorisée (jusqu’au ${new Date(visitWin.maxYmd + "T12:00:00").toLocaleDateString("fr-FR")} inclus selon les produits à commander).`
          : `Date hors plage : au plus tard le ${new Date(visitWin.maxYmd + "T12:00:00").toLocaleDateString("fr-FR")} (4 jours).`
      );
      return;
    }
    setBusyAction("visit");
    const { error } = await supabase.rpc("patient_update_planned_visit_after_confirmation", {
      p_request_id: requestId,
      p_planned_visit_date: resolvedVisitDate,
      p_planned_visit_time: htmlTimeToPg(visitTimeComposed),
    });
    setBusyAction("");
    if (error) {
      setActionError(error.message);
      return;
    }
    await onReload();
  };

  const allowed =
    status === "submitted" || status === "in_review" || status === "responded" || status === "confirmed";
  if (!allowed) return null;

  const showConfirm = status === "responded";
  const showResubmit = status === "submitted" || status === "in_review";
  const showAbandonAfterResponse = status === "responded" || status === "confirmed";
  const showConfirmedCards = status === "confirmed";
  /** Date/heure de passage : à la validation (responded) et pour modifier après coup (confirmed). */
  const showVisitFields = showConfirm || status === "confirmed";

  const visitTimeFr = visitTimeComposed ? formatTime24hFr(htmlTimeToPg(visitTimeComposed) ?? visitTimeComposed) : "";

  return (
    <section className={`mt-3 rounded-lg border border-border/90 bg-muted/15 p-2.5 sm:p-3 ${showResubmit ? "pb-20" : ""}`}>
      {actionError ? (
        <p className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-[11px] text-destructive">{actionError}</p>
      ) : null}

      {showConfirm ? (
        <ul className="space-y-4">
              {items.map((row) => {
                const prod = one(row.products);
                const prodUnitPrice = unitPriceLabel(prod?.price_pph);
                const altList = normalizeAlternatives(row.request_item_alternatives);
                const st = sel[row.id] ?? { branch: null, qty: 1 };
                const hasAlts = altList.length > 0;
                const capPrincipal = maxQtyPrincipal(row);
                const radioName = `line-choice-${row.id}`;
                const currentBranch = st.branch;
                const isProposedLine = row.line_source === "pharmacist_proposed";

                return (
                  <li
                    key={row.id}
                    className="rounded-xl border-2 border-slate-200/90 bg-white px-3 py-2.5 shadow-md ring-1 ring-black/[0.04]"
                  >
                    {isProposedLine ? (
                      <div className="mb-2.5 rounded-lg border border-violet-300/70 bg-violet-50 px-2.5 py-2 text-[11px] leading-snug text-violet-950">
                        <p className="font-bold text-violet-950">{requestItemLineSourceFr.pharmacist_proposed}</p>
                        {row.pharmacist_proposal_reason?.trim() ? (
                          <p className="mt-1 text-violet-900/95">
                            <span className="font-semibold">Motif : </span>
                            {row.pharmacist_proposal_reason.trim()}
                          </p>
                        ) : (
                          <p className="mt-1 italic text-violet-800/80">Aucun motif renseigné par la pharmacie.</p>
                        )}
                      </div>
                    ) : null}
                    <p className="text-xs font-semibold text-foreground sm:text-sm">{prod?.name ?? "Produit"}</p>
                    {!hasAlts && prodUnitPrice ? (
                      <p className="text-[10px] font-medium text-teal-800 sm:text-xs">{prodUnitPrice}</p>
                    ) : null}

                    {!hasAlts ? (
                      <>
                        <p className="mt-1 text-xs text-gray-600">
                          {row.availability_status ? availabilityStatusFr[row.availability_status] ?? row.availability_status : "—"}
                          {row.availability_status === "to_order" && row.expected_availability_date
                            ? ` · Disponible le ${formatDateShortFr(row.expected_availability_date)}`
                            : ""}
                        </p>
                        {row.pharmacist_comment ? (
                          <p className="mt-1 text-xs text-muted-foreground">{row.pharmacist_comment}</p>
                        ) : null}
                        <label className="mt-2 flex gap-2 text-sm font-medium text-gray-900">
                          <input
                            type="checkbox"
                            checked={currentBranch === "principal" && capPrincipal > 0}
                            disabled={capPrincipal === 0}
                            onChange={(e) => togglePrincipalOnlyLine(row.id, e.target.checked)}
                          />
                          <span>Je prends ce produit</span>
                        </label>
                        {capPrincipal > 0 ? (
                          <div className="ml-6 mt-2 flex flex-wrap items-center gap-2 text-xs">
                            <span className="text-gray-500">Quantité max. {capPrincipal}</span>
                            <label className="flex items-center gap-1">
                              <span>J’en prends :</span>
                              <input
                                type="number"
                                min={1}
                                max={capPrincipal}
                                disabled={currentBranch !== "principal"}
                                value={currentBranch === "principal" ? st.qty : 0}
                                onChange={(e) => setLineQty(row.id, Number(e.target.value))}
                                className="w-16 rounded border px-1 py-0.5"
                              />
                            </label>
                            {row.unit_price != null ? (
                              <span className="font-semibold text-foreground">
                                Total {Number(st.qty * row.unit_price).toFixed(2)} MAD
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <fieldset className="mt-2 space-y-2 border-0 p-0">
                        <legend className="sr-only">Choix pour {prod?.name ?? "Produit"}</legend>
                        <label className="flex gap-2 text-sm text-foreground">
                          <input type="radio" name={radioName} checked={currentBranch === null} onChange={() => setLineBranch(row.id, null)} />
                          <span>Je ne prends aucune option</span>
                        </label>
                        <label className={`flex flex-col gap-0.5 text-sm ${capPrincipal === 0 ? "text-gray-400" : ""}`}>
                          <span className="flex gap-2">
                            <input
                              type="radio"
                              name={radioName}
                              checked={currentBranch === "principal"}
                              disabled={capPrincipal === 0}
                              onChange={() => setLineBranch(row.id, "principal")}
                            />
                            <span>
                              Produit principal
                              {row.unit_price != null ? (
                                <span className="ml-1 text-xs font-normal text-gray-600">
                                  · Prix pharmacie {Number(row.unit_price).toFixed(2)} MAD
                                </span>
                              ) : null}
                              {row.availability_status ? (
                                <span className="ml-1 text-xs font-normal text-gray-600">
                                  ({availabilityStatusFr[row.availability_status] ?? row.availability_status})
                                </span>
                              ) : null}
                              {row.availability_status === "to_order" && row.expected_availability_date ? (
                                <span className="ml-1 text-xs font-normal text-gray-600">
                                  · Disponible le {formatDateShortFr(row.expected_availability_date)}
                                </span>
                              ) : null}
                            </span>
                          </span>
                        </label>
                        {altList.map((alt) => {
                          const altProd = one(alt.products);
                          const capA = maxQtyAlt(row, alt);
                          const disabled = capA === 0;
                          return (
                            <label key={alt.id} className={`flex flex-col gap-0.5 text-sm ${disabled ? "text-gray-400" : ""}`}>
                              <span className="flex gap-2">
                                <input
                                  type="radio"
                                  name={radioName}
                                  checked={currentBranch === alt.id}
                                  disabled={disabled}
                                  onChange={() => setLineBranch(row.id, alt.id)}
                                />
                                <span>
                                  Alternative : {altProd?.name ?? "Produit"}
                                  {alt.unit_price != null ? (
                                    <span className="ml-1 text-xs font-normal text-gray-600">
                                      · Prix pharmacie {Number(alt.unit_price).toFixed(2)} MAD
                                    </span>
                                  ) : null}
                                  {alt.availability_status ? (
                                    <span className="ml-1 text-xs font-normal text-gray-600">
                                      ({availabilityStatusFr[alt.availability_status] ?? alt.availability_status})
                                    </span>
                                  ) : null}
                                  {alt.availability_status === "to_order" && alt.expected_availability_date ? (
                                    <span className="ml-1 text-xs font-normal text-gray-600">
                                      · Disponible le {formatDateShortFr(alt.expected_availability_date)}
                                    </span>
                                  ) : null}
                                </span>
                              </span>
                              {alt.pharmacist_comment ? (
                                <span className="ml-6 text-xs text-muted-foreground">{alt.pharmacist_comment}</span>
                              ) : null}
                            </label>
                          );
                        })}
                        {currentBranch !== null && maxQtyForBranch(row, currentBranch, altList) > 0 ? (
                          <div className="ml-6 mt-1 flex flex-wrap items-center gap-2 text-xs">
                            <span className="text-gray-500">Quantité max. {maxQtyForBranch(row, currentBranch, altList)}</span>
                            <label className="flex items-center gap-1">
                              <span>J’en prends :</span>
                              <input
                                type="number"
                                min={1}
                                max={maxQtyForBranch(row, currentBranch, altList)}
                                value={st.qty}
                                onChange={(e) => setLineQty(row.id, Number(e.target.value))}
                                className="w-16 rounded border px-1 py-0.5"
                              />
                            </label>
                            {(() => {
                              const branchPrice =
                                currentBranch === "principal"
                                  ? row.unit_price
                                  : altList.find((a) => a.id === currentBranch)?.unit_price ?? null;
                              return branchPrice != null ? (
                                <span className="font-semibold text-foreground">
                                  Total {Number(st.qty * branchPrice).toFixed(2)} MAD
                                </span>
                              ) : null;
                            })()}
                          </div>
                        ) : null}
                      </fieldset>
                    )}
                  </li>
                );
              })}
        </ul>
      ) : null}

      {showConfirmedCards ? (
        (() => {
          const buckets = groupPatientConfirmedLines(items);
          const other = patientConfirmedLinesNotInBuckets(items, buckets);
          return (
            <div className="space-y-6">
              {buckets.atPharmacy.length > 0 ? (
                <section className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-emerald-900">
                    Produits à récupérer en pharmacie
                  </h3>
                  <p className="text-[10px] leading-snug text-muted-foreground">
                    Disponibles ou partiellement disponibles sur la branche que vous avez validée ; la pharmacie indique quand ils sont{" "}
                    <strong>réservés</strong> pour vous.
                  </p>
                  <ul className="space-y-3">
                    {buckets.atPharmacy.map((row) => (
                      <ConfirmedPatientLineRow key={row.id} row={row} />
                    ))}
                  </ul>
                </section>
              ) : null}
              {buckets.toOrder.length > 0 ? (
                <section className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-amber-900">Produits à commander</h3>
                  <p className="text-[10px] leading-snug text-muted-foreground">
                    Fournisseur / grossiste — suivez l&apos;état <strong>commandé</strong> et les dates de réception indiquées par
                    l&apos;officine.
                  </p>
                  <ul className="space-y-3">
                    {buckets.toOrder.map((row) => (
                      <ConfirmedPatientLineRow key={row.id} row={row} />
                    ))}
                  </ul>
                </section>
              ) : null}
              {buckets.unavailableOrShortage.length > 0 ? (
                <section className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-slate-800">Indisponibles ou rupture de marché</h3>
                  <p className="text-[10px] leading-snug text-muted-foreground">
                    Tel que répondu par la pharmacie sur la demande (y compris les lignes non retenues lors de votre validation).
                  </p>
                  <ul className="space-y-3">
                    {buckets.unavailableOrShortage.map((row) => (
                      <ConfirmedPatientLineRow key={row.id} row={row} />
                    ))}
                  </ul>
                </section>
              ) : null}
              {other.length > 0 ? (
                <section className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Autres lignes</h3>
                  <ul className="space-y-3">
                    {other.map((row) => (
                      <ConfirmedPatientLineRow key={row.id} row={row} />
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          );
        })()
      ) : null}

      {showResubmit && editMode ? (
        <div className="mt-2 rounded-2xl border border-primary/20 bg-primary/[0.06] p-3 shadow-sm">
          <label className="block text-sm font-semibold text-foreground">Recherche de produits</label>
          <p className="mt-1 text-xs text-muted-foreground">Commencez à taper le nom du produit (2 caractères minimum).</p>
          <div className="relative mt-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ex: Doliprane, Smecta..."
              className="w-full rounded-xl border border-input bg-background py-2.5 pl-9 pr-3 text-sm shadow-sm placeholder:text-muted-foreground"
            />
          </div>
          {visibleHits.length > 0 ? (
            <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto">
              {visibleHits.map((h) => (
                <li key={h.id}>
                  <button
                    type="button"
                    onClick={() => addProduct(h)}
                    className="flex h-20 w-full items-center gap-3 rounded-xl border border-border/70 bg-muted/20 px-2.5 py-2 text-left transition hover:bg-muted/35"
                  >
                    <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/70 bg-card">
                      {h.photo_url ? (
                        <img src={h.photo_url} alt={h.name} className="h-full w-full object-cover" />
                      ) : (
                        <Package className="size-5 text-muted-foreground" aria-hidden />
                      )}
                    </div>
                    <div className="min-w-0 flex flex-1 flex-col justify-center">
                      <p
                        className="overflow-hidden pr-1 text-[14px] font-semibold leading-tight text-foreground sm:text-[15px]"
                        style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
                      >
                        {h.name}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-primary sm:text-sm">
                        {unitPriceLabel(h.price_pph) ?? "Prix indisponible"}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : query.trim().length >= 2 ? (
            <p className="mt-2 text-xs text-muted-foreground">Aucun résultat.</p>
          ) : null}
        </div>
      ) : null}

      {showResubmit ? (
        <div className="mt-2">
          <ul className="space-y-3">
            {lines.map((l, idx) => (
              <li key={`${l.product_id}-${idx}`} className="rounded-xl border border-border/70 bg-muted/20 p-2">
                <div className="flex min-h-[96px] items-stretch gap-2.5">
                  <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-border/70 bg-card">
                    {editMode ? (
                      <button
                        type="button"
                        aria-label="Retirer"
                        className="absolute right-1 top-1 z-10 rounded-md bg-background/90 p-1 text-destructive shadow-sm hover:bg-destructive/10"
                        onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        <Trash2 size={15} />
                      </button>
                    ) : null}
                    {l.photo_url ? (
                      <img src={l.photo_url} alt={l.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Package className="size-7 text-muted-foreground" aria-hidden />
                      </div>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <p
                      className="overflow-hidden pr-1 text-[13px] font-semibold leading-tight text-foreground sm:text-[15px]"
                      style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
                    >
                      {l.name}
                    </p>
                    <p className="mt-0.5 text-xs font-medium text-primary">
                      {unitPriceLabel(l.price_pph) ?? "Prix unitaire indisponible"}
                    </p>
                    {l.line_source === "pharmacist_proposed" ? (
                      <p className="mt-1 text-[10px] font-medium text-violet-900">
                        {requestItemLineSourceFr.pharmacist_proposed}
                        {l.pharmacist_proposal_reason ? ` — ${l.pharmacist_proposal_reason}` : ""}
                      </p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        aria-label="Diminuer"
                        disabled={!editMode || l.qty <= 1}
                        className="rounded-lg border border-border bg-card p-1.5 text-foreground hover:bg-muted/60 disabled:opacity-40"
                        onClick={() =>
                          setLines((prev) => prev.map((row, i) => (i === idx ? { ...row, qty: Math.max(1, row.qty - 1) } : row)))
                        }
                      >
                        <Minus size={16} />
                      </button>
                      <span className="w-8 text-center text-sm font-semibold tabular-nums">{l.qty}</span>
                      <button
                        type="button"
                        aria-label="Augmenter"
                        disabled={!editMode || l.qty >= 10}
                        className="rounded-lg border border-border bg-card p-1.5 text-foreground hover:bg-muted/60 disabled:opacity-40"
                        onClick={() =>
                          setLines((prev) => prev.map((row, i) => (i === idx ? { ...row, qty: Math.min(10, row.qty + 1) } : row)))
                        }
                      >
                        <Plus size={16} />
                      </button>
                      <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        Total{" "}
                        <span className="inline-block rounded bg-background px-1.5 py-0.5 font-semibold text-foreground">
                          {l.price_pph != null ? `${(l.price_pph * l.qty).toFixed(2)} MAD` : "-"}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
                <label className="mt-2 block">
                  <input
                    type="text"
                    disabled={!editMode}
                    value={l.client_comment}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((row, i) => (i === idx ? { ...row, client_comment: e.target.value.slice(0, 500) } : row))
                      )
                    }
                    placeholder="Commentaire sur ce produit (optionnel)"
                    className="w-full touch-pan-x rounded-lg border border-primary/45 bg-primary/[0.06] px-3 py-2 text-sm placeholder:text-muted-foreground disabled:opacity-70"
                  />
                </label>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-3 space-y-2 rounded-md border border-border/70 bg-card p-2 sm:p-2.5">
        {showVisitFields ? (
          <div className="rounded-md border border-primary/20 bg-primary/5 p-2">
            <label className="block text-[11px] font-medium text-foreground">
              Date de passage {showConfirm ? <span className="text-destructive">*</span> : null}
              <input
                type="date"
                min={visitWin.minYmd}
                max={visitWin.maxYmd}
                value={resolvedVisitDate}
                onChange={(e) => setVisitDate(e.target.value)}
                className="mt-0.5 block w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                required={showConfirm}
              />
            </label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="block text-[11px] font-medium text-foreground">
                Heure (optionnel · 0–23)
                <input
                  type="number"
                  min={0}
                  max={23}
                  inputMode="numeric"
                  placeholder="—"
                  value={visitHour}
                  onChange={(e) => setVisitHour(e.target.value.replace(/\D/g, "").slice(0, 2))}
                  className="mt-0.5 block w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs tabular-nums"
                />
              </label>
              <label className="block text-[11px] font-medium text-foreground">
                Minutes (optionnel · 0–59)
                <input
                  type="number"
                  min={0}
                  max={59}
                  inputMode="numeric"
                  placeholder="—"
                  value={visitMinute}
                  onChange={(e) => setVisitMinute(e.target.value.replace(/\D/g, "").slice(0, 2))}
                  className="mt-0.5 block w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs tabular-nums"
                />
              </label>
            </div>
            {visitTimeFr ? (
              <span className="mt-1 block text-[10px] text-muted-foreground">Heure enregistrée : {visitTimeFr}</span>
            ) : null}
            {status === "confirmed" ? (
              <p className="mt-2 text-[10px] leading-snug text-primary/90">
                Vous pouvez changer la date ou l&apos;heure prévues ; la pharmacie les verra sur la demande.
              </p>
            ) : null}
          </div>
        ) : null}

        {showResubmit ? (
          <>
            <div className="rounded-md border border-border/70 bg-background p-2.5">
              <label className="block text-xs font-medium text-gray-700">
                Message pour la pharmacie (optionnel)
                <textarea
                  value={noteDraft}
                  disabled={!editMode}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  rows={2}
                  placeholder="Précisions, créneau de retrait..."
                  className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs disabled:bg-muted"
                />
              </label>
            </div>

            <div className="rounded-md border border-amber-200/70 bg-amber-50/40 p-2.5 space-y-2">
              <button
                type="button"
                onClick={() => {
                  if (editMode) {
                    resetResubmitDraft();
                    setEditMode(false);
                  } else {
                    setEditMode(true);
                  }
                }}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 text-xs font-semibold text-amber-900"
              >
                <Pencil size={15} />
                {editMode ? "Annuler les modifications" : "Modifier"}
              </button>

              {editMode ? (
                <button
                  type="button"
                  disabled={busyAction !== "" || lines.length === 0}
                  onClick={() => void runResubmit()}
                  className="w-full rounded-lg border border-amber-600 bg-amber-50 py-2.5 text-sm font-semibold text-amber-950 disabled:opacity-50"
                >
                  {busyAction === "resubmit" ? "Envoi…" : "Mettre à jour et renvoyer"}
                </button>
              ) : null}
            </div>
          </>
        ) : null}

        {showConfirm ? (
          <button
            type="button"
            disabled={busyAction !== "" || visitWin.missingEtaOnToOrder}
            onClick={() => void runConfirm()}
            className="w-full rounded-md bg-primary py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50 sm:text-sm"
          >
            {busyAction === "confirm" ? "Confirmation…" : "Valider ma sélection"}
          </button>
        ) : null}

        {status === "confirmed" ? (
          <button
            type="button"
            disabled={busyAction !== ""}
            onClick={() => void runUpdateVisit()}
            className="w-full rounded-md border border-primary/30 bg-primary/10 py-2 text-xs font-semibold text-primary disabled:opacity-50 sm:text-sm"
          >
            {busyAction === "visit" ? "Mise à jour…" : "Mettre à jour ma date de passage"}
          </button>
        ) : null}

        {showAbandonAfterResponse ? (
          <>
            <label className="block text-xs font-medium text-gray-700">
              Motif d’annulation
              <select
                value={abandonCode}
                onChange={(e) => setAbandonCode(e.target.value as PatientCancelReasonCode)}
                className="mt-1 block w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900"
              >
                {PATIENT_CANCEL_REASON_CODES.map((c) => (
                  <option key={c} value={c}>
                    {PATIENT_CANCEL_REASON_LABELS[c]}
                  </option>
                ))}
              </select>
            </label>
            {abandonCode === "other" ? (
              <textarea
                value={abandonDetail}
                rows={2}
                onChange={(e) => setAbandonDetail(e.target.value)}
                placeholder="Précisez votre motif"
                className="w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900"
              />
            ) : null}
            <button
              type="button"
              disabled={busyAction !== "" || (abandonCode === "other" && abandonDetail.trim().length < 8)}
              onClick={() => void runAbandon()}
              className="w-full rounded-lg border border-red-400 bg-white py-2 text-sm font-semibold text-red-950 disabled:opacity-50"
            >
              {busyAction === "abandon" ? "Annulation…" : "Annuler la demande"}
            </button>
          </>
        ) : null}
      </div>
      {showResubmit ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
          <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{lines.length}</span>{" "}
              {lines.length > 1 ? "produits" : "produit"} ajoutés
            </p>
            <p className="text-xs text-muted-foreground">
              Total indicatif <span className="font-semibold text-foreground">{resubmitTotal.toFixed(2)} MAD</span>
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
