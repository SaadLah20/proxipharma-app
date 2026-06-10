"use client";

import { FormEvent, useState } from "react";
import { adminApiFetch } from "@/lib/admin-api-fetch";
import { generateProvisionalPassword } from "@/lib/generate-provisional-password";
import {
  AdminPharmacyCoordsFields,
  validateAdminPharmacyCoordsForSubmit,
} from "@/components/admin/AdminPharmacyCoordsFields";
import { PharmacyCitySelect } from "@/components/pharmacy/pharmacy-city-select";
import { validatePharmacyCityForSubmit } from "@/lib/pharmacy-cities-morocco";
import { parseAdminPharmacyCoords } from "@/lib/pharmacy-coords-morocco";

type OnboardResult = {
  pharmacy_id: string;
  pharmacist_user_id: string;
  pharmacist_phone_e164: string;
  provisional_password: string;
  pharmacy_public_ref: string | null;
  message?: string;
};

type Props = {
  onCreated?: () => void;
};

export function AdminOnboardPharmacyForm({ onCreated }: Props) {
  const [nom, setNom] = useState("");
  const [adresse, setAdresse] = useState("");
  const [nomAr, setNomAr] = useState("");
  const [adresseAr, setAdresseAr] = useState("");
  const [ville, setVille] = useState("");
  const [telephone, setTelephone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [statut, setStatut] = useState("ouverte");
  const [publicListed, setPublicListed] = useState(false);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [provisionalPassword, setProvisionalPassword] = useState(() => generateProvisionalPassword());

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<OnboardResult | null>(null);

  const resetForm = () => {
    setNom("");
    setAdresse("");
    setNomAr("");
    setAdresseAr("");
    setVille("");
    setTelephone("");
    setWhatsapp("");
    setLatitude("");
    setLongitude("");
    setStatut("ouverte");
    setPublicListed(false);
    setFullName("");
    setPhone("");
    setEmail("");
    setProvisionalPassword(generateProvisionalPassword());
    setError("");
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);

    const cityErr = validatePharmacyCityForSubmit(ville);
    if (cityErr) {
      setError(cityErr);
      setLoading(false);
      return;
    }

    const coordsErr = validateAdminPharmacyCoordsForSubmit(latitude, longitude, true);
    if (coordsErr) {
      setError(coordsErr);
      setLoading(false);
      return;
    }
    const coords = parseAdminPharmacyCoords(latitude, longitude, { required: true });
    if (!coords.ok || coords.latitude === null || coords.longitude === null) {
      setError(!coords.ok ? coords.error : "Coordonnées invalides.");
      setLoading(false);
      return;
    }

    try {
      const res = await adminApiFetch("/api/admin/onboard-pharmacy", {
        method: "POST",
        body: JSON.stringify({
          pharmacy: {
            nom,
            adresse,
            ville,
            nom_ar: nomAr || undefined,
            adresse_ar: adresseAr || undefined,
            telephone: telephone || undefined,
            whatsapp: whatsapp || undefined,
            latitude: coords.latitude,
            longitude: coords.longitude,
            statut,
            public_listed: publicListed,
          },
          pharmacist: {
            full_name: fullName,
            phone,
            email: email || undefined,
          },
          provisional_password: provisionalPassword,
        }),
      });

      const json = (await res.json()) as OnboardResult & { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Création impossible.");
        setLoading(false);
        return;
      }

      setResult(json);
      onCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur réseau.");
    } finally {
      setLoading(false);
    }
  };

  const copyCredentials = async () => {
    if (!result) return;
    const text = [
      `Pharmeto — accès officine`,
      `Téléphone : ${result.pharmacist_phone_e164}`,
      `Mot de passe provisoire : ${result.provisional_password}`,
      `Connexion : ${typeof window !== "undefined" ? window.location.origin : ""}/auth`,
      `À la première connexion, choisir un nouveau mot de passe.`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  };

  if (result) {
    return (
      <section className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50/80 p-4">
        <h2 className="mb-2 text-lg font-semibold text-emerald-900">Officine créée</h2>
        <p className="mb-3 text-sm text-emerald-800">
          {result.message ??
            "Transmettez ces identifiants au pharmacien (WhatsApp, appel, etc.). Aucun SMS automatique."}
        </p>
        <dl className="mb-4 space-y-2 rounded-lg bg-white p-3 text-sm">
          <div>
            <dt className="text-gray-500">Réf. officine</dt>
            <dd className="font-mono font-medium">{result.pharmacy_public_ref ?? result.pharmacy_id}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Téléphone connexion</dt>
            <dd className="font-mono font-medium">{result.pharmacist_phone_e164}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Mot de passe provisoire</dt>
            <dd className="font-mono text-base font-bold tracking-wide">{result.provisional_password}</dd>
          </div>
          <div>
            <dt className="text-gray-500">UUID pharmacien</dt>
            <dd className="break-all font-mono text-xs">{result.pharmacist_user_id}</dd>
          </div>
        </dl>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void copyCredentials()}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white"
          >
            Copier les identifiants
          </button>
          <button
            type="button"
            onClick={() => {
              setResult(null);
              resetForm();
            }}
            className="rounded-lg border border-emerald-300 bg-white px-4 py-2 text-sm font-medium text-emerald-900"
          >
            Créer une autre officine
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-6 rounded-xl border-2 border-blue-200 bg-white p-4">
      <h2 className="mb-1 text-lg font-semibold">Nouvelle officine + pharmacien titulaire</h2>
      <p className="mb-4 text-sm text-gray-600">
        Crée la pharmacie, le compte Auth (téléphone + mot de passe provisoire) et le rattachement. Sans SMS :
        copiez le mot de passe provisoire pour le transmettre au titulaire.
      </p>

      {error ? <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}

      <form className="grid gap-4" onSubmit={handleSubmit}>
        <fieldset className="grid gap-3 md:grid-cols-2">
          <legend className="md:col-span-2 text-sm font-semibold text-gray-800">Pharmacie</legend>
          <input
            className="rounded-lg border p-3"
            placeholder="Nom de l’officine *"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            required
          />
          <PharmacyCitySelect
            className="rounded-lg border p-3"
            value={ville}
            onChange={setVille}
            required
            placeholder="Ville *"
          />
          <input
            className="rounded-lg border p-3 md:col-span-2"
            placeholder="Adresse *"
            value={adresse}
            onChange={(e) => setAdresse(e.target.value)}
            required
          />
          <input
            className="rounded-lg border p-3"
            placeholder="Nom de l'officine (arabe)"
            value={nomAr}
            onChange={(e) => setNomAr(e.target.value)}
            dir="rtl"
            lang="ar"
          />
          <input
            className="rounded-lg border p-3 md:col-span-2"
            placeholder="Adresse (arabe)"
            value={adresseAr}
            onChange={(e) => setAdresseAr(e.target.value)}
            dir="rtl"
            lang="ar"
          />
          <input
            className="rounded-lg border p-3"
            placeholder="Téléphone officine"
            value={telephone}
            onChange={(e) => setTelephone(e.target.value)}
          />
          <input
            className="rounded-lg border p-3"
            placeholder="WhatsApp officine (défaut = tél. titulaire)"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
          />
          <AdminPharmacyCoordsFields
            latitude={latitude}
            longitude={longitude}
            onLatitudeChange={setLatitude}
            onLongitudeChange={setLongitude}
            required
          />
          <select
            className="rounded-lg border p-3 md:col-span-2"
            value={statut}
            onChange={(e) => setStatut(e.target.value)}
          >
            <option value="ouverte">ouverte</option>
            <option value="fermee">fermee</option>
            <option value="garde">garde</option>
          </select>
          <label className="flex items-start gap-2 text-sm md:col-span-2">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={publicListed}
              onChange={(e) => setPublicListed(e.target.checked)}
            />
            <span>
              Visible dans l&apos;annuaire public
              <span className="mt-0.5 block text-xs text-gray-500">
                Décoché par défaut (officine pilote / test). Cochez pour une pharmacie réelle prête à être découverte.
              </span>
            </span>
          </label>
        </fieldset>

        <fieldset className="grid gap-3 md:grid-cols-2">
          <legend className="md:col-span-2 text-sm font-semibold text-gray-800">Pharmacien titulaire</legend>
          <input
            className="rounded-lg border p-3 md:col-span-2"
            placeholder="Prénom et nom *"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
          <input
            className="rounded-lg border p-3"
            placeholder="Téléphone connexion * (0612…)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
          <input
            className="rounded-lg border p-3"
            type="email"
            placeholder="E-mail (facultatif, fiche profil)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </fieldset>

        <fieldset className="grid gap-3">
          <legend className="text-sm font-semibold text-gray-800">Mot de passe provisoire</legend>
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="min-w-[12rem] flex-1 rounded-lg border p-3 font-mono"
              value={provisionalPassword}
              onChange={(e) => setProvisionalPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="off"
            />
            <button
              type="button"
              className="rounded-lg border px-3 py-2 text-sm"
              onClick={() => setProvisionalPassword(generateProvisionalPassword())}
            >
              Régénérer
            </button>
          </div>
          <p className="text-xs text-gray-500">Minimum 6 caractères. Affiché une fois après création.</p>
        </fieldset>

        <button
          type="submit"
          disabled={loading}
          className="w-fit rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white disabled:opacity-60"
        >
          {loading ? "Création…" : "Créer officine et compte pharmacien"}
        </button>
      </form>
    </section>
  );
}
