import {
  patientRequestActiveStatuses,
  pharmacistRequestActiveStatuses,
} from "@/lib/demandes-hub-buckets";
import type { RequestKindId } from "@/lib/request-kinds/types";

export const UNIFIED_PATIENT_HUB_PATH = "/dashboard/demandes";
export const UNIFIED_PHARMACIST_HUB_PATH = "/dashboard/pharmacien/demandes";

export type RequestHubParcoursSlug = "tous" | "produits" | "ordonnances" | "consultations";

export const REQUEST_HUB_PARCOURS_SLUGS: RequestHubParcoursSlug[] = [
  "tous",
  "produits",
  "ordonnances",
  "consultations",
];

export const ALL_REQUEST_KIND_IDS: RequestKindId[] = [
  "product_request",
  "prescription",
  "free_consultation",
];

const SLUG_TO_KIND: Record<Exclude<RequestHubParcoursSlug, "tous">, RequestKindId> = {
  produits: "product_request",
  ordonnances: "prescription",
  consultations: "free_consultation",
};

const KIND_TO_SLUG: Record<RequestKindId, Exclude<RequestHubParcoursSlug, "tous">> = {
  product_request: "produits",
  prescription: "ordonnances",
  free_consultation: "consultations",
};

export function isRequestHubParcoursSlug(value: string): value is RequestHubParcoursSlug {
  return (REQUEST_HUB_PARCOURS_SLUGS as string[]).includes(value);
}

export function parseParcoursParam(value: string | null | undefined): RequestHubParcoursSlug {
  if (value && isRequestHubParcoursSlug(value)) return value;
  return "tous";
}

export function parcoursSlugFromKindId(kindId: RequestKindId): Exclude<RequestHubParcoursSlug, "tous"> {
  return KIND_TO_SLUG[kindId];
}

export function kindIdFromParcoursSlug(
  slug: RequestHubParcoursSlug,
): RequestKindId | null {
  if (slug === "tous") return null;
  return SLUG_TO_KIND[slug];
}

export function effectiveKindIdForHub(parcours: RequestHubParcoursSlug): RequestKindId {
  return kindIdFromParcoursSlug(parcours) ?? "product_request";
}

export function unifiedHubPathForRole(role: "patient" | "pharmacien"): string {
  return role === "patient" ? UNIFIED_PATIENT_HUB_PATH : UNIFIED_PHARMACIST_HUB_PATH;
}

export function hubPathForRequestKind(kindId: RequestKindId, role: "patient" | "pharmacien"): string {
  const base = unifiedHubPathForRole(role);
  const slug = parcoursSlugFromKindId(kindId);
  return `${base}?parcours=${slug}`;
}

export type HubUrlParams = {
  parcours?: RequestHubParcoursSlug;
  vue?: string | null;
  statut?: string | null;
  section?: string | null;
  filtres?: string | null;
};

export function buildHubUrl(basePath: string, params: HubUrlParams, preserve?: URLSearchParams): string {
  const next = preserve ? new URLSearchParams(preserve.toString()) : new URLSearchParams();

  if (params.parcours !== undefined) {
    if (params.parcours === "tous") next.delete("parcours");
    else next.set("parcours", params.parcours);
  }

  if (params.vue !== undefined) {
    if (params.vue == null || params.vue === "") next.delete("vue");
    else next.set("vue", params.vue);
  }

  if (params.statut !== undefined) {
    if (params.statut == null || params.statut === "") next.delete("statut");
    else next.set("statut", params.statut);
  }

  if (params.section !== undefined) {
    if (params.section == null || params.section === "") next.delete("section");
    else next.set("section", params.section);
  }

  if (params.filtres !== undefined) {
    if (params.filtres == null || params.filtres === "") next.delete("filtres");
    else next.set("filtres", params.filtres);
  }

  const qs = next.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function filterRowsByParcours<T extends { request_type: string }>(
  rows: T[],
  parcours: RequestHubParcoursSlug,
): T[] {
  const kindId = kindIdFromParcoursSlug(parcours);
  if (!kindId) return rows;
  return rows.filter((r) => r.request_type === kindId);
}

export function countRowsInParcours<T extends { request_type: string }>(
  rows: T[],
  parcours: RequestHubParcoursSlug,
): number {
  return filterRowsByParcours(rows, parcours).length;
}

const PARCOURS_TITLE_KEYS = {
  tous: { patient: "patientTitleTous", pharmacist: "pharmacistTitleTous" },
  produits: { patient: "patientTitleProducts", pharmacist: "pharmacistTitleProducts" },
  ordonnances: { patient: "patientTitlePrescriptions", pharmacist: "pharmacistTitlePrescriptions" },
  consultations: { patient: "patientTitleConsultations", pharmacist: "pharmacistTitleConsultations" },
} as const;

export type UnifiedHubTitleKey = (typeof PARCOURS_TITLE_KEYS)[RequestHubParcoursSlug][keyof (typeof PARCOURS_TITLE_KEYS)[RequestHubParcoursSlug]];

export function unifiedHubTitleKey(
  parcours: RequestHubParcoursSlug,
  role: "patient" | "pharmacien",
): UnifiedHubTitleKey {
  const roleKey = role === "pharmacien" ? "pharmacist" : "patient";
  return PARCOURS_TITLE_KEYS[parcours][roleKey];
}

export function countActiveRequestsByParcours<T extends { request_type: string; status: string }>(
  rows: T[],
  role: "patient" | "pharmacien",
): Record<RequestHubParcoursSlug, number> {
  const activeStatuses = new Set(
    role === "patient" ? patientRequestActiveStatuses() : pharmacistRequestActiveStatuses(),
  );
  const activeRows = rows.filter((r) => activeStatuses.has(r.status));

  const countForKind = (kindId: RequestKindId | null) => {
    if (!kindId) return activeRows.length;
    return activeRows.filter((r) => r.request_type === kindId).length;
  };

  return {
    tous: countForKind(null),
    produits: countForKind("product_request"),
    ordonnances: countForKind("prescription"),
    consultations: countForKind("free_consultation"),
  };
}

export function excludePharmacistPrescriptionDrafts<T extends { request_type: string; status: string }>(
  rows: T[],
): T[] {
  return rows.filter((r) => !(r.request_type === "prescription" && r.status === "draft"));
}
