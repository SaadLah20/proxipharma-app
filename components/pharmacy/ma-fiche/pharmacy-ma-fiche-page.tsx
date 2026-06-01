"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { useRouter } from "next/navigation";
import {
  Building2,
  CalendarRange,
  ExternalLink,
  Eye,
  EyeOff,
  ImageIcon,
  LayoutGrid,
  Link2,
  MapPin,
  MessageSquareText,
} from "lucide-react";
import { PharmacistAccountPageHeader } from "@/components/pharmacist/pharmacist-account-page-header";
import { CompactCard, CompactCardBody, PageShell } from "@/components/ui/compact-shell";
import { PlatformStickyFooter } from "@/components/layout/platform-sticky-footer";
import { stickyFooterPadClass } from "@/lib/platform-sticky-footer";
import { platformDashboardChrome as chrome } from "@/lib/platform-dashboard-chrome";
import { PharmacyFormField } from "@/components/pharmacy/pharmacy-form-field";
import { PharmacyImageUploadField } from "@/components/pharmacy/pharmacy-image-upload-field";
import { PharmacySegmentTabs } from "@/components/pharmacy/pharmacy-segment-tabs";
import { PharmacyServicesPicker } from "@/components/pharmacy/ma-fiche/pharmacy-services-picker";
import { ScheduleToast, type ScheduleToastTone } from "@/components/pharmacy/schedule/schedule-toast";
import { PHARMACY_COVER_UPLOAD_HINT, PHARMACY_LOGO_UPLOAD_HINT } from "@/lib/pharmacy-cover-spec";
import {
  PHARMACY_CONTACT_FIELDS,
  validatePharmacyContactForm,
  type PharmacyContactFieldKey,
  type PharmacyContactForm,
} from "@/lib/pharmacy-contact-fields";
import {
  PHARMACY_FORM_FIELDS,
  normalizeOptionalUrl,
  validatePharmacyProfileForm,
  type PharmacyFieldKey,
} from "@/lib/pharmacy-form-fields";
import { normalizePhoneToE164 } from "@/lib/phone-e164";
import { loadPharmacistPharmacyId } from "@/lib/pharmacy-staff-context";
import { supabase } from "@/lib/supabase";
import type { PharmacyPublicProfileRow, PharmacyServiceCatalogRow } from "@/lib/pharmacy-profile-types";

type MaFicheTab = "contact" | "welcome" | "visual" | "links" | "services";

const MA_FICHE_TABS = [
  { id: "contact" as const, label: "Coordonnées", icon: Building2 },
  { id: "welcome" as const, label: "Accueil", icon: MessageSquareText },
  { id: "visual" as const, label: "Photos", icon: ImageIcon },
  { id: "links" as const, label: "Liens", icon: Link2 },
  { id: "services" as const, label: "Services", icon: LayoutGrid },
];

const LINK_FIELDS: PharmacyFieldKey[] = ["email", "website_url", "facebook_url", "instagram_url", "maps_url"];

type ProfileForm = Record<PharmacyFieldKey, string> & {
  cover_image_path: string;
  logo_url: string;
};

const EMPTY_FORM: ProfileForm = {
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
};

