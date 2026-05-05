"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, MousePointerClick, Phone } from "lucide-react";
import { PageShell } from "@/components/ui/compact-shell";
import { isPharmacyEngagementTableUnavailable } from "@/lib/pharmacy-engagement";
import { supabase } from "@/lib/supabase";

type Row = {
  id: string;
  created_at: string;
  event_type: string;
  source: string;
};

const EVENT_LABEL: Record<string, string> = {
  profile_view: "Vue de la fiche",
  phone_click: "Clic appeler",
  whatsapp_click: "Clic WhatsApp",
};

const SOURCE_LABEL: Record<string, string> = {
  annuaire: "Liste annuaire",
  profile: "Page fiche",
};

export default function PharmacienVisitesInteractionsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mutedNote, setMutedNote] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [pharmacyNom, setPharmacyNom] = useState("");

  const load = useCallback(async () => {
    setError("");
    const { data: auth } = await supabase.auth.getSession();
    const user = auth.session?.user;
    if (!user) {
      router.replace("/auth?redirect=/dashboard/pharmacien/visites-interactions");
      return;
    }

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if ((profile as { role?: string } | null)?.role !== "pharmacien") {
      setError("Cet écran est réservé aux pharmaciens.");
      setLoading(false);
      return;
    }

    const { data: staff, error: se } = await supabase
      .from("pharmacy_staff")
      .select("pharmacy_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (se || !staff?.pharmacy_id) {
      setError(se?.message ?? "Aucune pharmacie liée.");
      setLoading(false);
      return;
    }

    const { data: ph } = await supabase.from("pharmacies").select("nom").eq("id", staff.pharmacy_id).maybeSingle();
    setPharmacyNom(((ph as { nom?: string } | null)?.nom ?? "").trim() || "Votre officine");

    const { data, error: re } = await supabase
      .from("pharmacy_engagement_events")
      .select("id,created_at,event_type,source")
      .eq("pharmacy_id", staff.pharmacy_id)
      .order("created_at", { ascending: false })
      .limit(200);

    if (re) {
      if (isPharmacyEngagementTableUnavailable(re.message)) {
        setRows([]);
        setMutedNote(
          "Table « pharmacy_engagement_events » introuvable : appliquez la migration `20260505_003_rich_notifications_pharmacy_engagement.sql` sur Supabase."
        );
      } else {
        setMutedNote("");
        setError(re.message);
      }
    } else {
      setMutedNote("");
      setRows((data ?? []) as Row[]);
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    const tid = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(tid);
  }, [load]);

  const totals = useMemo(() => {
    let v = 0;
    let p = 0;
    let w = 0;
    for (const r of rows) {
      if (r.event_type === "profile_view") v += 1;
      else if (r.event_type === "phone_click") p += 1;
      else if (r.event_type === "whatsapp_click") w += 1;
    }
    return { v, p, w };
  }, [rows]);

  if (loading) {
    return (
      <PageShell maxWidthClass="max-w-4xl">
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </PageShell>
    );
  }

  return (
    <PageShell maxWidthClass="max-w-4xl" className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link href="/" className="text-xs font-medium text-sky-800 underline">
            ← Annuaire
          </Link>
          <h1 className="mt-2 text-lg font-bold text-foreground">Visites et interactions</h1>
          <p className="text-xs text-muted-foreground">
            Audiences de votre fiche publique et clics sur les boutons téléphone / WhatsApp — hors flux des demandes
            produits.
          </p>
          <p className="mt-1 text-xs font-medium text-emerald-900">{pharmacyNom}</p>
        </div>
        <Link
          href="/dashboard/pharmacien"
          className="shrink-0 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold shadow-sm hover:bg-muted/50"
        >
          Tableau de bord
        </Link>
      </div>

      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      {mutedNote && !error ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50/90 p-3 text-sm text-amber-950">{mutedNote}</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="rounded-lg bg-sky-100 p-2 text-sky-800">
            <Eye className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Vues fiche</p>
            <p className="text-xl font-bold tabular-nums">{totals.v}</p>
            <p className="text-[10px] text-muted-foreground">Derniers enregistrements listés</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="rounded-lg bg-amber-100 p-2 text-amber-900">
            <Phone className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Clics téléphone</p>
            <p className="text-xl font-bold tabular-nums">{totals.p}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="rounded-lg bg-emerald-100 p-2 text-emerald-900">
            <MousePointerClick className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Clics WhatsApp</p>
            <p className="text-xl font-bold tabular-nums">{totals.w}</p>
          </div>
        </div>
      </div>

      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Activité récente</h2>
          <p className="text-[11px] text-muted-foreground">Jusqu’à 200 événements — les visiteurs ne sont pas identifiés.</p>
        </div>
        {rows.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Aucun événement pour l’instant. Les consultations de fiche et les clics apparaîtront automatiquement.
          </p>
        ) : (
          <ul className="max-h-[28rem] divide-y divide-border overflow-y-auto">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                <div>
                  <p className="font-medium text-foreground">
                    {EVENT_LABEL[r.event_type] ?? r.event_type}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      ({SOURCE_LABEL[r.source] ?? r.source})
                    </span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(r.created_at).toLocaleString("fr-FR", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageShell>
  );
}
