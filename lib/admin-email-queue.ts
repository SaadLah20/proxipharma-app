import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminEmailQueueStats = {
  pending: number;
  failed: number;
  sent24h: number;
};

export async function loadAdminEmailQueueStats(supabase: SupabaseClient): Promise<AdminEmailQueueStats> {
  const since24h = new Date(Date.now() - 86400000).toISOString();
  const [pRes, fRes, sRes] = await Promise.all([
    supabase
      .from("notification_external_queue")
      .select("*", { count: "exact", head: true })
      .eq("channel", "email")
      .eq("status", "pending"),
    supabase
      .from("notification_external_queue")
      .select("*", { count: "exact", head: true })
      .eq("channel", "email")
      .eq("status", "failed"),
    supabase
      .from("notification_external_queue")
      .select("*", { count: "exact", head: true })
      .eq("channel", "email")
      .eq("status", "sent")
      .gte("sent_at", since24h),
  ]);

  return {
    pending: pRes.count ?? 0,
    failed: fRes.count ?? 0,
    sent24h: sRes.count ?? 0,
  };
}
