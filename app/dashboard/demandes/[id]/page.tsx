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
import {
  requestUsesProductLineWorkflow,
  sharedShowPlannedVisitBlock,
} from "@/lib/request-kinds/shared-capabilities";
import { RequestDetailBackLink } from "@/components/requests/shared/request-detail-back-link";
import { RequestKindHeader } from "@/components/requests/shared/request-kind-header";
import { one } from "@/lib/embed";
import { mapRequestItemsPhotos } from "@/lib/storage-media";
import { REQUEST_DETAIL_REFRESH_EVENT, type RequestDetailRefreshDetail } from "@/lib/request-detail-refresh-bus";
import { useRequestDetailDrift } from "@/lib/use-request-detail-drift";
import { PatientProductRequestActions, type PatientPharmacyContactInfo, usePatientSummaryStatusCopy } from "@/components/requests/product/patient-product-request-actions";
import { PatientProductRequestDossierHeader } from "@/components/requests/product/patient-product-request-dossier-header";
import { ConsultationRequestDetailChrome } from "@/components/requests/consultation/consultation-request-detail-chrome";
import { RequestExitConfirmModalFr } from "@/components/requests/request-exit-confirm-modal-fr";
import type { PatientCancelReasonCode } from "@/lib/patient-flow-reasons";
import { PlatformStickyFooter } from "@/components/layout/platform-sticky-footer";
import { uiActionBtnFullDestructive } from "@/lib/ui-action-buttons";
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
import { ConsultationBriefPanel } from "@/components/requests/consultation/consultation-brief-panel";
import {
  patientDetailStickyFooterPadTier,
  consultationConversationMinHeightClass,
  stickyFooterFabMinBottomPx,
  stickyFooterPadClass,
  stickyFooterScrollMarginClass,
} from "@/lib/platform-sticky-footer";
import { RequestConversationInline } from "@/components/requests/request-conversation-inline";
import type { ConsultationImagePaths } from "@/lib/consultation-media";
import type { PrescriptionPagePaths } from "@/lib/prescription-media";

