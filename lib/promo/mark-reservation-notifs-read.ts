import { supabase } from "@/lib/supabase";

/** Marque comme lues les notifs promo liées à une réservation (détail ouvert). */
export async function markPromoReservationNotificationsRead(reservationId: string): Promise<void> {
  const { data: auth } = await supabase.auth.getSession();
  const userId = auth.session?.user?.id;
  if (!userId) return;

  const nowIso = new Date().toISOString();
  await supabase
    .from("promo_in_app_notifications")
    .update({ read_at: nowIso })
    .eq("recipient_id", userId)
    .eq("reservation_id", reservationId)
    .is("read_at", null);
}
