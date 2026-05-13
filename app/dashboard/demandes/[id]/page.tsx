"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { clsx } from "clsx";
import { useParams, useRouter } from "next/navigation";
import { PageShell } from "@/components/ui/compact-shell";
import {
  formatDateShortCasablancaWithTime24hFr,
  formatDateTimeShort24hFr,
  formatPlannedVisitFr,
} from "@/lib/datetime-fr";
import { supabase } from "@/lib/supabase";
import { historyActorLabel, requestHistoryPatientHeadline, requestStatusFr } from "@/lib/request-display";
import { displayRequestPublicRef } from "@/lib/public-ref";
import { one } from "@/lib/embed";
import { REQUEST_DETAIL_REFRESH_EVENT, type RequestDetailRefreshDetail } from "@/lib/request-detail-refresh-bus";
import { patientDossierHistoryDetailParagraphsFr } from "@/lib/patient-request-history-audit";
import {
  PatientProductRequestActions,
  type PatientPharmacyContactInfo,
} from "./PatientProductRequestActions";
import {
  PatientRequestOutcomeBanner,
  isPatientProductArchiveStatus,
  type PatientOutcomeDetailContext,
} from "@/components/requests/patient-request-outcome-banner";

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

      type ReqRowMinimal = RequestDetail & { request_type?: string; status?: string };
      const r = reqRow as ReqRowMinimal;
      const st = String(r.status);
      const needStatusHistory =
        r.request_type === "product_request" &&
        (["confirmed", "treated"].includes(st) || isPatientProductArchiveStatus(st));

      const [itemsResult, amendmentsResult, phGlobalRes, histResult] = await Promise.all([
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
        needStatusHistory
          ? supabase
              .from("request_status_history")
              .select("id,created_at,old_status,new_status,reason")
              .eq("request_id", id)
              .order("created_at", { ascending: false })
              .limit(30)
          : Promise.resolve({ data: null, error: null } as const),
      ]);
      setPharmacistGlobalComment(((phGlobalRes.data?.comment_text ?? "") as string).trim());
      if (needStatusHistory && !histResult.error && Array.isArray(histResult.data)) {
        setHistoryRows(
          histResult.data as {
            id: string;
            created_at: string;
            old_status: string | null;
            new_status: string;
            reason: string | null;
          }[]
        );
      } else if (!needStatusHistory) {
        setHistoryRows([]);
      }

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

  const archivedOutcomeDetail = useMemo((): PatientOutcomeDetailContext | null => {
    if (!request || request.request_type !== "product_request" || !isPatientProductArchiveStatus(request.status)) {
      return null;
    }
    const ph = one(request.pharmacies);
    const pharmacyLine =
      ph?.nom?.trim() != null && ph.nom.trim() !== ""
        ? `${ph.nom.trim()}${ph.ville?.trim() ? ` · ${ph.ville.trim()}` : ""}`
        : null;
    const noteVal = one(request.product_requests)?.patient_note ?? null;
    const retainedCount = items.filter((i) => i.is_selected_by_patient).length;
    return {
      pharmacyLine,
      retainedCount,
      totalLines: items.length,
      hasPharmacistMessage: Boolean(pharmacistGlobalComment?.trim()),
      hasPatientNote: Boolean(noteVal?.trim()),
      lastUpdatedLabel: formatDateShortCasablancaWithTime24hFr(request.updated_at),
    };
  }, [request, items, pharmacistGlobalComment]);

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
      request.status === "treated");
  const showArchivedProductReadonly =
    request.request_type === "product_request" && isPatientProductArchiveStatus(request.status);

  const showPlannedVisitBlock =
    !["cancelled", "abandoned", "expired"].includes(request.status) &&
    (request.status === "confirmed" ||
      request.status === "treated" ||
      request.status === "completed" ||
      request.status === "partially_collected" ||
      request.status === "fully_collected");

  return (
    <PageShell className="space-y-3 bg-slate-50">
      <Link href="/dashboard/demandes" className="inline-block text-xs font-medium text-sky-800 underline">
        ← Retour aux demandes de produits
      </Link>

      <header className="mt-2 rounded-xl border-2 border-sky-300/45 bg-gradient-to-br from-sky-50/95 via-white to-teal-50/25 px-2.5 py-1.5 shadow-md shadow-sky-900/[0.06] ring-1 ring-sky-200/55 sm:px-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] sm:gap-x-2">
            <span className="shrink-0 font-bold uppercase tracking-wide text-sky-950/85">Demande prod.</span>
            <span className="font-mono text-[11px] font-semibold text-foreground">
              {displayRequestPublicRef(request)}
            </span>
            {request.request_type === "product_request" ? (
              <span className="shrink-0 rounded-full border border-sky-200/90 bg-white/90 px-1.5 py-0.5 text-[9px] font-bold tabular-nums text-sky-950">
                {items.length} ligne{items.length > 1 ? "s" : ""}
              </span>
            ) : null}
            <span className="text-muted-foreground" aria-hidden>
              ·
            </span>
            <span className="text-muted-foreground">
              Envoyée{" "}
              <span className="font-semibold tabular-nums text-foreground">
                {formatDateShortCasablancaWithTime24hFr(request.submitted_at ?? request.created_at)}
              </span>
            </span>
            {showPlannedVisitBlock ? (
              <>
                <span className="text-muted-foreground" aria-hidden>
                  ·
                </span>
                <span className="text-muted-foreground">
                  Passage{" "}
                  <span className="font-semibold text-foreground">
                    {request.patient_planned_visit_date
                      ? formatPlannedVisitFr(request.patient_planned_visit_date, request.patient_planned_visit_time)
                      : "À définir"}
                  </span>
                </span>
              </>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:ms-auto">
            <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Statut</span>
            <span
              className={clsx(
                "inline-flex max-w-[min(100%,16rem)] justify-center truncate rounded-full border px-2 py-0.5 text-center text-[10px] font-bold leading-tight shadow-sm sm:max-w-[14rem]",
                ["submitted", "in_review"].includes(request.status)
                  ? "border-sky-400/85 bg-sky-100 text-sky-950 ring-1 ring-sky-200/80"
                  : request.status === "responded"
                    ? "border-amber-300/95 bg-amber-50 text-amber-950"
                    : ["confirmed", "treated", "completed", "partially_collected", "fully_collected", "in_progress_virtual"].includes(
                          request.status
                        )
                      ? "border-teal-400/80 bg-teal-50 text-teal-950"
                      : request.status === "cancelled"
                        ? "border-rose-300/90 bg-rose-50 text-rose-950"
                        : request.status === "abandoned"
                          ? "border-orange-300/85 bg-orange-50 text-orange-950"
                          : request.status === "expired"
                            ? "border-amber-300/90 bg-amber-50 text-amber-950"
                            : "border-primary/35 bg-primary/10 text-primary"
              )}
              title={(requestStatusFr[request.status] ?? request.status) + ""}
            >
              {requestStatusFr[request.status] ?? request.status}
            </span>
          </div>
        </div>
      </header>

      {showArchivedProductReadonly ? (
        <PatientRequestOutcomeBanner
          status={request.status}
          historyRows={historyRows}
          detailContext={archivedOutcomeDetail}
        >
          {request.status === "expired" ? (
            <>
              {followUpErr ? (
                <p className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-[11px] text-destructive">
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
                className="w-full rounded-lg bg-amber-700 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-800 disabled:opacity-50"
              >
                {followUpBusy ? "Création…" : "Ajuster et renvoyer une nouvelle demande"}
              </button>
            </>
          ) : null}
        </PatientRequestOutcomeBanner>
      ) : null}

      {hasBottomActions || (showArchivedProductReadonly && items.length > 0) ? (
        <section className="pb-2">
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
              request.submitted_at ?? "",
              request.responded_at ?? "",
              request.confirmed_at ?? "",
              historyRows.map((h) => `${h.id}:${h.created_at}:${h.reason ?? ""}`).join(";"),
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
          requestTimelineMeta={{
            created_at: request.created_at,
            submitted_at: request.submitted_at,
            responded_at: request.responded_at,
            confirmed_at: request.confirmed_at,
          }}
          dossierHistoryRows={historyRows}
        />
        </section>
      ) : request.request_type === "product_request" && showArchivedProductReadonly && items.length === 0 ? (
        <p className="text-center text-xs text-muted-foreground">Aucune ligne pour cette demande.</p>
      ) : null}

      <details className="group rounded-xl border border-border/80 bg-card shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-2 marker:content-none [&::-webkit-details-marker]:hidden sm:px-3">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Historique du dossier</span>
            <span className="text-[11px] font-medium text-foreground">
              {historyRows.length === 0
                ? "Aucun événement chargé"
                : `${historyRows.length} événement${historyRows.length > 1 ? "s" : ""} — ouvrir pour le détail`}
            </span>
          </div>
          <ChevronDown
            className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
            aria-hidden
          />
        </summary>
        <div className="border-t border-border/70 px-2.5 pb-2.5 pt-1.5 sm:px-3">
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              onClick={() => void loadHistory()}
              className="inline-flex h-7 items-center justify-center rounded-md border border-border bg-background px-2 text-[10px] font-semibold text-foreground shadow-sm hover:bg-muted/40"
            >
              Rafraîchir
            </button>
          </div>
          <div className="space-y-1">
            {historyBusy ? (
              <p className="text-[11px] text-muted-foreground">Chargement…</p>
            ) : historyRows.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">Aucun événement disponible.</p>
            ) : (
              <ul className="space-y-1">
                {historyRows.map((h) => {
                  const detailParas = patientDossierHistoryDetailParagraphsFr(h.reason);
                  return (
                    <li key={h.id} className="rounded-md border border-border/60 bg-muted/15 px-2 py-1 text-[11px]">
                      <p className="font-semibold leading-snug text-foreground">
                        {requestHistoryPatientHeadline(h.old_status, h.new_status)}
                      </p>
                      {detailParas.length > 0
                        ? detailParas.map((para, i) => (
                            <p key={i} className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
                              {para}
                            </p>
                          ))
                        : null}
                      <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[9px] text-muted-foreground">
                        <span>
                          <strong className="font-medium text-foreground">{historyActorLabel("patient", h.reason)}</strong>
                        </span>
                        <span aria-hidden>·</span>
                        <time dateTime={h.created_at} className="tabular-nums">
                          {formatDateTimeShort24hFr(h.created_at)}
                        </time>
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </details>
    </PageShell>
  );
}
