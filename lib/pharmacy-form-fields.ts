/** Libellés, aides et validation légère — fiche pharmacien. */

export type PharmacyFieldKey =
  | "welcome_text"
  | "titular_name"
  | "titular_title"
  | "email"
  | "website_url"
  | "facebook_url"
  | "instagram_url"
  | "maps_url";

export type PharmacyFieldMeta = {
  label: string;
  hint: string;
  placeholder?: string;
  maxLength?: number;
  inputMode?: "text" | "email" | "url";
  type?: "text" | "email" | "url";
  rows?: number;
};

export const PHARMACY_FORM_FIELDS: Record<PharmacyFieldKey, PharmacyFieldMeta> = {
  welcome_text: {
    label: "Message d'accueil",
    hint: "Texte court visible sur l'onglet Informations (500 caractères max.).",
    placeholder: "Ex. Bienvenue, nous sommes à votre écoute du lundi au samedi…",
    maxLength: 500,
    rows: 4,
  },
  titular_name: {
    label: "Pharmacien titulaire",
    hint: "Nom affiché publiquement (80 caractères max.).",
    placeholder: "Ex. Dr Karim Benali",
    maxLength: 80,
  },
  titular_title: {
    label: "Titre du titulaire",
    hint: "Libellé sous le nom (60 caractères max.).",
    placeholder: "Pharmacien titulaire",
    maxLength: 60,
  },
  email: {
    label: "E-mail de contact",
    hint: "Adresse professionnelle (optionnelle).",
    placeholder: "contact@pharmacie.ma",
    type: "email",
    inputMode: "email",
    maxLength: 120,
  },
  website_url: {
    label: "Site web",
    hint: "URL complète avec https://",
    placeholder: "https://www.exemple.ma",
    type: "url",
    inputMode: "url",
    maxLength: 200,
  },
  facebook_url: {
    label: "Facebook",
    hint: "Lien vers la page Facebook de l'officine.",
    placeholder: "https://facebook.com/…",
    type: "url",
    inputMode: "url",
    maxLength: 200,
  },
  instagram_url: {
    label: "Instagram",
    hint: "Lien vers le profil Instagram.",
    placeholder: "https://instagram.com/…",
    type: "url",
    inputMode: "url",
    maxLength: 200,
  },
  maps_url: {
    label: "Lien de localisation",
    hint: "Collez le lien « Partager » (Google Maps, Waze, Plans…). Les patients choisissent l’app à l’ouverture.",
    placeholder: "https://maps.google.com/… ou https://waze.com/ul/…",
    type: "url",
    inputMode: "url",
    maxLength: 300,
  },
};

export function normalizeOptionalUrl(value: string): string | null {
  const t = value.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

export function validatePharmacyProfileForm(values: Record<PharmacyFieldKey, string>): string | null {
  if (values.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    return "Adresse e-mail invalide.";
  }
  for (const key of ["website_url", "facebook_url", "instagram_url", "maps_url"] as const) {
    const v = values[key].trim();
    if (!v) continue;
    try {
      const u = new URL(normalizeOptionalUrl(v) ?? v);
      if (!u.protocol.startsWith("http")) return `Lien invalide pour ${PHARMACY_FORM_FIELDS[key].label}.`;
    } catch {
      return `Lien invalide pour ${PHARMACY_FORM_FIELDS[key].label}.`;
    }
  }
  return null;
}
