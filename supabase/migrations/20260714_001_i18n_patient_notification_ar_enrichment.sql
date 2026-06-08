-- i18n patient : enrichissement titres AR (promo, legacy, conversation) + backfill.

CREATE OR REPLACE FUNCTION public._patient_notification_ar_from_fr(p_title text, p_body text)
RETURNS TABLE (out_title_ar text, out_body_ar text)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_title text := coalesce(p_title, '');
  v_body text := coalesce(p_body, '');
BEGIN
  out_title_ar :=
    CASE btrim(v_title)
      WHEN 'Passage en pharmacie mis à jour' THEN 'تم تحديث موعد زيارة الصيدلية'
      WHEN 'Rappel — validation en attente' THEN 'تذكير — التأكيد قيد الانتظار'
      WHEN 'Mise à jour après validation' THEN 'تحديث بعد التأكيد'
      WHEN 'Produit reçu en officine' THEN 'منتج وصل إلى الصيدلية'
      WHEN 'Produit reçu en pharmacie' THEN 'منتج وصل إلى الصيدلية'
      WHEN 'Réception annulée en officine' THEN 'تم إلغاء الاستلام في الصيدلية'
      WHEN 'Réception en pharmacie annulée' THEN 'تم إلغاء الاستلام في الصيدلية'
      WHEN 'Produit de nouveau disponible' THEN 'منتج متوفر مجدداً'
      WHEN 'Réponse mise à jour' THEN 'تم تحديث الرد'
      WHEN 'La pharmacie a mis à jour sa réponse' THEN 'تم تحديث الرد'
      WHEN 'Réponse de la pharmacie' THEN 'رد من الصيدلية'
      WHEN 'La pharmacie vous a répondu' THEN 'ردّت الصيدلية'
      WHEN 'Préparation terminée' THEN 'انتهى التحضير'
      WHEN 'Dossier clôturé' THEN 'ملف مُغلق'
      WHEN 'Demande clôturée' THEN 'طلب مُغلق'
      WHEN 'Demande annulée' THEN 'طلب ملغى'
      WHEN 'Demande abandonnée' THEN 'طلب مُهمَل'
      WHEN 'Demande expirée' THEN 'طلب منتهٍ'
      WHEN 'Mise à jour' THEN 'تحديث'
      WHEN 'Mise à jour de votre demande' THEN 'تحديث طلبك'
      WHEN 'Demande validée mise à jour' THEN 'تم تحديث الطلب المُؤكد'
      WHEN 'La pharmacie a mis à jour votre demande validée' THEN 'تم تحديث الطلب المُؤكد'
      WHEN 'Demande traitée' THEN 'تمت معالجة الطلب'
      WHEN 'Votre demande est traitée par la pharmacie' THEN 'تمت معالجة الطلب'
      WHEN 'Message de votre pharmacie' THEN 'رسالة من صيدليتك'
      WHEN 'Ordonnance mise à jour' THEN 'تم تحديث الوصفة'
      WHEN 'Votre pack est confirmé' THEN 'تم تأكيد باقتك'
      WHEN 'Pack non disponible' THEN 'الباقة غير متاحة'
      WHEN 'Pack récupéré' THEN 'تم استلام الباقة'
      WHEN 'Réservation pack annulée' THEN 'تم إلغاء حجز الباقة'
      WHEN 'Réservation annulée par l''officine' THEN 'ألغت الصيدلية الحجز'
      WHEN 'Réservation annulée' THEN 'تم إلغاء الحجز'
      WHEN 'Nouvelle réservation pack promo' THEN 'حجز باقة ترويجية جديد'
      WHEN 'Votre demande est en cours de traitement' THEN 'طلبك قيد المعالجة'
      WHEN 'Votre commande est prête en pharmacie' THEN 'طلبك جاهز في الصيدلية'
      WHEN 'Votre demande est clôturée' THEN 'طلبك مُغلق'
      WHEN 'Votre demande a été annulée' THEN 'تم إلغاء طلبك'
      WHEN 'Votre demande a été abandonnée' THEN 'تم التخلي عن طلبك'
      WHEN 'Votre demande a expiré' THEN 'انتهت صلاحية طلبك'
      ELSE v_title
    END;

  out_body_ar := v_body;
  out_body_ar := replace(out_body_ar, 'Votre pharmacie', 'صيدليتك');
  out_body_ar := replace(out_body_ar, 'Pharmacie', 'الصيدلية');
  out_body_ar := replace(out_body_ar, 'Produit', 'منتج');
  out_body_ar := replace(out_body_ar, 'Réf. dossier', 'مرجع الملف');
  out_body_ar := replace(out_body_ar, 'demande', 'طلب');
  out_body_ar := replace(out_body_ar, 'ordonnance', 'وصفة');
  out_body_ar := replace(out_body_ar, 'consultation', 'استشارة');

  RETURN NEXT;
END;
$$;

UPDATE public.app_notifications n
SET
  (title_ar, body_ar) = (
    SELECT ar.out_title_ar, ar.out_body_ar
    FROM public._patient_notification_ar_from_fr(n.title, n.body) AS ar
    LIMIT 1
  )
WHERE EXISTS (
  SELECT 1 FROM public.profiles p
  WHERE p.id = n.recipient_id AND p.role = 'patient'
)
AND (n.title_ar IS NULL OR btrim(n.title_ar) = '' OR n.title_ar = n.title);
