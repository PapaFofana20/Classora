-- ============================================================================
-- Tests pgTAP — Phase 4 : abonnements & paiements école.
-- Exécution : npx supabase test db  (base locale requise)
-- ============================================================================

begin;
select plan(25);

create or replace function temp_setup() returns void
language plpgsql volatile as $$
begin
  insert into public.schools (id, name, cycles)
  values ('aaaaaa11-0000-0000-0000-000000000001', 'École A', array['elementaire','moyen','secondaire']::app_cycle[]),
         ('bbbbbb22-0000-0000-0000-000000000001', 'École B', array['elementaire','moyen','secondaire']::app_cycle[]);
  insert into public.school_settings (school_id) values ('aaaaaa11-0000-0000-0000-000000000001'), ('bbbbbb22-0000-0000-0000-000000000001');
end;
$$;
select temp_setup();

-- 1 : apply_paid_subscription réservé au service_role ; verify_matricule public.
select is(
  has_function_privilege('authenticated'::regrole, 'public.apply_paid_subscription(text,text,text,jsonb)', 'execute'),
  false, 'authenticated ne peut PAS appliquer de paiement'
) as t01_apply_restreint;
select is(
  has_function_privilege('anon'::regrole, 'public.verify_matricule(text)', 'execute'),
  true, 'anon peut vérifier un matricule publiquement'
) as t02_verify_anon;

-- 2 : format du matricule (message exact du front).
-- Matricule normalisé « X7K9Z » : aucun établissement ne porte ce code, donc
-- le résultat attendu est « introuvable » (indépendant des données déjà en base).
select is(
  (public.verify_matricule('x7 k-9z'))->>'message',
  'Matricule introuvable. Vérifiez auprès de votre école.',
  'les espaces/tirets sont tolérés puis normalisés'
) as t03_saisie_tolerante;
select is(
  (public.verify_matricule('X7K9'))->>'reason',
  'format', 'matricule trop court refusé'
) as t04_format_trop_court;
select is(
  (public.verify_matricule('X7K9'))->>'message',
  'Le matricule comporte 5 caractères (lettres et chiffres, sans 0 ni O). Exemple : X7K9Q.',
  'message de format identique à schoolService'
) as t05_format_message;
select is(
  (public.verify_matricule('ABCD0'))->>'reason',
  'format', 'caractère 0 ambigü refusé'
) as t06_zero_refuse_matricule;

-- 3 : achat en attente puis confirmation (transaction PENDING de start-subscription).
insert into public.payment_transactions
  (tx_kind, school_id, provider, provider_ref, amount, method, phone, status, payload)
values
  ('subscription', 'aaaaaa11-0000-0000-0000-000000000001', 'wave', 'WV-1111-2222', 300000, 'wave', '777111222', 'pending',
   '{"plan_id":"pro","cycle":"yearly","student_limit":300,"school_id":"aaaaaa11-0000-0000-0000-000000000001"}'::jsonb);

select is(
  (public.apply_paid_subscription('wave', 'WV-1111-2222', 'succeeded'))->>'matriculeCreated',
  'true', 'le premier paiement confirmé crée le matricule'
) as t07_matricule_cree;
select is(
  (select (public.subscription_info('aaaaaa11-0000-0000-0000-000000000001')).status),
  'ACTIF', 'l''abonnement est actif après confirmation'
) as t08_sub_active;
select is(
  (select ends_at from public.subscriptions where school_id = 'aaaaaa11-0000-0000-0000-000000000001'),
  current_date + 365, 'échéance = aujourd''hui + 365 jours'
) as t09_echeance_365;

-- 4 : IDEMPotence — rejouer ne change rien.
select is(
  (public.apply_paid_subscription('wave', 'WV-1111-2222', 'succeeded'))->>'idempotent',
  'true', 'rejoue du webhook : résultat identique'
) as t10_idempotent;
select is(
  (select ends_at from public.subscriptions where school_id = 'aaaaaa11-0000-0000-0000-000000000001'),
  current_date + 365, 'rejoue du webhook : échéance inchangée'
) as t11_echeance_inchangée;
select is(
  (select count(*) from public.payment_transactions where provider = 'wave' and provider_ref = 'WV-1111-2222'),
  1::bigint, 'une seule transaction pour la référence'
) as t12_tx_unique;

-- 5 : le web hook refuse un montant qui ne correspond pas à la formule.
insert into public.payment_transactions
  (tx_kind, school_id, provider, provider_ref, amount, method, phone, status, payload)
values
  ('subscription', 'aaaaaa11-0000-0000-0000-000000000001', 'wave', 'WV-3333-4444', 290000, 'wave', '777111222', 'pending',
   '{"plan_id":"pro","cycle":"yearly","school_id":"aaaaaa11-0000-0000-0000-000000000001"}'::jsonb);
select throws_ok(
  'select public.apply_paid_subscription(''wave'', ''WV-3333-4444'', ''succeeded'')',
  'P0001', 'Le montant payé ne correspond pas à la formule choisie.', 'montant incohérent refusé'
) as t13_montant_refuse;
-- le montant refusé ne doit PAS marquer une réussite accidentelle :
select is(
  (select status from public.payment_transactions where provider_ref = 'WV-3333-4444'),
  'pending', 'montant incohérent : la transaction reste en attente'
) as t13b_montant_pending;