export function PharmacyMaFichePage() {
  const router = useRouter();
  const [tab, setTab] = useState<MaFicheTab>("contact");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: ScheduleToastTone }>({ message: "", tone: "info" });
  const [pharmacyId, setPharmacyId] = useState<string | null>(null);
  const [contactForm, setContactForm] = useState<PharmacyContactForm>({
    nom: "",
    adresse: "",
    ville: "",
    telephone: "",
    whatsapp: "",
  });
  const [titularPublic, setTitularPublic] = useState(true);
  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM);
  const [catalog, setCatalog] = useState<PharmacyServiceCatalogRow[]>([]);
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());

  const showToast = useCallback((message: string, tone: ScheduleToastTone = "info") => {
    setToast({ message, tone });
  }, []);

  const load = useCallback(async () => {
    const ctx = await loadPharmacistPharmacyId();
    if (!ctx.pharmacyId) {
      showToast(ctx.error ?? "Erreur", "error");
      setLoading(false);
      return;
    }
    setPharmacyId(ctx.pharmacyId);

    const [phRes, catRes, svcRes, ownerStaffRes] = await Promise.all([
      supabase
        .from("pharmacies")
        .select(
          "id,nom,ville,adresse,telephone,whatsapp,welcome_text,titular_name,titular_title,titular_public,email,website_url,facebook_url,instagram_url,maps_url,cover_image_path,logo_url"
        )
        .eq("id", ctx.pharmacyId)
        .maybeSingle(),
      supabase.from("pharmacy_service_catalog").select("id,label_fr").eq("is_active", true).order("sort_order"),
      supabase.from("pharmacy_services").select("service_id").eq("pharmacy_id", ctx.pharmacyId),
      supabase
        .from("pharmacy_staff")
        .select("user_id")
        .eq("pharmacy_id", ctx.pharmacyId)
        .eq("is_owner", true)
        .limit(1)
        .maybeSingle(),
    ]);

    const ph = phRes.data as PharmacyPublicProfileRow | null;
    let ownerFullName = "";
    const ownerUserId = (ownerStaffRes.data as { user_id?: string } | null)?.user_id;
    if (ownerUserId) {
      const { data: ownerProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", ownerUserId)
        .maybeSingle();
      ownerFullName = ((ownerProfile as { full_name?: string | null } | null)?.full_name ?? "").trim();
    }

    if (ph) {
      setContactForm({
        nom: ph.nom ?? "",
        adresse: ph.adresse ?? "",
        ville: ph.ville ?? "",
        telephone: ph.telephone ?? "",
        whatsapp: ph.whatsapp ?? "",
      });
      setTitularPublic(ph.titular_public !== false);
      const titularFromPharmacy = ph.titular_name?.trim() ?? "";
      setForm({
        welcome_text: ph.welcome_text ?? "",
        titular_name: titularFromPharmacy || ownerFullName,
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
  }, [showToast]);

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
    const contactError = validatePharmacyContactForm(contactForm);
    if (contactError) {
      showToast(contactError, "error");
      return;
    }
    const validationError = validatePharmacyProfileForm(form);
    if (validationError) {
      showToast(validationError, "error");
      return;
    }
    const whatsappE164 = contactForm.whatsapp.trim()
      ? normalizePhoneToE164(contactForm.whatsapp)
      : null;
    if (contactForm.whatsapp.trim() && !whatsappE164) {
      showToast("Numéro WhatsApp invalide (ex. 0612345678 ou +212612345678).", "error");
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("pharmacies")
      .update({
        nom: contactForm.nom.trim(),
        adresse: contactForm.adresse.trim(),
        ville: contactForm.ville.trim(),
        telephone: contactForm.telephone.trim() || null,
        whatsapp: whatsappE164,
        welcome_text: form.welcome_text.trim() || null,
        titular_name: form.titular_name.trim() || null,
        titular_title: form.titular_title.trim() || "Pharmacien titulaire",
        titular_public: titularPublic,
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
      showToast(error.message, "error");
      return;
    }

    await supabase.from("pharmacy_services").delete().eq("pharmacy_id", pharmacyId);
    const inserts = [...selectedServices].map((service_id) => ({ pharmacy_id: pharmacyId, service_id }));
    if (inserts.length > 0) {
      const { error: se } = await supabase.from("pharmacy_services").insert(inserts);
      if (se) {
        setBusy(false);
        showToast(se.message, "error");
        return;
      }
    }
    setBusy(false);
    showToast("Fiche enregistrée — visible sur la fiche publique.", "success");
  };

  const persistImageColumn = async (column: "cover_image_path" | "logo_url", path: string) => {
    if (!pharmacyId) return false;
    const value = path.trim() || null;
    const { error } = await supabase.from("pharmacies").update({ [column]: value }).eq("id", pharmacyId);
    if (error) {
      showToast(error.message, "error");
      return false;
    }
    showToast(column === "cover_image_path" ? "Couverture enregistrée." : "Logo enregistré.", "success");
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

  const welcomeChars = form.welcome_text.length;
  const welcomeMax = PHARMACY_FORM_FIELDS.welcome_text.maxLength ?? 500;

  if (loading) {
    return (
      <PageShell maxWidthClass="max-w-4xl">
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </PageShell>
    );
  }

  return (
    <PageShell maxWidthClass="max-w-4xl" className={clsx("space-y-4", stickyFooterPadClass("tall"))}>
      <header className="space-y-3">
        <PharmacistAccountPageHeader
          eyebrow="Officine & visibilité"
          title="Ma fiche publique"
          subtitle="Contenu affiché sur votre fiche publique (onglet Informations et en-tête)."
          pharmacyName={contactForm.nom.trim() || undefined}
          trailing={
            pharmacyId ? (
              <Link
                href={`/pharmacie/${pharmacyId}`}
                target="_blank"
                rel="noopener noreferrer"
                className={clsx("inline-flex min-h-10 items-center gap-1.5 px-3 py-2", chrome.ctaOutline)}
              >
                <ExternalLink className="size-3.5" aria-hidden />
                Aperçu public
              </Link>
            ) : null
          }
        />

        <Link
          href="/dashboard/pharmacien/horaires-garde"
          className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-amber-200/80 bg-amber-50/50 px-3 py-2.5 text-sm font-semibold text-amber-950 sm:w-auto"
        >
          <CalendarRange className="size-4 shrink-0" aria-hidden />
          Horaires et garde
        </Link>
      </header>

      <ScheduleToast
        message={toast.message}
        tone={toast.tone}
        onDismiss={() => setToast({ message: "", tone: "info" })}
      />

      <CompactCard>
        <PharmacySegmentTabs
          tabs={MA_FICHE_TABS}
          active={tab}
          onChange={setTab}
          ariaLabel="Sections de la fiche"
          columnClass="grid-cols-5"
        />

        <CompactCardBody className="space-y-4">
          {tab === "contact" ? (
            <div className="space-y-4">
              <p className="rounded-lg bg-muted/30 px-2.5 py-2 text-[11px] leading-snug text-muted-foreground">
                Coordonnées affichées sur la fiche publique et l&apos;annuaire. La position GPS reste gérée par
                l&apos;administration.
              </p>
              {(["nom", "adresse", "ville", "telephone", "whatsapp"] as PharmacyContactFieldKey[]).map((key) => (
                <PharmacyFormField
                  key={key}
                  meta={PHARMACY_CONTACT_FIELDS[key]}
                  value={contactForm[key]}
                  onChange={(v) => setContactForm((f) => ({ ...f, [key]: v }))}
                />
              ))}
            </div>
          ) : null}

          {tab === "welcome" ? (
            <div className="space-y-4">
              <p className="rounded-lg bg-muted/30 px-2.5 py-2 text-[11px] leading-snug text-muted-foreground">
                Message d&apos;accueil et identité du titulaire — visibles dans l&apos;onglet <strong>Informations</strong>{" "}
                de la fiche publique.
              </p>
              {(["welcome_text", "titular_name", "titular_title"] as PharmacyFieldKey[]).map((key) => (
                <PharmacyFormField
                  key={key}
                  meta={PHARMACY_FORM_FIELDS[key]}
                  value={form[key]}
                  onChange={(v) => setForm((f) => ({ ...f, [key]: v }))}
                />
              ))}
              <div className="rounded-xl border border-border/80 bg-muted/20 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-foreground">Afficher le titulaire sur la fiche publique</p>
                    <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
                      Le nom et le titre restent enregistrés même si l&apos;affichage public est désactivé.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={titularPublic}
                    onClick={() => setTitularPublic((v) => !v)}
                    className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-colors ${
                      titularPublic
                        ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                        : "border-border bg-card text-muted-foreground"
                    }`}
                  >
                    {titularPublic ? (
                      <>
                        <Eye className="size-3.5" aria-hidden />
                        Visible
                      </>
                    ) : (
                      <>
                        <EyeOff className="size-3.5" aria-hidden />
                        Masqué
                      </>
                    )}
                  </button>
                </div>
              </div>
              <p className="text-right text-[10px] tabular-nums text-muted-foreground">
                {welcomeChars} / {welcomeMax} caractères
              </p>
            </div>
          ) : null}

          {tab === "visual" && pharmacyId ? (
            <div className="space-y-4">
              <p className="rounded-lg bg-muted/30 px-2.5 py-2 text-[11px] leading-snug text-muted-foreground">
                La couverture s&apos;affiche en haut de la fiche ; le logo apparaît sur la carte et l&apos;en-tête.
                Les photos sont enregistrées dès l&apos;envoi.
              </p>
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
              <div className="mx-auto max-w-[200px]">
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
            </div>
          ) : null}

          {tab === "links" ? (
            <div className="space-y-4">
              <p className="rounded-lg bg-muted/30 px-2.5 py-2 text-[11px] leading-snug text-muted-foreground">
                Liens optionnels affichés dans la grille de contact. Vous pouvez coller l&apos;adresse sans{" "}
                <code className="text-[10px]">https://</code> — elle sera ajoutée à l&apos;enregistrement.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {LINK_FIELDS.map((key) => (
                  <div key={key} className={key === "maps_url" ? "sm:col-span-2" : undefined}>
                    <PharmacyFormField
                      meta={PHARMACY_FORM_FIELDS[key]}
                      value={form[key]}
                      onChange={(v) => setForm((f) => ({ ...f, [key]: v }))}
                    />
                  </div>
                ))}
              </div>
              {form.maps_url.trim() ? (
                <p className="flex items-start gap-2 text-[11px] text-muted-foreground">
                  <MapPin className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                  Le lien carte aide les patients à vous trouver depuis la fiche publique.
                </p>
              ) : null}
            </div>
          ) : null}

          {tab === "services" ? (
            <div className="space-y-3">
              <p className="text-[11px] leading-snug text-muted-foreground">
                Touchez pour activer ou désactiver. Les services choisis apparaissent sur l&apos;onglet{" "}
                <strong>Services</strong> de la fiche publique.
              </p>
              <PharmacyServicesPicker catalog={catalog} selected={selectedServices} onToggle={toggleService} />
              <p className="text-[10px] tabular-nums text-muted-foreground">
                {selectedServices.size} service{selectedServices.size > 1 ? "s" : ""} sélectionné
                {selectedServices.size > 1 ? "s" : ""}
              </p>
            </div>
          ) : null}
        </CompactCardBody>
      </CompactCard>

      <PlatformStickyFooter tone="neutral" width="3xl" innerClassName="!max-w-4xl">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            disabled={busy}
            onClick={() => void save()}
            className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground shadow-sm disabled:opacity-50 sm:w-auto sm:min-w-[12rem]"
          >
            {busy ? "Enregistrement…" : "Enregistrer la fiche"}
          </button>
          {pharmacyId ? (
            <Link
              href={`/pharmacie/${pharmacyId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center justify-center gap-1.5 text-center text-sm font-semibold text-emerald-800 underline"
            >
              Voir la fiche publique
              <ExternalLink className="size-3.5" aria-hidden />
            </Link>
          ) : null}
        </div>
      </PlatformStickyFooter>
    </PageShell>
  );
}
