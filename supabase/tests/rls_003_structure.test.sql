-- ============================================================================
-- Tests pgTAP — Phase 3 : structure pédagogique (RLS, limites, RPCs).
-- Exécution : npx supabase test db  (base locale requise)
-- ============================================================================

begin;
select plan(30);

create or replace function temp_setup() returns void
language plpgsql volatile as $$
begin
  insert into public.schools (id, name, cycles)
  values ('aaaaaa11-0000-0000-0000-000000000001', 'École A', array['elementaire','moyen','secondaire']::app_cycle[]),
         ('bbbbbb22-0000-0000-0000-000000000001', 'École B', array['elementaire','moyen','secondaire']::app_cycle[]);
  insert into public.school_settings (school_id) values ('aaaaaa11-0000-0000-0000-000000000001'), ('bbbbbb22-0000-0000-0000-000000000001');

  insert into public.subscriptions (school_id, plan_id, starts_at, ends_at, student_limit)
  values ('aaaaaa11-0000-0000-0000-000000000001', 'pro', current_date, current_date + 30, 300),
         ('bbbbbb22-0000-0000-0000-000000000001', 'pro', current_date, current_date + 30, 300);

  insert into public.class_rooms (id, school_id, name, level_id, cycle, capacity)
  values ('aaaaaa11-0000-0000-0000-0000000000ca', 'aaaaaa11-0000-0000-0000-000000000001', 'CM1-A', 'cm1', 'elementaire', 30),
         ('aaaaaa11-0000-0000-0000-0000000000cb', 'aaaaaa11-0000-0000-0000-000000000001', 'CM1-B', 'cm1', 'elementaire', 30),
         ('aaaaaa11-0000-0000-0000-0000000000cm', 'aaaaaa11-0000-0000-0000-000000000001', '6e-A',  '6e',  'moyen',       30),
         ('bbbbbb22-0000-0000-0000-0000000000ca', 'bbbbbb22-0000-0000-0000-000000000001', 'CM1-B', 'cm1', 'elementaire', 30);

  insert into public.subjects (id, school_id, name, cycles)
  values ('cccccc33-0000-0000-0000-0000000000sa', 'aaaaaa11-0000-0000-0000-000000000001', 'Français A', array['elementaire','moyen','secondaire']::app_cycle[]),
         ('cccccc33-0000-0000-0000-0000000000sb', 'aaaaaa11-0000-0000-0000-000000000001', 'Maths A',    array['elementaire','moyen','secondaire']::app_cycle[]);

  insert into public.class_subjects (school_id, class_id, subject_id, coefficient)
  values ('aaaaaa11-0000-0000-0000-000000000001', 'aaaaaa11-0000-0000-0000-0000000000ca', 'cccccc33-0000-0000-0000-0000000000sa', 2);

  insert into public.teachers (id, school_id, kind, first_name, last_name, email)
  values ('dddddd44-0000-0000-0000-0000000000ta', 'aaaaaa11-0000-0000-0000-000000000001', 'professeur', 'Moussa', 'A', 'moussa.a@schoola.sn'),
         ('dddddd44-0000-0000-0000-0000000000tb', 'bbbbbb22-0000-0000-0000-000000000001', 'professeur', 'Moussa', 'B', 'moussa.b@schoolb.sn');

  insert into public.students (id, school_id, class_id, matricule, child_code, first_name, last_name, gender, birth_date)
  values ('eeeeee55-0000-0000-0000-0000000000s1', 'aaaaaa11-0000-0000-0000-000000000001', 'aaaaaa11-0000-0000-0000-0000000000ca', 'ECA0001', 'ABCDE1', 'Leila A1', 'A',	'F', '2014-01-01');

  insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data)
  values
    ('ffaaaa11-0000-0000-0000-0000000000da', 'dir.a@schoola.sn', crypt('demo1234!', gen_salt('bf')), now(), '{"role":"directeur","school_id":"aaaaaa11-0000-0000-0000-000000000001"}'),
    ('ffbbbb22-0000-0000-0000-0000000000db', 'dir.b@schoolb.sn', crypt('demo1234!', gen_salt('bf')), now(), '{"role":"directeur","school_id":"bbbbbb22-0000-0000-0000-000000000001"}'),
    ('ffaaaa11-0000-0000-0000-0000000000rr', 'ndeye.dia@famille.sn', crypt('demo1234!', gen_salt('bf')), now(), '{"role":"eleve","school_id":"aaaaaa11-0000-0000-0000-000000000001"}'),
    ('ffaaaa11-0000-0000-0000-0000000000rp', 'fatou.p2@famille.sn', crypt('demo1234!', gen_salt('bf')), now(), '{"role":"parent","school_id":"aaaaaa11-0000-0000-0000-000000000001"}');

  insert into public.profiles (id, school_id, role, status, first_name, last_name, email)
  values
    ('ffaaaa11-0000-0000-0000-0000000000da', 'aaaaaa11-0000-0000-0000-000000000001', 'directeur', 'ACTIF', 'Direct', 'A', 'dir.a@schoola.sn'),
    ('ffbbbb22-0000-0000-0000-0000000000db', 'bbbbbb22-0000-0000-0000-000000000001', 'directeur', 'ACTIF', 'Direct', 'B', 'dir.b@schoolb.sn'),
    ('ffaaaa11-0000-0000-0000-0000000000rr', 'aaaaaa11-0000-0000-0000-000000000001', 'eleve',     'EN_ATTENTE', 'Ndèye', 'Dia', 'ndeye.dia@famille.sn'),
    ('ffaaaa11-0000-0000-0000-0000000000rp', 'aaaaaa11-0000-0000-0000-000000000001', 'parent',    'EN_ATTENTE', 'Fatou', 'P2', 'fatou.p2@famille.sn');

  insert into public.registration_requests (id, school_id, user_id, role, first_name, last_name, email, phone, gender, birth_date, class_id, status)
  values
    ('aaaaaa11-0000-0000-0000-0000000000r1', 'aaaaaa11-0000-0000-0000-000000000001', 'ffaaaa11-0000-0000-0000-0000000000rr', 'eleve',  'Ndèye', 'Dia', 'ndeye.dia@famille.sn', '771112233', 'F', '2015-05-05', 'aaaaaa11-0000-0000-0000-0000000000cb', 'EN_ATTENTE'),
    ('aaaaaa11-0000-0000-0000-0000000000r2', 'aaaaaa11-0000-0000-0000-000000000001', 'ffaaaa11-0000-0000-0000-0000000000rp', 'parent', 'Fatou', 'P2',  'fatou.p2@famille.sn',  '773334455', null, null,      null,                                   'EN_ATTENTE');
