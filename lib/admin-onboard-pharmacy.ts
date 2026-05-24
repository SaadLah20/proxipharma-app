import { normalizePhoneToE164 } from "@/lib/phone-e164";
import { generateProvisionalPassword, validateProvisionalPassword } from "@/lib/generate-provisional-password";
export type OnboardPharmacyInput = {
  pharmacy: {
    nom: string;
    adresse: string;
    ville: string;
    telephone?: string;
    whatsapp?: string;
    latitude?: number | null;
    longitude?: number | null;
    statut?: string;
  };
  pharmacist: {
    full_name: string;
    phone: string;
    email?: string;
  };
  provisional_password?: string;
};

export type OnboardPharmacySuccess = {
  pharmacy_id: string;
  pharmacist_user_id: string;
  pharmacist_phone_e164: string;
  provisional_password: string;
  pharmacy_public_ref: string | null;
};

const PHARMACY_STATUTS = new Set(["ouverte", "fermee", "garde"]);

export function parseOnboardPharmacyBody(body: unknown):
  | { ok: true; data: OnboardPharmacyInput; provisionalPassword: string }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Corps de requête invalide." };
  }

  const raw = body as Record<string, unknown>;
  const pharmacyRaw = raw.pharmacy;
  const pharmacistRaw = raw.pharmacist;

  if (!pharmacyRaw || typeof pharmacyRaw !== "object" || !pharmacistRaw || typeof pharmacistRaw !== "object") {
    return { ok: false, error: "Champs pharmacy et pharmacist requis." };
  }

  const ph = pharmacyRaw as Record<string, unknown>;
  const tit = pharmacistRaw as Record<string, unknown>;

  const nom = String(ph.nom ?? "").trim();
  const adresse = String(ph.adresse ?? "").trim();
  const ville = String(ph.ville ?? "").trim();
  const full_name = String(tit.full_name ?? "").trim();
  const phoneInput = String(tit.phone ?? "").trim();

  if (nom.length < 2) return { ok: false, error: "Nom de la pharmacie requis (2 caractères min.)." };
  if (adresse.length < 3) return { ok: false, error: "Adresse requise." };
  if (ville.length < 2) return { ok: false, error: "Ville requise." };
  if (full_name.length < 2) return { ok: false, error: "Nom du pharmacien requis (2 caractères min.)." };

  const phone = normalizePhoneToE164(phoneInput);
  if (!phone) {
    return { ok: false, error: "Numéro de téléphone invalide (ex. 0612345678 ou +212612345678)." };
  }

  const statut = String(ph.statut ?? "ouverte").trim() || "ouverte";
  if (!PHARMACY_STATUTS.has(statut)) {
    return { ok: false, error: "Statut invalide (ouverte, fermee ou garde)." };
  }

  let latitude: number | null = null;
  let longitude: number | null = null;
  if (ph.latitude !== undefined && ph.latitude !== null && ph.latitude !== "") {
    latitude = Number(ph.latitude);
    if (Number.isNaN(latitude) || latitude < -90 || latitude > 90) {
      return { ok: false, error: "Latitude invalide (-90 à 90)." };
    }
  }
  if (ph.longitude !== undefined && ph.longitude !== null && ph.longitude !== "") {
    longitude = Number(ph.longitude);
    if (Number.isNaN(longitude) || longitude < -180 || longitude > 180) {
      return { ok: false, error: "Longitude invalide (-180 à 180)." };
    }
  }

  const emailOpt = String(tit.email ?? "")
    .trim()
    .toLowerCase();
  if (emailOpt && !emailOpt.includes("@")) {
    return { ok: false, error: "E-mail du pharmacien invalide." };
  }

  let provisionalPassword =
    typeof raw.provisional_password === "string" ? raw.provisional_password.trim() : "";
  if (!provisionalPassword) {
    provisionalPassword = generateProvisionalPassword();
  } else {
    const pwdErr = validateProvisionalPassword(provisionalPassword);
    if (pwdErr) return { ok: false, error: pwdErr };
  }

  const data: OnboardPharmacyInput = {
    pharmacy: {
      nom,
      adresse,
      ville,
      telephone: String(ph.telephone ?? "").trim() || undefined,
      whatsapp: String(ph.whatsapp ?? "").trim() || phone,
      latitude,
      longitude,
      statut,
    },
    pharmacist: {
      full_name,
      phone,
      email: emailOpt || undefined,
    },
    provisional_password: provisionalPassword,
  };

  return { ok: true, data, provisionalPassword };
}
