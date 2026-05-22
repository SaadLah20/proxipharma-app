"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageShell } from "@/components/ui/compact-shell";
import { supabase } from "@/lib/supabase";
import { PharmacyFormField } from "@/components/pharmacy/pharmacy-form-field";
import { PharmacyImageUploadField } from "@/components/pharmacy/pharmacy-image-upload-field";
import { PHARMACY_COVER_UPLOAD_HINT, PHARMACY_LOGO_UPLOAD_HINT } from "@/lib/pharmacy-cover-spec";
import {
  PHARMACY_FORM_FIELDS,
  normalizeOptionalUrl,
  validatePharmacyProfileForm,
  type PharmacyFieldKey,
} from "@/lib/pharmacy-form-fields";
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
    const validationError = validatePharmacyProfileForm(form);
    if (validationError) {
      setMessage(validationError);
      return;
    }
    setBusy(true);
    setMessage("");
    const { error } = await supabase
      .from("pharmacies")
      .update({
        welcome_text: form.welcome_text.trim() || null,
        titular_name: form.titular_name.trim() || null,
        titular_title: form.titular_title.trim() || "Pharmacien titulaire",
        email: form.email.trim() || null,
        website_url: normalizeOptionalUrl(form.website_url),
        facebook_url: normalizeOptionalUrl(form.facebook_url),
        instagram_url: normalizeOptionalUrl(form.instagram_url),
        maps_url: normalizeOptionalUrl(form.maps_url),
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
    if (error) {
      setMessage(error.message);
      return false;
    }
    setMessage(column === "cover_image_path" ? "Couverture enregistrée." : "Logo enregistré.");
    return true;
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
        {(["welcome_text", "titular_name", "titular_title"] as PharmacyFieldKey[]).map((key) => (
          <PharmacyFormField
            key={key}
            meta={PHARMACY_FORM_FIELDS[key]}
            value={form[key]}
            onChange={(v) => setForm((f) => ({ ...f, [key]: v }))}
          />
        ))}
        {pharmacyId ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <PharmacyImageUploadField
              pharmacyId={pharmacyId}
              kind="cover"
              label="Photo de couverture"
              hint={PHARMACY_COVER_UPLOAD_HINT}
              storedPath={form.cover_image_path}
              onStoredPathChange={(cover_image_path) => {
                setForm((f) => {
                  const previous = f.cover_image_path;
                  void (async () => {
                    const ok = await persistImageColumn("cover_image_path", cover_image_path);
                    if (!ok) setForm((ff) => ({ ...ff, cover_image_path: previous }));
                  })();
                  return { ...f, cover_image_path };
                });
              }}
              aspectClass="aspect-[21/9]"
            />
            <PharmacyImageUploadField
              pharmacyId={pharmacyId}
              kind="logo"
              label="Logo officine"
              hint={PHARMACY_LOGO_UPLOAD_HINT}
              storedPath={form.logo_url}
              onStoredPathChange={(logo_url) => {
                setForm((f) => {
                  const previous = f.logo_url;
                  void (async () => {
                    const ok = await persistImageColumn("logo_url", logo_url);
                    if (!ok) setForm((ff) => ({ ...ff, logo_url: previous }));
                  })();
                  return { ...f, logo_url };
                });
              }}
              aspectClass="aspect-square"
            />
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          {(["email", "website_url", "facebook_url", "instagram_url", "maps_url"] as PharmacyFieldKey[]).map(
            (key) => (
              <div key={key} className={key === "maps_url" ? "sm:col-span-2" : undefined}>
                <PharmacyFormField
                  meta={PHARMACY_FORM_FIELDS[key]}
                  value={form[key]}
                  onChange={(v) => setForm((f) => ({ ...f, [key]: v }))}
                />
              </div>
            )
          )}
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
