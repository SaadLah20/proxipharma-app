"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { clsx } from "clsx";
import { useParams, useRouter } from "next/navigation";
import { PageShell } from "@/components/ui/compact-shell";
import { uiActionBtnFilterToggle, uiActionBtnFullOutline } from "@/lib/ui-action-buttons";
import { supabase } from "@/lib/supabase";
import { DossierHistoryListFr } from "@/components/requests/dossier-history-list-fr";
import { patientDossierHistoryDetailParagraphsFr } from "@/lib/patient-request-history-audit";
import { displayRequestPublicRef } from "@/lib/public-ref";
import { getRequestKindConfig } from "@/lib/request-kinds/registry";
import { sharedShowPlannedVisitBlock } from "@/lib/request-kinds/shared-capabilities";
import { RequestDetailBackLink } from "@/components/requests/shared/request-detail-back-link";
import { RequestKindHeader } from "@/components/requests/shared/request-kind-header";
import { one } from "@/lib/embed";
import { mapRequestItemsPhotos } from "@/lib/storage-media";
import { REQUEST_DETAIL_REFRESH_EVENT, type RequestDetailRefreshDetail } from "@/lib/request-detail-refresh-bus";
import { useRequestDetailDrift } from "@/lib/use-request-detail-drift";
import { PatientProductRequestActions, type PatientPharmacyContactInfo } from "@/components/requests/product/patient-product-request-actions";
import { ConsultationRequestDetailChrome } from "@/components/requests/consultation/consultation-request-detail-chrome";
import {
  getConsultationDefaultTab,
  type ConsultationDetailTab,
} from "@/lib/consultation-detail-tabs";
import {
  isPatientProductArchiveStatus,
  PatientRequestOutcomeBanner,
} from "@/components/requests/patient-request-outcome-banner";
import {
  buildPatientArchiveOutcomeDetailContext,
  findTerminalStatusHistoryEntry,
} from "@/lib/patient-archive-outcome-fr";
import { patientOutcomeStatusFooter } from "@/lib/request-kinds/hub-and-terminal-copy";
import { RequestConversationFabDock, RequestConversationPanel } from "@/components/requests/request-conversation-panel";
import {
  patientDetailStickyFooterPadTier,
  stickyFooterFabMinBottomPx,
  stickyFooterPadClass,
  stickyFooterScrollMarginClass,
} from "@/lib/platform-sticky-footer";
import { RequestConversationInline } from "@/components/requests/request-conversation-inline";
import { ConsultationBriefPanel } from "@/components/requests/consultation/consultation-brief-panel";
import type { ConsultationImagePaths } from "@/lib/consultation-media";
import type { PrescriptionPagePaths } from "@/lib/prescription-media";

type PharmacyEmbed = {
  nom: string;
  ville: string;
  adresse: string;
  telephone: string | null;
  public_ref?: string | null;
  contact_email?: string | null;
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
  /** Pour diagnostic expiration `responded` (cron SQL `expire_overdue_requests`). */
  expires_at?: string | null;
  confirmed_at: string | null;
  patient_planned_visit_date: string | null;
  patient_planned_visit_time: string | null;
  request_public_ref?: string | null;
  pharmacies: PharmacyEmbed | PharmacyEmbed[] | null;
};

type ProdEmbed = {
  name: string;
  product_type?: string | null;
  laboratory?: string | null;
  price_pph?: number | null;
  price_ppv?: number | null;
  photo_url?: string | null;
};

