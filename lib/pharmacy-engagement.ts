import { supabase } from "@/lib/supabase";

/** Erreur PostgREST quand la migration n’est pas encore appliquée sur le projet Supabase. */
export function isPharmacyEngagementTableUnavailable(message: string | undefined | null): boolean {
  if (!message) return false;
  return (
    message.includes("pharmacy_engagement_events") ||
    message.includes("schema cache") ||
    message.toLowerCase().includes("could not find the table")
  );
}

export type PharmacyEngagementEventType = "profile_view" | "phone_click" | "whatsapp_click";
export type PharmacyEngagementSource = "annuaire" | "profile";

/** Enregistre un événement d’audience (RLS : insert public). Les erreurs sont ignorées côté UX. */
export function trackPharmacyEngagement(args: {
  pharmacyId: string;
  eventType: PharmacyEngagementEventType;
  source: PharmacyEngagementSource;
}) {
  if (!args.pharmacyId) return;
  void supabase.from("pharmacy_engagement_events").insert({
    pharmacy_id: args.pharmacyId,
    event_type: args.eventType,
    source: args.source,
  });
}
