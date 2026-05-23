"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Gift, Mail, MessageSquare, Package, Phone, User } from "lucide-react";
import { PageShell } from "@/components/ui/compact-shell";
import { PHARMACIST_DASHBOARD_BUCKETS } from "@/lib/demandes-hub-buckets";
import {
  formatActivityFr,
  parsePharmacistPatientDetail,
  patientPromoDetailPath,
  patientRequestDetailPath,
  promoStatusLabelFr,
  type PharmacistPatientDetail,
  whatsappHref,
} from "@/lib/pharmacist-patient-crm";
import { getRequestKindConfig } from "@/lib/request-kinds/registry";
import { supabase } from "@/lib/supabase";

function requestStatusLabelFr(status: string): string {
  const bucket = PHARMACIST_DASHBOARD_BUCKETS.find((b) => b.statuses.includes(status));
  if (bucket) return bucket.label;
  return status;
}

export function PharmacistPatientDetail({ patientId }: { patientId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<PharmacistPatientDetail | null>(null);

  const load = useCallback(async () => {
    setError("");
    const { data: auth } = await supabase.auth.getSession();
    const user = auth.session?.user;
    if (!user) {
      router.replace(`/auth?redirect=/dashboard/pharmacien/clients/${patientId}`);
      return;
    }

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if ((profile as { role?: string } | null)?.role !== "pharmacien") {
      setError("Accès réservé aux pharmaciens.");
      setLoading(false);
      return;
    }

    const { data, error: rpcErr } = await supabase.rpc("pharmacist_patient_detail", {
      p_patient_id: patientId,
    });

    if (rpcErr) {
      if (rpcErr.message.includes("pharmacist_patient_detail")) {
        setError("Fiche client indisponible : appliquez la migration `20260616_001_pharmacist_dashboard_patient_crm.sql`.");
      } else {
        setError(rpcErr.message);
      }
      setDetail(null);
    } else {
      const parsed = parsePharmacistPatientDetail(data);
      if (!parsed) {
        setError("Client introuvable ou non lié à votre officine.");
      } else {
        setDetail(parsed);
      }
    }
    setLoading(false);
  }, [router, patientId]);

  useEffect(() => {
    const tid = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(tid);
  }, [load]);

  if (loading) {
    return (
      <PageShell maxWidthClass="max-w-3xl">
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </PageShell>
    );
  }

  if (error || !detail) {
    return (
      <PageShell maxWidthClass="max-w-3xl" className="space-y-4">
        <Link href="/dashboard/pharmacien/clients" className="text-xs font-medium text-emerald-900 underline">
          ← Clients
        </Link>
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error || "Client introuvable."}</p>
      </PageShell>
    );
  }

  const { contact } = detail;
  const wa = whatsappHref(contact.whatsapp);
  const activeRequests = detail.requests.filter((r) =>
    ["submitted", "in_review", "responded", "confirmed", "treated"].includes(r.status)
  );

  return (
    <PageShell maxWidthClass="max-w-3xl" className="space-y-5">
      <Link href="/dashboard/pharmacien/clients" className="text-xs font-medium text-emerald-900 underline">
        ← Clients
      </Link>

      <header className="rounded-2xl border border-border/80 bg-gradient-to-br from-emerald-500/10 via-card to-card p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-background/90 shadow-inner">
            <User className="h-6 w-6 text-emerald-800" />
          </div>
          <div className="min-w-0 flex-1">
            {contact.patient_ref?.trim() ? (
              <p className="font-mono text-xs font-bold text-emerald-900">{contact.patient_ref.trim()}</p>
            ) : null}
            <h1 className="text-lg font-bold text-foreground">{contact.full_name?.trim() || "Patient"}</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {detail.requests.length} demande{detail.requests.length !== 1 ? "s" : ""}
              {detail.promo_reservations.length > 0
                ? ` · ${detail.promo_reservations.length} réservation${detail.promo_reservations.length > 1 ? "s" : ""} promo`
                : ""}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {wa ? (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-800"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              WhatsApp
            </a>
          ) : null}
          {contact.whatsapp ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/80 px-3 py-2 text-xs text-muted-foreground">
              <Phone className="h-3.5 w-3.5" />
              {contact.whatsapp}
            </span>
          ) : null}
          {contact.email ? (
            <a
              href={`mailto:${contact.email}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/80 px-3 py-2 text-xs font-medium hover:bg-muted/40"
            >
              <Mail className="h-3.5 w-3.5" />
              {contact.email}
            </a>
          ) : null}
        </div>
      </header>

      {activeRequests.length > 0 ? (
        <section className="rounded-xl border border-amber-200/80 bg-amber-50/40 p-3">
          <h2 className="text-xs font-bold uppercase tracking-wide text-amber-950">Dossiers en cours</h2>
          <ul className="mt-2 space-y-1.5">
            {activeRequests.slice(0, 5).map((r) => (
              <li key={r.id}>
                <Link
                  href={patientRequestDetailPath(r.request_type, r.id)}
                  className="flex items-center justify-between gap-2 rounded-lg bg-background/80 px-2.5 py-2 text-sm hover:bg-background"
                >
                  <span className="min-w-0 truncate font-medium">
                    {r.request_public_ref?.trim() || getRequestKindConfig(r.request_type).theme.headerLabelShort}
                  </span>
                  <span className="shrink-0 text-[11px] text-amber-900">{requestStatusLabelFr(r.status)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Package className="h-4 w-4 text-sky-700" />
            Historique des demandes
          </h2>
        </div>
        {detail.requests.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Aucune demande.</p>
        ) : (
          <ul className="divide-y divide-border">
            {detail.requests.map((r) => (
              <li key={r.id}>
                <Link
                  href={patientRequestDetailPath(r.request_type, r.id)}
                  className="flex items-center gap-3 px-4 py-3 transition hover:bg-muted/30"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">
                      {r.request_public_ref?.trim() ||
                        getRequestKindConfig(r.request_type).theme.headerLabelShort}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {getRequestKindConfig(r.request_type).theme.headerLabelShort} · {requestStatusLabelFr(r.status)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Màj. {formatActivityFr(r.updated_at)}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {detail.promo_reservations.length > 0 ? (
        <section className="rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Gift className="h-4 w-4 text-violet-700" />
              Réservations packs promo
            </h2>
          </div>
          <ul className="divide-y divide-border">
            {detail.promo_reservations.map((pr) => (
              <li key={pr.id}>
                <Link
                  href={patientPromoDetailPath(pr.id)}
                  className="flex items-center gap-3 px-4 py-3 transition hover:bg-muted/30"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">
                      {pr.public_ref?.trim() || "Réservation promo"}
                      {pr.offer_title ? (
                        <span className="ml-1 font-normal text-muted-foreground">· {pr.offer_title}</span>
                      ) : null}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {promoStatusLabelFr(pr.status)} · Retrait{" "}
                      {new Date(pr.pickup_date).toLocaleDateString("fr-FR", { timeZone: "Africa/Casablanca" })}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </PageShell>
  );
}
