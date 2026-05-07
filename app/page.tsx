"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Building2, Loader2, MapPin, MessageCircle, Phone, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { trackPharmacyEngagement } from "@/lib/pharmacy-engagement";
import { rowMatchesPublicRefQuery } from "@/lib/public-ref";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Pharmacy = {
  id: string;
  nom: string;
  ville: string;
  adresse: string;
  telephone: string | null;
  whatsapp: string | null;
  statut: string;
  public_ref?: string | null;
};

export default function Home() {
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.from("pharmacies").select("*").order("created_at", { ascending: false });

      if (error) {
        setErrorMessage(error.message);
      }

      if (!error && Array.isArray(data)) {
        setPharmacies(data as Pharmacy[]);
      }

      setLoading(false);
    };

    void load();
  }, []);

  const normalizeWhatsAppNumber = (value: string | null) => (value ?? "").replace(/[^\d]/g, "");

  const filtered = useMemo(() => {
    if (searchQuery.trim().length < 2) return pharmacies;
    return pharmacies.filter((p) =>
      rowMatchesPublicRefQuery(searchQuery, [p.public_ref, p.nom, p.ville, p.adresse, p.telephone, p.whatsapp])
    );
  }, [pharmacies, searchQuery]);

  if (loading) {
    return (
      <main className="flex min-h-[50vh] flex-1 flex-col items-center justify-center gap-3 bg-background p-6 text-muted-foreground">
        <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
        <p className="text-sm font-medium text-foreground">Chargement de l&apos;annuaire…</p>
      </main>
    );
  }

  return (
    <main className="min-h-0 flex-1 bg-background p-4 pb-14 sm:p-5">
      <div className="mx-auto max-w-lg sm:max-w-xl">
        <div className="mb-6 rounded-2xl border border-primary/15 bg-gradient-to-br from-card via-card to-primary/[0.06] p-4 shadow-sm sm:p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary" aria-hidden>
              <Building2 className="size-5" strokeWidth={2.25} />
            </span>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">Annuaire des officines</h1>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Trouvez une pharmacie partenaire, consultez ses coordonnées et accédez à sa fiche pour vos demandes de
                produits.
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Pharmacies affichées :{" "}
            <span className="font-semibold text-foreground">
              {filtered.length}
              {searchQuery.trim().length >= 2 ? ` / ${pharmacies.length}` : ""}
            </span>
          </p>
          <label className="mt-3 block text-sm font-medium text-foreground">
            <span className="flex items-center gap-2">
              <Search className="size-4 text-primary" aria-hidden />
              Recherche (nom, ville, adresse ou code officine)
            </span>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Ex. Casablanca, PH001R… (2 caractères minimum pour filtrer)"
              className={cn(
                "mt-2 w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm text-foreground shadow-sm outline-none",
                "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
              )}
            />
          </label>
        </div>

        <div className="space-y-4">
          {errorMessage ? (
            <p className="rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive">
              Erreur chargement pharmacies : {errorMessage}
            </p>
          ) : null}
          {filtered.length > 0 ? (
            filtered.map((pharmacy) => (
              <article
                key={pharmacy.id}
                className="overflow-hidden rounded-2xl border border-border/90 bg-card text-card-foreground shadow-sm transition hover:border-primary/25 hover:shadow-md"
              >
                <div className="border-b border-border/60 bg-muted/25 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-[11px] font-semibold tracking-wide text-primary">
                        {pharmacy.public_ref?.trim() ?? "—"}
                      </p>
                      <h2 className="mt-1 text-base font-bold leading-snug sm:text-lg">{pharmacy.nom}</h2>
                      <p className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground">
                        <MapPin className="mt-0.5 size-4 shrink-0 text-primary/80" aria-hidden />
                        <span>
                          {pharmacy.ville} · {pharmacy.adresse}
                        </span>
                      </p>
                    </div>
                    <span className="shrink-0 rounded-lg bg-emerald-500/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-200">
                      {pharmacy.statut}
                    </span>
                  </div>
                </div>

                <div className="p-4 pt-3">
                  <Link
                    href={`/pharmacie/${pharmacy.id}`}
                    className={cn(buttonVariants({ size: "lg" }), "h-11 w-full gap-2 px-4 text-sm")}
                  >
                    Fiche pharmacie
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                  <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <a
                      href={pharmacy.telephone ? `tel:${pharmacy.telephone}` : undefined}
                      aria-disabled={!pharmacy.telephone}
                      onClick={() =>
                        trackPharmacyEngagement({
                          pharmacyId: pharmacy.id,
                          eventType: "phone_click",
                          source: "annuaire",
                        })
                      }
                      className={cn(
                        buttonVariants({ variant: "outline", size: "lg" }),
                        "h-11 w-full justify-center gap-2 text-sm aria-disabled:pointer-events-none aria-disabled:opacity-50"
                      )}
                    >
                      <Phone className="size-4" aria-hidden />
                      <span className="truncate">{pharmacy.telephone ?? "Téléphone indisponible"}</span>
                    </a>
                    <a
                      href={
                        normalizeWhatsAppNumber(pharmacy.whatsapp)
                          ? `https://wa.me/${normalizeWhatsAppNumber(pharmacy.whatsapp)}`
                          : undefined
                      }
                      target={normalizeWhatsAppNumber(pharmacy.whatsapp) ? "_blank" : undefined}
                      rel={normalizeWhatsAppNumber(pharmacy.whatsapp) ? "noreferrer" : undefined}
                      aria-disabled={!normalizeWhatsAppNumber(pharmacy.whatsapp)}
                      onClick={() =>
                        trackPharmacyEngagement({
                          pharmacyId: pharmacy.id,
                          eventType: "whatsapp_click",
                          source: "annuaire",
                        })
                      }
                      className={cn(
                        buttonVariants({ variant: "secondary", size: "lg" }),
                        "h-11 w-full justify-center gap-2 border-emerald-500/20 bg-emerald-500/10 text-emerald-900 hover:bg-emerald-500/18 dark:text-emerald-100 aria-disabled:pointer-events-none aria-disabled:opacity-50"
                      )}
                    >
                      <MessageCircle className="size-4" aria-hidden />
                      WhatsApp
                    </a>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <p className="rounded-xl border border-dashed border-border bg-muted/20 py-12 text-center text-sm text-muted-foreground">
              Aucune pharmacie ne correspond à votre recherche.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
