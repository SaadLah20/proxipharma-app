"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { useParams, useRouter } from "next/navigation";
import { PageShell } from "@/components/ui/compact-shell";
import {
  formatDateShortCasablancaWithTime24hFr,
  formatDateShortFr,
  formatDateTimeShort24hFr,
  formatPlannedVisitFr,
} from "@/lib/datetime-fr";
import { supabase } from "@/lib/supabase";
import {
  availabilityStatusFr,
  counterOutcomePatientLabel,
  historyActorLabel,
  requestItemLineSourceFr,
  requestStatusFr,
} from "@/lib/request-display";
import { displayRequestPublicRef } from "@/lib/public-ref";
import { one } from "@/lib/embed";
import { REQUEST_DETAIL_REFRESH_EVENT, type RequestDetailRefreshDetail } from "@/lib/request-detail-refresh-bus";
import { PatientCancelBeforeResponse } from "./PatientCancelBeforeResponse";
import {
  PatientProductRequestActions,
  type PatientPharmacyContactInfo,
} from "./PatientProductRequestActions";
import { unitPriceLabel } from "@/lib/product-price";

type PharmacyEmbed = {
  nom: string;
  ville: string;
  adresse: string;
  telephone: string | null;
  public_ref?: string | null;
  contact_email?: string | null;
};
type ProductRequestEmbed = { patient_note: string | null };

type ProdEmbed = { name: string; price_pph?: number | null; photo_url?: string | null };

type AltEmbed = {
  id: string;
  rank: number;
  availability_status: string | null;
  available_qty: number | null;
  unit_price: number | null;
  pharmacist_comment: string | null;
  expected_availability_date: string | null;
  products: ProdEmbed | ProdEmbed[] | null;
};

function normalizeAlternatives(raw: AltEmbed | AltEmbed[] | null | undefined): AltEmbed[] {
  if (!raw) return [];
  return Array.isArray(raw) ? [...raw].sort((a, b) => a.rank - b.rank) : [raw];
}

