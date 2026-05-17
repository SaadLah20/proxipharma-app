export type { RequestKindConfig, RequestKindId } from "@/lib/request-kinds/types";
export { getRequestKindConfig, allRequestKindConfigs, isRequestKindId } from "@/lib/request-kinds/registry";
export { productRequestKindConfig } from "@/lib/request-kinds/product.config";
export { prescriptionRequestKindConfig } from "@/lib/request-kinds/prescription.config";
export { getRequestKindWorkflowCopy } from "@/lib/request-kinds/workflow-copy";
export {
  dashboardBucketsForKind,
  hubDashboardChrome,
  patientArchiveIntroCopy,
  patientArchiveRetainedLabel,
  patientOutcomeExpiredHint,
  patientOutcomeStatusFooter,
  pharmacistClosedSuccessIntro,
  pharmacistHardStopSectionCopy,
} from "@/lib/request-kinds/hub-and-terminal-copy";
export { consultationRequestKindConfig } from "@/lib/request-kinds/consultation.config";
