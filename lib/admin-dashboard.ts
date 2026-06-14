import type { SupabaseClient } from "@supabase/supabase-js";
import { countPendingCommunityCatalogProducts } from "@/lib/admin-community-catalog-api";
import { loadAdminEmailQueueStats } from "@/lib/admin-email-queue";

export const ADMIN_ACTIVE_REQUEST_STATUSES = ["submitted", "in_review", "responded", "confirmed"] as const;

export type AdminRecentRequestRow = {
  id: string;
  created_at: string;
  status: string;
  request_type: string;
  pharmacy_id: string;
  pharmacies: { nom: string; ville: string } | { nom: string; ville: string }[] | null;
};

export type AdminDashboardSnapshot = {
  pharmacyCount: number;
  publicListedCount: number;
  activeRequestCount: number;
  pendingCommunityProducts: number;
  emailPending: number;
  emailFailed: number;
  emailSent24h: number;
  overdueRespondedCount: number;
  requestsByStatus: Record<string, number>;
  recentRequests: AdminRecentRequestRow[];
};

function countByStatus(rows: { status: string }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) {
    out[row.status] = (out[row.status] ?? 0) + 1;
  }
  return out;
}

export async function loadAdminDashboardSnapshot(supabase: SupabaseClient): Promise<AdminDashboardSnapshot> {
  const respondedCutoff = new Date(Date.now() - 86400000).toISOString();

  const [
    pharmaciesRes,
    publicListedRes,
    activeRequestsRes,
    statusRowsRes,
    overdueRespondedRes,
    recentRes,
    pendingCommunity,
    emailStats,
  ] = await Promise.all([
    supabase.from("pharmacies").select("*", { count: "exact", head: true }),
    supabase.from("pharmacies").select("*", { count: "exact", head: true }).eq("public_listed", true),
    supabase
      .from("requests")
      .select("*", { count: "exact", head: true })
      .in("status", [...ADMIN_ACTIVE_REQUEST_STATUSES]),
    supabase.from("requests").select("status").limit(5000),
    supabase
      .from("requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "responded")
      .lt("responded_at", respondedCutoff),
    supabase
      .from("requests")
      .select("id,created_at,status,request_type,pharmacy_id,pharmacies(nom,ville)")
      .order("created_at", { ascending: false })
      .limit(5),
    countPendingCommunityCatalogProducts(supabase).catch(() => 0),
    loadAdminEmailQueueStats(supabase),
  ]);

  const statusRows = (statusRowsRes.data ?? []) as { status: string }[];

  return {
    pharmacyCount: pharmaciesRes.count ?? 0,
    publicListedCount: publicListedRes.count ?? 0,
    activeRequestCount: activeRequestsRes.count ?? 0,
    pendingCommunityProducts: pendingCommunity,
    emailPending: emailStats.pending,
    emailFailed: emailStats.failed,
    emailSent24h: emailStats.sent24h,
    overdueRespondedCount: overdueRespondedRes.count ?? 0,
    requestsByStatus: countByStatus(statusRows),
    recentRequests: (recentRes.data ?? []) as unknown as AdminRecentRequestRow[],
  };
}

export function snapshotRowsForStatDashboard(byStatus: Record<string, number>) {
  const rows: { status: string; status_for_dashboard: string }[] = [];
  for (const [status, count] of Object.entries(byStatus)) {
    const n = Math.max(0, Math.floor(Number(count) || 0));
    for (let i = 0; i < n; i++) rows.push({ status, status_for_dashboard: status });
  }
  return rows;
}
