"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { CompactCard, CompactCardBody, CompactCardHeader, KvRow, PageShell } from "@/components/ui/compact-shell";
import { formatDateTimeShort24hFr, formatPlannedVisitFr } from "@/lib/datetime-fr";
import { supabase } from "@/lib/supabase";
import {
  availabilityStatusFr,
  counterOutcomeFr,
  formatShortId,
  patientRequestHasNoActions,
  requestStatusFr,
  requestTypeFr,
} from "@/lib/request-display";
import { one } from "@/lib/embed";
import { PatientCancelBeforeResponse } from "./PatientCancelBeforeResponse";
import { PatientProductRequestActions } from "./PatientProductRequestActions";
import { pphLabel } from "@/lib/product-price";

type PharmacyEmbed = { nom: string; ville: string; adresse: string; telephone: string | null };
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
  counter_outcome: string;
  expected_availability_date: string | null;
  patient_chosen_alternative_id?: string | null;
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
          "id,created_at,status,request_type,pharmacy_id,submitted_at,responded_at,confirmed_at,patient_planned_visit_date,patient_planned_visit_time,pharmacies(nom,ville,adresse,telephone),product_requests(patient_note)"
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
          "id,product_id,requested_qty,selected_qty,is_selected_by_patient,availability_status,available_qty,unit_price,pharmacist_comment,expected_availability_date,counter_outcome,patient_chosen_alternative_id,products(name,price_pph),request_item_alternatives!request_item_alternatives_request_item_id_fkey(id,rank,availability_status,available_qty,unit_price,pharmacist_comment,expected_availability_date,products(name,price_pph))"
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

  const pharmacy = one(request.pharmacies);
  const productReq = one(request.product_requests);
  const note = productReq?.patient_note ?? null;

  return (
    <PageShell className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/dashboard/demandes" className="text-xs font-medium text-sky-800 underline">
          ← Mes demandes
        </Link>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            #{formatShortId(request.id)}
          </span>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
            {requestStatusFr[request.status] ?? request.status}
          </span>
        </div>
      </div>

      {patientRequestHasNoActions(request.status) ? (
        <CompactCard>
          <CompactCardHeader title="Lecture seule" />
          <CompactCardBody className="text-muted-foreground">
            Cette demande est clôturée ou sans action ici. Tu peux consulter les informations ci-dessous.
          </CompactCardBody>
        </CompactCard>
      ) : null}

      {items.length > 0 ? (
        <CompactCard>
          <CompactCardHeader title={`${items.length} ligne${items.length > 1 ? "s" : ""}`} />
          <CompactCardBody className="space-y-2 p-2 sm:p-2.5">
            <ul className="space-y-2">
              {items.map((row) => {
                const prod = one(row.products);
                const altList = normalizeAlternatives(row.request_item_alternatives);
                const linePph = pphLabel(prod?.price_pph);
                return (
                  <li key={row.id} className="rounded-md border border-border/60 bg-muted/10 p-2 text-[11px] leading-snug sm:text-xs">
                    <div className="flex flex-wrap items-start justify-between gap-1">
                      <p className="font-semibold text-foreground">{prod?.name ?? "Produit"}</p>
                      {linePph ? <span className="shrink-0 text-[10px] font-medium text-teal-800">{linePph}</span> : null}
                    </div>
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
                    {(request.status === "confirmed" || request.status === "completed") &&
                    row.is_selected_by_patient &&
                    normalizeAlternatives(row.request_item_alternatives).some((a) => a.id === row.patient_chosen_alternative_id) ? (
                      <p className="mt-1 font-medium text-emerald-900">
                        Alternative validée :{" "}
                        {one(
                          normalizeAlternatives(row.request_item_alternatives).find(
                            (a) => a.id === row.patient_chosen_alternative_id
                          )?.products
                        )?.name ?? "—"}
                      </p>
                    ) : null}
                    {(request.status === "confirmed" || request.status === "completed") &&
                    row.is_selected_by_patient &&
                    !row.patient_chosen_alternative_id &&
                    normalizeAlternatives(row.request_item_alternatives).length > 0 ? (
                      <p className="mt-1 text-muted-foreground">Produit principal validé.</p>
                    ) : null}
                    {row.availability_status ? (
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
                            const altPph = pphLabel(altProd?.price_pph);
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
          </CompactCardBody>
        </CompactCard>
      ) : request.request_type === "product_request" ? (
        <p className="text-center text-xs text-muted-foreground">Aucune ligne pour cette demande.</p>
      ) : null}

      {request.request_type === "product_request" &&
      (request.status === "submitted" ||
        request.status === "in_review" ||
        request.status === "responded" ||
        request.status === "confirmed") ? (
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
                ].join(":")
              ),
            ].join("|")
          }
          requestId={request.id}
          status={request.status}
          items={items}
          initialPatientNote={note}
          onReload={async () => {
            await loadDetail(true);
          }}
        />
      ) : null}

      {request.request_type === "product_request" && (request.status === "submitted" || request.status === "in_review") ? (
        <PatientCancelBeforeResponse
          requestId={request.id}
          onDone={async () => {
            await loadDetail(true);
          }}
        />
      ) : null}

      <details className="rounded-lg border border-border/70 bg-muted/10">
        <summary className="cursor-pointer px-3 py-2.5 text-xs font-semibold text-foreground hover:bg-muted/25">
          Pharmacie, historique et message
        </summary>
        <div className="space-y-3 border-t border-border/60 p-2 pt-3">
          <CompactCard>
            <CompactCardHeader title={requestTypeFr[request.request_type] ?? request.request_type} />
            <CompactCardBody className="space-y-0">
              {pharmacy ? (
                <>
                  <KvRow label="Pharmacie">
                    <span>
                      {pharmacy.nom}{" "}
                      <span className="text-muted-foreground">({pharmacy.ville})</span>
                    </span>
                  </KvRow>
                  <KvRow label="Adresse">{pharmacy.adresse}</KvRow>
                  {pharmacy.telephone ? (
                    <KvRow label="Tél.">
                      <a href={`tel:${pharmacy.telephone}`} className="text-sky-800 underline">
                        {pharmacy.telephone}
                      </a>
                    </KvRow>
                  ) : null}
                  <div className="pt-1">
                    <Link href={`/pharmacie/${request.pharmacy_id}`} className="text-[11px] font-medium text-sky-800 underline">
                      Fiche pharmacie
                    </Link>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground">Pharmacie…</p>
              )}
            </CompactCardBody>
          </CompactCard>

          <CompactCard>
            <CompactCardHeader title="Historique" />
            <CompactCardBody className="space-y-0">
              <KvRow label="Créée">{formatDateTimeShort24hFr(request.created_at)}</KvRow>
              {request.submitted_at ? <KvRow label="Envoyée">{formatDateTimeShort24hFr(request.submitted_at)}</KvRow> : null}
              {request.responded_at ? (
                <KvRow label="Réponse pharma">{formatDateTimeShort24hFr(request.responded_at)}</KvRow>
              ) : null}
              {request.confirmed_at ? (
                <KvRow label="Confirmée">{formatDateTimeShort24hFr(request.confirmed_at)}</KvRow>
              ) : null}
              {request.patient_planned_visit_date ? (
                <KvRow label="Passage prévu">{formatPlannedVisitFr(request.patient_planned_visit_date, request.patient_planned_visit_time)}</KvRow>
              ) : null}
            </CompactCardBody>
          </CompactCard>

          {note ? (
            <CompactCard>
              <CompactCardHeader title="Ton message" />
              <CompactCardBody className="whitespace-pre-wrap text-foreground">{note}</CompactCardBody>
            </CompactCard>
          ) : null}
        </div>
      </details>
    </PageShell>
  );
}
