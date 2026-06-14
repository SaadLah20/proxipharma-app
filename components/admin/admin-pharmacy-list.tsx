"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { ExternalLink } from "lucide-react";
import { platformDashboardChrome as p } from "@/lib/platform-dashboard-chrome";
import { supabase } from "@/lib/supabase";

export type AdminPharmacyRow = {
  id: string;
  nom: string;
  ville: string;
  statut: string;
  public_listed: boolean;
};

export function AdminPharmacyList({
  pharmacies,
  filter,
  onUpdated,
}: {
  pharmacies: AdminPharmacyRow[];
  filter?: "public" | "all";
  onUpdated: () => void | Promise<void>;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const rows =
    filter === "public" ? pharmacies.filter((ph) => ph.public_listed) : pharmacies;

  const togglePublicListed = useCallback(
    async (pharmacy: AdminPharmacyRow) => {
      setMessage("");
      setBusyId(pharmacy.id);
      const next = !pharmacy.public_listed;
      const { error } = await supabase.from("pharmacies").update({ public_listed: next }).eq("id", pharmacy.id);
      setBusyId(null);
      if (error) {
        setMessage(`Erreur visibilité annuaire : ${error.message}`);
        return;
      }
      await onUpdated();
    },
    [onUpdated]
  );

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucune officine pour ce filtre.</p>;
  }

  return (
    <div className="space-y-2">
      {message ? <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{message}</p> : null}
      <ul className="space-y-2">
        {rows.map((ph) => (
          <li
            key={ph.id}
            className={clsx(
              "rounded-xl border border-border/90 bg-card p-3 shadow-sm ring-1 ring-primary/5",
              p.cardHover
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-foreground">{ph.nom}</p>
                <p className="text-xs text-muted-foreground">{ph.ville}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span
                    className={clsx(
                      "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                      ph.statut === "ouverte"
                        ? "bg-emerald-100 text-emerald-800"
                        : ph.statut === "garde"
                          ? "bg-sky-100 text-sky-800"
                          : "bg-muted text-muted-foreground"
                    )}
                  >
                    {ph.statut}
                  </span>
                  <span
                    className={clsx(
                      "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                      ph.public_listed ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {ph.public_listed ? "Annuaire public" : "Pilote privé"}
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Link
                  href={`/pharmacie/${ph.id}`}
                  className={clsx(p.headerAction, "inline-flex items-center gap-1")}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Fiche
                  <ExternalLink className="size-3" aria-hidden />
                </Link>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-input"
                    checked={ph.public_listed}
                    disabled={busyId === ph.id}
                    onChange={() => void togglePublicListed(ph)}
                  />
                  Visible annuaire
                </label>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
