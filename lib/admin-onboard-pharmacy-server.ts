import type { SupabaseClient } from "@supabase/supabase-js";
import { SIGNUP_META_PASSWORD_PENDING } from "@/lib/auth-signup-flow";
import type { OnboardPharmacyInput, OnboardPharmacySuccess } from "@/lib/admin-onboard-pharmacy";
import { PROVISIONED_PHARMACIST_META } from "@/lib/provisioned-pharmacist-auth";

async function deleteAuthUser(admin: SupabaseClient, userId: string) {
  await admin.auth.admin.deleteUser(userId);
}

export async function onboardPharmacyAndPharmacist(
  admin: SupabaseClient,
  input: OnboardPharmacyInput,
  provisionalPassword: string
): Promise<{ ok: true; result: OnboardPharmacySuccess } | { ok: false; error: string; status: number }> {
  const phone = input.pharmacist.phone;

  const { data: phoneExists, error: phoneRpcErr } = await admin.rpc("auth_phone_user_exists", {
    p_phone: phone,
  });
  if (phoneRpcErr) {
    return { ok: false, error: phoneRpcErr.message, status: 500 };
  }
  if (phoneExists === true) {
    return {
      ok: false,
      error: "Ce numéro est déjà enregistré. Utilisez un autre téléphone ou rattachez le compte existant.",
      status: 409,
    };
  }

  const { data: authData, error: createErr } = await admin.auth.admin.createUser({
    phone,
    password: provisionalPassword,
    phone_confirm: true,
    user_metadata: {
      full_name: input.pharmacist.full_name,
      whatsapp: phone,
      [SIGNUP_META_PASSWORD_PENDING]: true,
      [PROVISIONED_PHARMACIST_META]: true,
    },
  });

  if (createErr || !authData.user) {
    return {
      ok: false,
      error: createErr?.message ?? "Impossible de créer le compte Auth.",
      status: 500,
    };
  }

  const userId = authData.user.id;

  // Un trigger Supabase (on_auth_user_created) peut déjà avoir inséré une ligne profiles → upsert.
  const { error: profileErr } = await admin.from("profiles").upsert(
    {
      id: userId,
      role: "pharmacien",
      full_name: input.pharmacist.full_name,
      whatsapp: phone,
      email: input.pharmacist.email ?? null,
    },
    { onConflict: "id" }
  );

  if (profileErr) {
    await deleteAuthUser(admin, userId);
    return { ok: false, error: `Profil pharmacien : ${profileErr.message}`, status: 500 };
  }

  const { data: pharmacyRow, error: pharmacyErr } = await admin
    .from("pharmacies")
    .insert({
      nom: input.pharmacy.nom,
      adresse: input.pharmacy.adresse,
      ville: input.pharmacy.ville,
      telephone: input.pharmacy.telephone ?? null,
      whatsapp: input.pharmacy.whatsapp ?? phone,
      maps_url: null,
      latitude: input.pharmacy.latitude,
      longitude: input.pharmacy.longitude,
      statut: input.pharmacy.statut ?? "ouverte",
      titular_name: input.pharmacist.full_name.trim(),
      titular_title: "Pharmacien titulaire",
      titular_public: true,
    })
    .select("id,public_ref")
    .single();

  if (pharmacyErr || !pharmacyRow) {
    await admin.from("profiles").delete().eq("id", userId);
    await deleteAuthUser(admin, userId);
    return {
      ok: false,
      error: `Pharmacie : ${pharmacyErr?.message ?? "insertion échouée"}`,
      status: 500,
    };
  }

  const { error: staffErr } = await admin.from("pharmacy_staff").insert({
    pharmacy_id: pharmacyRow.id,
    user_id: userId,
    is_owner: true,
  });

  if (staffErr) {
    await admin.from("pharmacies").delete().eq("id", pharmacyRow.id);
    await admin.from("profiles").delete().eq("id", userId);
    await deleteAuthUser(admin, userId);
    return { ok: false, error: `Rattachement officine : ${staffErr.message}`, status: 500 };
  }

  return {
    ok: true,
    result: {
      pharmacy_id: pharmacyRow.id as string,
      pharmacist_user_id: userId,
      pharmacist_phone_e164: phone,
      provisional_password: provisionalPassword,
      pharmacy_public_ref: (pharmacyRow.public_ref as string | null) ?? null,
    },
  };
}
