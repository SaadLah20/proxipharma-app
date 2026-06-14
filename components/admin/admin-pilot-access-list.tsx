"use client";

import { useCallback, useState } from "react";
import { clsx } from "clsx";
import { platformDashboardChrome as p } from "@/lib/platform-dashboard-chrome";
import { supabase } from "@/lib/supabase";

export type AdminPilotProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  pilot_access: boolean;
};

export function AdminPilotAccessList({
  profiles,
  onUpdated,
}: {
  profiles: AdminPilotProfileRow[];
  onUpdated: () => void | Promise<void>;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const togglePilotAccess = useCallback(
    async (profile: AdminPilotProfileRow) => {
      if (profile.role === "admin") return;
      setMessage("");
      setBusyId(profile.id);
      const next = !profile.pilot_access;
      const { error } = await supabase.from("profiles").update({ pilot_access: next }).eq("id", profile.id);
      setBusyId(null);
      if (error) {
        setMessage(`Erreur accès pilote : ${error.message}`);
        return;
      }
      await onUpdated();
    },
    [onUpdated]
  );

  const patientProfiles = profiles.filter((row) => row.role === "patient");

  if (patientProfiles.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucun compte patient enregistré.</p>;
  }

  return (
    <div className="space-y-2">
      {message ? <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{message}</p> : null}
      <ul className="divide-y divide-border/70 rounded-xl border border-border/90 bg-card">
        {patientProfiles.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{row.full_name?.trim() || "Sans nom"}</p>
              <p className="truncate text-xs text-muted-foreground">{row.email?.trim() || row.id}</p>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-muted-foreground">
              <input
                type="checkbox"
                className="size-4 rounded border-input"
                checked={row.pilot_access}
                disabled={busyId === row.id}
                onChange={() => void togglePilotAccess(row)}
              />
              Accès pilote annuaire
            </label>
          </li>
        ))}
      </ul>
      <p className={clsx("text-[11px]", p.heroSubtitle)}>
        Les comptes avec accès pilote voient les officines non listées publiquement dans l&apos;annuaire.
      </p>
    </div>
  );
}
