-- Helper : types de demande partageant le workflow lignes produits (réponse + post-confirm).

create or replace function public._request_uses_product_line_workflow(p_type public.request_type_enum)
returns boolean
language sql
immutable
as $$
  select p_type in ('product_request'::public.request_type_enum, 'prescription'::public.request_type_enum);
$$;

comment on function public._request_uses_product_line_workflow(public.request_type_enum) is
  'Demande avec lignes produits, réponse pharmacien et suivi post-validation (produits + ordonnances).';

grant execute on function public._request_uses_product_line_workflow(public.request_type_enum) to authenticated;
