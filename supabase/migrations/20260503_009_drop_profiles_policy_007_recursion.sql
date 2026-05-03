-- La politique 007 (profiles_select_for_assigned_pharmacy_patients) provoquait une
-- récursion infinie avec requests_select_access (qui joint public.profiles pour le rôle).
-- La lecture nom/contact côté pharmacien passe par les RPC SECURITY DEFINER (008).

drop policy if exists "profiles_select_for_assigned_pharmacy_patients" on public.profiles;
