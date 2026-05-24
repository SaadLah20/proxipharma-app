/** Champs coordonnées officine — éditables par le pharmacien (ma fiche). */

export type PharmacyContactFieldKey = "nom" | "adresse" | "ville" | "telephone" | "whatsapp";

export type PharmacyContactFieldMeta = {
  label: string;
  hint: string;
  placeholder?: string;
  maxLength?: number;
  inputMode?: "text" | "tel";
  type?: "text" | "tel";
  rows?: number;
};

export const PHARMACY_CONTACT_FIELDS: Record<PharmacyContactFieldKey, PharmacyContactFieldMeta> = {
  nom: {
    label: "Nom de l'officine",
    hint: "Nom affiché sur la fiche publique et l'annuaire.",
    placeholder: "Pharmacie Al Fajr",
    maxLength: 120,
  },
  adresse: {
    label: "Adresse",
    hint: "Rue, quartier, repères utiles.",
    placeholder: "12 av. Hassan II",
    maxLength: 200,
  },
  ville: {
    label: "Ville",
    hint: "Ville ou commune.",
    placeholder: "Témara",
    maxLength: 80,
  },
  telephone: {
    label: "Téléphone fixe",
    hint: "Optionnel — affiché sur la fiche publique.",
    placeholder: "05 37 12 34 56",
    maxLength: 30,
    type: "tel",
    inputMode: "tel",
  },
  whatsapp: {
    label: "WhatsApp / mobile",
    hint: "Numéro utilisé pour WhatsApp et contact rapide (format 06… ou +212…).",
    placeholder: "06 12 34 56 78",
    maxLength: 30,
    type: "tel",
    inputMode: "tel",
  },
};

export type PharmacyContactForm = Record<PharmacyContactFieldKey, string>;

export function validatePharmacyContactForm(values: PharmacyContactForm): string | null {
  if (!values.nom.trim()) return "Indiquez le nom de l'officine.";
  if (!values.adresse.trim()) return "Indiquez l'adresse.";
  if (!values.ville.trim()) return "Indiquez la ville.";
  return null;
}
