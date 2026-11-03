-- ============================================================================
-- 00042 — Matières du curriculum sénégalais par cycle.
--
-- Enrichit la liste des matières créées à l'inscription d'un directeur
-- (finish_director_registration) pour refléter les programmes officiels du
-- Sénégal (élémentaire CI-CM2, moyen 6e-3e, secondaire 2nde-Tle), et
-- complète les écoles déjà existantes (backfill) pour que les directeurs
-- actuels bénéficient aussi de la nouvelle liste.
--
-- Idempotente : peut être rejouée sans erreur (ON CONFLICT / NOT EXISTS).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Redéfinition de finish_director_registration avec la liste enrichie.
--    On conserve la logique de 00035 et on remplace uniquement le bloc subjects.
-- ----------------------------------------------------------------------------
drop function if exists public.finish_director_registration(uuid, text, text, text, text, text, text, text, text[], text);

create or replace function public.finish_director_registration(
  p_user_id uuid,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_email text,
  p_school_name text,
  p_city text,
  p_address text,
  p_cycles text[],
  p_plan_id text default 'essentiel'
)
returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  v_school_id uuid;
  v_cycles_text text[];
  v_matricule text;
  v_plan record;
  v_days int;
  v_ends date;
  v_ref text;
begin
  if p_user_id is null then
    raise exception 'Compte introuvable.';
  end if;
  if p_cycles is null or array_length(p_cycles, 1) = 0
     or not app_valid_cycles(p_cycles) then
    raise exception 'Sélectionnez au moins un cycle.';
  end if;
  if exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'Un compte existe déjà avec cet e-mail.';
  end if;

  select * into v_plan
  from public.plans
  where id::text = coalesce(nullif(trim(p_plan_id), ''), 'essentiel');
  if not found then
    raise exception 'Formule d''abonnement inconnue.';
  end if;

  v_cycles_text := p_cycles;

  for attempt in 1..50 loop
    v_matricule := public.app_random_code(5);
    if not exists (select 1 from public.schools s where s.matricule = v_matricule) then
      exit;
    end if;
    if attempt = 50 then
      raise exception 'Impossible de générer un matricule unique, réessayez.';
    end if;
  end loop;

  insert into public.schools
    (name, city, address, phone, email, cycles, registration_open,
     auto_approve_students, matricule, requested_plan)
  values
    (trim(p_school_name), trim(p_city), trim(p_address), trim(p_phone), trim(p_email),
     v_cycles_text::app_cycle[], true, false, v_matricule, v_plan.id)
  returning id into v_school_id;

  insert into public.school_settings (school_id, school_year, period_type, current_period, annex_fees, sibling_discount)
  values (
    v_school_id,
    extract(year from now())::int::text || '-' || (extract(year from now())::int + 1)::text,
    'semestre', 'S1',
    '{"cantine": 10000, "transport": 15000, "tenue": 12000}'::jsonb,
    10
  );

  insert into public.level_fees (school_id, level_id, inscription, mensualite)
  select v_school_id, lf.level_id, lf.inscription, lf.mensualite
  from (values
    ('elementaire', 'ci',   30000, 20000), ('elementaire', 'cp',   30000, 20000),
    ('elementaire', 'ce1',  30000, 22500), ('elementaire', 'ce2',  30000, 25000),
    ('elementaire', 'cm1',  35000, 25000), ('elementaire', 'cm2',  35000, 27500),
    ('moyen',       '6e',   40000, 30000), ('moyen',       '5e',   40000, 30000),
    ('moyen',       '4e',   40000, 32500), ('moyen',       '3e',   45000, 35000),
    ('secondaire',  '2nde', 50000, 40000), ('secondaire',  '1ere', 50000, 42500),
    ('secondaire',  'tle',  55000, 45000)
  ) as lf(cycle, level_id, inscription, mensualite)
  where lf.cycle in (select unnest(v_cycles_text));

  -- Matières du curriculum sénégalais, filtrées selon les cycles choisis par l'école.
  insert into public.subjects (school_id, name, cycles)
  select v_school_id, s.name,
    (select array_agg(x)::app_cycle[] from (select unnest(s.cycles::text[]) intersect select unnest(v_cycles_text)) as t(x))
  from (values
    ('Français',                    array['elementaire','moyen','secondaire']),
    ('Mathématiques',               array['elementaire','moyen','secondaire']),
    ('Histoire et Géographie',      array['elementaire','moyen','secondaire']),
    ('Éducation physique et sportive', array['elementaire','moyen','secondaire']),
    ('Éveil scientifique',          array['elementaire']),
    ('Instruction civique',         array['elementaire']),
    ('Éducation artistique',        array['elementaire','moyen']),
    ('Langue nationale',            array['elementaire','moyen']),
    ('Arabe',                       array['elementaire','moyen','secondaire']),
    ('Éducation religieuse',        array['elementaire','moyen','secondaire']),
    ('Anglais',                     array['moyen','secondaire']),
    ('Sciences de la Vie et de la Terre', array['moyen','secondaire']),
    ('Sciences Physiques',          array['moyen','secondaire']),
    ('Éducation Civique et Morale', array['moyen','secondaire']),
    ('Technologie',                 array['moyen','secondaire']),
    ('Économie Familiale et Sociale', array['moyen']),
    ('Philosophie',                 array['secondaire']),
    ('Sciences Économiques et Sociales', array['secondaire']),
    ('Informatique',                array['secondaire'])
  ) as s(name, cycles)
  where exists (select 1 from unnest(s.cycles::text[]) c where c = any(v_cycles_text));

  insert into public.profiles (id, school_id, role, status, first_name, last_name, phone, email)
  values (p_user_id, v_school_id, 'directeur', 'ACTIF', trim(p_first_name), trim(p_last_name), trim(p_phone), trim(p_email));

  v_days := 365;
  v_ends := current_date + v_days;
  v_ref := 'INSCRIPTION-' || v_matricule;

  insert into public.subscriptions
    (school_id, plan_id, starts_at, ends_at, student_limit, amount_paid, payment_ref, method, paid_at)
  values
    (v_school_id, v_plan.id, current_date, v_ends, v_plan.student_limit, 0, v_ref, null, now());

  insert into public.subscription_events
    (school_id, event_type, plan_id, amount_paid, payment_ref, method, starts_at, ends_at, payload)
  values
    (v_school_id, 'purchase', v_plan.id, 0, v_ref, null, current_date, v_ends,
     jsonb_build_object('source', 'registration', 'plan', v_plan.id, 'days', v_days));

  insert into public.audit_log (school_id, actor_id, actor_role, action, entity, entity_id, payload)
  values (v_school_id, p_user_id, 'directeur', 'register_director', 'schools', v_school_id,
          jsonb_build_object('requested_plan', v_plan.id, 'subscription_ends_at', v_ends,
                             'amount_paid', 0));

  return v_school_id;
