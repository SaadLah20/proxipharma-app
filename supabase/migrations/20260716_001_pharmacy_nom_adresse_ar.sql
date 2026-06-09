-- Nom et adresse en arabe (facultatifs) — saisie admin / édition ma-fiche pharmacien.

alter table public.pharmacies
  add column if not exists nom_ar text,
  add column if not exists adresse_ar text;

comment on column public.pharmacies.nom_ar is
  'Nom de l''officine en arabe — affiché côté patient si locale ar et valeur renseignée.';
comment on column public.pharmacies.adresse_ar is
  'Adresse en arabe — affichée côté patient si locale ar et valeur renseignée.';

-- CRM patient : exposer les champs AR dans le détail officine.
create or replace function public.patient_pharmacy_detail(p_pharmacy_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_patient_id uuid;
  v_pharmacy jsonb;
  v_requests jsonb;
  v_promos jsonb;
begin
  if auth.uid() is null or p_pharmacy_id is null then
    return null;
  end if;

  select p.id into v_patient_id
  from public.profiles p
  where p.id = auth.uid()
    and p.role = 'patient';

  if v_patient_id is null then
    return null;
  end if;

  if not exists (
    select 1
    from public.requests r
    where r.pharmacy_id = p_pharmacy_id
      and r.patient_id = v_patient_id
      and r.status <> 'draft'
    union all
    select 1
    from public.pharmacy_promo_reservations pr
    where pr.pharmacy_id = p_pharmacy_id
      and pr.patient_id = v_patient_id
  ) then
    return null;
  end if;

  select jsonb_build_object(
    'pharmacy_id', ph.id,
    'nom', ph.nom,
    'nom_ar', ph.nom_ar,
    'ville', ph.ville,
    'adresse', ph.adresse,
    'adresse_ar', ph.adresse_ar,
    'telephone', ph.telephone,
    'whatsapp', ph.whatsapp,
    'pharmacy_public_ref', ph.public_ref,
    'rating_avg', ph.rating_avg,
    'rating_count', ph.rating_count
  )
  into v_pharmacy
  from public.pharmacies ph
  where ph.id = p_pharmacy_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'request_type', r.request_type::text,
        'status', r.status::text,
        'request_public_ref', r.request_public_ref,
        'created_at', r.created_at,
        'updated_at', r.updated_at,
        'submitted_at', r.submitted_at,
        'responded_at', r.responded_at
      )
      order by r.updated_at desc nulls last
    ),
    '[]'::jsonb
  )
  into v_requests
  from public.requests r
  where r.pharmacy_id = p_pharmacy_id
    and r.patient_id = v_patient_id
    and r.status <> 'draft';

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', pr.id,
        'status', pr.status::text,
        'public_ref', pr.public_ref,
        'pickup_date', pr.pickup_date,
        'created_at', pr.created_at,
        'updated_at', pr.updated_at,
        'offer_title', o.title
      )
      order by pr.updated_at desc nulls last
    ),
    '[]'::jsonb
  )
  into v_promos
  from public.pharmacy_promo_reservations pr
  left join public.pharmacy_promo_offers o on o.id = pr.offer_id
  where pr.pharmacy_id = p_pharmacy_id
    and pr.patient_id = v_patient_id;

  return jsonb_build_object(
    'pharmacy', v_pharmacy,
    'requests', v_requests,
    'promo_reservations', v_promos
  );
end;
$$;

revoke all on function public.patient_pharmacy_detail(uuid) from public;
grant execute on function public.patient_pharmacy_detail(uuid) to authenticated;
