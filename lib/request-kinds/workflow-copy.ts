import { getRequestKindConfig } from "@/lib/request-kinds/registry";
import type { RequestKindWorkflowCopy } from "@/lib/request-kinds/types";

export function getRequestKindWorkflowCopy(requestType: string): RequestKindWorkflowCopy {
  return getRequestKindConfig(requestType).copy.workflow;
}