type RequestDetail = {
  id: string;
  created_at: string;
  updated_at: string;
  status: string;
  request_type: string;
  pharmacy_id: string;
  submitted_at: string | null;
  responded_at: string | null;
  confirmed_at: string | null;
  patient_planned_visit_date: string | null;
  patient_planned_visit_time: string | null;
  request_public_ref?: string | null;
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
  client_comment: string | null;
  line_source: string | null;
  pharmacist_proposal_reason: string | null;
  counter_outcome: string;
  counter_cancel_reason: string | null;
  counter_cancel_detail: string | null;
  expected_availability_date: string | null;
  patient_chosen_alternative_id?: string | null;
  post_confirm_fulfillment?: string | null;
  withdrawn_after_confirm?: boolean | null;
  products: ProdEmbed | ProdEmbed[] | null;
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
  const [historyBusy, setHistoryBusy] = useState(false);
  const [historyRows, setHistoryRows] = useState<
    { id: string; created_at: string; old_status: string | null; new_status: string; reason: string | null }[]
  >([]);
  const [followUpBusy, setFollowUpBusy] = useState(false);
  const [followUpErr, setFollowUpErr] = useState("");
  const [supplyAmendments, setSupplyAmendments] = useState<{ id: string; created_at: string; amendments: unknown }[]>([]);
  const [pharmacistGlobalComment, setPharmacistGlobalComment] = useState("");

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
          "id,created_at,updated_at,status,request_type,pharmacy_id,submitted_at,responded_at,confirmed_at,patient_planned_visit_date,patient_planned_visit_time,request_public_ref,pharmacies(nom,ville,adresse,telephone,public_ref,contact_email),product_requests(patient_note)"
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

      const [itemsResult, amendmentsResult, phGlobalRes] = await Promise.all([
        supabase
          .from("request_items")
          .select(
            "id,product_id,requested_qty,selected_qty,is_selected_by_patient,availability_status,available_qty,unit_price,pharmacist_comment,client_comment,line_source,pharmacist_proposal_reason,expected_availability_date,counter_outcome,counter_cancel_reason,counter_cancel_detail,patient_chosen_alternative_id,post_confirm_fulfillment,withdrawn_after_confirm,products(name,price_pph,photo_url),request_item_alternatives!request_item_alternatives_request_item_id_fkey(id,rank,availability_status,available_qty,unit_price,pharmacist_comment,expected_availability_date,products(name,price_pph,photo_url))"
          )
          .eq("request_id", id)
          .order("created_at", { ascending: true }),
        supabase
          .from("request_supply_amendments")
          .select("id,created_at,amendments")
          .eq("request_id", id)
          .order("created_at", { ascending: false })
          .limit(40),
        supabase
          .from("request_comments")
          .select("comment_text")
          .eq("request_id", id)
          .eq("author_role", "pharmacien")
          .eq("is_internal", false)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      setPharmacistGlobalComment(((phGlobalRes.data?.comment_text ?? "") as string).trim());

      const itemsErr = itemsResult.error;
      const itemsData = itemsResult.data;
      if (itemsErr) {
        setError(itemsErr.message);
      } else if (Array.isArray(itemsData)) {
        setItems(itemsData as RequestItemRow[]);
      }
      if (!amendmentsResult.error && Array.isArray(amendmentsResult.data)) {
        setSupplyAmendments(amendmentsResult.data as { id: string; created_at: string; amendments: unknown }[]);
      } else {
        setSupplyAmendments([]);
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

  useEffect(() => {
    const listener = (ev: Event) => {
      const detail = (ev as CustomEvent<RequestDetailRefreshDetail>).detail;
      if (detail?.requestId !== id) return;
      void loadDetail(true);
    };
    window.addEventListener(REQUEST_DETAIL_REFRESH_EVENT, listener);
    return () => window.removeEventListener(REQUEST_DETAIL_REFRESH_EVENT, listener);
  }, [id, loadDetail]);

  const loadHistory = useCallback(async () => {
    if (!id) return;
    setHistoryBusy(true);
    const { data, error: histErr } = await supabase
      .from("request_status_history")
      .select("id,created_at,old_status,new_status,reason")
      .eq("request_id", id)
      .order("created_at", { ascending: false })
      .limit(30);
    if (!histErr && Array.isArray(data)) {
      setHistoryRows(data as typeof historyRows);
    }
    setHistoryBusy(false);
  }, [id]);

  if (loading) {
    return (
      <PageShell>
        <p className="text-muted-foreground">Chargement…</p>
      </PageShell>
    );
  }

  if (error || !request) {
    return (
      <PageShell>
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">{error || "Erreur."}</p>
        <Link href="/dashboard/demandes" className="mt-3 inline-block text-xs font-medium text-sky-800 underline">
          Mes demandes de produits
        </Link>
      </PageShell>
    );
  }

  const productReq = one(request.product_requests);
  const note = productReq?.patient_note ?? null;
  const hasBottomActions =
    request.request_type === "product_request" &&
    (request.status === "submitted" ||
      request.status === "in_review" ||
      request.status === "responded" ||
      request.status === "confirmed" ||
      request.status === "processing" ||
      request.status === "treated");
  const showPlannedVisitBlock =
    request.status === "confirmed" ||
    request.status === "processing" ||
    request.status === "treated" ||
    request.status === "completed" ||
    request.status === "partially_collected" ||
    request.status === "fully_collected";

  return (
    <PageShell className="space-y-3">
      <Link href="/dashboard/demandes" className="inline-block text-xs font-medium text-sky-800 underline">
        ← Retour aux demandes de produits
      </Link>

      <header className="mt-2 rounded-xl border border-sky-200/85 bg-gradient-to-r from-sky-50/40 via-white to-white px-2.5 py-2 shadow-sm sm:px-3">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] sm:gap-x-3">
            <span className="shrink-0 font-bold uppercase tracking-wide text-sky-950/85">Demande prod.</span>
            <span className="font-mono text-[11px] font-semibold text-foreground">
              {displayRequestPublicRef(request)}
            </span>
            <span className="hidden h-3.5 w-px shrink-0 bg-border/80 sm:block" aria-hidden />
            <span className="text-muted-foreground">
              Envoyée{" "}
              <span className="font-semibold tabular-nums text-foreground">
                {formatDateShortCasablancaWithTime24hFr(request.submitted_at ?? request.created_at)}
              </span>
            </span>
          </div>
          <div className="flex w-full shrink-0 items-center justify-end gap-2 border-t border-sky-100/90 pt-2 sm:w-auto sm:border-0 sm:pt-0">
            <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Statut</span>
            <span
              className={clsx(
                "inline-flex max-w-[min(100%,16rem)] justify-center truncate rounded-full border px-2.5 py-1 text-center text-[11px] font-bold leading-tight shadow-sm sm:max-w-[14rem]",
                ["submitted", "in_review"].includes(request.status)
                  ? "border-sky-400/85 bg-sky-100 text-sky-950 ring-1 ring-sky-200/80"
                  : request.status === "responded"
                    ? "border-amber-300/95 bg-amber-50 text-amber-950"
                    : ["confirmed", "processing", "treated", "completed", "in_progress_virtual"].includes(request.status)
                      ? "border-teal-400/80 bg-teal-50 text-teal-950"
                      : "border-primary/35 bg-primary/10 text-primary"
              )}
              title={(requestStatusFr[request.status] ?? request.status) + ""}
            >
              {requestStatusFr[request.status] ?? request.status}
            </span>
          </div>
        </div>
        {showPlannedVisitBlock ? (
          <p className="mt-2 border-t border-sky-100 pt-2 text-[10px] text-muted-foreground sm:text-[11px]">
            Passage prévu :{" "}
            <span className="font-medium text-foreground">
              {request.patient_planned_visit_date
                ? formatPlannedVisitFr(request.patient_planned_visit_date, request.patient_planned_visit_time)
                : "À définir"}
            </span>
          </p>
        ) : null}
      </header>

      {request.request_type === "product_request" && request.status === "expired" ? (
        <section className="rounded-xl border border-amber-200/80 bg-amber-50/50 p-3 shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-wide text-amber-950">Demande expirée</h2>
          <p className="mt-1 text-[11px] leading-snug text-amber-950/90">
            Vous n&apos;avez pas validé la réponse de la pharmacie dans les 24 h. Vous pouvez créer une nouvelle demande avec les
            mêmes produits que vous aviez demandés au départ, les ajuster si besoin, puis les renvoyer à la pharmacie.
          </p>
          {followUpErr ? (
            <p className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-[11px] text-destructive">
              {followUpErr}
            </p>
          ) : null}
          <button
            type="button"
            disabled={followUpBusy}
            onClick={() => {
              void (async () => {
                setFollowUpErr("");
                setFollowUpBusy(true);
                const { data, error: rpcErr } = await supabase.rpc("patient_create_followup_from_expired_product_request", {
                  p_expired_request_id: request.id,
                });
                setFollowUpBusy(false);
                if (rpcErr) {
                  setFollowUpErr(rpcErr.message);
                  return;
                }
                const newId = typeof data === "string" ? data : Array.isArray(data) ? data[0] : null;
                if (!newId || typeof newId !== "string") {
                  setFollowUpErr("Réponse inattendue du serveur.");
                  return;
                }
                router.push(`/dashboard/demandes/${newId}`);
              })();
            }}
            className="mt-3 w-full rounded-lg bg-amber-700 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-800 disabled:opacity-50"
          >
            {followUpBusy ? "Création…" : "Ajuster et renvoyer une nouvelle demande"}
          </button>
        </section>
      ) : null}

      {items.length > 0 && !hasBottomActions ? (
        <section className="space-y-2">
            <ul className="space-y-2.5">
              {items.map((row) => {
                const prod = one(row.products);
                const altList = normalizeAlternatives(row.request_item_alternatives);
                const linePph = unitPriceLabel(prod?.price_pph);
                const postConfirmPatientView = [
                  "confirmed",
                  "processing",
                  "treated",
                  "completed",
                  "partially_collected",
                  "fully_collected",
                ].includes(request.status);
                const chosenAltForValidated = altList.find((a) => a.id === row.patient_chosen_alternative_id);
                const validatedProductName = chosenAltForValidated
                  ? one(chosenAltForValidated.products)?.name ?? "Alternative"
                  : prod?.name ?? "Produit";
                const validatedQtyBaseline = row.selected_qty ?? row.requested_qty;
                return (
                  <li key={row.id} className="rounded-xl border-2 border-slate-100 bg-white p-2.5 text-[11px] leading-snug shadow-sm sm:text-xs">
                    <div className="flex flex-wrap items-start justify-between gap-1">
                      <p className="font-semibold text-foreground">{prod?.name ?? "Produit"}</p>
                      {linePph ? <span className="shrink-0 text-[10px] font-medium text-teal-800">{linePph}</span> : null}
                    </div>
                    {row.line_source === "pharmacist_proposed" &&
                    !(postConfirmPatientView && row.is_selected_by_patient) ? (
                      <p className="mt-1 rounded bg-violet-100/80 px-1.5 py-0.5 text-[10px] font-semibold text-violet-950">
                        {requestItemLineSourceFr.pharmacist_proposed}
                        {row.pharmacist_proposal_reason ? ` — ${row.pharmacist_proposal_reason}` : ""}
                      </p>
                    ) : null}
                    {row.client_comment ? (
                      <p className="mt-1 text-[10px] text-sky-950/90">
                        <span className="font-medium">Ta note :</span> {row.client_comment}
                      </p>
                    ) : null}
                    <p className="mt-0.5 text-muted-foreground">
                      {row.line_source === "pharmacist_proposed" ? (
                        <>
                          Quantité proposée{" "}
                          <strong className="tabular-nums text-foreground">{row.requested_qty}</strong>
                        </>
                      ) : (
                        <>
                          Demandé <strong className="text-foreground">{row.requested_qty}</strong>
                        </>
                      )}
                      {row.selected_qty != null ? (
                        <>
                          {" "}
                          · sélect. <strong className="text-foreground">{row.selected_qty}</strong>
                          {!row.is_selected_by_patient ? <span className="text-muted-foreground"> (décoché)</span> : null}
                        </>
                      ) : null}
                    </p>
                    {postConfirmPatientView && !row.is_selected_by_patient ? (
                      <p className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] leading-snug text-slate-700">
                        Vous n&apos;avez pas retenu cette ligne lors de votre validation. Aucun suivi pharmacie pour ce produit.
                      </p>
                    ) : null}
                    {postConfirmPatientView && row.is_selected_by_patient ? (
                      (() => {
                        const counterTouched = (row.counter_outcome ?? "unset") !== "unset";
                        const validatedDispo = chosenAltForValidated?.availability_status ?? row.availability_status;
                        const validatedPrice = chosenAltForValidated?.unit_price ?? row.unit_price;
                        const validatedEta =
                          chosenAltForValidated?.expected_availability_date ?? row.expected_availability_date;
                        const isPharmaProposed = row.line_source === "pharmacist_proposed";
                        return (
                          <>
                            {isPharmaProposed ? (
                              <div className="mt-2 rounded-lg border border-violet-300/80 bg-violet-50 px-2 py-2 text-[11px] leading-snug text-violet-950">
                                <p className="font-bold text-violet-950">Produit proposé par la pharmacie</p>
                                {row.pharmacist_proposal_reason?.trim() ? (
                                  <p className="mt-1">
                                    <span className="font-semibold">Motif : </span>
                                    {row.pharmacist_proposal_reason.trim()}
                                  </p>
                                ) : null}
                                <p className="mt-1 text-[10px] text-violet-900/90">
                                  Ajouté par l&apos;officine ; vous l&apos;avez accepté lors de votre validation.
                                </p>
                              </div>
                            ) : null}
                            <div className="mt-2 rounded-lg border border-emerald-300/70 bg-emerald-50 px-2 py-1.5">
                              <p className="text-[9px] font-bold uppercase tracking-wide text-emerald-900">
                                {isPharmaProposed ? "Ce que vous avez accepté (ajout pharmacie)" : "Ce que vous avez validé"}
                              </p>
                              <p className="mt-0.5 text-xs font-semibold leading-snug text-emerald-950">
                                {validatedProductName}
                              </p>
                              <p className="mt-0.5 text-[11px] leading-snug text-emerald-900/90">
                                Qté validée · <strong className="tabular-nums">{validatedQtyBaseline}</strong>
                                {validatedDispo ? (
                                  <>
                                    {" "}
                                    · Dispo · <strong>{availabilityStatusFr[validatedDispo] ?? validatedDispo}</strong>
                                  </>
                                ) : null}
                                {validatedPrice != null ? (
                                  <>
                                    {" "}
                                    · Prix ·{" "}
                                    <strong className="tabular-nums">{Number(validatedPrice).toFixed(2)} MAD</strong>
                                  </>
                                ) : null}{" "}
                                · État · <strong>Pas encore récupéré</strong>
                              </p>
                              {chosenAltForValidated ? (
                                <p className="mt-1 text-[10px] text-emerald-900/80">
                                  Alternative retenue par rapport au produit initialement demandé.
                                </p>
                              ) : altList.length > 0 ? (
                                <p className="mt-1 text-[10px] text-emerald-900/80">Produit principal retenu.</p>
                              ) : null}
                            </div>
                            <div className="mt-2 rounded-lg border border-slate-300/80 bg-slate-50 px-2 py-1.5">
                              <p className="text-[9px] font-bold uppercase tracking-wide text-slate-700">Suivi officine</p>
                              {!counterTouched ? (
                                <p className="mt-0.5 text-[11px] leading-snug text-slate-700">
                                  <strong className="text-slate-900">En cours</strong> · la pharmacie n&apos;a pas encore indiqué si le
                                  produit est prêt ou remis. Le détail apparaît dès la première mise à jour.
                                </p>
                              ) : (
                                <>
                                  <p className="mt-0.5 text-xs font-semibold leading-snug text-slate-950">
                                    {validatedProductName}
                                  </p>
                                  <p className="mt-0.5 text-[11px] leading-snug text-slate-800">
                                    Qté suivie ·{" "}
                                    <strong className="tabular-nums">{row.available_qty ?? "—"}</strong>
                                    {row.availability_status ? (
                                      <>
                                        {" "}
                                        · Dispo ·{" "}
                                        <strong>
                                          {availabilityStatusFr[row.availability_status] ?? row.availability_status}
                                        </strong>
                                      </>
                                    ) : null}
                                    {validatedPrice != null ? (
                                      <>
                                        {" "}
                                        · Prix ·{" "}
                                        <strong className="tabular-nums">{Number(validatedPrice).toFixed(2)} MAD</strong>
                                      </>
                                    ) : null}
                                    {row.availability_status === "to_order" && validatedEta ? (
                                      <> · Disponible le {formatDateShortFr(validatedEta)}</>
                                    ) : null}
                                  </p>
                                  <div className="mt-1.5 text-[11px]">
                                    <span className="font-medium text-foreground">
                                      {counterOutcomePatientLabel(row.counter_outcome, row.counter_cancel_reason)}
                                    </span>
                                    {row.counter_cancel_detail ? (
                                      <span className="ml-1 text-[10px] text-muted-foreground">
                                        — {row.counter_cancel_detail}
                                      </span>
                                    ) : null}
                                  </div>
                                  {row.available_qty != null &&
                                  Number(row.available_qty) !== Number(validatedQtyBaseline) ? (
                                    <p className="mt-1 text-[10px] leading-snug text-amber-900">
                                      Peut différer de votre validation sans nouvelle validation de votre part. Consultez
                                      l&apos;historique du dossier pour le détail des changements.
                                    </p>
                                  ) : null}
                                </>
                              )}
                            </div>
                          </>
                        );
                      })()
                    ) : row.availability_status ? (
                      <p className="mt-1 text-primary">
                        <span className="font-medium">{availabilityStatusFr[row.availability_status] ?? row.availability_status}</span>
                        {row.unit_price != null ? ` · ${Number(row.unit_price).toFixed(2)} MAD` : ""}
                      </p>
                    ) : (
                      <p className="mt-1 text-muted-foreground">En attente réponse pharmacien</p>
                    )}
                    {row.pharmacist_comment ? (
                      <p className="mt-1 rounded border border-border/50 bg-background/80 px-1.5 py-0.5 text-[11px]">{row.pharmacist_comment}</p>
                    ) : null}
                    {altList.length > 0 ? (
                      <div className="mt-1.5 rounded border border-dashed border-amber-300/60 bg-amber-50/50 px-1.5 py-1">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-amber-900/90">Alternatives</p>
                        <ul className="mt-1 space-y-1">
                          {altList.map((alt) => {
                            const altProd = one(alt.products);
                            const altPph = unitPriceLabel(altProd?.price_pph);
                            return (
                              <li key={alt.id} className="rounded bg-card/90 px-1.5 py-1 text-[10px] sm:text-[11px]">
                                <span className="font-medium">{altProd?.name ?? "Alt."}</span>
                                {altPph ? <span className="ml-1 text-teal-800">{altPph}</span> : null}
                                {alt.availability_status ? (
                                  <span className="ml-1 text-primary">
                                    {availabilityStatusFr[alt.availability_status] ?? alt.availability_status}
                                    {alt.unit_price != null ? ` · ${Number(alt.unit_price).toFixed(2)} MAD` : ""}
                                  </span>
                                ) : null}
                                {alt.pharmacist_comment ? <span className="mt-0.5 block text-muted-foreground">{alt.pharmacist_comment}</span> : null}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ) : null}
                    {!postConfirmPatientView && row.counter_outcome !== "unset" ? (
                      <p className="mt-1 text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {counterOutcomePatientLabel(row.counter_outcome, row.counter_cancel_reason)}
                        </span>
                        {row.counter_cancel_detail ? (
                          <span className="ml-1 text-[10px] text-muted-foreground">— {row.counter_cancel_detail}</span>
                        ) : null}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
        </section>
      ) : request.request_type === "product_request" && !hasBottomActions ? (
        <p className="text-center text-xs text-muted-foreground">Aucune ligne pour cette demande.</p>
      ) : null}

      {hasBottomActions ? (
        <section className="pb-3">
        <PatientProductRequestActions
          key={
            [
              request.status,
              note ?? "",
              request.patient_planned_visit_date ?? "",
              request.patient_planned_visit_time ?? "",
              one(request.pharmacies)?.telephone ?? "",
              one(request.pharmacies)?.contact_email ?? "",
              ...items.map((i) =>
                [
                  i.id,
                  i.selected_qty,
                  i.is_selected_by_patient,
                  i.available_qty,
                  i.requested_qty,
                  i.counter_outcome,
                  i.post_confirm_fulfillment ?? "",
                  i.withdrawn_after_confirm ? "1" : "0",
                  i.client_comment ?? "",
                  i.line_source ?? "",
                ].join(":")
              ),
              supplyAmendments.map((a) => a.id).join(","),
              pharmacistGlobalComment,
            ].join("|")
          }
          requestId={request.id}
          status={request.status}
          items={items}
          supplyAmendmentBundles={supplyAmendments}
          initialPatientNote={note}
          initialPlannedVisitDate={request.patient_planned_visit_date}
          initialPlannedVisitTime={request.patient_planned_visit_time}
          requestPublicRef={displayRequestPublicRef(request)}
          pharmacyContact={(() => {
            const ph = one(request.pharmacies);
            if (!ph?.nom?.trim()) return null;
            const c: PatientPharmacyContactInfo = {
              nom: ph.nom,
              ville: ph.ville,
              telephone: ph.telephone,
              contact_email: ph.contact_email ?? null,
            };
            return c;
          })()}
          onReload={async () => {
            await loadDetail(true);
          }}
          pharmacistGlobalComment={pharmacistGlobalComment}
        />
        </section>
      ) : null}

      {request.request_type === "product_request" && (request.status === "submitted" || request.status === "in_review") ? (
        <PatientCancelBeforeResponse
          requestId={request.id}
          onDone={async () => {
            await loadDetail(true);
          }}
        />
      ) : null}

      <section className="rounded-xl border border-border/70 bg-card p-2.5 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Historique</h2>
          <button
            type="button"
            onClick={() => void loadHistory()}
            className="inline-flex h-8 items-center justify-center rounded-md border border-border px-2.5 text-[11px] font-semibold text-foreground hover:bg-muted/40"
          >
            Rafraîchir
          </button>
        </div>
        <div className="mt-2 space-y-1.5">
          {historyBusy ? (
            <p className="text-xs text-muted-foreground">Chargement…</p>
          ) : historyRows.length === 0 ? (
            <p className="text-xs text-muted-foreground">Aucun événement disponible.</p>
          ) : (
            <ul className="space-y-1.5">
              {historyRows.map((h) => (
                <li key={h.id} className="rounded-lg border border-border/60 bg-muted/20 px-2 py-1.5 text-xs">
                  <p className="font-medium text-foreground">
                    {h.old_status ? `${requestStatusFr[h.old_status] ?? h.old_status} → ` : ""}
                    {requestStatusFr[h.new_status] ?? h.new_status}
                  </p>
                  {h.reason ? <p className="mt-0.5 text-[11px] text-muted-foreground">{h.reason}</p> : null}
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
                    <span>
                      Par <strong className="font-medium text-foreground">{historyActorLabel("patient", h.reason)}</strong>
                    </span>
                    <span aria-hidden>·</span>
                    <time dateTime={h.created_at} className="tabular-nums">
                      {formatDateTimeShort24hFr(h.created_at)}
                    </time>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </PageShell>
  );
}
