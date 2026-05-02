-- Jeu de données de démo (idempotent): demande produit + items + alternatives.
-- S'exécute seulement si: 2+ produits, 1+ pharmacie, 1+ profil patient, et la démo n'existe pas encore.

do $$
declare
  v_tag constant text := 'SEED_DEMO_WORKFLOW_v1';
  v_req_id uuid;
  v_item_a uuid;
  v_item_b uuid;
  v_patient_id uuid;
  v_pharmacy_id uuid;
  v_prod_a uuid;
  v_prod_b uuid;
  v_prod_alt uuid;
begin
  if exists (
    select 1 from public.product_requests pr where pr.patient_note = v_tag
  ) then
    raise notice 'seed %: already present, skip', v_tag;
    return;
  end if;

  select p.id into v_patient_id
  from public.profiles p
  where p.role = 'patient'
  limit 1;

  select ph.id into v_pharmacy_id
  from public.pharmacies ph
  limit 1;

  select pr.id into v_prod_a from public.products pr where pr.is_active = true order by pr.created_at asc limit 1 offset 0;
  select pr.id into v_prod_b from public.products pr where pr.is_active = true order by pr.created_at asc limit 1 offset 1;
  select pr.id into v_prod_alt from public.products pr where pr.is_active = true order by pr.created_at asc limit 1 offset 2;

  if v_patient_id is null or v_pharmacy_id is null or v_prod_a is null or v_prod_b is null then
    raise notice 'seed %: missing patient, pharmacy, or 2 products — skip', v_tag;
    return;
  end if;

  v_req_id := gen_random_uuid();

  insert into public.requests (
    id,
    patient_id,
    pharmacy_id,
    request_type,
    status,
    submitted_at,
    responded_at,
    expires_at
  ) values (
    v_req_id,
    v_patient_id,
    v_pharmacy_id,
    'product_request',
    'responded',
    now() - interval '2 days',
    now() - interval '1 day',
    now() + interval '7 days'
  );

  insert into public.product_requests (request_id, patient_note)
  values (v_req_id, v_tag);

  insert into public.request_items (
    request_id,
    product_id,
    requested_qty,
    availability_status,
    available_qty,
    unit_price,
    pharmacist_comment
  ) values (
    v_req_id,
    v_prod_a,
    2,
    'available',
    2,
    45.50,
    'Stock OK'
  )
  returning id into v_item_a;

  insert into public.request_items (
    request_id,
    product_id,
    requested_qty,
    availability_status,
    available_qty,
    pharmacist_comment
  ) values (
    v_req_id,
    v_prod_b,
    1,
    'unavailable',
    0,
    'Rupture locale'
  )
  returning id into v_item_b;

  if v_prod_alt is not null then
    insert into public.request_item_alternatives (
      request_item_id,
      rank,
      product_id,
      availability_status,
      available_qty,
      unit_price,
      pharmacist_comment
    ) values (
      v_item_b,
      1,
      v_prod_alt,
      'available',
      4,
      38.00,
      'Alternative proposée'
    );
  end if;

  insert into public.request_item_alternatives (
    request_item_id,
    rank,
    product_id,
    availability_status,
    available_qty,
    unit_price,
    pharmacist_comment
  ) values (
    v_item_a,
    1,
    v_prod_b,
    'available',
    10,
    12.00,
    'Si besoin d un second choix'
  );

  insert into public.request_status_history (request_id, old_status, new_status, changed_by, reason) values
    (v_req_id, null, 'submitted', null, v_tag),
    (v_req_id, 'submitted', 'in_review', null, v_tag),
    (v_req_id, 'in_review', 'responded', null, v_tag);
end;
$$;
