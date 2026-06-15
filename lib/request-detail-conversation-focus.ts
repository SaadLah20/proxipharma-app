import type { MutableRefObject } from "react";
import type { ConsultationDetailTab } from "@/lib/consultation-detail-tabs";

export const REQUEST_DETAIL_CONVERSATION_URL_PARAM = "conversation";

export function isRequestDetailConversationUrlFocus(value: string | null | undefined): boolean {
  const v = (value ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "open";
}

export function requestDetailHrefWithConversationFocus(path: string): string {
  const hashIdx = path.indexOf("#");
  const pathWithoutHash = hashIdx >= 0 ? path.slice(0, hashIdx) : path;
  const hash = hashIdx >= 0 ? path.slice(hashIdx) : "";
  const qIdx = pathWithoutHash.indexOf("?");
  const base = qIdx >= 0 ? pathWithoutHash.slice(0, qIdx) : pathWithoutHash;
  const sp = new URLSearchParams(qIdx >= 0 ? pathWithoutHash.slice(qIdx + 1) : "");
  sp.set(REQUEST_DETAIL_CONVERSATION_URL_PARAM, "1");
  return `${base}?${sp.toString()}${hash}`;
}

export function consultationTabSyncKeyFromRequest(request: {
  id: string;
  status: string;
  responded_at?: string | null;
}): string {
  return `${request.id}|${request.status}|${request.responded_at ?? ""}`;
}

export function consumeConversationUrlFocusFromWindow(): boolean {
  if (typeof window === "undefined") return false;
  const sp = new URLSearchParams(window.location.search);
  if (!isRequestDetailConversationUrlFocus(sp.get(REQUEST_DETAIL_CONVERSATION_URL_PARAM))) return false;
  sp.delete(REQUEST_DETAIL_CONVERSATION_URL_PARAM);
  const qs = sp.toString();
  const clean = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
  window.history.replaceState(null, "", clean);
  return true;
}

export function applyRequestDetailConversationUrlFocusOnce(
  consumedRef: MutableRefObject<boolean>,
  request: { id: string; status: string; responded_at?: string | null } | null | undefined,
  handlers: {
    setConversationOpen: (open: boolean) => void;
    setConsultationTab: (tab: ConsultationDetailTab) => void;
    bumpConversationRefresh: () => void;
    lockConsultationTabSyncKey: (key: string) => void;
  },
): void {
  if (consumedRef.current || !request) return;
  if (!consumeConversationUrlFocusFromWindow()) return;
  consumedRef.current = true;
  handlers.setConsultationTab("conversation");
  handlers.bumpConversationRefresh();
  handlers.setConversationOpen(true);
  handlers.lockConsultationTabSyncKey(consultationTabSyncKeyFromRequest(request));
}
