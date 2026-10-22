-- ============================================================================
-- Migration : Génération du matricule d'école + abonnement essai 30 jours
-- lors de l'inscription du directeur.
-- Phase test : abonnement "Pro" 30 jours gratuit pour permettre l'accès complet.
-- Production : le support activera l'abonnement réel après paiement.
-- ============================================================================

-- Mise à jour de finish_director_registration pour générer le matricule
-- et créer un abonnement essai 30 jours (plan Pro, 300 élèves)
create or replace function public.finish_director_registration(
  p_user_id uuid,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_email text,
  p_school_name text,
  p_city text,
  p_cycles text[]
)
returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  v_school_id uuid;
  v_cycles_text text[];
  v_matricule text;
  v_ends_at date := current_date + 30; -- essai 30 jours
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

  v_cycles_text := p_cycles;

  -- Générer le matricule d'école
  for attempt in 1..50 loop
    v_matricule := public.app_random_code(5);
    if not exists (select 1 from public.schools s where s.matricule = v_matricule) then
      exit;
    end if;
    if attempt = 50 then
      raise exception 'Impossible de générer un matricule unique, réessayez.';
    end if;
  end loop;

  insert into public.schools (name, city, address, phone, email, cycles, registration_open, auto_approve_students, matricule)
  values (trim(p_school_name), trim(p_city), '', trim(p_phone), trim(p_email), v_cycles_text::app_cycle[], true, false, v_matricule)
  returning id into v_school_id;

  insert into public.school_settings (school_id, school_year, period_type, current_period, annex_fees, sibling_discount)
  values (
    v_school_id,
    extract(year from now())::int::text || '-' || (extract(year from now())::int + 1)::text,
    'semestre', 'S1',
    '{"cantine": 10000, "transport": 15000, "tenue": 12000}'::jsonb,
    10
  );

  -- Frais par niveau : valeurs par défaut identiques à src/data/school.ts,
  -- limitées aux cycles ouverts de l'école.
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

  insert into public.subjects (school_id, name, cycles)
  values
    (v_school_id, 'Français', v_cycles_text::app_cycle[]),
    (v_school_id, 'Mathématiques', v_cycles_text::app_cycle[]),
    (v_school_id, 'Histoire-Géographie', v_cycles_text::app_cycle[]),
    (v_school_id, 'Éducation physique et sportive', v_cycles_text::app_cycle[]);

  insert into public.profiles (id, school_id, role, status, first_name, last_name, phone, email)
  values (p_user_id, v_school_id, 'directeur', 'ACTIF', trim(p_first_name), trim(p_last_name), trim(p_phone), trim(p_email));

  -- Abonnement essai 30 jours (plan Pro) pour phase test
  insert into public.subscriptions (school_id, plan_id, starts_at, ends_at, student_limit, amount_paid, payment_ref, method)
  values (v_school_id, 'pro', current_date, v_ends_at, 300, 0, 'ESSAI_30J', 'test');

  insert into public.subscription_events (school_id, event_type, plan_id, amount_paid, payment_ref, method, starts_at, ends_at, payload)
  values (v_school_id, 'purchase', 'pro', 0, 'ESSAI_30J', 'test', current_date, v_ends_at, jsonb_build_object('trial', true));

  insert into public.audit_log (school_id, actor_id, actor_role, action, entity, entity_id)
  values (v_school_id, p_user_id, 'directeur', 'register_director', 'schools', v_school_id);

  return v_school_id;
end;
$$;

-- Révoquer et réaccorder les permissions
revoke execute on function public.finish_director_registration(uuid, text, text, text, text, text, text, text[])
  from anon, authenticated, public;
grant execute on function public.finish_director_registration(uuid, text, text, text, text, text, text, text[])
  to service_role;