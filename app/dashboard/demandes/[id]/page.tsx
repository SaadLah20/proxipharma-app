"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { clsx } from "clsx";
import { useParams, useRouter } from "next/navigation";
import { PageShell } from "@/components/ui/compact-shell";
import { formatDateShortCasablancaWithTime24hFr, formatDateTimeShort24hFr } from "@/lib/datetime-fr";
import { supabase } from "@/lib/supabase";
import { historyActorLabel, requestHistoryPatientHeadline, requestStatusFr } from "@/lib/request-display";
import { displayRequestPublicRef } from "@/lib/public-ref";
import { getRequestKindConfig } from "@/lib/request-kinds/registry";
import { sharedShowPlannedVisitBlock } from "@/lib/request-kinds/shared-capabilities";
import { RequestDetailBackLink } from "@/components/requests/shared/request-detail-back-link";
import { RequestKindHeader } from "@/components/requests/shared/request-kind-header";
import { RequestTypeStubPanel } from "@/components/requests/shared/request-type-stub-panel";
import { one } from "@/lib/embed";
import { mapRequestItemsPhotos } from "@/lib/storage-media";
import { REQUEST_DETAIL_REFRESH_EVENT, type RequestDetailRefreshDetail } from "@/lib/request-detail-refresh-bus";
import { patientDossierHistoryDetailParagraphsFr } from "@/lib/patient-request-history-audit";
import {
  PatientProductRequestActions,
  PatientSentEnvoyeeSummaryCard,
  buildPatientLineCountLabel,
  buildPatientSummaryStatusHint,
  type PatientPharmacyContactInfo,
} from "@/components/requests/product/patient-product-request-actions";
import { ConsultationDetailStickyChrome } from "@/components/requests/consultation/consultation-detail-sticky-chrome";
import {
  PatientRequestOutcomeBanner,
  isPatientProductArchiveStatus,
  type PatientOutcomeDetailContext,
} from "@/components/requests/patient-request-outcome-banner";
import { RequestConversationFabDock, RequestConversationPanel } from "@/components/requests/request-conversation-panel";
import { RequestConversationInline } from "@/components/requests/request-conversation-inline";
import { ConsultationBriefPanel } from "@/components/requests/consultation/consultation-brief-panel";
import { ConsultationBriefCompact } from "@/components/requests/consultation/consultation-brief-compact";
import { ConsultationDetailTabBar } from "@/components/requests/consultation/consultation-detail-tab-bar";
import {
  getConsultationDefaultTab,
  type ConsultationDetailTab,
} from "@/lib/consultation-detail-tabs";
import { PrescriptionImageViewer } from "@/components/requests/prescription/prescription-image-viewer";
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
  const [conversationOpen, setConversationOpen] = useState(false);
  const [conversationUnread, setConversationUnread] = useState(false);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [conversationMessageCount, setConversationMessageCount] = useState(0);
  const [prescriptionPaths, setPrescriptionPaths] = useState<PrescriptionPagePaths | null>(null);
  const [prescriptionNote, setPrescriptionNote] = useState<string | null>(null);
  const [consultationBrief, setConsultationBrief] = useState<{
    text: string;
    paths: ConsultationImagePaths;
  } | null>(null);
  const [consultationTab, setConsultationTab] = useState<ConsultationDetailTab>("conversation");

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
      const needStatusHistory =
        r.request_type === "product_request" &&
        (["confirmed", "treated"].includes(st) || isPatientProductArchiveStatus(st));

      const isPrescription = (reqRow as RequestDetail).request_type === "prescription";
      const isConsultation = (reqRow as RequestDetail).request_type === "free_consultation";
      const needStatusHistoryConsult =
        isConsultation &&
        (["confirmed", "treated"].includes(st) || isPatientProductArchiveStatus(st));

      const [itemsResult, amendmentsResult, convUnreadRes, convCountRes, histResult, prescriptionResult, consultationResult] =
        await Promise.all([
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
        supabase.rpc("request_conversation_unread_flags", { p_request_ids: [id] }),
        supabase
          .from("request_comments")
          .select("id", { count: "exact", head: true })
          .eq("request_id", id)
          .eq("is_internal", false)
          .is("deleted_at", null),
        needStatusHistory || needStatusHistoryConsult
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
      ]);
      const unreadRow = (convUnreadRes.data as { request_id: string; has_unread: boolean }[] | null)?.find((x) => x.request_id === id);
      setConversationUnread(Boolean(unreadRow?.has_unread));
      setConversationMessageCount(convCountRes.count ?? 0);
      if ((needStatusHistory || needStatusHistoryConsult) && !histResult.error && Array.isArray(histResult.data)) {
        setHistoryRows(
          histResult.data as {
            id: string;
            created_at: string;
            old_status: string | null;
            new_status: string;
            reason: string | null;
          }[]
        );
      } else if (!needStatusHistory && !needStatusHistoryConsult) {
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

  useEffect(() => {
    if (!request || request.request_type !== "free_consultation") return;
    const tid = window.setTimeout(() => {
      setConsultationTab(getConsultationDefaultTab(request.status, request.responded_at));
    }, 0);
    return () => window.clearTimeout(tid);
  }, [request]);

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
    if (!request || !isPatientProductArchiveStatus(request.status)) return null;
    if (
      request.request_type !== "product_request" &&
      request.request_type !== "prescription" &&
      request.request_type !== "free_consultation"
    ) {
      return null;
    }
    const ph = one(request.pharmacies);
    const pharmacyLine =
      ph?.nom?.trim() != null && ph.nom.trim() !== ""
        ? `${ph.nom.trim()}${ph.ville?.trim() ? ` · ${ph.ville.trim()}` : ""}`
        : null;
    const retainedCount = items.filter((i) => i.is_selected_by_patient).length;
    return {
      pharmacyLine,
      retainedCount,
      totalLines: items.length,
      hasConversationMessages: conversationMessageCount > 0,
      lastUpdatedLabel: formatDateShortCasablancaWithTime24hFr(request.updated_at),
      linesMode:
        request.request_type === "prescription"
          ? "prescription"
          : request.request_type === "free_consultation"
            ? "prescription"
            : "product",
    };
  }, [request, items, conversationMessageCount]);

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
    !isConsultationRequest &&
    ["submitted", "in_review", "responded", "confirmed", "treated"].includes(request.status);
  const consultationChromeStatuses = ["submitted", "in_review", "responded", "confirmed", "treated"] as const;
  const showConsultationStickyChrome =
    isConsultationRequest &&
    !showArchivedReadonly &&
    consultationChromeStatuses.includes(request.status as (typeof consultationChromeStatuses)[number]);
  const consultationPharmacyContact = (() => {
    const ph = one(request.pharmacies);
    if (!ph?.nom?.trim()) return null;
    return {
      nom: ph.nom,
      ville: ph.ville,
      telephone: ph.telephone,
      contact_email: ph.contact_email ?? null,
      public_ref: ph.public_ref ?? null,
    } satisfies PatientPharmacyContactInfo;
  })();

  return (
    <PageShell
      className={clsx(
        "space-y-3 bg-slate-50",
        hideMainRequestHeader && "pb-56"
      )}
    >
      <RequestDetailBackLink config={kindConfig} viewerRole="patient" />

      {!hideMainRequestHeader ? (
        <RequestKindHeader
          config={kindConfig}
          request={request}
          lineCount={items.length}
          showPlannedVisit={showPlannedVisitBlock}
          viewerRole="patient"
        />
      ) : null}

      {showArchivedReadonly ? (
        <PatientRequestOutcomeBanner
          status={request.status}
          historyRows={historyRows}
          detailContext={archivedOutcomeDetail}
          closedFooterNote={
            isPrescriptionRequest || isConsultationRequest ? workflowCopy.patientArchiveClosedFooter : null
          }
          requestKindId={
            isConsultationRequest ? "free_consultation" : isPrescriptionRequest ? "prescription" : "product_request"
          }
        >
          {request.status === "expired" && !isPrescriptionRequest ? (
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
          ) : request.status === "expired" && isPrescriptionRequest ? (
            <Link
              href="/"
              className="mt-1 inline-flex w-full justify-center rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm font-semibold text-amber-950 shadow-sm transition hover:bg-amber-100"
            >
              Annuaire — envoyer une nouvelle ordonnance
            </Link>
          ) : null}
        </PatientRequestOutcomeBanner>
      ) : null}

      {showArchivedReadonly && isPrescriptionRequest && prescriptionPaths?.page1 ? (
        <PrescriptionImageViewer paths={prescriptionPaths} layout="desktop-comfort" className="mt-2" />
      ) : null}

      {showConsultationStickyChrome && consultationPharmacyContact ? (
        <ConsultationDetailStickyChrome>
          <PatientSentEnvoyeeSummaryCard
            pharmacyContact={consultationPharmacyContact}
            pharmacyId={request.pharmacy_id}
            dossierRefLabel={displayRequestPublicRef(request)}
            lineCount={items.length}
            lineCountLabel={buildPatientLineCountLabel(request.request_type, request.status, items.length)}
            status={request.status}
            createdAt={request.created_at}
            updatedAt={request.updated_at}
            kindLabel={workflowCopy.patientSummaryKindLabel}
            refShort={workflowCopy.patientSummaryRefShort}
            statusHint={buildPatientSummaryStatusHint(request.status, request.request_type, workflowCopy)}
            accent="violet"
          />
          <ConsultationDetailTabBar
            tab={consultationTab}
            onTab={setConsultationTab}
            conversationUnread={conversationUnread}
            productLineCount={items.length}
          />
        </ConsultationDetailStickyChrome>
      ) : isConsultationRequest ? (
        <ConsultationDetailTabBar
          tab={consultationTab}
          onTab={setConsultationTab}
          conversationUnread={conversationUnread}
          productLineCount={items.length}
        />
      ) : null}

      {isConsultationRequest && consultationTab === "conversation" && consultationBrief ? (
        <div className="space-y-3">
          <ConsultationBriefPanel
            requestId={request.id}
            initialText={consultationBrief.text}
            initialPaths={consultationBrief.paths}
            editable={consultationEditable}
            viewerRole="patient"
          />
          {sessionUserId ? (
            <RequestConversationInline
              requestId={request.id}
              viewerRole="patient"
              currentUserId={sessionUserId}
              variant="consultation"
              onMarkedRead={() => setConversationUnread(false)}
            />
          ) : null}
        </div>
      ) : null}

      {isConsultationRequest && consultationTab === "products" && consultationBrief ? (
        <ConsultationBriefCompact
          text={consultationBrief.text}
          paths={consultationBrief.paths}
          onOpenConversation={() => setConsultationTab("conversation")}
        />
      ) : null}

      {(hasBottomActions || (showArchivedReadonly && items.length > 0)) &&
      (!isConsultationRequest || consultationTab === "products") ? (
        <section className="pb-2">
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
              String(conversationMessageCount),
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
          }}
          dossierHistoryRows={historyRows}
          pharmacyId={request.pharmacy_id}
          requestUpdatedAt={request.updated_at}
          requestType={request.request_type}
          prescriptionPaths={isPrescriptionRequest ? prescriptionPaths : null}
          prescriptionNote={isPrescriptionRequest ? prescriptionNote : null}
          summaryInPageChrome={showConsultationStickyChrome}
        />
        </section>
      ) : showArchivedReadonly && items.length === 0 ? (
        <p className="text-center text-xs text-muted-foreground">
          {isPrescriptionRequest ? workflowCopy.patientArchiveEmptyLines : workflowCopy.patientArchiveEmptyLines}
        </p>
      ) : null}

      <details className="group scroll-mb-44 rounded-xl border border-border/80 bg-card shadow-sm">
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
      {usesLineWorkflow && sessionUserId && !isConsultationRequest ? (
        <>
          <RequestConversationFabDock
            hasUnread={conversationUnread}
            onOpen={() => setConversationOpen(true)}
            tone="patient"
          />
          <RequestConversationPanel
            requestId={request.id}
            viewerRole="patient"
            currentUserId={sessionUserId}
            open={conversationOpen}
            onClose={() => setConversationOpen(false)}
            onMarkedRead={() => setConversationUnread(false)}
          />
        </>
      ) : null}
    </PageShell>
  );
}
