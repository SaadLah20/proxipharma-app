"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { PageShell } from "@/components/ui/compact-shell";
import { formatPlannedVisitFr } from "@/lib/datetime-fr";
import { supabase } from "@/lib/supabase";
import {
  availabilityStatusFr,
  counterOutcomeFr,
  requestItemLineSourceFr,
  requestStatusFr,
} from "@/lib/request-display";
import { displayRequestPublicRef } from "@/lib/public-ref";
import { one } from "@/lib/embed";
import { PatientCancelBeforeResponse } from "./PatientCancelBeforeResponse";
import { PatientProductRequestActions } from "./PatientProductRequestActions";
import { unitPriceLabel } from "@/lib/product-price";
import { formatDh } from "@/lib/currency-ma";
import { summarizeRequestForPatientCard, type PatientRequestItemRow } from "@/lib/patient-request-list-summary";
import {
  patientHistoryAuditDetailLines,
  patientHistoryAuditTitle,
  tryParsePatientHistoryAudit,
} from "@/lib/patient-request-history-audit";

type PharmacyEmbed = {
  nom: string;
  ville: string;
  adresse: string;
  telephone: string | null;
  public_ref?: string | null;
};
type ProductRequestEmbed = { patient_note: string | null };

type ProdEmbed = { name: string; price_pph?: number | null };

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
  expected_availability_date: string | null;
  patient_chosen_alternative_id?: string | null;
  products: ProdEmbed | ProdEmbed[] | null;
  request_item_alternatives: AltEmbed | AltEmbed[] | null;
};

type StatusHistoryRow = {
  id: string;
  created_at: string;
  old_status: string | null;
  new_status: string;
  reason: string | null;
};

function historyReasonLabel(reason: string | null | undefined): string {
  if (!reason) return "Mise à jour du dossier";
  if (reason === "publication_disponibilites") return "Réponse de la pharmacie publiée";
  if (reason === "pharmacist_adjustments_after_confirmation") return "Préparation pharmacie mise à jour";
  if (reason === "counter_product_added") return "Produit ajouté au comptoir";
  if (reason === "counter_line_cancelled") return "Produit annulé au comptoir";
  if (reason === "counter_alternative_added") return "Alternative ajoutée";
  if (reason === "counter_alternative_removed") return "Alternative retirée";
  if (reason.startsWith("counter_outcome:")) return "Statut de récupération mis à jour";
  return "Mise à jour du dossier";
}

function PatientHistoryReasonBlock({ reason }: { reason: string | null }) {
  const audit = tryParsePatientHistoryAudit(reason);
  if (audit) {
    return (
      <>
        <p className="font-medium text-foreground">{patientHistoryAuditTitle(audit)}</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] leading-snug text-muted-foreground">
          {patientHistoryAuditDetailLines(audit).map((line, idx) => (
            <li key={idx}>{line}</li>
          ))}
        </ul>
      </>
    );
  }
  return <p className="font-medium text-foreground">{historyReasonLabel(reason)}</p>;
}

