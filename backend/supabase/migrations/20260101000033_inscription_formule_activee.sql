-- ============================================================================
-- 00033 — Inscription directeur : formule activée immédiatement.
--
-- Produit :
--   * le formulaire d'inscription ne propose plus de choix de formule ;
--   * par défaut, l'école démarre sur le plan découverte (gratuit) ;
--   * la formule Premium est choisie depuis la page /tarifs, qui ouvre
--     /inscription?plan=premium ;
--   * la formule retenue est activée dès la création du compte :
--       - découverte (prix mensuel 0) : 365 jours ;
--       - formule payante            : 30 jours (le support encaisse ensuite
--         et prolonge via activate_school_subscription).
--
-- Cette migration :
--   1. rend le plan découverte réellement gratuit dans public.plans ;
--   2. ajoute schools.requested_plan (formule choisie) ;
--   3. remplace finish_director_registration (10 arguments, p_plan_id avec
--      valeur par défaut → compatible avec l'ancien appel à 9 arguments) et
--      crée l'abonnement immédiatement ;
--   4. corrige activate_school_subscription : passer d'une formule gratuite à
--      une formule payante repart d'aujourd'hui au lieu de prolonger l'année
--      gratuite (sinon un mois payé offrait un an de Premium).
--
-- Idempotente : peut être rejouée sans erreur.
-- ============================================================================

-- 1. Plan découverte réellement gratuit (le front l'affichait déjà à 0 FCFA,
--    mais la base était restée à 15 000 : l'abonnement « gratuit » aurait été
--    facturé et la détection du plan gratuit ne fonctionnait pas).
update public.plans
set name = 'Découverte',
    tagline = 'Pour démarrer une école',
    monthly_price = 0,
    yearly_price = 0
where id = 'essentiel';

-- 2. Formule choisie à l'inscription (traçabilité pour le support).
alter table public.schools
  add column if not exists requested_plan app_plan_id references public.plans (id);

comment on column public.schools.requested_plan is
  'Formule choisie par le directeur à l''inscription (activée immédiatement).';

-- 3. Inscription : ancienne signature à 9 arguments supprimée pour éviter une
--    surcharge résolue vers l'implémentation sans formule.
drop function if exists public.finish_director_registration(uuid, text, text, text, text, text, text, text, text[]);
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

  -- Formule validée contre le référentiel : jamais inventée côté client.
  select * into v_plan
  from public.plans
  where id::text = coalesce(nullif(trim(p_plan_id), ''), 'essentiel');
  if not found then
    raise exception 'Formule d''abonnement inconnue.';
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

  -- Abonnement immédiat : le directeur entre directement dans un tableau de
  -- bord fonctionnel (plus de « aucun abonnement » ni de lecture seule).
  v_days := case when v_plan.monthly_price = 0 then 365 else 30 end;
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

comment on function public.finish_director_registration(uuid, text, text, text, text, text, text, text, text[], text)
  is 'Inscription directeur atomique + activation immédiate de la formule choisie.';

-- ============================================================================
-- 4. Activation manuelle : ne jamais prolonger une période gratuite avec un
--    paiement. Le support qui active Premium sur une école découverte repart
--    de la date du jour.
-- ============================================================================
create or replace function public.activate_school_subscription(
  p_school_id  uuid,
  p_plan_id    text,
  p_cycle      text,
  p_amount_paid int default null,
  p_payment_ref text default '',
  p_method     text default 'especes'
)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_school    record;
  v_plan      record;
  v_sub       record;
  v_method    app_pay_method;
  v_days      int;
  v_amount    int;
  v_starts    date;
  v_ends      date;
  v_event     text;
  v_matricule text;
  v_ref       text;
  v_new       boolean := false;
  v_old_free  boolean := false;
begin
  if auth.role() is distinct from 'service_role'
     and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Activation réservée au support.';
  end if;

  select * into v_school from public.schools where id = p_school_id for update;
  if not found then
    raise exception 'École introuvable.';
  end if;

  select * into v_plan from public.plans where id::text = p_plan_id;
  if not found then
    raise exception 'Formule introuvable.';
  end if;

  if p_cycle is null or p_cycle not in ('monthly', 'yearly') then
    raise exception 'Cycle invalide (monthly ou yearly).';
  end if;
  if coalesce(p_method, 'especes') not in ('wave', 'orange_money', 'free_money', 'especes') then
    raise exception 'Moyen de paiement invalide.';
  end if;
  v_method := coalesce(p_method, 'especes')::app_pay_method;
  -- Une formule gratuite est toujours accordée pour un an, quel que soit le
  -- cycle choisi dans la console.
  v_days := case
    when v_plan.monthly_price = 0 then 365
    when p_cycle = 'yearly' then 365
    else 30
  end;

  v_amount := coalesce(
    p_amount_paid,
    case when p_cycle = 'yearly' then v_plan.yearly_price else v_plan.monthly_price end
  );
  if v_amount < 0 then
    raise exception 'Montant invalide.';
  end if;

  v_ref := coalesce(
    nullif(trim(coalesce(p_payment_ref, '')), ''),
    'MANUAL-' || to_char(now(), 'YYYYMMDD-HH24MISS')
  );

  select * into v_sub from public.subscriptions where school_id = p_school_id for update;
  if found then
    v_old_free := coalesce(
      (select p.monthly_price = 0 from public.plans p where p.id = v_sub.plan_id),
      false
    );

    if v_plan.monthly_price = 0 then
      -- (Re)mise à une formule gratuite : nouvelle année pleine.
      v_starts := current_date;
      v_ends   := current_date + v_days;
    elsif coalesce(v_sub.ends_at >= current_date, false) and not v_old_free then
      -- Renouvellement / changement de formule payante : cumul.
      v_starts := coalesce(v_sub.starts_at, current_date);
      v_ends   := v_sub.ends_at + v_days;
    else
      -- Passage d'une formule gratuite à une formule payante : le paiement
      -- démarre aujourd'hui, il n'achète pas l'année gratuite restante.
      v_starts := current_date;
      v_ends   := current_date + v_days;
    end if;
    v_event := case when v_sub.plan_id = v_plan.id then 'renewal' else 'plan_change' end;
  else
    v_starts := current_date;
    v_ends   := current_date + v_days;
    v_event  := 'purchase';
    v_new    := true;
  end if;

  insert into public.subscriptions
    (school_id, plan_id, starts_at, ends_at, student_limit, amount_paid, payment_ref, method, paid_at)
  values
    (p_school_id, v_plan.id, v_starts, v_ends, v_plan.student_limit, v_amount, v_ref,
     v_method, now())
  on conflict (school_id) do update set
    plan_id       = excluded.plan_id,
    starts_at     = excluded.starts_at,
    ends_at       = excluded.ends_at,
    student_limit = excluded.student_limit,
    amount_paid   = excluded.amount_paid,
    payment_ref   = excluded.payment_ref,
    method        = excluded.method,
    paid_at       = excluded.paid_at;

  if v_school.matricule is null then
    v_matricule := public.generate_school_matricule();
    update public.schools set matricule = v_matricule where id = p_school_id;
  else
    v_matricule := v_school.matricule;
  end if;

  insert into public.subscription_events
    (school_id, event_type, plan_id, amount_paid, payment_ref, method, starts_at, ends_at, payload)
  values
    (p_school_id, v_event, v_plan.id, v_amount, v_ref, v_method,
     v_starts, v_ends, jsonb_build_object('source', 'manual_activation', 'cycle', p_cycle));

  insert into public.audit_log
    (school_id, actor_id, actor_role, action, entity, entity_id, payload)
  values
    (p_school_id, null, 'service_role', 'subscription_activated_manually', 'subscriptions', null,
     jsonb_build_object('plan', v_plan.id, 'cycle', p_cycle, 'amount', v_amount,
                        'payment_ref', v_ref, 'matricule_created', v_school.matricule is null));

  return jsonb_build_object(
    'school_id', p_school_id,
    'matricule', v_matricule,
    'matriculeCreated', v_school.matricule is null,
    'plan_id', v_plan.id,
    'plan_name', v_plan.name,
    'cycle', p_cycle,
    'amount_paid', v_amount,
    'payment_ref', v_ref,
    'method', v_method,
    'starts_at', v_starts,
    'ends_at', v_ends,
    'new_subscription', v_new
  );
end;
$$;

revoke execute on function public.activate_school_subscription(uuid, text, text, int, text, text)
  from public, anon, authenticated;
grant execute on function public.activate_school_subscription(uuid, text, text, int, text, text)
  to service_role;

comment on function public.activate_school_subscription(uuid, text, text, int, text, text)
  is 'Activation manuelle support : crée/prolonge l''abonnement, sans prolonger une période gratuite.';