end;
$$;

revoke execute on function public.finish_director_registration(uuid, text, text, text, text, text, text, text, text[], text)
  from public, anon, authenticated;
grant execute on function public.finish_director_registration(uuid, text, text, text, text, text, text, text, text[], text)
  to service_role;

-- ----------------------------------------------------------------------------
-- 2. Backfill : ajouter les nouvelles matières aux écoles déjà existantes.
-- ----------------------------------------------------------------------------
insert into public.subjects (school_id, name, cycles)
select sc.id, s.name,
  (select array_agg(x)::app_cycle[] from (select unnest(s.cycles::text[]) intersect select unnest(sc.cycles::text[])) as t(x))
from public.schools sc
cross join (values
  ('Français',                    array['elementaire','moyen','secondaire']),
  ('Mathématiques',               array['elementaire','moyen','secondaire']),
  ('Histoire et Géographie',      array['elementaire','moyen','secondaire']),
  ('Éducation physique et sportive', array['elementaire','moyen','secondaire']),
  ('Éveil scientifique',          array['elementaire']),
  ('Instruction civique',         array['elementaire']),
  ('Éducation artistique',        array['elementaire','moyen']),
  ('Langue nationale',            array['elementaire','moyen']),
  ('Arabe',                       array['elementaire','moyen','secondaire']),
  ('Éducation religieuse',        array['elementaire','moyen','secondaire']),
  ('Anglais',                     array['moyen','secondaire']),
  ('Sciences de la Vie et de la Terre', array['moyen','secondaire']),
  ('Sciences Physiques',          array['moyen','secondaire']),
  ('Éducation Civique et Morale', array['moyen','secondaire']),
  ('Technologie',                 array['moyen','secondaire']),
  ('Économie Familiale et Sociale', array['moyen']),
  ('Philosophie',                 array['secondaire']),
  ('Sciences Économiques et Sociales', array['secondaire']),
  ('Informatique',                array['secondaire'])
) as s(name, cycles)
where exists (select 1 from unnest(s.cycles::text[]) c where c = any(sc.cycles::text[]))
  and not exists (select 1 from public.subjects sub where sub.school_id = sc.id and sub.name = s.name);