import { supabase } from "@/lib/supabase";

/** Pharmacien connecté → pharmacie assignée (première ligne pharmacy_staff). */
export async function loadPharmacistPharmacyId(): Promise<{
  userId: string | null;
  pharmacyId: string | null;
  error: string | null;
}> {
  const { data: auth } = await supabase.auth.getSession();
  const userId = auth.session?.user?.id ?? null;
  if (!userId) return { userId: null, pharmacyId: null, error: "Non connecté" };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  if ((profile as { role?: string } | null)?.role !== "pharmacien") {
    return { userId, pharmacyId: null, error: "Réservé aux pharmaciens" };
  }

  const { data: staff, error: se } = await supabase
    .from("pharmacy_staff")
    .select("pharmacy_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (se) return { userId, pharmacyId: null, error: se.message };
  if (!staff?.pharmacy_id) return { userId, pharmacyId: null, error: "Aucune pharmacie liée" };
  return { userId, pharmacyId: staff.pharmacy_id as string, error: null };
}
