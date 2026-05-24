"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { trackPharmacyEngagement } from "@/lib/pharmacy-engagement";
import { PharmacyPublicBackLink } from "@/components/pharmacy/pharmacy-public-chrome";
import { PharmacyPublicProfile } from "@/components/pharmacy/pharmacy-public-profile";
import type {
  PharmacyDayOverrideRow,
  PharmacyOnCallPeriodRow,
  PharmacyPublicProfileRow,
  PharmacyServiceCatalogRow,
  PharmacyWeeklyHourRow,
} from "@/lib/pharmacy-profile-types";

export default function PharmacieFichePage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const hasId = Boolean(id);
  const [pharmacy, setPharmacy] = useState<PharmacyPublicProfileRow | null>(null);
  const [weeklyHours, setWeeklyHours] = useState<PharmacyWeeklyHourRow[]>([]);
  const [dayOverrides, setDayOverrides] = useState<PharmacyDayOverrideRow[]>([]);
  const [onCallPeriods, setOnCallPeriods] = useState<PharmacyOnCallPeriodRow[]>([]);
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [serviceCatalog, setServiceCatalog] = useState<PharmacyServiceCatalogRow[]>([]);
  const [loading, setLoading] = useState(hasId);
  const [error, setError] = useState("");
  const viewTracked = useRef(false);

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      const today = new Date();
      const weekStart = new Date(today);
      const js = today.getDay();
      weekStart.setDate(today.getDate() - ((js + 6) % 7));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      const weekStartIso = weekStart.toISOString().slice(0, 10);
      const weekEndIso = weekEnd.toISOString().slice(0, 10);

      const [phRes, whRes, ovRes, ocRes, svcRes, catRes] = await Promise.all([
        supabase
          .from("pharmacies")
          .select(
            "id,nom,ville,adresse,telephone,whatsapp,statut,public_ref,latitude,longitude,cover_image_path,logo_url,welcome_text,titular_name,titular_title,titular_public,email,website_url,facebook_url,instagram_url,maps_url,rating_avg,rating_count"
          )
          .eq("id", id)
          .maybeSingle(),
        supabase
          .from("pharmacy_weekly_hours")
          .select("weekday,period,opens_at,closes_at,is_closed")
          .eq("pharmacy_id", id)
          .order("weekday")
          .order("period"),
        supabase
          .from("pharmacy_day_overrides")
          .select(
            "id,day_date,override_type,label,morning_opens_at,morning_closes_at,afternoon_opens_at,afternoon_closes_at"
          )
          .eq("pharmacy_id", id)
          .gte("day_date", weekStartIso)
          .lte("day_date", weekEndIso),
        supabase
          .from("pharmacy_on_call_periods")
          .select("id,kind,starts_at,ends_at,note")
          .eq("pharmacy_id", id)
          .gte("ends_at", new Date(Date.now() - 14 * 86400000).toISOString())
          .order("starts_at"),
        supabase.from("pharmacy_services").select("service_id").eq("pharmacy_id", id),
        supabase.from("pharmacy_service_catalog").select("id,label_fr").eq("is_active", true).order("sort_order"),
      ]);

      if (phRes.error) {
        setError(phRes.error.message);
      } else if (!phRes.data) {
        setError("Cette pharmacie n'existe pas ou n'est plus disponible.");
      } else {
        setPharmacy(phRes.data as PharmacyPublicProfileRow);
        setWeeklyHours((whRes.data ?? []) as PharmacyWeeklyHourRow[]);
        setDayOverrides((ovRes.data ?? []) as PharmacyDayOverrideRow[]);
        setOnCallPeriods((ocRes.data ?? []) as PharmacyOnCallPeriodRow[]);
        setServiceIds((svcRes.data ?? []).map((r: { service_id: string }) => r.service_id));
        setServiceCatalog((catRes.data ?? []) as PharmacyServiceCatalogRow[]);
      }
      setLoading(false);
    };

    void load();
  }, [id]);

  useEffect(() => {
    if (!pharmacy?.id || viewTracked.current) return;
    viewTracked.current = true;
    trackPharmacyEngagement({
      pharmacyId: pharmacy.id,
      eventType: "profile_view",
      source: "profile",
    });
  }, [pharmacy?.id]);

  if (!hasId) {
    return (
      <main className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-lg rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          Pharmacie introuvable.
        </div>
        <Link href="/" className="mt-4 block text-center text-sm font-medium text-primary">
          Retour à l&apos;annuaire
        </Link>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-background p-6">
        <p className="text-sm text-muted-foreground">Chargement de la fiche…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background p-4 pb-10 sm:p-5">
      <div className="mx-auto max-w-lg">
        <PharmacyPublicBackLink href="/">Annuaire</PharmacyPublicBackLink>

        {error ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>
        ) : pharmacy ? (
          <PharmacyPublicProfile
            pharmacy={pharmacy}
            weeklyHours={weeklyHours}
            dayOverrides={dayOverrides}
            onCallPeriods={onCallPeriods}
            serviceIds={serviceIds}
            serviceCatalog={serviceCatalog}
          />
        ) : null}
      </div>
    </main>
  );
}
