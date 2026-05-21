/** Types fiche digitale pharmacie (alignés migrations 20260606_001). */

export type PharmacyWeeklyPeriod = "morning" | "afternoon";

export type PharmacyWeeklyHourRow = {
  weekday: number;
  period: PharmacyWeeklyPeriod;
  opens_at: string | null;
  closes_at: string | null;
  is_closed: boolean;
};

export type PharmacyDayOverrideRow = {
  id: string;
  day_date: string;
  override_type: "closed" | "holiday" | "custom";
  label: string | null;
  morning_opens_at: string | null;
  morning_closes_at: string | null;
  afternoon_opens_at: string | null;
  afternoon_closes_at: string | null;
};

export type PharmacyOnCallKind = "weekend_48h" | "weekday_24h" | "holiday_24h";

export type PharmacyOnCallPeriodRow = {
  id: string;
  kind: PharmacyOnCallKind;
  starts_at: string;
  ends_at: string;
  note: string | null;
};

export type PharmacyServiceCatalogRow = {
  id: string;
  label_fr: string;
};

export type PharmacyPublicProfileRow = {
  id: string;
  nom: string;
  ville: string;
  adresse: string;
  telephone: string | null;
  whatsapp: string | null;
  statut: string;
  public_ref?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  cover_image_path?: string | null;
  logo_url?: string | null;
  welcome_text?: string | null;
  titular_name?: string | null;
  titular_title?: string | null;
  email?: string | null;
  website_url?: string | null;
  facebook_url?: string | null;
  instagram_url?: string | null;
  maps_url?: string | null;
  rating_avg?: number | null;
  rating_count?: number | null;
};

export type PharmacyOpenStatus = "open" | "closed" | "on_call";

export type PharmacyDayScheduleLine = {
  dateIso: string;
  weekdayLabel: string;
  dateLabel: string;
  lines: string[];
  isToday: boolean;
  isException: boolean;
};
