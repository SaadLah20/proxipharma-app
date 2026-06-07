"use client";

import { Mail, MessageCircle, MessageSquare, Phone } from "lucide-react";

export type PharmacistPatientContactInfo = {
  full_name?: string | null;
  patient_ref?: string | null;
  whatsapp?: string | null;
  email?: string | null;
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

const contactIconBtn =
  "inline-flex size-9 items-center justify-center rounded-lg border border-border/80 bg-card text-foreground shadow-sm transition hover:bg-muted/40";

export function PharmacistPatientQuickContact({
  patient,
  requestRef,
  variant = "default",
}: {
  patient: PharmacistPatientContactInfo;
  requestRef: string;
  variant?: "default" | "iconsOnly";
}) {
  const telRaw = patient.whatsapp?.trim() ?? "";
  const digits = telRaw.replace(/\D/g, "");
  const telOk = digits.length >= 8 || telRaw.length >= 8;
  const mail = patient.email?.trim() ?? "";
  const mailOk = mail.length > 4 && mail.includes("@");

  const mailHref = mailOk
    ? `mailto:${mail}?subject=${encodeURIComponent(`Dossier ${requestRef}`)}&body=${encodeURIComponent(
        `Bonjour,\n\nConcernant le dossier ${requestRef} :\n\n`,
      )}`
    : "";

  const loc = [patient.full_name?.trim(), patient.patient_ref?.trim()].filter(Boolean).join(" · ");

  const iconButtons = (
    <>
      {telOk ? (
        <>
          <a
            href={telHrefPatient(telRaw)}
            className={contactIconBtn}
            title="Appeler"
            aria-label="Appeler le patient"
          >
            <Phone className="size-4 shrink-0" strokeWidth={2} aria-hidden />
          </a>
          <a
            href={smsHrefPatient(telRaw)}
            className={contactIconBtn}
            title="SMS"
            aria-label="Envoyer un SMS"
          >
            <MessageSquare className="size-4 shrink-0" strokeWidth={2} aria-hidden />
          </a>
          <a
            href={whatsappHrefPatient(telRaw)}
            target="_blank"
            rel="noreferrer"
            className={contactIconBtn}
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
          className={contactIconBtn}
          title="Courriel"
          aria-label="Écrire au patient"
        >
          <Mail className="size-4 shrink-0" strokeWidth={2} aria-hidden />
        </a>
      ) : null}
    </>
  );

  if (variant === "iconsOnly") {
    if (!telOk && !mailOk) {
      return (
        <p className="text-[9px] leading-snug text-muted-foreground">
          Coordonnées non renseignées sur le dossier — rapprochez-vous du patient.
        </p>
      );
    }
    return <div className="flex flex-wrap items-center gap-1.5">{iconButtons}</div>;
  }

  return (
    <section className="rounded-xl border border-border/80 bg-muted/20 p-2.5 shadow-sm">
      <h3 className="text-[10px] font-bold uppercase tracking-wide text-foreground">Contacter le patient</h3>
      {loc ? <p className="mt-1 text-[11px] font-semibold leading-snug text-foreground">{loc}</p> : null}
      {telOk || mailOk ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">{iconButtons}</div>
      ) : (
        <p className="mt-1.5 text-[9px] leading-snug text-muted-foreground">
          Coordonnées non renseignées sur le dossier — rapprochez-vous du patient.
        </p>
      )}
    </section>
  );
}
