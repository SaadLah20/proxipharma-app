import type { AppLocale } from "@/lib/i18n/config";

/** Repli client si title_ar absent en base (notifications historiques). */
const TITLE_AR_BY_FR: Record<string, string> = {
  "Passage en pharmacie mis à jour": "تم تحديث موعد زيارة الصيدلية",
  "Rappel — validation en attente": "تذكير — التأكيد قيد الانتظار",
  "Mise à jour après validation": "تحديث بعد التأكيد",
  "Produit reçu en officine": "منتج وصل إلى الصيدلية",
  "Réception annulée en officine": "تم إلغاء الاستلام في الصيدلية",
  "Produit de nouveau disponible": "منتج متوفر مجدداً",
  "Réponse mise à jour": "تم تحديث الرد",
  "Réponse de la pharmacie": "رد من الصيدلية",
  "Préparation terminée": "انتهى التحضير",
  "Dossier clôturé": "ملف مُغلق",
  "Demande annulée": "طلب ملغى",
  "Demande abandonnée": "طلب مُهمَل",
  "Demande expirée": "طلب منتهٍ",
  "Mise à jour": "تحديث",
  "Demande validée mise à jour": "تم تحديث الطلب المُؤكد",
  "Demande traitée": "تمت معالجة الطلب",
};

export function fallbackPatientNotificationArabic(titleFr: string, bodyFr: string | null): {
  title: string;
  body: string | null;
} {
  const title = TITLE_AR_BY_FR[titleFr.trim()] ?? titleFr;
  if (!bodyFr) return { title, body: null };
  const body = bodyFr
    .replace(/\bVotre pharmacie\b/g, "صيدليتك")
    .replace(/\bPharmacie\b/g, "الصيدلية")
    .replace(/\bProduit\b/g, "منتج")
    .replace(/\bRéf\. dossier\b/g, "مرجع الملف")
    .replace(/\bdemande\b/g, "طلب")
    .replace(/\bordonnance\b/g, "وصفة")
    .replace(/\bconsultation\b/g, "استشارة");
  return { title, body };
}

export function resolvePatientNotificationDisplay(
  row: { title: string; body: string | null; title_ar?: string | null; body_ar?: string | null },
  locale: AppLocale,
): { title: string; body: string | null } {
  if (locale !== "ar") return { title: row.title, body: row.body };
  if (row.title_ar?.trim()) {
    return { title: row.title_ar, body: row.body_ar ?? row.body };
  }
  return fallbackPatientNotificationArabic(row.title, row.body);
}
