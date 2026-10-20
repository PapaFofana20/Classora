-- ============================================================================
-- Tests pgTAP — Phase 6 : paiements des familles.
-- Exécution : npx supabase test db  (base locale requise)
-- ============================================================================

begin;
select plan(24);

create or replace function temp_setup() returns void
language plpgsql volatile as $$
begin
  insert into public.schools (id, name, cycles)
  values ('aaaaaa11-0000-0000-0000-000000000001', 'École A', array['elementaire','moyen','secondaire']::app_cycle[]);
  insert into public.school_settings (school_id, school_year)
  values ('aaaaaa11-0000-0000-0000-000000000001', '2026-2027');

  insert into public.subscriptions (school_id, plan_id, starts_at, ends_at, student_limit)
  values ('aaaaaa11-0000-0000-0000-000000000001', 'pro', current_date, current_date + 30, 300);

  insert into public.level_fees (school_id, level_id, inscription, mensualite)
  values ('aaaaaa11-0000-0000-0000-000000000001', 'cm1', 20000, 15000);

  insert into public.class_rooms (id, school_id, name, level_id, cycle, capacity)
  values ('aaaaaa11-0000-0000-0000-0000000000ca', 'aaaaaa11-0000-0000-0000-000000000001', 'CM1-A', 'cm1', 'elementaire', 30);

  insert into public.parents (id, school_id, first_name, last_name, email)
  values ('eeeeee55-0000-0000-0000-0000000000p1', 'aaaaaa11-0000-0000-0000-000000000001', 'Awa', 'P1', 'awa.p1@schoola.sn');

  insert into public.students (id, school_id, class_id, matricule, child_code, first_name, last_name, gender, birth_date, parent_id)
  values ('eeeeee55-0000-0000-0000-0000000000s1', 'aaaaaa11-0000-0000-0000-000000000001', 'aaaaaa11-0000-0000-0000-0000000000ca', 'ECA0001', 'ABCDEF', 'Leila S1', 'F', '2014-01-01', 'eeeeee55-0000-0000-0000-0000000000p1'),
         ('eeeeee55-0000-0000-0000-0000000000s2', 'aaaaaa11-0000-0000-0000-000000000001', 'aaaaaa11-0000-0000-0000-0000000000ca', 'ECA0002', 'ABCDGH', 'Ilyas S2', 'M', '2012-02-02', 'eeeeee55-0000-0000-0000-0000000000p1');

  insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data)
  values
    ('ffaaaa11-0000-0000-0000-0000000000da', 'dir.a@schoola.sn', crypt('demo1234!', gen_salt('bf')), now(), '{"role":"directeur","school_id":"aaaaaa11-0000-0000-0000-000000000001"}'),
    ('ffaaaa11-0000-0000-0000-0000000000ec', 'econ.a@schoola.sn', crypt('demo1234!', gen_salt('bf')), now(), '{"role":"econome","school_id":"aaaaaa11-0000-0000-0000-000000000001"}'),
    ('ffaaaa11-0000-0000-0000-0000000000pa', 'parent.a@schoola.sn', crypt('demo1234!', gen_salt('bf')), now(), '{"role":"parent","school_id":"aaaaaa11-0000-0000-0000-000000000001"}'),
    ('ffaaaa11-0000-0000-0000-0000000000es', 'eleve.a@schoola.sn', crypt('demo1234!', gen_salt('bf')), now(), '{"role":"eleve","school_id":"aaaaaa11-0000-0000-0000-000000000001"}');

  insert into public.profiles (id, school_id, role, status, first_name, last_name, email, parent_id, student_id)
  values
    ('ffaaaa11-0000-0000-0000-0000000000da', 'aaaaaa11-0000-0000-0000-000000000001', 'directeur', 'ACTIF', 'Direct', 'A', 'dir.a@schoola.sn', null, null),
    ('ffaaaa11-0000-0000-0000-0000000000ec', 'aaaaaa11-0000-0000-0000-000000000001', 'econome', 'ACTIF', 'Eco', 'N', 'econ.a@schoola.sn', null, null),
    ('ffaaaa11-0000-0000-0000-0000000000pa', 'aaaaaa11-0000-0000-0000-000000000001', 'parent', 'ACTIF', 'Awa', 'P1', 'parent.a@schoola.sn', 'eeeeee55-0000-0000-0000-0000000000p1', null),
    ('ffaaaa11-0000-0000-0000-0000000000es', 'aaaaaa11-0000-0000-0000-000000000001', 'eleve', 'ACTIF', 'Leila', 'S1', 'eleve.a@schoola.sn', null, 'eeeeee55-0000-0000-0000-0000000000s1');

  perform public.build_payment_plan('eeeeee55-0000-0000-0000-0000000000s1');
  perform public.build_payment_plan('eeeeee55-0000-0000-0000-0000000000s2');
