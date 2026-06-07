import { supabase } from "@/lib/supabase";

export type PharmacistPromoPatientContact = {
  full_name: string | null;
  whatsapp: string | null;
  email: string | null;
  patient_ref: string | null;
};

/** Annuaire patient officine (demandes + réservations promo) — SECURITY DEFINER, pas de SELECT profiles direct. */
export async function loadPharmacistPromoPatientDirectory(): Promise<
  Map<string, PharmacistPromoPatientContact>
> {
  const map = new Map<string, PharmacistPromoPatientContact>();

  const { data: enriched, error: enrichedErr } = await supabase.rpc(
    "pharmacist_patient_directory_enriched_for_my_pharmacy",
  );

  if (!enrichedErr && enriched?.length) {
    for (const row of enriched as Array<Record<string, unknown>>) {
      const patientId = row.patient_id as string;
      if (!patientId) continue;
      map.set(patientId, {
        full_name: (row.full_name as string | null) ?? null,
        whatsapp: (row.whatsapp as string | null) ?? null,
        email: (row.email as string | null) ?? null,
        patient_ref: (row.patient_ref as string | null) ?? null,
      });
    }
    return map;
  }

  const { data: legacy } = await supabase.rpc("pharmacist_patient_directory_for_my_pharmacy");
  for (const row of (legacy ?? []) as Array<Record<string, unknown>>) {
    const patientId = row.patient_id as string;
    if (!patientId) continue;
    map.set(patientId, {
      full_name: (row.full_name as string | null) ?? null,
      whatsapp: (row.whatsapp as string | null) ?? null,
      email: (row.email as string | null) ?? null,
      patient_ref: (row.patient_ref as string | null) ?? null,
    });
  }
  return map;
}

export async function loadPharmacistPromoPatientContact(
  patientId: string,
): Promise<PharmacistPromoPatientContact | null> {
  const { data } = await supabase.rpc("pharmacist_patient_detail", { p_patient_id: patientId });
  const contact = (data as { contact?: PharmacistPromoPatientContact } | null)?.contact;
  if (!contact) return null;
  return {
    full_name: contact.full_name ?? null,
    whatsapp: contact.whatsapp ?? null,
    email: contact.email ?? null,
    patient_ref: contact.patient_ref ?? null,
  };
}
