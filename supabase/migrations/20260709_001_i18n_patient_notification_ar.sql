-- i18n patient : colonnes arabe pour notifications in-app + remplissage à l'insertion.

ALTER TABLE public.app_notifications
  ADD COLUMN IF NOT EXISTS title_ar text,
  ADD COLUMN IF NOT EXISTS body_ar text;

COMMENT ON COLUMN public.app_notifications.title_ar IS 'Titre notification patient (arabe standard).';
COMMENT ON COLUMN public.app_notifications.body_ar IS 'Corps notification patient (arabe standard).';

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
      WHEN 'Réception annulée en officine' THEN 'تم إلغاء الاستلام في الصيدلية'
      WHEN 'Produit de nouveau disponible' THEN 'منتج متوفر مجدداً'
      WHEN 'Réponse mise à jour' THEN 'تم تحديث الرد'
      WHEN 'Réponse de la pharmacie' THEN 'رد من الصيدلية'
      WHEN 'Préparation terminée' THEN 'انتهى التحضير'
      WHEN 'Dossier clôturé' THEN 'ملف مُغلق'
      WHEN 'Demande annulée' THEN 'طلب ملغى'
      WHEN 'Demande abandonnée' THEN 'طلب مُهمَل'
      WHEN 'Demande expirée' THEN 'طلب منتهٍ'
      WHEN 'Mise à jour' THEN 'تحديث'
      WHEN 'Demande validée mise à jour' THEN 'تم تحديث الطلب المُؤكد'
      WHEN 'Demande traitée' THEN 'تمت معالجة الطلب'
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

CREATE OR REPLACE FUNCTION public._app_notifications_fill_patient_ar()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_role text;
  v_ar record;
BEGIN
  IF NEW.title_ar IS NOT NULL AND btrim(NEW.title_ar) <> '' THEN
    RETURN NEW;
  END IF;

  SELECT p.role INTO v_role FROM public.profiles p WHERE p.id = NEW.recipient_id;
  IF v_role IS DISTINCT FROM 'patient' THEN
    RETURN NEW;
  END IF;

  SELECT t.out_title_ar, t.out_body_ar INTO v_ar
  FROM public._patient_notification_ar_from_fr(NEW.title, NEW.body) AS t;

  NEW.title_ar := v_ar.out_title_ar;
  NEW.body_ar := v_ar.out_body_ar;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_app_notifications_fill_patient_ar ON public.app_notifications;
CREATE TRIGGER trg_app_notifications_fill_patient_ar
  BEFORE INSERT ON public.app_notifications
  FOR EACH ROW
  EXECUTE FUNCTION public._app_notifications_fill_patient_ar();

-- Notifications historiques patient (sous-requêtes : n non référençable dans LATERAL du FROM en UPDATE)
UPDATE public.app_notifications n
SET
  (title_ar, body_ar) = (
    SELECT ar.out_title_ar, ar.out_body_ar
    FROM public._patient_notification_ar_from_fr(n.title, n.body) AS ar
    LIMIT 1
  )
WHERE EXISTS (
  SELECT 1
  FROM public.profiles p
  WHERE p.id = n.recipient_id
    AND p.role = 'patient'
)
AND (n.title_ar IS NULL OR btrim(n.title_ar) = '');
