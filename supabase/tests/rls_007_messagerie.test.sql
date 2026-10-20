-- ============================================================================
-- Tests pgTAP — Phase 7 : messagerie, annonces ciblées, absences, dashboard.
-- Exécution : npx supabase test db  (base locale requise)
-- ============================================================================

begin;
select plan(33);

create or replace function temp_setup() returns void
language plpgsql volatile as $$
begin
  -- École B (isolation) : une seule classe, un élève sans parent.
  insert into public.schools (id, name, cycles)
  values ('bbbbbb22-0000-0000-0000-000000000001', 'École B', array['elementaire']::app_cycle[]);
  insert into public.school_settings (school_id, school_year)
  values ('bbbbbb22-0000-0000-0000-000000000001', '2026-2027');
  insert into public.class_rooms (id, school_id, name, level_id, cycle, capacity)
  values ('bbbbbb22-0000-0000-0000-0000000000ca', 'bbbbbb22-0000-0000-0000-000000000001', 'CM1-B', 'cm1', 'elementaire', 30);
  insert into public.students (id, school_id, class_id, matricule, child_code, first_name, last_name, gender)
  values ('bbbbbb22-0000-0000-0000-0000000000s1', 'bbbbbb22-0000-0000-0000-000000000001', 'bbbbbb22-0000-0000-0000-0000000000ca', 'ECB0001', 'ZABGHI', 'Toto B', 'M', '2014-01-01');

  -- École A : structure complète.
  insert into public.schools (id, name, cycles)
  values ('aaaaaa11-0000-0000-0000-000000000001', 'École A', array['elementaire','moyen','secondaire']::app_cycle[]);
  insert into public.school_settings (school_id, school_year)
  values ('aaaaaa11-0000-0000-0000-000000000001', '2026-2027');
  insert into public.subscriptions (school_id, plan_id, starts_at, ends_at, student_limit)
  values ('aaaaaa11-0000-0000-0000-000000000001', 'pro', current_date, current_date + 30, 300);
  insert into public.level_fees (school_id, level_id, inscription, mensualite)
  values ('aaaaaa11-0000-0000-0000-000000000001', 'cm1', 20000, 15000);

  insert into public.class_rooms (id, school_id, name, level_id, cycle, capacity, head_teacher_id)
  values ('aaaaaa11-0000-0000-0000-0000000000ca', 'aaaaaa11-0000-0000-0000-000000000001', 'CM1-A', 'cm1', 'elementaire', 30,
          'aaaaaa11-0000-0000-0000-0000000000t1');

  insert into public.subjects (id, school_id, name, cycles)
  values ('aaaaaa11-0000-0000-0000-0000000000sx', 'aaaaaa11-0000-0000-0000-000000000001', 'Mathématiques',
          array['elementaire','moyen','secondaire']::app_cycle[]);
  insert into public.class_subjects (school_id, class_id, subject_id, coefficient)
  values ('aaaaaa11-0000-0000-0000-000000000001', 'aaaaaa11-0000-0000-0000-0000000000ca', 'aaaaaa11-0000-0000-0000-0000000000sx', 4);
  insert into public.teaching_assignments (school_id, teacher_id, class_id, subject_id)
  values ('aaaaaa11-0000-0000-0000-000000000001', 'aaaaaa11-0000-0000-0000-0000000000t2', 'aaaaaa11-0000-0000-0000-0000000000ca', 'aaaaaa11-0000-0000-0000-0000000000sx');

  insert into public.teachers (id, school_id, kind, first_name, last_name, email)
  values ('aaaaaa11-0000-0000-0000-0000000000t1', 'aaaaaa11-0000-0000-0000-000000000001', 'instituteur', 'Ily', 'T1', 'ily.t1@schoola.sn'),
         ('aaaaaa11-0000-0000-0000-0000000000t2', 'aaaaaa11-0000-0000-0000-000000000001', 'professeur', 'Sok', 'T2', 'sok.t2@schoola.sn'),
         ('aaaaaa11-0000-0000-0000-0000000000t3', 'aaaaaa11-0000-0000-0000-000000000001', 'professeur', 'Mam', 'T3', 'mam.t3@schoola.sn');

  insert into public.parents (id, school_id, first_name, last_name, email)
  values ('aaaaaa11-0000-0000-0000-0000000000p1', 'aaaaaa11-0000-0000-0000-000000000001', 'Awa', 'P1', 'awa.p1@schoola.sn');

  insert into public.students (id, school_id, class_id, matricule, child_code, first_name, last_name, gender, birth_date, parent_id)
  values ('aaaaaa11-0000-0000-0000-0000000000s1', 'aaaaaa11-0000-0000-0000-000000000001', 'aaaaaa11-0000-0000-0000-0000000000ca', 'ECA0001', 'ABCDEF', 'Leila S1', 'F', '2014-01-01', 'aaaaaa11-0000-0000-0000-0000000000p1'),
         ('aaaaaa11-0000-0000-0000-0000000000s2', 'aaaaaa11-0000-0000-0000-000000000001', 'aaaaaa11-0000-0000-0000-0000000000ca', 'ECA0002', 'ABCDGH', 'Ilyas S2', 'M', '2012-02-02', 'aaaaaa11-0000-0000-0000-0000000000p1');

  insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data)
  values
    ('ffaaaa11-0000-0000-0000-0000000000da', 'dir.a@schoola.sn',      crypt('demo1234!', gen_salt('bf')), now(), '{"role":"directeur","school_id":"aaaaaa11-0000-0000-0000-000000000001"}'),
    ('ffaaaa11-0000-0000-0000-0000000000ec', 'econ.a@schoola.sn',     crypt('demo1234!', gen_salt('bf')), now(), '{"role":"econome","school_id":"aaaaaa11-0000-0000-0000-000000000001"}'),
    ('ffaaaa11-0000-0000-0000-0000000000su', 'surv.a@schoola.sn',    crypt('demo1234!', gen_salt('bf')), now(), '{"role":"surveillant","school_id":"aaaaaa11-0000-0000-0000-000000000001"}'),
    ('ffaaaa11-0000-0000-0000-0000000000t1', 'ily.t1@schoola.sn',     crypt('demo1234!', gen_salt('bf')), now(), '{"role":"instituteur","school_id":"aaaaaa11-0000-0000-0000-000000000001"}'),
    ('ffaaaa11-0000-0000-0000-0000000000t2', 'sok.t2@schoola.sn',     crypt('demo1234!', gen_salt('bf')), now(), '{"role":"professeur","school_id":"aaaaaa11-0000-0000-0000-000000000001"}'),
    ('ffaaaa11-0000-0000-0000-0000000000pa', 'parent.a@schoola.sn',   crypt('demo1234!', gen_salt('bf')), now(), '{"role":"parent","school_id":"aaaaaa11-0000-0000-0000-000000000001"}'),
    ('ffaaaa11-0000-0000-0000-0000000000es', 'eleve.a@schoola.sn',    crypt('demo1234!', gen_salt('bf')), now(), '{"role":"eleve","school_id":"aaaaaa11-0000-0000-0000-000000000001"}');

  insert into public.profiles (id, school_id, role, status, first_name, last_name, email, teacher_id, parent_id, student_id)
  values
    ('ffaaaa11-0000-0000-0000-0000000000da', 'aaaaaa11-0000-0000-0000-000000000001', 'directeur',  'ACTIF', 'Direct', 'A',   'dir.a@schoola.sn',    null,                                 null,                                 null),
    ('ffaaaa11-0000-0000-0000-0000000000ec', 'aaaaaa11-0000-0000-0000-000000000001', 'econome',    'ACTIF', 'Eco',    'N',   'econ.a@schoola.sn',   null,                                 null,                                 null),
    ('ffaaaa11-0000-0000-0000-0000000000su', 'aaaaaa11-0000-0000-0000-000000000001', 'surveillant','ACTIF', 'Surv',   'A',   'surv.a@schoola.sn',   null,                                 null,                                 null),
    ('ffaaaa11-0000-0000-0000-0000000000t1', 'aaaaaa11-0000-0000-0000-000000000001', 'instituteur','ACTIF', 'Ily',    'T1',  'ily.t1@schoola.sn',   'aaaaaa11-0000-0000-0000-0000000000t1', null,                               null),
    ('ffaaaa11-0000-0000-0000-0000000000t2', 'aaaaaa11-0000-0000-0000-000000000001', 'professeur', 'ACTIF', 'Sok',    'T2',  'sok.t2@schoola.sn',   'aaaaaa11-0000-0000-0000-0000000000t2', null,                               null),
    ('ffaaaa11-0000-0000-0000-0000-0000000000pa', 'aaaaaa11-0000-0000-0000-000000000001', 'parent',    'ACTIF', 'Awa',    'P1',  'parent.a@schoola.sn', null,                                 'aaaaaa11-0000-0000-0000-0000000000p1', null),
    ('ffaaaa11-0000-0000-0000-0000000000es', 'aaaaaa11-0000-0000-0000-000000000001', 'eleve',      'ACTIF', 'Leila',  'S1',  'eleve.a@schoola.sn',  null,                                 null,                                 'aaaaaa11-0000-0000-0000-0000000000s1');

  perform public.build_payment_plan('aaaaaa11-0000-0000-0000-0000000000s1');
  perform public.build_payment_plan('aaaaaa11-0000-0000-0000-0000000000s2');