type AltEmbed = {
  id: string;
  rank: number;
  product_id: string;
  availability_status: string | null;
  available_qty: number | null;
  unit_price: number | null;
  pharmacist_comment: string | null;
  expected_availability_date: string | null;
  products: ProdEmbed | ProdEmbed[] | null;
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
  const [supplyAmendments, setSupplyAmendments] = useState<{ id: string; created_at: string; amendments: unknown }[]>([]);
  const [productPatientNote, setProductPatientNote] = useState<string | null>(null);
  const [conversationOpen, setConversationOpen] = useState(false);
  const [conversationUnread, setConversationUnread] = useState(false);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [prescriptionPaths, setPrescriptionPaths] = useState<PrescriptionPagePaths | null>(null);
  const [prescriptionNote, setPrescriptionNote] = useState<string | null>(null);
  const [consultationBrief, setConsultationBrief] = useState<{
    text: string;
    paths: ConsultationImagePaths;
  } | null>(null);
  const [consultationTab, setConsultationTab] = useState<ConsultationDetailTab>("conversation");
  const [prevConsultationTabSyncKey, setPrevConsultationTabSyncKey] = useState("");
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

      setSessionUserId(user.id);

      const { data: reqRow, error: reqErr } = await supabase
        .from("requests")
        .select(
          "id,created_at,updated_at,status,request_type,pharmacy_id,submitted_at,responded_at,expires_at,confirmed_at,patient_planned_visit_date,patient_planned_visit_time,request_public_ref,pharmacies(nom,ville,adresse,telephone,public_ref,contact_email)"
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
      const isPrescription = (reqRow as RequestDetail).request_type === "prescription";
      const isProductRequest = (reqRow as RequestDetail).request_type === "product_request";
      const isConsultation = (reqRow as RequestDetail).request_type === "free_consultation";
      const usesLineWorkflowRequest =
        isProductRequest || isPrescription || isConsultation;
      const needStatusHistory =
        usesLineWorkflowRequest &&
        (["confirmed", "treated"].includes(st) || isPatientProductArchiveStatus(st));

      const [itemsResult, amendmentsResult, convUnreadRes, histResult, prescriptionResult, consultationResult, productReqResult] =
        await Promise.all([
        supabase
          .from("request_items")
          .select(
            "id,product_id,requested_qty,selected_qty,is_selected_by_patient,availability_status,available_qty,unit_price,pharmacist_comment,client_comment,line_source,pharmacist_proposal_reason,expected_availability_date,counter_outcome,counter_cancel_reason,counter_cancel_detail,patient_chosen_alternative_id,post_confirm_fulfillment,withdrawn_after_confirm,updated_at,products(name,product_type,laboratory,price_pph,price_ppv,photo_url),request_item_alternatives!request_item_alternatives_request_item_id_fkey(id,rank,product_id,availability_status,available_qty,unit_price,pharmacist_comment,expected_availability_date,products(name,product_type,laboratory,price_pph,price_ppv,photo_url))"
          )
          .eq("request_id", id)
          .order("created_at", { ascending: true }),
        supabase
          .from("request_supply_amendments")
          .select("id,created_at,amendments")
          .eq("request_id", id)
          .order("created_at", { ascending: false })
          .limit(40),
        supabase.rpc("request_conversation_unread_flags", { p_request_ids: [id] }),
        needStatusHistory
          ? supabase
              .from("request_status_history")
              .select("id,created_at,old_status,new_status,reason")
              .eq("request_id", id)
              .order("created_at", { ascending: false })
              .limit(30)
          : Promise.resolve({ data: null, error: null } as const),
        isPrescription
          ? supabase
              .from("prescription_requests")
              .select("prescription_image_url,page_2_path,patient_note")
              .eq("request_id", id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null } as const),
        isConsultation
          ? supabase
              .from("free_consultation_requests")
              .select("consultation_text,image_1_path,image_2_path,image_3_path")
              .eq("request_id", id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null } as const),
        isProductRequest
          ? supabase.from("product_requests").select("patient_note").eq("request_id", id).maybeSingle()
          : Promise.resolve({ data: null, error: null } as const),
      ]);
      const unreadRow = (convUnreadRes.data as { request_id: string; has_unread: boolean }[] | null)?.find((x) => x.request_id === id);
      setConversationUnread(Boolean(unreadRow?.has_unread));
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
        setItems(mapRequestItemsPhotos(itemsData as RequestItemRow[]));
      }
      if (!amendmentsResult.error && Array.isArray(amendmentsResult.data)) {
        setSupplyAmendments(amendmentsResult.data as { id: string; created_at: string; amendments: unknown }[]);
      } else {
        setSupplyAmendments([]);
      }

      if (isProductRequest && productReqResult.data) {
        setProductPatientNote((productReqResult.data as { patient_note: string | null }).patient_note);
      } else {
        setProductPatientNote(null);
      }

      if (isPrescription && prescriptionResult.data) {
        const pr = prescriptionResult.data as {
          prescription_image_url: string | null;
          page_2_path: string | null;
          patient_note: string | null;
        };
        setPrescriptionPaths({
          page1: pr.prescription_image_url,
          page2: pr.page_2_path,
        });
        setPrescriptionNote(pr.patient_note);
      } else {
        setPrescriptionPaths(null);
        setPrescriptionNote(null);
      }

      if (isConsultation && consultationResult.data) {
        const cr = consultationResult.data as {
          consultation_text: string;
          image_1_path: string | null;
          image_2_path: string | null;
          image_3_path: string | null;
        };
        setConsultationBrief({
          text: cr.consultation_text,
          paths: {
            photo1: cr.image_1_path,
            photo2: cr.image_2_path,
            photo3: cr.image_3_path,
          },
        });
      } else {
        setConsultationBrief(null);
      }

      setLoading(false);
    },
    [id, router]
  );

  const requestDrift = useRequestDetailDrift(id, request?.status, "patient", () => loadDetail(true));
  const { acknowledge: acknowledgeRequestDrift } = requestDrift;

  useEffect(() => {
    if (!request?.updated_at) return;
    acknowledgeRequestDrift(request.updated_at, request.status);
  }, [request?.id, request?.updated_at, request?.status, acknowledgeRequestDrift]);

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

  const archiveStatusDetail = useMemo(() => {
    if (!request || !isPatientProductArchiveStatus(request.status)) return null;
    const kindId =
      request.request_type === "prescription"
        ? "prescription"
        : request.request_type === "free_consultation"
          ? "free_consultation"
          : "product_request";
    const footer = patientOutcomeStatusFooter(request.status, kindId);
    const entry = historyRows.find((h) => h.new_status === request.status) ?? historyRows[0] ?? null;
    const paras = entry ? patientDossierHistoryDetailParagraphsFr(entry.reason) : [];
    return [footer, ...paras].filter((s) => s.trim().length > 0).join(" — ");
  }, [request, historyRows]);

  const archiveTerminalHistoryEntry = useMemo(() => {
    if (!request || !isPatientProductArchiveStatus(request.status)) return null;
    return findTerminalStatusHistoryEntry(historyRows, request.status);
  }, [request, historyRows]);

  const archiveTerminalOldStatus = archiveTerminalHistoryEntry?.old_status ?? null;

  const archiveOutcomeDetail = useMemo(() => {
    if (!request || request.request_type !== "product_request") return null;
    if (!isPatientProductArchiveStatus(request.status)) return null;
    const ph = one(request.pharmacies);
    return buildPatientArchiveOutcomeDetailContext({
      terminalStatus: request.status,
      items,
      pharmacyName: ph?.nom ?? null,
      historyEntry: archiveTerminalHistoryEntry,
    });
  }, [request, items, archiveTerminalHistoryEntry]);

  const handleConversationMarkedRead = useCallback(() => {
    setConversationUnread(false);
  }, []);

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
        <Link
          href={getRequestKindConfig("product_request").routes.patientHubPath}
          className="mt-3 inline-block text-xs font-medium text-sky-800 underline"
        >
          Mes demandes
        </Link>
      </PageShell>
    );
  }

  const usesLineWorkflow =
    request.request_type === "product_request" ||
    request.request_type === "prescription" ||
    request.request_type === "free_consultation";
  const activeLineStatuses = ["submitted", "in_review", "responded", "confirmed", "treated"] as const;
  const hasBottomActions =
    usesLineWorkflow && activeLineStatuses.includes(request.status as (typeof activeLineStatuses)[number]);
  const detailStickyFooterTier = patientDetailStickyFooterPadTier(request.request_type, request.status);
  const detailStickyFooterPad = hasBottomActions ? stickyFooterPadClass(detailStickyFooterTier) : "";
  const conversationFabMinBottomPx = stickyFooterFabMinBottomPx(
    hasBottomActions ? detailStickyFooterTier : "none"
  );
  const isPrescriptionRequest = request.request_type === "prescription";
  const isConsultationRequest = request.request_type === "free_consultation";
  const consultationEditable =
    isConsultationRequest && ["submitted", "in_review"].includes(request.status) && consultationBrief != null;
  const showArchivedReadonly = usesLineWorkflow && isPatientProductArchiveStatus(request.status);

  const kindConfig = getRequestKindConfig(request.request_type);
  const workflowCopy = kindConfig.copy.workflow;
  const showPlannedVisitBlock = sharedShowPlannedVisitBlock(request.status);

  const hideMainRequestHeader =
    usesLineWorkflow &&
    (isConsultationRequest ||
      ["submitted", "in_review", "responded", "confirmed", "treated"].includes(request.status) ||
      (request.request_type === "product_request" && showArchivedReadonly));

  const showConsultationTabbed =
    isConsultationRequest &&
    consultationBrief != null &&
    ["submitted", "in_review"].includes(request.status) &&
    !showArchivedReadonly;

  const dossierRefLabel =
    displayRequestPublicRef(request) || `Dossier ${request.id.slice(0, 8)}…`;

  const consultationSeed =
    consultationBrief != null
      ? {
          text: consultationBrief.text,
          paths: consultationBrief.paths,
          createdAt: request.submitted_at ?? request.created_at,
        }
      : null;

  const consultationTabSyncKey =
    isConsultationRequest && request
      ? `${request.id}|${request.status}|${request.responded_at ?? ""}`
      : "";
  if (consultationTabSyncKey && consultationTabSyncKey !== prevConsultationTabSyncKey) {
    setPrevConsultationTabSyncKey(consultationTabSyncKey);
    setConsultationTab(getConsultationDefaultTab(request.status, request.responded_at));
  }

  return (
    <PageShell className={clsx("min-w-0 max-w-full space-y-3 bg-slate-50", detailStickyFooterPad)}>
      <RequestDetailBackLink config={kindConfig} viewerRole="patient" />

      {showConsultationTabbed ? (
        <ConsultationRequestDetailChrome
          dossierRefLabel={dossierRefLabel}
          status={request.status}
          tab={consultationTab}
          onTab={setConsultationTab}
          conversationUnread={conversationUnread}
          productLineCount={items.length}
          submittedAt={request.submitted_at}
          createdAt={request.created_at}
        />
      ) : !hideMainRequestHeader ||
        (showArchivedReadonly && request.request_type !== "product_request") ? (
        <RequestKindHeader
          config={kindConfig}
          request={request}
          lineCount={items.length}
          showPlannedVisit={showPlannedVisitBlock}
          viewerRole="patient"
          statusDetail={showArchivedReadonly ? archiveStatusDetail : null}
        />
      ) : null}

      {showArchivedReadonly &&
      request.request_type === "product_request" &&
      request.status !== "expired" &&
      request.status !== "cancelled" &&
      request.status !== "abandoned" &&
      request.status !== "completed" &&
      request.status !== "partially_collected" &&
      request.status !== "fully_collected" ? (
        <PatientRequestOutcomeBanner
          status={request.status}
          historyRows={historyRows}
          detailContext={archiveOutcomeDetail}
          requestKindId="product_request"
        />
      ) : null}

      {showArchivedReadonly && request.status === "expired" && isPrescriptionRequest ? (
        <Link
          href="/"
          className={uiActionBtnFullOutline("inline-flex w-full justify-center")}
        >
          Annuaire — envoyer une nouvelle ordonnance
        </Link>
      ) : null}

      {showConsultationTabbed && consultationTab === "conversation" && sessionUserId ? (
        <div className="space-y-2">
          <RequestConversationInline
            requestId={request.id}
            viewerRole="patient"
            currentUserId={sessionUserId}
            variant="consultation"
            consultationSeed={consultationSeed}
            onMarkedRead={handleConversationMarkedRead}
          />
          {consultationEditable ? (
            <details className="rounded-lg border border-violet-200/70 bg-violet-50/30 px-2.5 py-2 text-[11px] text-violet-950">
              <summary className="cursor-pointer font-semibold">Modifier mon message ou mes photos</summary>
              <div className="mt-2">
                <ConsultationBriefPanel
                  requestId={request.id}
                  initialText={consultationBrief!.text}
                  initialPaths={consultationBrief!.paths}
                  editable
                  viewerRole="patient"
                />
              </div>
            </details>
          ) : null}
        </div>
      ) : null}

      {(hasBottomActions || (showArchivedReadonly && items.length > 0)) &&
      (!showConsultationTabbed || consultationTab === "products") ? (
        <>
        {requestDrift.stale ? (
          <div className="mb-2 rounded-lg border border-amber-300/80 bg-amber-50/90 p-3 text-[11px] text-amber-950 shadow-sm">
            <p className="font-bold">{requestDrift.stale.title}</p>
            <p className="mt-1 leading-snug">{requestDrift.stale.message}</p>
            <button
              type="button"
              className={uiActionBtnFilterToggle("mt-2")}
              onClick={() => void requestDrift.refresh()}
            >
              Actualiser la page
            </button>
          </div>
        ) : null}
        <section className="min-w-0 w-full max-w-full overflow-x-hidden pb-2">
        <PatientProductRequestActions
          key={
            [
              request.status,
              request.patient_planned_visit_date ?? "",
              request.patient_planned_visit_time ?? "",
              one(request.pharmacies)?.telephone ?? "",
              one(request.pharmacies)?.contact_email ?? "",
              one(request.pharmacies)?.public_ref ?? "",
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
                  i.pharmacist_comment ?? "",
                  i.line_source ?? "",
                ].join(":")
              ),
              supplyAmendments.map((a) => a.id).join(","),
              request.submitted_at ?? "",
              request.responded_at ?? "",
              request.confirmed_at ?? "",
              request.updated_at ?? "",
              historyRows.map((h) => `${h.id}:${h.created_at}:${h.reason ?? ""}`).join(";"),
            ].join("|")
          }
          requestId={request.id}
          status={request.status}
          items={items}
          supplyAmendmentBundles={supplyAmendments}
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
              public_ref: ph.public_ref ?? null,
            };
            return c;
          })()}
          onReload={async () => {
            await loadDetail(true);
          }}
          requestTimelineMeta={{
            created_at: request.created_at,
            submitted_at: request.submitted_at,
            responded_at: request.responded_at,
            confirmed_at: request.confirmed_at,
            expires_at: request.expires_at ?? null,
          }}
          productPatientNote={productPatientNote}
          dossierHistoryRows={historyRows}
          pharmacyId={request.pharmacy_id}
          requestUpdatedAt={request.updated_at}
          requestType={request.request_type}
          prescriptionPaths={isPrescriptionRequest ? prescriptionPaths : null}
          prescriptionNote={isPrescriptionRequest ? prescriptionNote : null}
          summaryInPageChrome={showConsultationTabbed}
          detailStale={requestDrift.stale}
          archiveTerminalOldStatus={archiveTerminalOldStatus}
        />
        </section>
        </>
      ) : showArchivedReadonly && items.length === 0 ? (
        <p className="text-center text-xs text-muted-foreground">
          {isPrescriptionRequest ? workflowCopy.patientArchiveEmptyLines : workflowCopy.patientArchiveEmptyLines}
        </p>
      ) : null}

      <details
        className={clsx(
          "group rounded-xl border border-border/80 bg-card shadow-sm",
          hasBottomActions ? stickyFooterScrollMarginClass(detailStickyFooterTier) : "scroll-mb-8"
        )}
      >
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
          <DossierHistoryListFr
            rows={historyRows}
            viewerRole="patient"
            busy={historyBusy}
            supplyBundles={supplyAmendments}
            timeline={{
              requestCreatedAt: request.created_at,
              requestSubmittedAt: request.submitted_at,
              requestRespondedAt: request.responded_at,
              requestConfirmedAt: request.confirmed_at,
              requestStatus: request.status,
              patientNote: productPatientNote,
              plannedVisitDate: request.patient_planned_visit_date,
              plannedVisitTime: request.patient_planned_visit_time,
            }}
          />
        </div>
      </details>
      {usesLineWorkflow &&
      sessionUserId &&
      (!isConsultationRequest || !["submitted", "in_review"].includes(request.status)) ? (
        <>
          <RequestConversationFabDock
            hasUnread={conversationUnread}
            onOpen={() => setConversationOpen(true)}
            tone="patient"
            minBottomPx={conversationFabMinBottomPx}
          />
          <RequestConversationPanel
            requestId={request.id}
            viewerRole="patient"
            currentUserId={sessionUserId}
            open={conversationOpen}
            onClose={() => setConversationOpen(false)}
            onMarkedRead={handleConversationMarkedRead}
            composerDisabled={
              showArchivedReadonly && request.request_type === "product_request"
            }
          />
        </>
      ) : null}
    </PageShell>
  );
}
