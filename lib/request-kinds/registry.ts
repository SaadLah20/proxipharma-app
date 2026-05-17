import { consultationRequestKindConfig } from "@/lib/request-kinds/consultation.config";
import { prescriptionRequestKindConfig } from "@/lib/request-kinds/prescription.config";
import { productRequestKindConfig } from "@/lib/request-kinds/product.config";
import type { RequestKindConfig, RequestKindId } from "@/lib/request-kinds/types";

const REQUEST_KIND_CONFIGS: Record<RequestKindId, RequestKindConfig> = {
  product_request: productRequestKindConfig,
  prescription: prescriptionRequestKindConfig,
  free_consultation: consultationRequestKindConfig,
};

const DEFAULT_CONFIG = productRequestKindConfig;

export function isRequestKindId(value: string): value is RequestKindId {
  return value in REQUEST_KIND_CONFIGS;
}

/** Config métier pour un `request_type` (repli produits si inconnu). */
export function getRequestKindConfig(requestType: string): RequestKindConfig {
  if (isRequestKindId(requestType)) return REQUEST_KIND_CONFIGS[requestType];
  return DEFAULT_CONFIG;
}

export function allRequestKindConfigs(): RequestKindConfig[] {
  return Object.values(REQUEST_KIND_CONFIGS);
}

export { REQUEST_KIND_CONFIGS };