end;
$$;
select temp_setup();

create or replace function temp_persona(p_user_id uuid) returns text
language sql as $$
  select (case
    when p_user_id = 'ffaaaa11-0000-0000-0000-0000000000ec' then '{"role":"econome","school_id":"aaaaaa11-0000-0000-0000-000000000001"}'
    when p_user_id = 'ffaaaa11-0000-0000-0000-0000000000pa' then '{"role":"parent","school_id":"aaaaaa11-0000-0000-0000-000000000001"}'
    when p_user_id = 'ffaaaa11-0000-0000-0000-0000000000es' then '{"role":"eleve","school_id":"aaaaaa11-0000-0000-0000-000000000001"}'
    else '{"role":"directeur","school_id":"aaaaaa11-0000-0000-0000-000000000001"}'
  end)
$$;

create or replace function temp_statu(p_user_id uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config('request.jwt.claims', temp_persona(p_user_id), true);
  perform set_config('role', 'authenticated', true);
end;
$$;

-- ----------------------------------------------------------------------------
-- 1-3 : échéancier du serveur (11 échéances, remise fratrie, statuts auto).
-- ----------------------------------------------------------------------------
select is(
  (select count(*) from public.payments where student_id = 'eeeeee55-0000-0000-0000-0000000000s1'),
  11::bigint, 'le plan de s1 contient 11 échéances'
) as t01_plan_11;
select is(
  (select min(amount) from public.payments
   where student_id = 'eeeeee55-0000-0000-0000-0000000000s1' and kind = 'mensualite'),
  13500, 'la mensualité applique la remise fratrie (13500 FCFA)'
) as t02_remise_fratrie;
select is(
  (select status from public.payments
   where student_id = 'eeeeee55-0000-0000-0000-0000000000s1' and kind = 'inscription'),
  'en_retard', 'échéance passée et impayée : statut en_retard posé par le trigger'
) as t03_en_retard;

-- ----------------------------------------------------------------------------
-- 4-7 : encaissement espèces (économe) — parité paymentService.
-- ----------------------------------------------------------------------------
select temp_statu('ffaaaa11-0000-0000-0000-0000000000ec');
select is(
  (public.record_cash_payment(
    (select id from public.payments where student_id = 'eeeeee55-0000-0000-0000-0000000000s1' and kind = 'inscription'),
    5000
  ))->>'status',
  'partiel', 'un versement partiel marque la ligne partiel'
) as t04_partiel;
select is(
  (public.record_cash_payment(
    (select id from public.payments where student_id = 'eeeeee55-0000-0000-0000-0000000000s1' and kind = 'inscription'),
    15000
  ))->>'status',
  'paye', 'le solde clôture l''échéance (payé)'
) as t05_paye;
select throws_ok(
  (select public.record_cash_payment(
    (select id from public.payments where student_id = 'eeeeee55-0000-0000-0000-0000000000s1' and kind = 'inscription'),
    1)),
  'P0001', 'Montant invalide.', 'échéance soldée : plus aucun versement possible'
) as t06_solde_refuse;
select is(
  (select paid_amount from public.payments
   where student_id = 'eeeeee55-0000-0000-0000-0000000000s1' and kind = 'inscription'),
  20000, 'le montant encaissé total est exactement 20000 (jamais plus)'
) as t07_paid_cap;

-- ----------------------------------------------------------------------------
-- 8-9 : un élève ne peut payer que SES échéances.
-- ----------------------------------------------------------------------------
select temp_statu('ffaaaa11-0000-0000-0000-0000000000es');
select throws_ok(
  (select public.start_installment_payments(
     array[(select id from public.payments
            where student_id = 'eeeeee55-0000-0000-0000-0000000000s2' and kind = 'mensualite'
            order by due_date limit 1)]::uuid[],
     'wave', '771234567')),
  'P0001', 'Ces échéances ne vous concernent pas.',
  'échéance d''un autre élève refusée'
) as t08_scope_refus;
select is(
  (select count(*) from public.payment_transactions),
  0::bigint, 'aucune transaction créée pour l''appel refusé'
) as t09_aucune_tx_refus;

-- ----------------------------------------------------------------------------
-- 10-12 : la famille initie deux échéances (PENDING), réutilise les références.
-- ----------------------------------------------------------------------------
select temp_statu('ffaaaa11-0000-0000-0000-0000000000pa');
select is(
  (select jsonb_array_length(public.start_installment_payments(
     array[(select p1.id from public.payments p1
            where p1.student_id = 'eeeeee55-0000-0000-0000-0000000000s1' and p1.kind = 'mensualite'
            order by p1.due_date limit 1),
           (select p2.id from public.payments p2
            where p2.student_id = 'eeeeee55-0000-0000-0000-0000000000s1' and p2.kind = 'mensualite'
            order by p2.due_date offset 1 limit 1)]::uuid[],
     'wave', '771234567'))),
  2, 'deux transactions PENDING créées pour deux échéances de la famille'
) as t10_pending_2;
select is(
  (select count(*) from public.payment_transactions where method = 'wave' and status = 'pending'),
  2::bigint, 'le registre contient 2 transactions en attente'
) as t10b_pending_count;
select is(
  (select count(*) from public.payment_transactions
   where method = 'wave' and status = 'pending'
     and provider_ref = (
       select jn->>'reference' from jsonb_array_elements(
         public.start_installment_payments(
           array[(select p1.id from public.payments p1
                  where p1.student_id = 'eeeeee55-0000-0000-0000-0000000000s1' and p1.kind = 'mensualite'
                  order by p1.due_date limit 1)]::uuid[],
           'wave', '771234567')) jn limit 1)),
  1::bigint, 'ré-appel sur une échéance déjà PENDING : la MÊME référence est réutilisée'
) as t11_reappel_meme_ref;

-- ----------------------------------------------------------------------------
-- 13-18 : confirmation idempotente (service_role) — jamais de sur-encaissement.
-- ----------------------------------------------------------------------------
perform set_config('role', 'postgres', true);
select throws_ok(
  (select public.apply_paid_installment('wave', 'WV-0000-9999', 'succeeded')),
  'P0001', 'Transaction inconnue.', 'référence inconnue refusée'
) as t12_ref_inconnue;
select is(
  (public.apply_paid_installment('wave',
    (select provider_ref from public.payment_transactions
     where method = 'wave' and status = 'pending' order by created_at limit 1),
    'succeeded'))->>'idempotent',
  'false', 'la première confirmation réussit (idempotent = false)'
) as t13_confirm_ok;
select is(
  (select count(*) from public.payment_transactions where status = 'succeeded'),
  1::bigint, 'exactement une transaction marquée succeeded'
) as t14_succeeded_1;
select is(
  (public.apply_paid_installment('wave',
    (select provider_ref from public.payment_transactions where status = 'succeeded' limit 1),
    'succeeded'))->>'idempotent',
  'true', 'rejouer la confirmation renvoie idempotent = true sans effet'
) as t15_replay_idempotent;
select is(
  (select count(*) from public.payment_transactions t
   join public.payments p on p.id = t.payment_id
   where t.status = 'succeeded' and p.paid_amount > p.amount),
  0::bigint, 'aucune échéance ne dépasse son montant suite au replay'
) as t16_cap_ok;
select is(
  (select status from public.payments
   where id = (select payment_id from public.payment_transactions where status = 'succeeded' limit 1)),
  'paye', 'mensualité réglée en totalité par sa référence : statut payé'
) as t17_status_paye;

-- ----------------------------------------------------------------------------
-- 18-19 : l'élève paie sa propre échéance (Orange Money).
-- ----------------------------------------------------------------------------
select temp_statu('ffaaaa11-0000-0000-0000-0000000000es');
select is(
  (select jsonb_array_length(public.start_installment_payments(
     array[(select id from public.payments
            where student_id = 'eeeeee55-0000-0000-0000-0000000000s1' and kind = 'mensualite'
              and paid_amount = 0 order by due_date limit 1)]::uuid[],
     'orange_money', '771234567'))),
  1, 'l''élève initie sa propre échéance impayée'
) as t18_eleve_init_ok;

perform set_config('role', 'postgres', true);
select is(
  (public.apply_paid_installment('orange_money',
    (select provider_ref from public.payment_transactions
     where method = 'orange_money' and status = 'pending' limit 1),
    'succeeded'))->>'status',
  'paye', 'confirmation Orange Money : échéance payée'
) as t18b_eleve_confirm;

-- ----------------------------------------------------------------------------
-- 20-23 : portée de lecture, relances, visibilité du registre.
-- ----------------------------------------------------------------------------
select temp_statu('ffaaaa11-0000-0000-0000-0000000000pa');
select is(
  (select count(*) from public.payments),
  22::bigint, 'le parent de p1 lit les 22 échéances de SES deux enfants'
) as t19_parent_scope;
select is(
  (select count(*) from public.payment_transactions),
  0::bigint, 'le registre des transactions mobiles reste invisible des clients'
) as t20_tx_invisible;
select temp_statu('ffaaaa11-0000-0000-0000-0000000000da');
select is(
  public.send_reminders(array['eeeeee55-0000-0000-0000-0000000000s1']::uuid[]),
  1, 'la relance touche 1 famille'
) as t21_relances;
select is(
  (select count(*) from public.announcements where title = 'Relance de paiement'),
  1::bigint, 'l''annonce de relance est créée'
) as t22_annonce_relance;

select * from finish();
rollback;