end;
$$;
select temp_setup();

create or replace function temp_act_as(p_user_id uuid) returns text
language sql as $$
  select (
    select case
      when p_user_id = 'ffbbbb22-0000-0000-0000-0000000000db'
        then '{"sub":"ffbbbb22-0000-0000-0000-0000000000db","app_metadata":{"role":"directeur","school_id":"bbbbbb22-0000-0000-0000-000000000001"}}'
      else '{"sub":"ffaaaa11-0000-0000-0000-0000000000da","app_metadata":{"role":"directeur","school_id":"aaaaaa11-0000-0000-0000-000000000001"}}'
    end
  )
$$;

create or replace function temp_statu(p_user_id uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config('request.jwt.claims', temp_act_as(p_user_id), true);
  perform set_config('role', 'authenticated', true);
end;
$$;

-- 1-2 : le directeur de B ne voit que SON école.
select temp_statu('ffbbbb22-0000-0000-0000-0000000000db');
select is(
  (select count(*) from public.class_rooms where school_id = 'bbbbbb22-0000-0000-0000-000000000001'),
  1::bigint, 'le directeur de B voit sa classe'
) as t01_b_voits_sa_classe;
select is(
  (select count(*) from public.subjects),
  0::bigint, 'le directeur de B ne voit aucune matière de A'
) as t02_b_aucune_matiere_a;

-- 3-4 : inscription directe par le directeur de A (matricule, échéancier).
select temp_statu('ffaaaa11-0000-0000-0000-0000000000da');
select lives_ok(
  (select public.enroll_student(
    'aaaaaa11-0000-0000-0000-0000000000ca'::uuid, 'Ali', 'Dia', 'M', '2015-05-05'::date,
    '{}'::jsonb, null::uuid, 'Fatou', 'Dia', '771234567', 'fatou.dia@famille.sn', '')
  ),
  'directeur A : inscription directe acceptée'
) as t03_inscription_ok;
select is(
  (select count(*) from public.payments p
   join public.students s on s.id = p.student_id
   where s.first_name = 'Ali' and s.parent_id is not null),
  11::bigint, 'l''inscription génère 11 échéances (frais d''inscription + 10 mensualités)'
) as t04_echeances_11;

-- 5-6 : limite d'élèves de la formule (message exact registrationService).
perform set_config('role', 'postgres', true);
update public.subscriptions set student_limit = 1 where school_id = 'aaaaaa11-0000-0000-0000-000000000001';
perform set_config('role', 'authenticated', true);
select throws_ok(
  (select public.enroll_student(
    'aaaaaa11-0000-0000-0000-0000000000ca'::uuid, 'Awa', 'Sow', 'F', '2014-06-06'::date,
    '{}'::jsonb, null::uuid, 'Fatou', 'Sow', '771111111', 'awa.sow@famille.sn', '')
  ),
  'P0001', 'Votre formule .+ est limitée à 1 élèves', 'limite de formule : message exact renvoyé'
) as t05_limite_message;
select is(
  (select count(*) from public.students where school_id = 'aaaaaa11-0000-0000-0000-000000000001'),
  2::bigint, 'aucun élève créé au-delà de la limite'
) as t06_pas_deleve_en_trop;

-- 7 : plafond de 10 affectations par enseignant.
perform set_config('role', 'postgres', true);
update public.subscriptions set student_limit = 300 where school_id = 'aaaaaa11-0000-0000-0000-000000000001';
perform set_config('role', 'authenticated', true);
insert into public.subjects (id, school_id, name, cycles)
values ('cccccc33-0000-0000-0000-0000000000sc', 'aaaaaa11-0000-0000-0000-000000000001', 'EPS A',    array['elementaire','moyen','secondaire']::app_cycle[]),
       ('cccccc33-0000-0000-0000-0000000000sd', 'aaaaaa11-0000-0000-0000-000000000001', 'Anglais A', array['elementaire','moyen','secondaire']::app_cycle[]);
insert into public.teaching_assignments (school_id, teacher_id, class_id, subject_id)
select 'aaaaaa11-0000-0000-0000-000000000001', 'dddddd44-0000-0000-0000-0000000000ta'::uuid, c.cl, s.su
from (values
        ('aaaaaa11-0000-0000-0000-0000000000ca'::uuid), ('aaaaaa11-0000-0000-0000-0000000000cb'::uuid),
        ('aaaaaa11-0000-0000-0000-0000000000cm'::uuid)
     ) c(cl)
join (values
        ('cccccc33-0000-0000-0000-0000000000sa'::uuid), ('cccccc33-0000-0000-0000-0000000000sb'::uuid),
        ('cccccc33-0000-0000-0000-0000000000sc'::uuid), ('cccccc33-0000-0000-0000-0000000000sd'::uuid)
     ) s(su) on true;
select throws_ok(
  (select public.replace_cell_teachers(
    'aaaaaa11-0000-0000-0000-0000000000ca'::uuid, 'cccccc33-0000-0000-0000-0000000000sa'::uuid,
    array['dddddd44-0000-0000-0000-0000000000ta']::uuid[])),
  'P0001', 'est surchargé : \d+ affectations', 'enseignant à plus de 10 affectations refusé'
) as t07_surcharge;

-- 8-10 : titulaire / professeur principal.
select lives_ok(
  (select public.set_class_head_teacher('aaaaaa11-0000-0000-0000-0000000000ca'::uuid, 'dddddd44-0000-0000-0000-0000000000ta'::uuid, 'titulaire')),
  'titulaire d''une classe élémentaire : OK'
) as t08_titulaire_ok;
select throws_ok(
  (select public.set_class_head_teacher('aaaaaa11-0000-0000-0000-0000000000cm'::uuid, 'dddddd44-0000-0000-0000-0000000000ta'::uuid, 'titulaire')),
  'P0001', 'Cette classe n''est pas une classe élémentaire.', 'mode titulaire refusé au moyen'
) as t09_titulaire_moyen_refuse;
select throws_ok(
  (select public.set_class_head_teacher('aaaaaa11-0000-0000-0000-0000000000ca'::uuid, 'dddddd44-0000-0000-0000-0000000000ta'::uuid, 'principal')),
  'P0001', 'Le professeur principal concerne le moyen et le secondaire.', 'principal refusé en élémentaire'
) as t10_principal_elem_refuse;

-- 11-14 : ajout de matière → auto-affectation du titulaire ; retrait → nettoyage.
select lives_ok(
  (insert into public.class_subjects (school_id, class_id, subject_id, coefficient)
   values ('aaaaaa11-0000-0000-0000-000000000001', 'aaaaaa11-0000-0000-0000-0000000000ca', 'cccccc33-0000-0000-0000-0000000000sb', 1)),
  'ajout des Maths dans CM1-A'
) as t11_matiere_ajoutee;
select is(
  (select count(*) from public.teaching_assignments
   where class_id = 'aaaaaa11-0000-0000-0000-0000000000ca'
     and subject_id = 'cccccc33-0000-0000-0000-0000000000sb'),
  1::bigint, 'le titulaire est automatiquement affecté'
) as t12_titulaire_auto;
select lives_ok(
  (delete from public.class_subjects
   where class_id = 'aaaaaa11-0000-0000-0000-0000000000ca'
     and subject_id = 'cccccc33-0000-0000-0000-0000000000sb'),
  'retrait de la matière'
) as t13_matiere_retiree;
select is(
  (select count(*) from public.teaching_assignments
   where class_id = 'aaaaaa11-0000-0000-0000-0000000000ca'
     and subject_id = 'cccccc33-0000-0000-0000-0000000000sb'),
  0::bigint, 'les affectations de la cellule sont nettoyées'
) as t14_nettoyage;

-- 15-20 : capacité, classes ouvertes.
select throws_ok(
  (update public.class_rooms set capacity = 1 where id = 'aaaaaa11-0000-0000-0000-0000000000ca'),
  'P0001', 'La classe contient déjà 2 élèves.', 'capacité sous l''effectif refusée'
) as t15_capacite_refusee;
select lives_ok(
  (update public.schools set registration_open = false where id = 'aaaaaa11-0000-0000-0000-000000000001'),
  'l''école peut fermer ses inscriptions'
) as t16_fermeture_ok;
select is(
  (select count(*) from public.open_classes('aaaaaa11-0000-0000-0000-000000000001')),
  0::bigint, 'inscriptions fermées : aucune classe ouverte'
) as t17_ouvertes_fermees;
select lives_ok(
  (update public.class_rooms set capacity = 1 where id = 'aaaaaa11-0000-0000-0000-0000000000cm'),
  'la capacité d''une classe vide peut baisser'
) as t18_capacite_vide_ok;
perform set_config('role', 'postgres', true);
insert into public.students (id, school_id, class_id, matricule, child_code, first_name, last_name, gender)
values ('eeeeee55-0000-0000-0000-0000000000s9', 'aaaaaa11-0000-0000-0000-000000000001', 'aaaaaa11-0000-0000-0000-0000000000cm', 'ECM0001', 'CCODE1', 'Full Cm', 'Cm', 'M');
perform set_config('role', 'authenticated', true);
select lives_ok(
  (update public.schools set registration_open = true where id = 'aaaaaa11-0000-0000-0000-000000000001'),
  'l''école peut rouvrir ses inscriptions'
) as t19_reouverture_ok;
select is(
  (select count(*) from public.open_classes('aaaaaa11-0000-0000-0000-000000000001')),
  2::bigint, 'inscriptions ouvertes : seules les classes avec place apparaissent'
) as t20_ouvertes_2;

-- 21-22 : conflits d'affectations.
select is(
  (select count(*) from public.assignment_conflicts() c where c.conflict_id like 'nt-%'),
  1::bigint, 'CM1-B sans titulaire est signalée'
) as t21_titulaire_manquant;
select is(
  (select count(*) from public.assignment_conflicts() c where c.conflict_id like 'nh-%'),
  1::bigint, '6e-A sans professeur principal est signalée'
) as t22_principal_manquant;
update public.class_rooms set head_teacher_id = 'dddddd44-0000-0000-0000-0000000000ta' where id = 'aaaaaa11-0000-0000-0000-0000000000cb';

-- 23-26 : approbation d'une demande élève (parent créé, échéancier, annonce).
select is(
  public.decide_registration_requests(array['aaaaaa11-0000-0000-0000-0000000000r1']::uuid[], true),
  1, 'l''approbation valide 1 demande'
) as t23_approuve_1;
select is(
  (select status from public.profiles where id = 'ffaaaa11-0000-0000-0000-0000000000rr'),
  'ACTIF', 'le compte élève passe à ACTIF'
) as t24_eleve_actif;
select is(
  (select count(*) from public.students where school_id = 'aaaaaa11-0000-0000-0000-000000000001'),
  3::bigint, 'l''élève Ndèye est inscrit avec un matricule'
) as t25_eleve_inscrit;
select is(
  (select count(*) from public.announcements where title = 'Inscription(s) validée(s)' and school_id = 'aaaaaa11-0000-0000-0000-000000000001'),
  1::bigint, 'l''annonce « Inscription(s) validée(s) » est créée'
) as t26_annonce_validation;

-- 27-29 : refus (compte désactivé + motif enregistré).
select is(
  public.decide_registration_requests(array['aaaaaa11-0000-0000-0000-0000000000r2']::uuid[], false, 'Capacité atteinte en CM1.'),
  1, 'le refus valide 1 demande'
) as t27_refus_1;
select is(
  (select status from public.profiles where id = 'ffaaaa11-0000-0000-0000-0000000000rp'),
  'DESACTIVE', 'le compte refusé est désactivé'
) as t28_refuse_desactive;
select is(
  (select reason from public.registration_requests where id = 'aaaaaa11-0000-0000-0000-0000000000r2'),
  'Capacité atteinte en CM1.', 'le motif de refus est enregistré'
) as t29_motif_enregistre;

-- 30 : un directeur d'une autre école ne voit aucune demande.
select temp_statu('ffbbbb22-0000-0000-0000-0000000000db');
select throws_ok(
  (select public.decide_registration_requests(array['aaaaaa11-0000-0000-0000-0000000000r1']::uuid[], true)),
  'P0001', 'Aucune demande à approuver.', 'portée école des demandes '
) as t30_portee_ecole;

select * from finish();
rollback;
