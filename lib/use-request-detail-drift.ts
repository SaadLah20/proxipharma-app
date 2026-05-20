"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  detectRequestDetailStale,
  shouldPollRequestDetailDrift,
  type RequestContentSnapshot,
  type RequestStaleState,
} from "@/lib/request-detail-stale";
import {
  REQUEST_DETAIL_REFRESH_EVENT,
  type RequestDetailRefreshDetail,
} from "@/lib/request-detail-refresh-bus";

export function useRequestDetailDrift(
  requestId: string | undefined,
  status: string | null | undefined,
  viewerRole: "patient" | "pharmacien",
  onReload: () => void | Promise<void>
) {
  const [snapshot, setSnapshot] = useState<RequestContentSnapshot | null>(null);
  const [live, setLive] = useState<RequestContentSnapshot | null>(null);
  const acknowledge = useCallback((updatedAt: string, nextStatus: string) => {
    const snap = { updatedAt, status: nextStatus };
    setSnapshot(snap);
    setLive(snap);
  }, []);

  const stale = useMemo((): RequestStaleState | null => {
    if (!status || !live) return null;
    return detectRequestDetailStale({
      viewerRole,
      status,
      snapshot,
      live,
    });
  }, [viewerRole, status, snapshot, live]);

  const refresh = useCallback(async () => {
    await onReload();
  }, [onReload]);

  useEffect(() => {
    if (!requestId || !status || !shouldPollRequestDetailDrift(status, viewerRole)) return;

    let cancelled = false;
    const poll = async () => {
      const { data } = await supabase
        .from("requests")
        .select("updated_at,status")
        .eq("id", requestId)
        .maybeSingle();
      if (cancelled || !data) return;
      const row = data as { updated_at: string; status: string };
      setLive({ updatedAt: row.updated_at, status: row.status });
    };

    void poll();
    const id = window.setInterval(() => void poll(), 12_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [requestId, status, viewerRole]);

  useEffect(() => {
    if (!requestId) return;
    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent<RequestDetailRefreshDetail>).detail;
      if (detail?.requestId === requestId) void refresh();
    };
    window.addEventListener(REQUEST_DETAIL_REFRESH_EVENT, handler);
    return () => window.removeEventListener(REQUEST_DETAIL_REFRESH_EVENT, handler);
  }, [requestId, refresh]);

  return { snapshot, acknowledge, stale, refresh, setLive };
}
