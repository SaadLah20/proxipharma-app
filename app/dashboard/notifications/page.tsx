"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageShell } from "@/components/ui/compact-shell";
import { InAppNotificationItem } from "@/components/notifications/in-app-notification-item";
import { supabase } from "@/lib/supabase";

type Row = {
  id: string;
  created_at: string;
  title: string;
  body: string | null;
  request_id: string;
  read_at: string | null;
  event_type: string | null;
};

function hrefFor(role: string, requestId: string) {
  if (role === "admin") return `/admin/demandes/${requestId}`;
  if (role === "pharmacien") return `/dashboard/pharmacien/demandes/${requestId}`;
  return `/dashboard/demandes/${requestId}`;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string>("patient");
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    const { data: auth } = await supabase.auth.getSession();
    const user = auth.session?.user;
    if (!user) {
      router.replace("/auth?redirect=/dashboard/notifications");
      return;
    }

    const { data: profile, error: pe } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (pe) {
      setError(pe.message);
      setLoading(false);
      return;
    }
    setRole((profile as { role?: string } | null)?.role ?? "patient");

    const { data, error: ne } = await supabase
      .from("app_notifications")
      .select("id,created_at,title,body,request_id,read_at,event_type")
      .order("created_at", { ascending: false })
      .limit(80);

    if (ne) {
      setError(ne.message);
    } else {
      setRows((data ?? []) as Row[]);
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    const tid = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(tid);
  }, [load]);

  if (loading) {
    return (
      <PageShell>
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </PageShell>
    );
  }

  return (
    <PageShell className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link href="/" className="text-xs font-medium text-sky-800 underline">
            ← Annuaire
          </Link>
          <h1 className="mt-2 text-lg font-bold text-foreground">Notifications</h1>
          <p className="text-xs text-muted-foreground">Historique des alertes liées à vos demandes.</p>
        </div>
      </div>

      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}

      {rows.length === 0 ? (
        <p className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Aucune notification pour le moment.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((n) => (
            <li key={n.id}>
              <InAppNotificationItem
                title={n.title}
                body={n.body}
                createdAt={n.created_at}
                eventType={n.event_type}
                href={hrefFor(role, n.request_id)}
              />
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