export default function DemandeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [items, setItems] = useState<RequestItemRow[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [historyRows, setHistoryRows] = useState<StatusHistoryRow[]>([]);

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
          "id,created_at,status,request_type,pharmacy_id,submitted_at,responded_at,confirmed_at,patient_planned_visit_date,patient_planned_visit_time,request_public_ref,pharmacies(nom,ville,adresse,telephone,public_ref),product_requests(patient_note)"
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
          "id,product_id,requested_qty,selected_qty,is_selected_by_patient,availability_status,available_qty,unit_price,pharmacist_comment,client_comment,line_source,pharmacist_proposal_reason,expected_availability_date,counter_outcome,patient_chosen_alternative_id,products(name,price_pph),request_item_alternatives!request_item_alternatives_request_item_id_fkey(id,rank,availability_status,available_qty,unit_price,pharmacist_comment,expected_availability_date,products(name,price_pph))"
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
      setHistoryRows(data as StatusHistoryRow[]);
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
          Mes demandes
        </Link>
      </PageShell>
    );
  }

  const productReq = one(request.product_requests);
  const note = productReq?.patient_note ?? null;
  const summary = summarizeRequestForPatientCard(items as unknown as PatientRequestItemRow[]);
  const isInitialAmountView =
    request.status === "submitted" || request.status === "in_review" || request.status === "responded";
  const totalLabel = isInitialAmountView
    ? summary.totalInitialDh != null
      ? formatDh(summary.totalInitialDh)
      : "—"
    : summary.totalSelectedDh != null
      ? formatDh(summary.totalSelectedDh)
      : "—";
  const amountHint = isInitialAmountView
    ? "montant basé sur les produits et quantités initialement demandés"
    : "montant basé sur les produits validés par vous";
  const hasBottomActions =
    request.request_type === "product_request" &&
    (request.status === "submitted" ||
      request.status === "in_review" ||
      request.status === "responded" ||
      request.status === "confirmed");
  const showPlannedVisitBlock =
    request.status === "confirmed" ||
    request.status === "completed" ||
    request.status === "partially_collected" ||
    request.status === "fully_collected";

  return (
    <PageShell className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/dashboard/demandes" className="text-xs font-medium text-sky-800 underline">
          ← Mes demandes
        </Link>
      </div>
      <section className="rounded-xl border-2 border-sky-100 bg-white p-2.5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold text-foreground">
            {displayRequestPublicRef(request)}
          </span>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
            {requestStatusFr[request.status] ?? request.status}
          </span>
        </div>
        <div className={`mt-2 grid gap-2 ${showPlannedVisitBlock ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
          <div className="rounded-lg border border-sky-100 bg-sky-50/60 px-2.5 py-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-900">Montant</p>
            <p className="text-sm font-bold text-sky-950">{totalLabel}</p>
            <p className="text-[10px] text-sky-900/80">{amountHint}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-700">Produits</p>
            <p className="text-sm font-bold text-foreground">{summary.lineCount} ligne{summary.lineCount > 1 ? "s" : ""}</p>
          </div>
          {showPlannedVisitBlock ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-2.5 py-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800">Passage prévu</p>
              <p className="text-xs font-semibold text-emerald-950">
                {request.patient_planned_visit_date
                  ? formatPlannedVisitFr(request.patient_planned_visit_date, request.patient_planned_visit_time)
                  : "À définir"}
              </p>
              <p className="text-[10px] text-emerald-900/80">modifiable dans les actions ci-dessous</p>
            </div>
          ) : null}
        </div>
      </section>
      <section className="rounded-xl border border-border/80 bg-card p-2.5 shadow-sm">
        <button
          type="button"
          onClick={() => {
            const next = !historyOpen;
            setHistoryOpen(next);
            if (next && historyRows.length === 0 && !historyBusy) {
              void loadHistory();
            }
          }}
          className="inline-flex h-9 items-center justify-center rounded-lg border border-border px-3 text-xs font-semibold text-foreground hover:bg-muted/40"
        >
          {historyOpen ? "Masquer l’historique" : "Voir l’historique"}
        </button>
        {historyOpen ? (
          <div className="mt-2 space-y-1.5">
            {historyBusy ? (
              <p className="text-xs text-muted-foreground">Chargement…</p>
            ) : historyRows.length === 0 ? (
              <p className="text-xs text-muted-foreground">Aucun événement disponible.</p>
            ) : (
              <ul className="space-y-1.5">
                {historyRows.map((h) => (
                  <li key={h.id} className="rounded-lg border border-border/60 bg-muted/20 px-2 py-1.5 text-xs">
                    <PatientHistoryReasonBlock reason={h.reason} />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {h.old_status ? `${requestStatusFr[h.old_status] ?? h.old_status} → ` : ""}
                      {requestStatusFr[h.new_status] ?? h.new_status}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </section>

      {items.length > 0 && !hasBottomActions ? (
        <section className="space-y-2">
            <ul className="space-y-2.5">
              {items.map((row) => {
                const prod = one(row.products);
                const altList = normalizeAlternatives(row.request_item_alternatives);
                const linePph = unitPriceLabel(prod?.price_pph);
                const postConfirmPatientView = [
                  "confirmed",
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
                    {row.line_source === "pharmacist_proposed" ? (
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
                      Demandé <strong className="text-foreground">{row.requested_qty}</strong>
                      {row.selected_qty != null ? (
                        <>
                          {" "}
                          · sélect. <strong className="text-foreground">{row.selected_qty}</strong>
                          {!row.is_selected_by_patient ? <span className="text-muted-foreground"> (décoché)</span> : null}
                        </>
                      ) : null}
                    </p>
                    {postConfirmPatientView && row.is_selected_by_patient ? (
                      <>
                        <div className="mt-2 rounded-lg border border-emerald-300/70 bg-emerald-50 px-2 py-1.5">
                          <p className="text-[9px] font-bold uppercase tracking-wide text-emerald-900">
                            Ce que vous avez validé
                          </p>
                          <p className="mt-0.5 text-xs font-semibold leading-snug text-emerald-950">
                            <span>{validatedProductName}</span>
                            <span className="tabular-nums"> · {validatedQtyBaseline} unité(s)</span>
                          </p>
                          {chosenAltForValidated ? (
                            <p className="mt-1 text-[10px] text-emerald-900/85">
                              Alternative retenue par rapport au produit initialement demandé.
                            </p>
                          ) : altList.length > 0 ? (
                            <p className="mt-1 text-[10px] text-emerald-900/85">Produit principal retenu.</p>
                          ) : null}
                        </div>
                        <div className="mt-2 rounded-lg border border-slate-300/80 bg-slate-50 px-2 py-1.5">
                          <p className="text-[9px] font-bold uppercase tracking-wide text-slate-700">
                            Préparation actuelle (pharmacie)
                          </p>
                          <p className="mt-0.5 text-[11px] leading-snug text-slate-900">
                            Quantité suivie :{" "}
                            <strong className="tabular-nums">{row.available_qty ?? "—"}</strong>
                            {row.availability_status ? (
                              <>
                                {" "}
                                · {availabilityStatusFr[row.availability_status] ?? row.availability_status}
                              </>
                            ) : null}
                            {(chosenAltForValidated?.unit_price ?? row.unit_price) != null ? (
                              <span className="tabular-nums">
                                {" "}
                                · {Number(chosenAltForValidated?.unit_price ?? row.unit_price).toFixed(2)} MAD
                              </span>
                            ) : null}
                          </p>
                          {row.available_qty != null &&
                          Number(row.available_qty) !== Number(validatedQtyBaseline) ? (
                            <p className="mt-1 text-[10px] leading-snug text-amber-900">
                              Peut différer de votre validation sans nouvelle validation de votre part. Consultez
                              l&apos;historique du dossier pour le détail des changements.
                            </p>
                          ) : null}
                        </div>
                      </>
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
                    {(request.status === "confirmed" || request.status === "completed" || row.counter_outcome !== "unset") && (
                      <p className="mt-1 text-muted-foreground">
                        <span className="font-medium text-foreground">{counterOutcomeFr[row.counter_outcome] ?? row.counter_outcome}</span>
                      </p>
                    )}
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
              ...items.map((i) =>
                [
                  i.id,
                  i.selected_qty,
                  i.is_selected_by_patient,
                  i.available_qty,
                  i.requested_qty,
                  i.counter_outcome,
                  i.patient_chosen_alternative_id ?? "",
                  i.client_comment ?? "",
                  i.line_source ?? "",
                ].join(":")
              ),
            ].join("|")
          }
          requestId={request.id}
          status={request.status}
          items={items}
          initialPatientNote={note}
          initialPlannedVisitDate={request.patient_planned_visit_date}
          initialPlannedVisitTime={request.patient_planned_visit_time}
          onReload={async () => {
            await loadDetail(true);
          }}
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
    </PageShell>
  );
}
