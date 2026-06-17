import { formatDateShortYmdForLocale, formatMinutesForLocale } from "@/lib/datetime-locale";
import type { AppLocale } from "@/lib/i18n/config";
import { localeToBcp47 } from "@/lib/i18n/config";
import type { MoroccoPublicHoliday } from "@/lib/morocco-public-holidays";
import type { PharmacyDayOverrideRow } from "@/lib/pharmacy-profile-types";

/** Libellés d'affichage horaires / gardes (fiche publique, annuaire). */
export type PharmacyScheduleLabels = {
  morning: string;
  afternoon: string;
  closed: string;
  afternoonClosed: string;
  notProvided: string;
  closedExceptional: string;
  customHours: string;
  onCallFullDay: string;
  onCallFrom: (time: string) => string;
  onCallUntil: (time: string) => string;
  onCallKind: Record<string, string>;
  holidayPrefix: string;
  holidayUncertainSuffix: string;
  closedWithLabel: (label: string) => string;
  holidayWithLabel: (label: string) => string;
  periodLine: (period: string, slot: string) => string;
  holidayLine: (name: string, uncertain: boolean) => string;
  weekdayLabel: (weekday: number) => string;
  dateLabel: (dateIso: string) => string;
  formatMinutes: (min: number) => string;
  formatSlot: (opensMin: number, closesMin: number) => string;
};

const ON_CALL_KIND_FR: Record<string, string> = {
  weekend_48h: "Garde 48 h (week-end)",
  weekday_24h: "Garde 24 h (jour ouvré)",
  holiday_24h: "Garde 24 h (jour férié)",
};

const ON_CALL_KIND_AR: Record<string, string> = {
  weekend_48h: "مناوبة 48 س (عطلة نهاية الأسبوع)",
  weekday_24h: "مناوبة 24 س (يوم عمل)",
  holiday_24h: "مناوبة 24 س (عطلة رسمية)",
};

const HOLIDAY_LABEL_AR: Record<string, string> = {
  "new-year": "رأس السنة الميلادية",
  "independence-manifesto": "ذكرى بيان الاستقلال",
  "amazigh-new-year": "رأس السنة الأمازيغية (إناصل)",
  "labour-day": "عيد الشغل",
  "throne-day": "عيد العرش",
  "oued-ed-dahab": "ذكرى استرجاع وادي الذهب",
  "revolution-day": "ذكرى ثورة الملك والشعب",
  "youth-day": "عيد الشباب",
  "green-march": "ذكرى المسيرة الخضراء",
  "independence-day": "ذكرى الاستقلال",
  "eid-fitr": "عيد الفطر",
  "eid-adha": "عيد الأضحى",
  mawlid: "المولد النبوي الشريف",
  ashura: "عاشوراء",
};

function holidayBaseId(id: string): string {
  return id.replace(/-\d{4}$/, "");
}

export function moroccoHolidayLabelForLocale(h: MoroccoPublicHoliday, locale: AppLocale): string {
  if (locale === "ar") {
    return HOLIDAY_LABEL_AR[holidayBaseId(h.id)] ?? h.labelFr;
  }
  return h.labelFr;
}

/** Lundi = 1 … Dimanche = 7 */
function weekdayLabelFromIntl(weekday: number, locale: AppLocale): string {
  const baseMonday = new Date(2025, 0, 6);
  const d = new Date(baseMonday);
  d.setDate(baseMonday.getDate() + weekday - 1);
  return d.toLocaleDateString(localeToBcp47(locale), { weekday: "long" });
}

export function pharmacyScheduleLabelsForLocale(locale: AppLocale): PharmacyScheduleLabels {
  const formatMinutes = (min: number) => formatMinutesForLocale(min, locale);

  if (locale === "ar") {
    return {
      morning: "الصباح",
      afternoon: "بعد الظهر",
      closed: "مغلق",
      afternoonClosed: "بعد الظهر : مغلق",
      notProvided: "لم يتم إدخال المواعيد",
      closedExceptional: "مغلق (استثناء)",
      customHours: "مواعيد خاصة",
      onCallFullDay: "مناوبة طوال اليوم",
      onCallFrom: (time) => `مناوبة من ${time}`,
      onCallUntil: (time) => `مناوبة حتى ${time}`,
      onCallKind: ON_CALL_KIND_AR,
      holidayPrefix: "عطلة رسمية",
      holidayUncertainSuffix: " (تاريخ تقديري)",
      closedWithLabel: (label) => `مغلق (${label})`,
      holidayWithLabel: (label) => `عطلة رسمية (${label})`,
      periodLine: (period, slot) => `${period} : ${slot}`,
      holidayLine: (name, uncertain) =>
        uncertain ? `عطلة رسمية — ${name}${" (تاريخ تقديري)"}` : `عطلة رسمية — ${name}`,
      weekdayLabel: (weekday) => weekdayLabelFromIntl(weekday, locale),
      dateLabel: (dateIso) => formatDateShortYmdForLocale(dateIso, locale),
      formatMinutes,
      formatSlot: (opensMin, closesMin) => `${formatMinutes(opensMin)} – ${formatMinutes(closesMin)}`,
    };
  }

  return {
    morning: "Matin",
    afternoon: "Après-midi",
    closed: "Fermé",
    afternoonClosed: "Après-midi : fermé",
    notProvided: "Horaires non renseignés",
    closedExceptional: "Fermé exceptionnellement",
    customHours: "Horaires spécifiques",
    onCallFullDay: "Permanence de garde — journée entière",
    onCallFrom: (time) => `Garde à partir de ${time}`,
    onCallUntil: (time) => `Garde jusqu'à ${time}`,
    onCallKind: ON_CALL_KIND_FR,
    holidayPrefix: "Férié",
    holidayUncertainSuffix: " (date estimée)",
    closedWithLabel: (label) => `Fermé (${label})`,
    holidayWithLabel: (label) => `Férié (${label})`,
    periodLine: (period, slot) => `${period} : ${slot}`,
    holidayLine: (name, uncertain) =>
      uncertain ? `Férié — ${name} (date estimée)` : `Férié — ${name}`,
    weekdayLabel: (weekday) => weekdayLabelFromIntl(weekday, locale),
    dateLabel: (dateIso) => formatDateShortYmdForLocale(dateIso, locale),
    formatMinutes,
    formatSlot: (opensMin, closesMin) => `${formatMinutes(opensMin)} – ${formatMinutes(closesMin)}`,
  };
}

export const OVERRIDE_TYPE_LABEL_FR: Record<PharmacyDayOverrideRow["override_type"], string> = {
  closed: "Fermeture exceptionnelle",
  holiday: "Jour férié",
  custom: "Horaires spécifiques",
};
