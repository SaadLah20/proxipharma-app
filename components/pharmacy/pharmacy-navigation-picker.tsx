"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { MapPin, Navigation, X } from "lucide-react";
import { clsx } from "clsx";
import {
  buildNavigationProviderLinks,
  resolvePharmacyLocation,
  type NavigationProviderLink,
} from "@/lib/pharmacy-navigation";
import { trackPharmacyEngagement } from "@/lib/pharmacy-engagement";
import { lockBodyScroll } from "@/lib/ui-body-scroll-lock";
import {
  uiActionBtnCompactOutline,
  uiAnnuaireActionOverlayBtn,
  uiAnnuaireActionOverlayBtnGhost,
  uiAnnuaireQuickAction,
} from "@/lib/ui-action-buttons";

export type PharmacyNavigationTarget = {
  pharmacyId?: string;
  nom?: string | null;
  adresse?: string | null;
  ville?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  maps_url?: string | null;
};

type Props = {
  pharmacy: PharmacyNavigationTarget;
  source: "annuaire" | "profile";
  className?: string;
  /** Style bouton annuaire (icône + libellé court). */
  variant?: "annuaire" | "annuaire-rail" | "annuaire-overlay" | "inline" | "compact-outline";
  disabledClassName?: string;
  /** Modal contrôlée depuis l’extérieur (ex. grille contact fiche). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Ne pas afficher le bouton déclencheur (ouvrir via `open`). */
  hideTrigger?: boolean;
};

export function PharmacyNavigationPicker({
  pharmacy,
  source,
  className,
  variant = "annuaire",
  disabledClassName,
  open: openControlled,
  onOpenChange,
  hideTrigger = false,
}: Props) {
  const titleId = useId();
  const [openInternal, setOpenInternal] = useState(false);
  const open = openControlled ?? openInternal;
  const setOpen = onOpenChange ?? setOpenInternal;
  const location = resolvePharmacyLocation(pharmacy);
  const storedMapsUrl = pharmacy.maps_url?.trim() || null;
  const canNavigate = location !== null || Boolean(storedMapsUrl);

  const links: NavigationProviderLink[] = location ? buildNavigationProviderLinks(location) : [];

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const releaseScroll = lockBodyScroll();
    return () => {
      document.removeEventListener("keydown", onKey);
      releaseScroll();
    };
  }, [open, close]);

  const trackOpen = () => {
    if (pharmacy.pharmacyId) {
      trackPharmacyEngagement({
        pharmacyId: pharmacy.pharmacyId,
        eventType: "maps_click",
        source,
      });
    }
  };

  const openPicker = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!canNavigate) return;
    trackOpen();
    setOpen(true);
  };

  const triggerClass =
    variant === "annuaire-rail"
      ? clsx(
          uiAnnuaireActionOverlayBtn(),
          !canNavigate && (disabledClassName ?? "pointer-events-none opacity-45"),
          className
        )
      : variant === "annuaire-overlay"
        ? clsx(
            uiAnnuaireActionOverlayBtnGhost(),
            !canNavigate && (disabledClassName ?? "pointer-events-none opacity-45"),
            className
          )
        : variant === "annuaire"
        ? clsx(
            uiAnnuaireQuickAction(),
            !canNavigate && (disabledClassName ?? "pointer-events-none opacity-45"),
            className
          )
        : clsx(
            uiAnnuaireQuickAction("inline-flex flex-row items-center gap-1.5 px-3 py-2 text-xs"),
            !canNavigate && "opacity-45",
            className
          );

  return (
    <>
      {!hideTrigger ? (
        <button
          type="button"
          onClick={openPicker}
          disabled={!canNavigate}
          className={triggerClass}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          {variant === "compact-outline" ? (
            "Itinéraire"
          ) : variant === "annuaire-rail" || variant === "annuaire-overlay" ? (
            <MapPin className="size-3.5" aria-hidden />
          ) : (
            <Navigation className="size-4" aria-hidden />
          )}
          {variant === "annuaire-rail" || variant === "annuaire-overlay" ? (
            <span className="sr-only">Localisation</span>
          ) : variant === "annuaire" ? (
            "Itinéraire"
          ) : variant === "compact-outline" ? null : (
            "Y aller"
          )}
        </button>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            aria-label="Fermer"
            onClick={close}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative z-[81] w-full max-w-md rounded-t-2xl border border-border bg-card p-4 shadow-xl sm:rounded-2xl"
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <h2 id={titleId} className="text-base font-bold text-foreground">
                  Ouvrir avec…
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Choisissez l&apos;application de navigation sur votre téléphone ou ordinateur.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
                aria-label="Fermer"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>

            {pharmacy.nom ? (
              <p className="mb-3 flex items-start gap-1.5 text-xs text-muted-foreground">
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-primary/70" aria-hidden />
                <span>
                  {pharmacy.nom}
                  {pharmacy.ville ? ` — ${pharmacy.ville}` : ""}
                </span>
              </p>
            ) : null}

            <ul className="space-y-2">
              {links.map((link) => (
                <li key={link.id}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    onClick={close}
                    className="flex flex-col rounded-xl border border-border/80 bg-muted/20 px-3 py-2.5 transition hover:border-primary/30 hover:bg-primary/5"
                  >
                    <span className="text-sm font-semibold text-foreground">{link.label}</span>
                    <span className="text-[11px] text-muted-foreground">{link.description}</span>
                  </a>
                </li>
              ))}
              {storedMapsUrl ? (
                <li>
                  <a
                    href={storedMapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={close}
                    className="flex flex-col rounded-xl border border-dashed border-border px-3 py-2.5 text-sm font-semibold text-foreground hover:bg-muted/30"
                  >
                    Lien partagé par l&apos;officine
                    <span className="text-[11px] font-normal text-muted-foreground">
                      Ouvre exactement le lien enregistré (Google, Waze, etc.)
                    </span>
                  </a>
                </li>
              ) : null}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}
