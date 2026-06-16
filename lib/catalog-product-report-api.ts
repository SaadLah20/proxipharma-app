import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ActiveCatalogProductReportSummary,
  AdminCatalogProductReportDetail,
  AdminCatalogProductReportListRow,
  AdminCatalogReportFilter,
  CatalogProductReportDetail,
  CatalogProductReportFieldInput,
  CatalogProductReportListRow,
  CatalogProductReportSnapshot,
  PharmacistCatalogReportFilter,
} from "@/lib/catalog-product-report-types";

export async function fetchActiveCatalogProductReports(
  supabase: SupabaseClient,
  productIds: string[]
): Promise<ActiveCatalogProductReportSummary[]> {
  if (productIds.length === 0) return [];

  const { data, error } = await supabase.rpc("pharmacist_catalog_product_active_report_ids", {
    p_product_ids: productIds,
  });

  if (error) throw error;
  if (!Array.isArray(data)) return [];

  return data.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      product_id: String(r.product_id),
      report_id: String(r.report_id),
      status: r.status as ActiveCatalogProductReportSummary["status"],
    };
  });
}

export async function getProductReportableSnapshot(
  supabase: SupabaseClient,
  productId: string
): Promise<CatalogProductReportSnapshot> {
  const { data, error } = await supabase.rpc("pharmacist_get_product_reportable_snapshot", {
    p_product_id: productId,
  });

  if (error) throw error;
  return (data ?? {}) as CatalogProductReportSnapshot;
}

export async function submitCatalogProductReport(
  supabase: SupabaseClient,
  productId: string,
  fields: CatalogProductReportFieldInput[]
): Promise<{ id: string }> {
  const { data, error } = await supabase.rpc("pharmacist_submit_catalog_product_report", {
    p_product_id: productId,
    p_fields: fields,
  });

  if (error) throw error;
  const row = data as { id: string };
  return { id: row.id };
}

export async function updateCatalogProductReport(
  supabase: SupabaseClient,
  reportId: string,
  fields: CatalogProductReportFieldInput[]
): Promise<void> {
  const { error } = await supabase.rpc("pharmacist_update_catalog_product_report", {
    p_report_id: reportId,
    p_fields: fields,
  });

  if (error) throw error;
}

export async function cancelCatalogProductReport(supabase: SupabaseClient, reportId: string): Promise<void> {
  const { error } = await supabase.rpc("pharmacist_cancel_catalog_product_report", {
    p_report_id: reportId,
  });

  if (error) throw error;
}

export async function respondCatalogProductReport(
  supabase: SupabaseClient,
  reportId: string,
  accept: boolean,
  message?: string
): Promise<void> {
  const { error } = await supabase.rpc("pharmacist_respond_catalog_product_report", {
    p_report_id: reportId,
    p_accept: accept,
    p_message: message ?? null,
  });

  if (error) throw error;
}

export async function listPharmacistCatalogProductReports(
  supabase: SupabaseClient,
  filter: PharmacistCatalogReportFilter = "active"
): Promise<CatalogProductReportListRow[]> {
  const { data, error } = await supabase.rpc("pharmacist_list_catalog_product_reports", {
    p_filter: filter,
  });

  if (error) throw error;
  if (!Array.isArray(data)) return [];
  return data as CatalogProductReportListRow[];
}

export async function getPharmacistCatalogProductReportDetail(
  supabase: SupabaseClient,
  reportId: string
): Promise<CatalogProductReportDetail> {
  const { data, error } = await supabase.rpc("pharmacist_catalog_product_report_detail", {
    p_report_id: reportId,
  });

  if (error) throw error;
  return data as CatalogProductReportDetail;
}

export async function listAdminCatalogProductReports(
  supabase: SupabaseClient,
  filter: AdminCatalogReportFilter = "open",
  limit = 100,
  offset = 0
): Promise<AdminCatalogProductReportListRow[]> {
  const { data, error } = await supabase.rpc("admin_list_catalog_product_reports", {
    p_filter: filter,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) throw error;
  if (!Array.isArray(data)) return [];
  return data as AdminCatalogProductReportListRow[];
}

export async function getAdminCatalogProductReportDetail(
  supabase: SupabaseClient,
  reportId: string
): Promise<AdminCatalogProductReportDetail> {
  const { data, error } = await supabase.rpc("admin_catalog_product_report_detail", {
    p_report_id: reportId,
  });

  if (error) throw error;
  return data as AdminCatalogProductReportDetail;
}

export async function saveAdminCatalogProductFromReport(
  supabase: SupabaseClient,
  reportId: string,
  product: Record<string, string | null>
): Promise<void> {
  const { error } = await supabase.rpc("admin_save_catalog_product_from_report", {
    p_report_id: reportId,
    p_product: product,
  });

  if (error) throw error;
}

export async function resolveAdminCatalogProductReport(
  supabase: SupabaseClient,
  reportId: string,
  options?: { message?: string; product?: Record<string, string | null> }
): Promise<void> {
  const { error } = await supabase.rpc("admin_resolve_catalog_product_report", {
    p_report_id: reportId,
    p_message: options?.message ?? null,
    p_product: options?.product ?? null,
  });

  if (error) throw error;
}

export async function countOpenAdminCatalogProductReports(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase.rpc("admin_count_open_catalog_product_reports");

  if (error) throw error;
  return Number(data ?? 0);
}

export async function countPharmacistAwaitingCatalogReports(supabase: SupabaseClient): Promise<number> {
  const rows = await listPharmacistCatalogProductReports(supabase, "awaiting_pharmacist");
  return rows.length;
}
