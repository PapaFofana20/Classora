-- ============================================================================
-- AUD-033 : format du matricule élève faux et indépendant de l'année
--
-- `left(p_school_year, 2)` renvoie « 20 » pour « 2026-2027 » : les matricules
-- sortaient « EC200001 » au lieu de « EC260001 » (le commentaire annonçait
-- pourtant « 26 » = année de DÉBUT de l'année scolaire).
--
-- Correctif : on extrait la première année à 4 chiffres de l'année scolaire
-- ('2026-2027' -> '2026' -> '26', '2027-2028' -> '27') puis on en garde les
-- deux derniers chiffres. Le compteur reste indexé par année scolaire
-- (public.counters.school_id, counter, year) : la numérotation repart à 1
-- chaque année.
--
-- Ce correctif est dans une migration dédiée et non dans 00002 : les
-- migrations 00001..00011 sont déjà appliquées sur les environnements
-- existants (modifying 00002 créerait une divergence local / hébergé).
-- ============================================================================

create or replace function public.next_student_matricule(p_school_id uuid, p_school_year text)
returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  v_seq  int;
  v_year text;
begin
  insert into public.counters (school_id, counter, year, value)
  values (p_school_id, 'student_matricule', p_school_year, 1)
  on conflict (school_id, counter, year) do update
    set value = public.counters.value + 1,
        updated_at = now()
  returning value into v_seq;

  -- Année de DÉBUT de l'année scolaire : « 2026-2027 » -> « 2026 » -> « 26 ».
  v_year := coalesce(nullif(substring(p_school_year from '(\d{4})'), ''), left(p_school_year, 4));

  return 'EC' || right(v_year, 2) || lpad(v_seq::text, 4, '0');
end;
$$;