end;
$$;
select temp_setup();

create or replace function temp_persona(p_user_id uuid) returns text
language sql as $$
  select (case
    when p_user_id = 'ffaaaa11-0000-0000-0000-0000000000ec' then '{"role":"econome","school_id":"aaaaaa11-0000-0000-0000-000000000001"}'
    when p_user_id = 'ffaaaa11-0000-0000-0000-0000000000su' then '{"role":"surveillant","school_id":"aaaaaa11-0000-0000-0000-000000000001"}'
    when p_user_id = 'ffaaaa11-0000-0000-0000-0000000000t1' then '{"role":"instituteur","school_id":"aaaaaa11-0000-0000-0000-000000000001"}'
    when p_user_id = 'ffaaaa11-0000-0000-0000-0000000000t2' then '{"role":"professeur","school_id":"aaaaaa11-0000-0000-0000-000000000001"}'
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
-- MESSAGERIE
-- ----------------------------------------------------------------------------
-- 1. L'instituteur titulaire ouvre un fil (t1 est titulaire de CM1-A).
select temp_statu('ffaaaa11-0000-0000-0000-0000000000t1');
select lives_ok(
  (select public.start_conversation(
     'aaaaaa11-0000-0000-0000-0000000000t1', 'aaaaaa11-0000-0000-0000-0000000000p1',
     'aaaaaa11-0000-0000-0000-0000000000s1', 'Suivi', 'Bonjour.')),
  'l''instituteur titulaire ouvre un fil avec un parent de son élève'
) as t01_start_ok;
select is(
  (select count(*) from public.conversations),
  1::bigint, 'une conversation a été créée'
) as t02_conv_1;
select is(
  (select count(*) from public.messages),
  1::bigint, 'le premier message est enregistré'
) as t03_message_1;

-- 2. Le parent le voit et il est marqué non lu.
select temp_statu('ffaaaa11-0000-0000-0000-0000000000pa');
select is(
  (select jsonb_array_length(public.list_conversations())),
  1, 'le parent voit SON fil'
) as t04_parent_voit;
select is(
  ((public.list_conversations())->0->>'unread'),
  '1', 'le fil est non lu pour le parent'
) as t05_unread_parent;

-- 3. Réponse du parent ; l'enseignant voit le non-lu puis le marque lu.
select lives_ok(
  (select public.send_message(
     (select id from public.conversations limit 1), 'Bien reçu.')),
  'le parent répond au fil'
) as t06_reponse_parent;
select is(
  (select count(*) from public.messages),
  2::bigint, 'deux messages dans le fil'
) as t07_2_messages;
select temp_statu('ffaaaa11-0000-0000-0000-0000000000t1');
select is(
  ((public.list_conversations())->0->>'unread'),
  '1', 'le fil est non lu pour l''enseignant'
) as t08_unread_enseignant;
select lives_ok(
  (select public.mark_conversation_read((select id from public.conversations limit 1))),
  'l''enseignant marque le fil lu'
) as t09_mark_lu;
select is(
  ((public.list_conversations())->0->>'unread'),
  '0', 'le fil est lu pour l''enseignant'
) as t10_lu_enseignant;

-- 4. Le directeur supervise en lecture seule.
select temp_statu('ffaaaa11-0000-0000-0000-0000000000da');
select is(
  (select jsonb_array_length(public.list_conversations())),
  1, 'le directeur voit tous les fils de son école'
) as t11_dir_supervise;
select throws_ok(
  (select public.send_message(
     (select id from public.conversations limit 1), 'Non autorisé.')),
  'P0001', 'Conversation indisponible.', 'le directeur n''écrit pas dans les fils'
) as t12_dir_refus;
select temp_statu('ffaaaa11-0000-0000-0000-0000000000ec');
select is(
  (select jsonb_array_length(public.list_conversations())),
  0, 'l''économe n''est pas dans la messagerie'
) as t13_econome_0;

-- 5. Seconde conversation via le professeur affecté (contact parent).
select temp_statu('ffaaaa11-0000-0000-0000-0000000000pa');
select lives_ok(
  (select public.start_conversation(
     'aaaaaa11-0000-0000-0000-0000000000t2', 'aaaaaa11-0000-0000-0000-0000000000p1',
     'aaaaaa11-0000-0000-0000-0000000000s1', 'Maths', 'Bonjour monsieur.')),
  'le parent contacte un enseignant affecté à la classe'
) as t14_conv2_ok;
select throws_ok(
  (select public.start_conversation(
     'aaaaaa11-0000-0000-0000-0000000000t3', 'aaaaaa11-0000-0000-0000-0000000000p1',
     'aaaaaa11-0000-0000-0000-0000000000s1', 'Inconnu', 'Bonjour.')),
  'P0001', 'Conversation indisponible.', 'enseignant non affecté refusé'
) as t15_non_affecte;
select throws_ok(
  (select public.start_conversation(
     'aaaaaa11-0000-0000-0000-0000000000t1', 'bbbbbb22-0000-0000-0000-0000000000p1',
     'bbbbbb22-0000-0000-0000-0000000000s1', 'Autre école', 'Bonjour.')),
  'P0001', 'Conversation indisponible.', 'trio d''une autre école refusé'
) as t16_autre_ecole;

-- 6. L'élève (s1) participe aux fils qui le concernent.
select temp_statu('ffaaaa11-0000-0000-0000-0000000000es');
select is(
  (select jsonb_array_length(public.list_conversations())),
  2, 'l''élève s1 voit les deux fils qui le concernent'
) as t17_eleve_2_fils;
select lives_ok(
  (select public.send_message(
     (select c.id from public.conversations c
      where c.teacher_id = 'aaaaaa11-0000-0000-0000-0000000000t2'),
     'Bonjour.')),
  'l''élève écrit dans son fil'
) as t18_eleve_ecrit;
select temp_statu('ffaaaa11-0000-0000-0000-0000000000t2');
select is(
  (select jsonb_array_length(public.list_conversations())),
  1, 'le professeur t2 ne voit que SON fil'
) as t19_t2_portee;

-- ----------------------------------------------------------------------------
-- ANNONCES
-- ----------------------------------------------------------------------------
select temp_statu('ffaaaa11-0000-0000-0000-0000000000da');
select lives_ok(
  (select public.post_announcement('Rentrée', 'Les cours reprennent.', true, '{}'::text[])),
  'la direction publie une annonce pour toute l''école'
) as t20_annonce_all;
select temp_statu('ffaaaa11-0000-0000-0000-0000000000ec');
select is(
  (public.post_announcement('Cantine', 'Paiement cantine.', false,
    array['parent','eleve','directeur','econome']::text[]))->>'author',
  'Économat', 'l''auteur « Économat » est dérivé du rôle'
) as t21_economat_auteur;
select temp_statu('ffaaaa11-0000-0000-0000-0000000000pa');
select is(
  (select count(*) from public.announcements),
  2::bigint, 'le parent voit 2 annonces (toutes + ciblée parents)'
) as t22_parent_2;
select temp_statu('ffaaaa11-0000-0000-0000-0000000000t1');
select is(
  (select count(*) from public.announcements),
  1::bigint, 'l''enseignant ne voit que l''annonce « toutes »'
) as t23_enseignant_1;
select temp_statu('ffaaaa11-0000-0000-0000-0000000000su');
select throws_ok(
  (select public.post_announcement('Test', 'Test.', true, '{}'::text[])),
  'P0001', 'Seule la direction peut publier une annonce.',
  'le surveillant ne publie pas d''annonces'
) as t24_surv_refus;

-- ----------------------------------------------------------------------------
-- ABSENCES (surveillant)
-- ----------------------------------------------------------------------------
select lives_ok(
  (insert into public.absences (school_id, student_id, absence_date, absence_type, motif)
   values ('aaaaaa11-0000-0000-0000-000000000001', 'aaaaaa11-0000-0000-0000-0000000000s1',
           current_date, 'absence', 'Maladie')),
  'le surveillant enregistre une absence'
) as t25_absence_ok;
select is(
  (select count(*) from public.absences),
  1::bigint, 'l''absence est enregistrée'
) as t26_absence_1;
select throws_ok(
  (insert into public.absences (school_id, student_id, absence_date, absence_type)
   values ('aaaaaa11-0000-0000-0000-000000000001', 'bbbbbb22-0000-0000-0000-0000000000s1',
           current_date, 'absence')),
  null, null, 'échec attendu, détail juste après'
) as t27_absence_ecole_refus;
select temp_statu('ffaaaa11-0000-0000-0000-0000000000pa');
select throws_ok(
  (insert into public.absences (school_id, student_id, absence_date, absence_type)
   values ('aaaaaa11-0000-0000-0000-000000000001', 'aaaaaa11-0000-0000-0000-0000000000s1',
           current_date, 'absence')),
  null, null, 'échec attendu, détail juste après'
) as t28_absence_parent_refus;

-- ----------------------------------------------------------------------------
-- DASHBOARD (direction, économe finance)
-- ----------------------------------------------------------------------------
select temp_statu('ffaaaa11-0000-0000-0000-0000000000da');
select is(
  (public.admin_dashboard('S1')->>'expected'),
  '67000', 'attendu au jour le jour : 2 inscriptions + 2 mensualités (remise fratrie)'
) as t29_expected;
select is(
  (public.admin_dashboard('S1')->>'unpaidStudents'),
  '2', 'les 2 élèves ont une échéance en retard (octobre due)'
) as t30_unpaid_students;
select is(
  (select jsonb_array_length(public.admin_dashboard('S1')->'paymentsByMonth')),
  10, '10 mois de suivi (octobre → juillet de l''année scolaire)'
) as t31_10_mois;
select is(
  (public.admin_dashboard('S1')->>'generalAverage'),
  'null', 'sans notes, la moyenne générale est inconnue (pas 0)'
) as t32_avg_null;
select temp_statu('ffaaaa11-0000-0000-0000-0000000000pa');
select throws_ok(
  (select public.admin_dashboard('S1')),
  'P0001', 'Tableau de bord indisponible.', 'le tableau de bord est réservé à la direction'
) as t33_parent_refus;

select * from finish();
rollback;