-- 6 : renouvellement CUMULATIF sur abonnement actif (événement renewal).
insert into public.payment_transactions
  (tx_kind, school_id, provider, provider_ref, amount, method, phone, status, payload)
values
  ('subscription', 'aaaaaa11-0000-0000-0000-000000000001', 'orange_money', 'OM-5555-6666', 30000, 'orange_money', '777111222', 'pending',
   '{"plan_id":"pro","cycle":"monthly","school_id":"aaaaaa11-0000-0000-0000-000000000001"}'::jsonb);
select is(
  (public.apply_paid_subscription('orange_money', 'OM-5555-6666', 'succeeded'))->>'matriculeCreated',
  'false', 'le matricule ne change PAS au renouvellement'
) as t14_matricule_immuable;
select is(
  (select ends_at from public.subscriptions where school_id = 'aaaaaa11-0000-0000-0000-000000000001'),
  current_date + 365 + 30, 'renouvellement actif : échéance cumulée + 30 jours'
) as t15_cumul_30;
-- Les événements sont créés dans la même transaction (created_at identique) :
-- l'événement est désigné par sa référence de paiement, pas par son horodatage.
select is(
  (select event_type from public.subscription_events
   where school_id = 'aaaaaa11-0000-0000-0000-000000000001'
     and payment_ref = 'OM-5555-6666'),
  'renewal', 'un abonnement confirmé produit un événement renewal'
) as t16_event_renewal;

-- 7 : échéance passée → reprise du jour, événement toujours renewal (même formule).
update public.subscriptions set ends_at = current_date - 10 where school_id = 'aaaaaa11-0000-0000-0000-000000000001';
insert into public.payment_transactions
  (tx_kind, school_id, provider, provider_ref, amount, method, phone, status, payload)
values
  ('subscription', 'aaaaaa11-0000-0000-0000-000000000001', 'free_money', 'FM-7777-8888', 30000, 'free_money', '777111222', 'pending',
   '{"plan_id":"pro","cycle":"monthly","school_id":"aaaaaa11-0000-0000-0000-000000000001"}'::jsonb);
select is(
  (public.apply_paid_subscription('free_money', 'FM-7777-8888', 'succeeded'))->>'ends_at',
  (current_date + 30)::text, 'abonnement expiré : nouvelle échéance au jour du paiement'
) as t17_reprise_apres_expiration;

-- 8 : verify_matricule sur une école expirée (messages front exacts ; école A).
update public.subscriptions set ends_at = current_date - 30 where school_id = 'aaaaaa11-0000-0000-0000-000000000001';
select is(
  (public.verify_matricule((select matricule from public.schools where id = 'aaaaaa11-0000-0000-0000-000000000001')))->>'message',
  'École A n''accepte plus de nouvelles inscriptions. Contactez l''école pour plus d''informations.',
  'école bloquée : message exact'
) as t18_bloquee_message;
update public.subscriptions set ends_at = current_date - 4 where school_id = 'aaaaaa11-0000-0000-0000-000000000001';
select is(
  (public.verify_matricule((select matricule from public.schools where id = 'aaaaaa11-0000-0000-0000-000000000001')))->>'reason',
  'abonnement_expire', 'école en lecture seule : inscriptions refusées'
) as t19_expire_reason;
update public.schools set registration_open = false where id = 'aaaaaa11-0000-0000-0000-000000000001';
update public.subscriptions set ends_at = current_date + 30 where school_id = 'aaaaaa11-0000-0000-0000-000000000001';
select is(
  (public.verify_matricule((select matricule from public.schools where id = 'aaaaaa11-0000-0000-0000-000000000001')))->>'reason',
  'inscriptions_fermees', 'inscriptions fermées : signalé malgré un abonnement actif'
) as t20_fermees_reason;

-- 9 : le paiement refused marque la transaction failed (pas d'abonnement).
update public.schools set registration_open = true where id = 'aaaaaa11-0000-0000-0000-000000000001';
insert into public.payment_transactions
  (tx_kind, school_id, provider, provider_ref, amount, method, phone, status, payload)
values
  ('subscription', 'bbbbbb22-0000-0000-0000-000000000001', 'wave', 'WV-9999-0000', 300000, 'wave', '778888999', 'pending',
   '{"plan_id":"pro","cycle":"yearly","school_id":"bbbbbb22-0000-0000-0000-000000000001"}'::jsonb);
select lives_ok(
  'select public.apply_paid_subscription(''wave'', ''WV-9999-0000'', ''failed'')',
  ' Paiement refusé : la transaction passe en failed'
) as t21_failed_status;
select is(
  (select status from public.payment_transactions where provider_ref = 'WV-9999-0000'),
  'failed', 'la transaction refusée est marquée failed'
) as t21b_failed_statut_ok;

-- 10 : clients ne lisent pas le registre de paiement ; le webhook rejoué est transparent.
select is(
  (select count(*) from public.subscription_events where school_id = 'aaaaaa11-0000-0000-0000-000000000001'),
  3::bigint, '3 événements (1 achat + 2 renouvellements), aucun redoublé par le replay'
) as t22_events_compte;

select set_config('role', 'authenticated', true);
select set_config('search_path', 'pgtap, public, extensions', true);
select set_config('search_path', 'pgtap, public, extensions', true);
select throws_ok(
  'select count(*) from public.payment_transactions',
  '42501'::char(5), null::text, 'authenticated ne lit AUCUNE transaction de paiement'
) as t23_clients_invisibles;

select * from finish();
rollback;
