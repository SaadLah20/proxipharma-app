import type { AppLocale } from "@/lib/i18n/config";

/** Repli client si title_ar absent en base (notifications historiques). */
const TITLE_AR_BY_FR: Record<string, string> = {
  "Passage en pharmacie mis à jour": "تم تحديث موعد زيارة الصيدلية",
  "Rappel — validation en attente": "تذكير — التأكيد قيد الانتظار",
  "Mise à jour après validation": "تحديث بعد التأكيد",
  "Produit reçu en officine": "منتج وصل إلى الصيدلية",
  "Produit reçu en pharmacie": "منتج وصل إلى الصيدلية",
  "Réception annulée en officine": "تم إلغاء الاستلام في الصيدلية",
  "Réception en pharmacie annulée": "تم إلغاء الاستلام في الصيدلية",
  "Produit de nouveau disponible": "منتج متوفر مجدداً",
  "Réponse mise à jour": "تم تحديث الرد",
  "La pharmacie a mis à jour sa réponse": "تم تحديث الرد",
  "Réponse de la pharmacie": "رد من الصيدلية",
  "La pharmacie vous a répondu": "ردّت الصيدلية",
  "Préparation terminée": "انتهى التحضير",
  "Dossier clôturé": "ملف مُغلق",
  "Demande clôturée": "طلب مُغلق",
  "Demande annulée": "طلب ملغى",
  "Demande abandonnée": "طلب مُهمَل",
  "Demande expirée": "طلب منتهٍ",
  "Mise à jour": "تحديث",
  "Mise à jour de votre demande": "تحديث طلبك",
  "Demande validée mise à jour": "تم تحديث الطلب المُؤكد",
  "La pharmacie a mis à jour votre demande validée": "تم تحديث الطلب المُؤكد",
  "Demande traitée": "تمت معالجة الطلب",
  "Votre demande est traitée par la pharmacie": "تمت معالجة الطلب",
  "Message de votre pharmacie": "رسالة من صيدليتك",
  "Ordonnance mise à jour": "تم تحديث الوصفة",
  "Votre pack est confirmé": "تم تأكيد باقتك",
  "Pack non disponible": "الباقة غير متاحة",
  "Pack récupéré": "تم استلام الباقة",
  "Réservation pack annulée": "تم إلغاء حجز الباقة",
  "Réservation annulée par l'officine": "ألغت الصيدلية الحجز",
  "Réservation annulée": "تم إلغاء الحجز",
  "Nouvelle réservation pack promo": "حجز باقة ترويجية جديد",
  "Votre demande est en cours de traitement": "طلبك قيد المعالجة",
  "Votre commande est prête en pharmacie": "طلبك جاهز في الصيدلية",
  "Votre demande est clôturée": "طلبك مُغلق",
  "Votre demande a été annulée": "تم إلغاء طلبك",
  "Votre demande a été abandonnée": "تم التخلي عن طلبك",
  "Votre demande a expiré": "انتهت صلاحية طلبك",
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
