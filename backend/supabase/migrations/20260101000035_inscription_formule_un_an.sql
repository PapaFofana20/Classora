-- ============================================================================
-- 00035 — Inscription : toute formule accordée pour un an (pas seulement la
-- formule gratuite).
--
-- Contexte : la passerelle de paiement n'est pas encore intégrée. À
-- l'inscription, le plan Premium doit fonctionner exactement comme le plan
-- Découverte : abonnement actif immédiatement, accordé pour 365 jours, sans
-- encaissement (amount_paid = 0). La limite d'élèves propre à la formule
-- (Premium = 600 élèves) reste inchangée.
--
-- Produit :
--   * finish_director_registration : v_days passe de
--     « 365 si gratuit, 30 si payant » à 365 pour TOUTES les formules ;
--   * le reste du comportement (matricule, paramètres, frais, matières,
--     profil, requested_plan, audit) est conservé à l'identique.
--
-- L'activation manuelle du support (activate_school_subscription, migration
-- 00033 au paragraphe 4) reste inchangée : quand le support encaissera un vrai
-- paiement (ou quand la passerelle sera branchée), prolonger une échéance
-- active cumule toujours.
--
-- Cette migration supprime d'abord les signatures antérieures avant de
-- recréer la fonction, pour ne pas laisser de surcharge résolue vers une
-- ancienne implémentation. Idempotente : peut être rejouée sans erreur.
-- ============================================================================

drop function if exists public.finish_director_registration(uuid, text, text, text, text, text, text, text);
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

  -- Abonnement immédiat et annuel. Tant que la passerelle de paiement n'est
  -- pas intégrée, TOUTES les formules sont accordées pour 365 jours à
  -- l'inscription, sans encaissement : Premium fonctionne exactement comme le
  -- plan Découverte. La limite d'élèves de la formule (student_limit) reste
  -- appliquée : Premium = 600 élèves.
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

comment on function public.finish_director_registration(uuid, text, text, text, text, text, text, text, text[], text)
  is 'Inscription directeur atomique + abonnement annuel immédiat (365 jours, sans encaissement avant la passerelle de paiement).';

-- Rattrapage : les écoles inscrites pendant la période « 30 jours » (migration
-- 00033) voient leur abonnement de première inscription prolongé à un an.
-- On ne touche que les abonnements d'origine inscription, sans encaissement :
-- payment_ref commence par INSCRIPTION- et amount_paid = 0. Les paiements
-- réels (même montant encaissé par le support) ne sont jamais modifiés.
update public.subscriptions
   set ends_at = greatest(ends_at, starts_at + 365)
 where amount_paid = 0
   and payment_ref like 'INSCRIPTION-%';
