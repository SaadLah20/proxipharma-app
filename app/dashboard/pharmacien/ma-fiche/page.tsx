"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageShell } from "@/components/ui/compact-shell";
import { supabase } from "@/lib/supabase";
import { PharmacyImageUploadField } from "@/components/pharmacy/pharmacy-image-upload-field";
import { loadPharmacistPharmacyId } from "@/lib/pharmacy-staff-context";
import type { PharmacyPublicProfileRow, PharmacyServiceCatalogRow } from "@/lib/pharmacy-profile-types";

export default function PharmacienMaFichePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [pharmacyId, setPharmacyId] = useState<string | null>(null);
  const [form, setForm] = useState({
    welcome_text: "",
    titular_name: "",
    titular_title: "Pharmacien titulaire",
    email: "",
    website_url: "",
    facebook_url: "",
    instagram_url: "",
    maps_url: "",
    cover_image_path: "",
    logo_url: "",
  });
  const [catalog, setCatalog] = useState<PharmacyServiceCatalogRow[]>([]);
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setMessage("");
    const ctx = await loadPharmacistPharmacyId();
    if (!ctx.pharmacyId) {
      setMessage(ctx.error ?? "Erreur");
      setLoading(false);
      return;
    }
    setPharmacyId(ctx.pharmacyId);

    const [phRes, catRes, svcRes] = await Promise.all([
      supabase
        .from("pharmacies")
        .select(
          "id,nom,ville,adresse,telephone,welcome_text,titular_name,titular_title,email,website_url,facebook_url,instagram_url,maps_url,cover_image_path,logo_url"
        )
        .eq("id", ctx.pharmacyId)
        .maybeSingle(),
      supabase.from("pharmacy_service_catalog").select("id,label_fr").eq("is_active", true).order("sort_order"),
      supabase.from("pharmacy_services").select("service_id").eq("pharmacy_id", ctx.pharmacyId),
    ]);

    const ph = phRes.data as PharmacyPublicProfileRow | null;
    if (ph) {
      setForm({
        welcome_text: ph.welcome_text ?? "",
        titular_name: ph.titular_name ?? "",
        titular_title: ph.titular_title ?? "Pharmacien titulaire",
        email: ph.email ?? "",
        website_url: ph.website_url ?? "",
        facebook_url: ph.facebook_url ?? "",
        instagram_url: ph.instagram_url ?? "",
        maps_url: ph.maps_url ?? "",
        cover_image_path: ph.cover_image_path ?? "",
        logo_url: ph.logo_url ?? "",
      });
    }
    setCatalog((catRes.data ?? []) as PharmacyServiceCatalogRow[]);
    setSelectedServices(new Set((svcRes.data ?? []).map((r: { service_id: string }) => r.service_id)));
    setLoading(false);
  }, []);

  useEffect(() => {
    const tid = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(tid);
  }, [load]);

  useEffect(() => {
    const run = async () => {
      const { data: auth } = await supabase.auth.getSession();
      if (!auth.session?.user) router.replace("/auth?redirect=/dashboard/pharmacien/ma-fiche");
    };
    void run();
  }, [router]);

  const save = async () => {
    if (!pharmacyId) return;
    setBusy(true);
    setMessage("");
    const { error } = await supabase
      .from("pharmacies")
      .update({
        welcome_text: form.welcome_text.trim() || null,
        titular_name: form.titular_name.trim() || null,
        titular_title: form.titular_title.trim() || "Pharmacien titulaire",
        email: form.email.trim() || null,
        website_url: form.website_url.trim() || null,
        facebook_url: form.facebook_url.trim() || null,
        instagram_url: form.instagram_url.trim() || null,
        maps_url: form.maps_url.trim() || null,
        cover_image_path: form.cover_image_path.trim() || null,
        logo_url: form.logo_url.trim() || null,
      })
      .eq("id", pharmacyId);

    if (error) {
      setBusy(false);
      setMessage(error.message);
      return;
    }

    await supabase.from("pharmacy_services").delete().eq("pharmacy_id", pharmacyId);
    const inserts = [...selectedServices].map((service_id) => ({ pharmacy_id: pharmacyId, service_id }));
    if (inserts.length > 0) {
      const { error: se } = await supabase.from("pharmacy_services").insert(inserts);
      if (se) {
        setBusy(false);
        setMessage(se.message);
        return;
      }
    }
    setBusy(false);
    setMessage("Fiche enregistrée.");
  };

  const persistImageColumn = async (column: "cover_image_path" | "logo_url", path: string) => {
    if (!pharmacyId) return;
    const value = path.trim() || null;
    const { error } = await supabase.from("pharmacies").update({ [column]: value }).eq("id", pharmacyId);
    if (error) setMessage(error.message);
    else setMessage(column === "cover_image_path" ? "Couverture enregistrée." : "Logo enregistré.");
  };

  const toggleService = (id: string) => {
    setSelectedServices((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) {
    return (
      <PageShell maxWidthClass="max-w-4xl">
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </PageShell>
    );
  }

  return (
    <PageShell maxWidthClass="max-w-4xl" className="space-y-4">
      <div>
        <Link href="/" className="text-xs font-medium text-primary underline">
          ← Annuaire
        </Link>
        <h1 className="mt-2 text-lg font-bold">Ma fiche pharmacie</h1>
        <p className="text-xs text-muted-foreground">
          Texte d&apos;accueil, coordonnées étendues et services affichés dans l&apos;onglet Informations.
        </p>
        <Link
          href="/dashboard/pharmacien/horaires-garde"
          className="mt-2 inline-block text-sm font-medium text-amber-800 underline"
        >
          Horaires et garde →
        </Link>
      </div>

      {message ? <p className="rounded-lg bg-sky-50 p-2 text-sm text-sky-950">{message}</p> : null}

      <section className="rounded-lg border bg-card p-4 shadow-sm space-y-3">
        <h2 className="text-sm font-bold">Informations publiques</h2>
        <label className="block text-xs">
          Message d&apos;accueil
          <textarea
            rows={3}
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            value={form.welcome_text}
            onChange={(e) => setForm((f) => ({ ...f, welcome_text: e.target.value }))}
          />
        </label>
        <label className="block text-xs">
          Pharmacien titulaire
          <input
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            value={form.titular_name}
            onChange={(e) => setForm((f) => ({ ...f, titular_name: e.target.value }))}
          />
        </label>
        {pharmacyId ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <PharmacyImageUploadField
              pharmacyId={pharmacyId}
              kind="cover"
              label="Photo de couverture"
              hint="Bannière en tête de la fiche publique (format paysage recommandé)."
              storedPath={form.cover_image_path}
              onStoredPathChange={(cover_image_path) => {
                setForm((f) => ({ ...f, cover_image_path }));
                void persistImageColumn("cover_image_path", cover_image_path);
              }}
              aspectClass="aspect-[21/9]"
            />
            <PharmacyImageUploadField
              pharmacyId={pharmacyId}
              kind="logo"
              label="Logo officine"
              hint="Affiché sur la fiche publique (carré, fond transparent si possible)."
              storedPath={form.logo_url}
              onStoredPathChange={(logo_url) => {
                setForm((f) => ({ ...f, logo_url }));
                void persistImageColumn("logo_url", logo_url);
              }}
              aspectClass="aspect-square"
            />
          </div>
        ) : null}
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-xs">
            E-mail
            <input
              type="email"
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </label>
          <label className="text-xs">
            Site web
            <input
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
              value={form.website_url}
              onChange={(e) => setForm((f) => ({ ...f, website_url: e.target.value }))}
            />
          </label>
          <label className="text-xs">
            Facebook
            <input
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
              value={form.facebook_url}
              onChange={(e) => setForm((f) => ({ ...f, facebook_url: e.target.value }))}
            />
          </label>
          <label className="text-xs">
            Instagram
            <input
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
              value={form.instagram_url}
              onChange={(e) => setForm((f) => ({ ...f, instagram_url: e.target.value }))}
            />
          </label>
          <label className="text-xs sm:col-span-2">
            Lien carte (Google Maps)
            <input
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
              value={form.maps_url}
              onChange={(e) => setForm((f) => ({ ...f, maps_url: e.target.value }))}
            />
          </label>
        </div>
      </section>

      <section className="rounded-lg border bg-card p-4 shadow-sm">
        <h2 className="text-sm font-bold">Services en officine</h2>
        <ul className="mt-2 flex flex-wrap gap-2">
          {catalog.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => toggleService(s.id)}
                className={
                  selectedServices.has(s.id)
                    ? "rounded-full border border-emerald-400 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-950"
                    : "rounded-full border border-border bg-muted/30 px-2 py-1 text-[11px] text-muted-foreground"
                }
              >
                {s.label_fr}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <button
        type="button"
        disabled={busy}
        onClick={() => void save()}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        Enregistrer
      </button>

      {pharmacyId ? (
        <Link href={`/pharmacie/${pharmacyId}`} className="block text-sm font-medium text-emerald-800 underline">
          Voir la fiche publique
        </Link>
      ) : null}
    </PageShell>
  );
}
