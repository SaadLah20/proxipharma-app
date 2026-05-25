"use client";

import { Mail, MessageCircle, MessageSquare, Phone } from "lucide-react";
import { pharmacyPublicLabel } from "@/lib/pharmacy-public-label";

export type PatientPharmacyContactInfo = {
  nom: string;
  ville?: string | null;
  telephone?: string | null;
  contact_email?: string | null;
  public_ref?: string | null;
};

function telHrefPatient(raw: string): string {
  const d = raw.replace(/\D/g, "");
  return d.length >= 8 ? `tel:${d}` : `tel:${raw.trim()}`;
}

function smsHrefPatient(raw: string): string {
  const d = raw.replace(/\D/g, "");
  return d.length >= 8 ? `sms:${d}` : `sms:${raw.trim()}`;
}

function whatsappHrefPatient(raw: string): string {
  const d = raw.replace(/\D/g, "");
  return `https://wa.me/${d}`;
}

export function PatientPharmacyQuickContact({
  pharmacy,
  requestRef,
  variant = "default",
}: {
  pharmacy: PatientPharmacyContactInfo;
  requestRef: string;
  variant?: "default" | "iconsOnly";
}) {
  const telRaw = pharmacy.telephone?.trim() ?? "";
  const digits = telRaw.replace(/\D/g, "");
  const telOk = digits.length >= 8 || telRaw.length >= 8;
  const mail = pharmacy.contact_email?.trim() ?? "";
  const mailOk = mail.length > 4 && mail.includes("@");

  const mailHref = mailOk
    ? `mailto:${mail}?subject=${encodeURIComponent(`Demande ${requestRef}`)}&body=${encodeURIComponent(
        `Bonjour,\n\nConcernant ma demande ${requestRef} :\n\n`
      )}`
    : "";

  const loc = [pharmacyPublicLabel(pharmacy.nom), pharmacy.ville?.trim()].filter(Boolean).join(" · ");

  const iconButtons = (
    <>
      {telOk ? (
        <>
          <a
            href={telHrefPatient(telRaw)}
            className="inline-flex size-9 items-center justify-center rounded-lg border border-emerald-400/70 bg-white text-emerald-900 shadow-sm transition hover:bg-emerald-50"
            title="Appeler"
            aria-label="Appeler la pharmacie"
          >
            <Phone className="size-4 shrink-0" strokeWidth={2} aria-hidden />
          </a>
          <a
            href={smsHrefPatient(telRaw)}
            className="inline-flex size-9 items-center justify-center rounded-lg border border-emerald-400/70 bg-white text-emerald-900 shadow-sm transition hover:bg-emerald-50"
            title="SMS"
            aria-label="Envoyer un SMS"
          >
            <MessageSquare className="size-4 shrink-0" strokeWidth={2} aria-hidden />
          </a>
          <a
            href={whatsappHrefPatient(telRaw)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex size-9 items-center justify-center rounded-lg border border-emerald-400/70 bg-white text-emerald-900 shadow-sm transition hover:bg-emerald-50"
            title="WhatsApp"
            aria-label="Discuter sur WhatsApp"
          >
            <MessageCircle className="size-4 shrink-0" strokeWidth={2} aria-hidden />
          </a>
        </>
      ) : null}
      {mailOk ? (
        <a
          href={mailHref}
          className="inline-flex size-9 items-center justify-center rounded-lg border border-sky-400/70 bg-white text-sky-900 shadow-sm transition hover:bg-sky-50"
          title="Courriel"
          aria-label="Écrire à la pharmacie"
        >
          <Mail className="size-4 shrink-0" strokeWidth={2} aria-hidden />
        </a>
      ) : null}
    </>
  );

  if (variant === "iconsOnly") {
    if (!telOk && !mailOk) {
      return (
        <p className="text-[9px] leading-snug text-emerald-900/80">
          Coordonnées non renseignées sur le dossier — rapprochez-vous de l&apos;officine.
        </p>
      );
    }
    return <div className="flex flex-wrap items-center gap-1.5">{iconButtons}</div>;
  }

  return (
    <section className="rounded-xl border border-emerald-300/60 bg-gradient-to-br from-emerald-50/85 via-white to-teal-50/40 p-2 shadow-sm ring-1 ring-emerald-200/45">
      <h3 className="text-[10px] font-bold uppercase tracking-wide text-emerald-950">Contacter l&apos;officine</h3>
      <p className="mt-1 text-[10px] leading-snug text-emerald-950/88">
        Pour un ajustement sur un produit déjà validé, contactez directement la pharmacie.
      </p>
      {loc ? <p className="mt-1 text-[11px] font-semibold leading-snug text-emerald-950">{loc}</p> : null}
      {telOk || mailOk ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">{iconButtons}</div>
      ) : (
        <p className="mt-1.5 text-[9px] leading-snug text-emerald-900/80">
          Coordonnées non renseignées sur le dossier — rapprochez-vous de l&apos;officine.
        </p>
      )}
    </section>
  );
}