type PharmacyEmbed = {
  nom: string;
  ville: string;
  adresse: string;
  telephone: string | null;
  public_ref?: string | null;
  contact_email?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  maps_url?: string | null;
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
    contentUpdatedAt: string | null;
  } | null>(null);
  const [consultationTab, setConsultationTab] = useState<ConsultationDetailTab>("conversation");
  const [prevConsultationTabSyncKey, setPrevConsultationTabSyncKey] = useState("");
  const [conversationRefreshToken, setConversationRefreshToken] = useState(0);
  const [consultationExitOpen, setConsultationExitOpen] = useState(false);
  const [consultationExitBusy, setConsultationExitBusy] = useState(false);
  const [consultationExitNonce, setConsultationExitNonce] = useState(0);
  const { hint: summaryStatusHint, detail: summaryStatusDetail } = usePatientSummaryStatusCopy(
    request?.request_type ?? "product_request",
  );
  const loadDetail = useCallback(
    async (silent?: boolean): Promise<{ updatedAt: string; status: string } | null> => {
      if (!id) {
        setLoading(false);
        setError("Demande introuvable.");
        return null;
      }
      if (!silent) {
        setLoading(true);
        setError("");
      }

      const { data: authData } = await supabase.auth.getSession();
      const user = authData.session?.user;
      if (!user) {
        router.replace(`/auth?redirect=/dashboard/demandes/${id}`);
        return null;
      }

      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();

      if (profile && (profile as { role: string }).role !== "patient") {
        setError("Cette page concerne les patients.");
        setLoading(false);
        return null;
      }

      setSessionUserId(user.id);

      const { data: reqRow, error: reqErr } = await supabase
        .from("requests")
        .select(
          "id,created_at,updated_at,status,request_type,pharmacy_id,submitted_at,responded_at,expires_at,confirmed_at,patient_planned_visit_date,patient_planned_visit_time,request_public_ref,pharmacies(nom,ville,adresse,telephone,public_ref,contact_email,latitude,longitude,maps_url)"
        )
        .eq("id", id)
        .eq("patient_id", user.id)
        .maybeSingle();

      if (reqErr) {
        setError(reqErr.message);
        setLoading(false);
        return null;
      }

      if (!reqRow) {
        setError("Demande introuvable ou elle ne t’appartient pas.");
        setLoading(false);
        return null;
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
            "id,product_id,requested_qty,selected_qty,is_selected_by_patient,availability_status,available_qty,unit_price,pharmacist_comment,client_comment,line_source,pharmacist_proposal_reason,expected_availability_date,counter_outcome,counter_cancel_reason,counter_cancel_detail,patient_chosen_alternative_id,post_confirm_fulfillment,withdrawn_after_confirm,updated_at,products(name,product_type,laboratory,price_pph,price_ppv,photo_url,full_description),request_item_alternatives!request_item_alternatives_request_item_id_fkey(id,rank,product_id,availability_status,available_qty,unit_price,pharmacist_comment,expected_availability_date,products(name,product_type,laboratory,price_pph,price_ppv,photo_url,full_description))"
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
              .select("consultation_text,image_1_path,image_2_path,image_3_path,patient_content_updated_at")
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
          patient_content_updated_at: string | null;
        };
        setConsultationBrief({
          text: cr.consultation_text,
          paths: {
            photo1: cr.image_1_path,
            photo2: cr.image_2_path,
            photo3: cr.image_3_path,
          },
          contentUpdatedAt: cr.patient_content_updated_at,
        });
      } else {
        setConsultationBrief(null);
      }

      setLoading(false);
      return {
        updatedAt: (reqRow as RequestDetail).updated_at,
        status: String((reqRow as RequestDetail).status),
      };
    },
    [id, router]
  );

  const requestDrift = useRequestDetailDrift(id, request?.status, "patient", async () => {
    await loadDetail(true);
  });
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
      if (detail.focus === "conversation") {
        setConsultationTab("conversation");
        setConversationRefreshToken((t) => t + 1);
        setConversationOpen(true);
      }
      void (async () => {
        const loaded = await loadDetail(true);
        if (loaded) acknowledgeRequestDrift(loaded.updatedAt, loaded.status);
      })();
    };
    window.addEventListener(REQUEST_DETAIL_REFRESH_EVENT, listener);
    return () => window.removeEventListener(REQUEST_DETAIL_REFRESH_EVENT, listener);
  }, [id, loadDetail, acknowledgeRequestDrift]);

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

  const usesLineWorkflow = requestUsesProductLineWorkflow(request.request_type);
  const activeLineStatuses = ["submitted", "in_review", "responded", "confirmed", "treated"] as const;
  const isPrescriptionRequest = request.request_type === "prescription";
  const isConsultationRequest = request.request_type === "free_consultation";
  const showArchivedReadonly = usesLineWorkflow && isPatientProductArchiveStatus(request.status);
  const hasBottomActions =
    usesLineWorkflow && activeLineStatuses.includes(request.status as (typeof activeLineStatuses)[number]);
  const showConsultationTabbed =
    isConsultationRequest &&
    consultationBrief != null &&
    ["submitted", "in_review", "responded"].includes(request.status) &&
    !showArchivedReadonly;
  const showConsultationWaitingFooter =
    showConsultationTabbed && ["submitted", "in_review"].includes(request.status);
  const detailStickyFooterTier = patientDetailStickyFooterPadTier(request.request_type, request.status);
  const effectiveStickyFooterTier = showConsultationWaitingFooter ? "standard" : detailStickyFooterTier;
  const detailStickyFooterPad =
    hasBottomActions || showConsultationWaitingFooter
      ? stickyFooterPadClass(effectiveStickyFooterTier)
      : "";
  const conversationFabMinBottomPx = stickyFooterFabMinBottomPx(
    hasBottomActions || showConsultationWaitingFooter ? effectiveStickyFooterTier : "none"
  );
  const consultationEditable =
    isConsultationRequest &&
    ["submitted", "in_review", "responded"].includes(request.status) &&
    consultationBrief != null &&
    !showArchivedReadonly;

  const kindConfig = getRequestKindConfig(request.request_type);
  const workflowCopy = kindConfig.copy.workflow;
  const showPlannedVisitBlock = sharedShowPlannedVisitBlock(request.status);

  const hideMainRequestHeader =
    usesLineWorkflow &&
    (isConsultationRequest ||
      ["submitted", "in_review", "responded", "confirmed", "treated"].includes(request.status) ||
      (showArchivedReadonly &&
        (request.request_type === "product_request" || request.request_type === "prescription")));

  const dossierRefLabel =
    displayRequestPublicRef(request) || `Dossier ${request.id.slice(0, 8)}…`;

  const consultationSeed =
    consultationBrief != null
      ? {
          text: consultationBrief.text,
          paths: consultationBrief.paths,
          createdAt: request.submitted_at ?? request.created_at,
          modifiedAt: consultationBrief.contentUpdatedAt,
        }
      : null;

  const showConsultationConversationPane =
    showConsultationTabbed && consultationTab === "conversation" && Boolean(sessionUserId);

  const consultationTabSyncKey =
    isConsultationRequest && request
      ? `${request.id}|${request.status}|${request.responded_at ?? ""}`
      : "";
  if (consultationTabSyncKey && consultationTabSyncKey !== prevConsultationTabSyncKey) {
    setPrevConsultationTabSyncKey(consultationTabSyncKey);
    const nextTab = getConsultationDefaultTab(request.status, request.responded_at);
    setConsultationTab(nextTab);
    if (nextTab === "products") setConversationOpen(false);
  }

  const pharmacyContact = (() => {
    const ph = one(request.pharmacies);
    if (!ph?.nom?.trim()) return null;
    const c: PatientPharmacyContactInfo = {
      nom: ph.nom,
      ville: ph.ville,
      adresse: ph.adresse ?? null,
      telephone: ph.telephone,
      contact_email: ph.contact_email ?? null,
      public_ref: ph.public_ref ?? null,
      latitude: ph.latitude ?? null,
      longitude: ph.longitude ?? null,
      maps_url: ph.maps_url ?? null,
    };
    return c;
  })();

  const handleConsultationCancelConfirm = async (p: {
    kind: "patient";
    code: PatientCancelReasonCode;
    other: string | null;
  }) => {
    setConsultationExitBusy(true);
    try {
      const { error: cancelErr } = await supabase.rpc("patient_cancel_product_request_before_response", {
        p_request_id: request.id,
        p_reason_code: p.code,
        p_reason_other: p.other,
      });
      if (cancelErr) {
        setError(cancelErr.message);
        return;
      }
      setConsultationExitOpen(false);
      await loadDetail(true);
    } finally {
      setConsultationExitBusy(false);
    }
  };

  return (
    <PageShell className={clsx("min-w-0 max-w-full space-y-3 bg-slate-50", detailStickyFooterPad)}>
      <div>
        <RequestDetailBackLink config={kindConfig} viewerRole="patient" />
      </div>

      {showConsultationTabbed ? (
        <div>
          <ConsultationRequestDetailChrome
            header={
              <PatientProductRequestDossierHeader
                dossierRefLabel={dossierRefLabel}
                pharmacyContact={pharmacyContact}
                pharmacyId={request.pharmacy_id}
                kindLabel={workflowCopy.patientSummaryKindLabel}
                requestType={request.request_type}
                status={request.status}
                statusHint={summaryStatusHint(request.status)}
                statusDetail={summaryStatusDetail(request.status)}
                submittedAt={request.submitted_at}
                createdAt={request.created_at}
              />
            }
            tab={consultationTab}
            onTab={setConsultationTab}
            conversationUnread={conversationUnread}
            productLineCount={items.length}
          />
        </div>
      ) : !hideMainRequestHeader ||
        (showArchivedReadonly &&
          request.request_type !== "product_request" &&
          request.request_type !== "prescription" &&
          request.request_type !== "free_consultation") ? (
        <RequestKindHeader
          config={kindConfig}
          request={request}
          lineCount={items.length}
          showPlannedVisit={showPlannedVisitBlock && !showArchivedReadonly}
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

      {showConsultationTabbed && requestDrift.stale ? (
        <div className="rounded-lg border border-amber-300/80 bg-amber-50/90 p-3 text-[11px] text-amber-950 shadow-sm">
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

      {showConsultationConversationPane ? (
        <>
          <RequestConversationInline
            requestId={request.id}
            viewerRole="patient"
            currentUserId={sessionUserId!}
            variant="consultation"
            consultationSeed={consultationSeed}
            refreshToken={conversationRefreshToken}
            minHeightClass={consultationConversationMinHeightClass(effectiveStickyFooterTier)}
            onMarkedRead={handleConversationMarkedRead}
          />
          {consultationEditable && consultationBrief ? (
            <ConsultationBriefPanel
              requestId={request.id}
              initialText={consultationBrief.text}
              initialPaths={consultationBrief.paths}
              editable
              onSaved={async () => {
                await loadDetail(true);
                setConversationRefreshToken((n) => n + 1);
              }}
            />
          ) : null}
        </>
      ) : null}

      {(hasBottomActions || (showArchivedReadonly && items.length > 0)) &&
      (!showConsultationTabbed || consultationTab === "products") ? (
        <>
        {!showConsultationTabbed && requestDrift.stale ? (
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
          pharmacyContact={pharmacyContact}
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
          detailStale={showConsultationTabbed ? null : requestDrift.stale}
          archiveTerminalOldStatus={archiveTerminalOldStatus}
        />
        </section>
        </>
      ) : showArchivedReadonly && items.length === 0 ? (
        <p className="text-center text-xs text-muted-foreground">
          {isPrescriptionRequest ? workflowCopy.patientArchiveEmptyLines : workflowCopy.patientArchiveEmptyLines}
        </p>
      ) : null}

      {showConsultationWaitingFooter ? (
        <PlatformStickyFooter tone="violet">
          <button
            type="button"
            disabled={consultationExitBusy}
            onClick={() => {
              setConsultationExitNonce((n) => n + 1);
              setConsultationExitOpen(true);
            }}
            className={uiActionBtnFullDestructive()}
          >
            {workflowCopy.patientCancelWhileWaitingLabel}
          </button>
          <RequestExitConfirmModalFr
            key={consultationExitNonce}
            open={consultationExitOpen}
            mode="patient_before_response"
            busy={consultationExitBusy}
            onClose={() => {
              if (consultationExitBusy) return;
              setConsultationExitOpen(false);
            }}
            onConfirmPatient={handleConsultationCancelConfirm}
          />
        </PlatformStickyFooter>
      ) : null}

      <details
        className={clsx(
          "group rounded-xl border border-border/80 bg-card shadow-sm",
          hasBottomActions || showConsultationWaitingFooter
            ? stickyFooterScrollMarginClass(effectiveStickyFooterTier)
            : "scroll-mb-8"
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
      (!isConsultationRequest || !["submitted", "in_review", "responded"].includes(request.status)) ? (
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
