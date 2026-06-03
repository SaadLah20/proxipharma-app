"use client";

import type { MouseEvent } from "react";
import { MessageCircle, Phone, Share2 } from "lucide-react";
import { PharmacyNavigationPicker } from "@/components/pharmacy/pharmacy-navigation-picker";
import { hasPharmacyNavigation } from "@/lib/pharmacy-navigation";
import { trackPharmacyEngagement } from "@/lib/pharmacy-engagement";
import type { PharmacyEngagementSource } from "@/lib/pharmacy-engagement";
import { pharmacyPublicLabel } from "@/lib/pharmacy-public-label";
import { uiAnnuaireActionOverlayBtnGhost } from "@/lib/ui-action-buttons";
import { cn } from "@/lib/utils";

export type PharmacyCoverOverlayTarget = {
  id: string;
  nom: string;
  telephone?: string | null;
  whatsapp?: string | null;
  adresse?: string | null;
  ville?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  maps_url?: string | null;
};

function normalizeWhatsApp(value: string | null | undefined) {
  return (value ?? "").replace(/[^\d]/g, "");
}

export function PharmacyCoverOverlayActions({
  pharmacy,
  source,
  onShare,
  className,
}: {
  pharmacy: PharmacyCoverOverlayTarget;
  source: PharmacyEngagementSource;
  onShare: (e: MouseEvent<HTMLButtonElement>) => void;
  className?: string;
}) {
  const wa = normalizeWhatsApp(pharmacy.whatsapp);
  const canNavigate = hasPharmacyNavigation(pharmacy);
  const label = pharmacyPublicLabel(pharmacy.nom);
  const ghostBtn = (disabled?: boolean) =>
    cn(uiAnnuaireActionOverlayBtnGhost(), disabled && "pointer-events-none opacity-40");

  return (
    <div
      className={cn(
        "absolute right-1.5 top-1/2 z-[2] flex -translate-y-1/2 flex-col items-center gap-0.5 sm:right-2",
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <a
        href={pharmacy.telephone ? `tel:${pharmacy.telephone}` : undefined}
        aria-disabled={!pharmacy.telephone}
        aria-label={pharmacy.telephone ? `Appeler ${label}` : "Téléphone non renseigné"}
        onClick={(e) => {
          if (!pharmacy.telephone) e.preventDefault();
          else
            trackPharmacyEngagement({
              pharmacyId: pharmacy.id,
              eventType: "phone_click",
              source,
            });
        }}
        className={ghostBtn(!pharmacy.telephone)}
      >
        <Phone className="size-3.5" aria-hidden />
      </a>
      <a
        href={wa ? `https://wa.me/${wa}` : undefined}
        target={wa ? "_blank" : undefined}
        rel={wa ? "noreferrer" : undefined}
        aria-disabled={!wa}
        aria-label={wa ? `WhatsApp ${label}` : "WhatsApp non renseigné"}
        onClick={(e) => {
          if (!wa) e.preventDefault();
          else
            trackPharmacyEngagement({
              pharmacyId: pharmacy.id,
              eventType: "whatsapp_click",
              source,
            });
        }}
        className={ghostBtn(!wa)}
      >
        <MessageCircle className="size-3.5" aria-hidden />
      </a>
      <PharmacyNavigationPicker
        pharmacy={{
          pharmacyId: pharmacy.id,
          nom: pharmacy.nom,
          adresse: pharmacy.adresse,
          ville: pharmacy.ville,
          latitude: pharmacy.latitude,
          longitude: pharmacy.longitude,
          maps_url: pharmacy.maps_url,
        }}
        source={source}
        variant="annuaire-overlay"
        disabledClassName={!canNavigate ? "pointer-events-none opacity-40" : undefined}
        className={!canNavigate ? "pointer-events-none opacity-40" : undefined}
      />
      <button type="button" onClick={onShare} className={ghostBtn()} aria-label={`Partager ${label}`}>
        <Share2 className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}
