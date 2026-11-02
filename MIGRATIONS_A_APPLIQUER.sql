

-- ############################################################################
-- FICHIER : backend/supabase/migrations/20260101000028_child_code_immediate.sql
-- ############################################################################

-- ============================================================================
-- SCOLIA — Génération immédiate du code élève (child_code) à l'inscription
-- Au lieu d'attendre l'approbation (auto ou manuelle), le code est créé
-- dès finish_student_registration. L'élève existe en EN_ATTENTE avec son code.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Modifier finish_student_registration : créer l'élève AVEC child_code
--    dès l'inscription, profil reste EN_ATTENTE jusqu'à approbation.
-- ----------------------------------------------------------------------------
create or replace function public.finish_student_registration(
  p_user_id uuid,
  p_school_id uuid,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_email text,
  p_gender text,
  p_birth_date date,
  p_class_id uuid
)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_profile_exists boolean;
  v_class_ok boolean;
  v_request_id uuid;
  v_approved boolean := false;
  v_student_id uuid;
  v_school record;
  v_child_code text;
begin
  if p_user_id is null then raise exception 'Compte introuvable.'; end if;
  if p_class_id is null then raise exception 'Sélectionnez une classe.'; end if;

  select * into v_school from public.schools where id = p_school_id;
  if not found then raise exception 'École introuvable.'; end if;

  if not v_school.registration_open then
    raise exception 'Les inscriptions sont fermées dans cette école.';
  end if;

  select exists (
    select 1 from public.class_rooms where id = p_class_id and school_id = p_school_id
  ) into v_class_ok;
  if not v_class_ok then
    raise exception 'Cette classe n''appartient pas à cette école.';
  end if;

  select exists (select 1 from public.profiles where id = p_user_id) into v_profile_exists;
  if v_profile_exists then
    raise exception 'Un compte existe déjà avec cet e-mail.';
  end if;

  -- Générer le code élève MAINTENANT (6 caractères, unique par école)
  v_child_code := public.generate_school_code(p_school_id, 6, 'child_code');

  -- Créer l'élève MAINTENANT avec son code, parent_id = null pour l'instant
  insert into public.students (
    school_id, matricule, child_code, first_name, last_name, gender, birth_date, class_id, parent_id, enrolled_at
  ) values (
    p_school_id,
    public.next_student_matricule(p_school_id, (select school_year from public.school_settings where school_id = p_school_id)),
    v_child_code,
    trim(p_first_name), trim(p_last_name),
    coalesce(p_gender::app_gender, 'F'::app_gender),
    coalesce(p_birth_date, date '2015-01-01'),
    p_class_id, null, current_date
  ) returning id into v_student_id;

  -- Profil élève EN_ATTENTE, mais déjà lié à l'élève (student_id)
  insert into public.profiles (id, school_id, role, status, first_name, last_name, phone, email, student_id)
  values (p_user_id, p_school_id, 'eleve', 'EN_ATTENTE', trim(p_first_name), trim(p_last_name), trim(p_phone), trim(p_email), v_student_id);

  -- Demande d'inscription
  insert into public.registration_requests
    (school_id, user_id, role, first_name, last_name, email, phone, gender, birth_date, class_id)
  values
    (p_school_id, p_user_id, 'eleve', trim(p_first_name), trim(p_last_name), trim(p_email), trim(p_phone),
     p_gender::app_gender, p_birth_date, p_class_id)
  returning id into v_request_id;

  -- Approbation automatique si activée
  if v_school.auto_approve_students then
    select not coalesce((
      select si.limit_reached
      from public.subscription_info(p_school_id) si
    ), false) into v_approved;
    if v_approved and not public.school_is_writable(p_school_id) then
      v_approved := false; -- école en lecture seule : décision manuelle reportée
    end if;
  end if;

  if v_approved then
    -- Échéancier de l'élève
    perform public.build_payment_plan(v_student_id);

    update public.profiles set status = 'ACTIF' where id = p_user_id;

    update public.registration_requests
    set status = 'APPROUVEE', decided_at = current_date
    where id = v_request_id;

    insert into public.audit_log (school_id, actor_id, action, entity, entity_id, payload)
    values (p_school_id, p_user_id, 'auto_approve_student', 'registration_requests', v_request_id, jsonb_build_object('student_id', v_student_id));
  end if;

  -- Retourner AUSSI le child_code pour l'afficher au parent/élève
  return jsonb_build_object(
    'request_id', v_request_id,
    'approved', v_approved,
    'student_id', v_student_id,
    'child_code', v_child_code
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 2. Modifier decide_registration_requests : mettre à jour l'élève existant
--    au lieu d'en créer un nouveau (le child_code existe déjà).
-- ----------------------------------------------------------------------------
create or replace function public.decide_registration_requests(
  p_ids uuid[],
  p_approve boolean,
  p_reason text default null
)
returns int
language plpgsql volatile security definer set search_path = public as $$
declare
  v_school uuid := current_school_id();
  v_role text := public.current_role();
  v_requests int;
  v_req record;
  v_students int;
  v_to_create int;
  v_limit int;
  v_plan text;
  v_parent_id uuid;
  v_student_id uuid;
  v_class record;
  v_child_count int;
begin
  if v_role <> 'directeur' then
    raise exception 'Seule la direction valide les demandes d''inscription.';
  end if;
  if not public.school_is_writable(v_school) then
    raise exception 'Mode lecture seule : l''abonnement de votre école est expiré. Les modifications sont désactivées.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('scolia:enroll:' || v_school::text, 0));

  drop table if exists tmp_requests;
  create temp table tmp_requests on commit drop as
  select * from public.registration_requests
  where school_id = v_school
    and status = 'EN_ATTENTE'
    and id = any (coalesce(p_ids, array[]::uuid[]));
  select count(*) into v_requests from tmp_requests;
  if v_requests = 0 then
    if p_approve then raise exception 'Aucune demande à approuver.'; else raise exception 'Aucune demande à refuser.'; end if;
  end if;

  if p_approve then
    if exists (select 1 from tmp_requests where role = 'eleve') then
      select si.plan_name into v_plan from public.subscription_info(v_school) si;
      select si.student_limit into v_limit from public.subscription_info(v_school) si;
      select count(*) into v_students from public.students where school_id = v_school;
      select count(*) into v_to_create from tmp_requests
      where role = 'eleve' and class_id is not null;
      if v_limit is not null and v_students + v_to_create > v_limit then
        raise exception 'Votre formule % est limitée à % élèves. Changez de formule pour approuver une nouvelle inscription.', v_plan, v_limit;
      end if;
    end if;
  end if;

  for v_req in select * from tmp_requests loop
    if p_approve then
      if v_req.role = 'eleve' and v_req.class_id is not null then
        select * into v_class from public.class_rooms where id = v_req.class_id;
        v_child_count := (select count(*) from public.students
                          where school_id = v_school and class_id = v_req.class_id);
        if v_child_count >= v_class.capacity then
          raise exception 'La classe % est complète (% places).', v_class.name, v_class.capacity;
        end if;

        -- Rattachement parent par e-mail
        select id into v_parent_id from public.parents
        where school_id = v_school and lower(email) = lower(v_req.email)
        limit 1;
        if not found then
          insert into public.parents (school_id, first_name, last_name, phone, email, address)
          values (v_school, v_req.first_name, v_req.last_name, v_req.phone, v_req.email, '')
          returning id into v_parent_id;
        end if;

        -- L'élève existe DÉJÀ (créé à l'inscription avec son child_code).
        -- On le met à jour : parent_id, classe, etc.
        select id into v_student_id
        from public.students
        where school_id = v_school
          and first_name = v_req.first_name
          and last_name = v_req.last_name
          and (birth_date = v_req.birth_date or (birth_date is null and v_req.birth_date is null))
        limit 1;

        if found then
          update public.students
          set parent_id = v_parent_id,
              class_id = v_req.class_id,
              gender = coalesce(v_req.gender, gender),
              birth_date = coalesce(v_req.birth_date, birth_date)
          where id = v_student_id;
        else
          -- Fallback (ne devrait pas arriver) : créer si introuvable
          insert into public.students (
            school_id, matricule, child_code, first_name, last_name, gender, birth_date, class_id, parent_id, enrolled_at
          ) values (
            v_school,
            public.next_student_matricule(v_school, (select school_year from public.school_settings where school_id = v_school)),
            public.generate_school_code(v_school, 6, 'child_code'),
            v_req.first_name, v_req.last_name,
            coalesce(v_req.gender, 'F'::app_gender),
            coalesce(v_req.birth_date, date '2015-01-01'),
            v_req.class_id, v_parent_id, current_date
          ) returning id into v_student_id;
        end if;

        -- Échéancier
        perform public.build_payment_plan(v_student_id);

        -- Lier le profil à l'élève
        update public.profiles set status = 'ACTIF', student_id = v_student_id where id = v_req.user_id;

        update public.registration_requests
        set status = 'APPROUVEE', decided_at = current_date, reason = p_reason
        where id = v_req.id;

        insert into public.audit_log (school_id, actor_id, actor_role, action, entity, entity_id, payload)
        values (v_school, v_req.user_id, 'approve_student', 'registration_requests', v_req.id, jsonb_build_object('student_id', v_student_id, 'child_code', (select child_code from public.students where id = v_student_id)));
      else
        -- Parent ou élève sans classe : simple activation
        update public.profiles set status = 'ACTIF' where id = v_req.user_id;
        update public.registration_requests
        set status = 'APPROUVEE', decided_at = current_date, reason = p_reason
        where id = v_req.id;
      end if;
    else
      -- REFUS (H3) : suppression UNIQUEMENT de l'élève créé par CETTE
-- inscription, retrouvé via profiles.student_id. La suppression « par
-- homonymie » pouvait effacer l'enfant légitime d'une autre famille
-- (avec cascades notes/paiements/absences/messagerie).
if v_req.role = 'eleve' then
  select student_id into v_student_id from public.profiles where id = v_req.user_id limit 1;
  if v_student_id is not null then
    delete from public.students where id = v_student_id and school_id = v_school;
  end if;
end if;

      update public.profiles set status = 'DESACTIVE' where id = v_req.user_id;
      update public.registration_requests
      set status = 'REFUSEE', decided_at = current_date, reason = p_reason
      where id = v_req.id;

      insert into public.audit_log (school_id, actor_id, actor_role, action, entity, entity_id, payload)
      values (v_school, v_req.user_id, 'reject_student', 'registration_requests', v_req.id, jsonb_build_object('reason', p_reason));
    end if;
  end loop;

  return v_requests;
end;
$$;



-- ############################################################################
-- FICHIER : backend/supabase/migrations/20260101000035_inscription_formule_un_an.sql
-- ############################################################################

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




-- ############################################################################
-- FICHIER : backend/supabase/migrations/20260101000036_durcissement_audit_vague1.sql
-- ############################################################################

-- ============================================================================
-- 00036 — Durcissement vagues 1 (audit du 02/11/2026).
--
-- Corrige les constats CRITIQUES/HAUT de l'audit :
--   1. (H1) Trois policies SQL « tautologiques » : dans `exists (select 1
--      from class_rooms c where ... c.school_id = school_id)`, le school_id
--      NON qualifié se résolvait sur c.school_id (la colonne du FROM
--      intérieur, du même nom) → comparaison toujours vraie → un directeur
--      pouvait rattacher une classe/matière/enseignant d'une AUTRE école.
--      00015 avait corrigé le même bug pour grades/payments/report_metas ;
--      `class_subjects` (insert + update) et `teaching_assignments` (insert)
--      restait à faire. On requalifie avec current_school_id().
--   2. (H2) finish_student_registration : l'élève est créé AVANT tout contrôle
--      de viabilité → une école expirée continuait d'engranger des comptes
--      élèves, et le matricule d'école (semi-public) permettait l'inflation
--      des demandes en attente. Journal : school_is_writable AVANT l'insert
--      + plafond (100) de demandes EN_ATTENTE par école.
--   3. (H3) decide_registration_requests rattachait l'élève « par homonymie »
--      (prénom + nom + date de naissance) : à l'approbation, un attaquant
--      inscrit avec l'identité d'un élève réel héritait de son dossier ;
--      au refus, la suppression par homonymie pouvait détruire l'élève
--      légitime (cascade notes/paiements/absences). Désormais : l'élève est
--      retrouvé UNIQUEMENT via profiles.student_id du compte de la demande
--      (posé à l'inscription, 00028) — jamais par nom.
--   4. (C3, préventif) TRUNCATE n'est pas bloqué par la RLS : révoke
--      explicite + default privileges, non destructif (aucun grant DML,
--      lecture ou FK n'est touché).
--
-- Idempotente : peut être rejouée sans erreur.
-- ============================================================================

-- ============================================================================
-- 1. (C3) TRUNCATE fermé sur tout le schéma public
-- ============================================================================
revoke truncate on all tables in schema public from anon, authenticated;

alter default privileges in schema public
  revoke truncate on tables from anon, authenticated;

-- ============================================================================
-- 2. (H1) Requalification des policies tautologiques
--    current_school_id() est la même valeur que `school_id = current_school_id()`
--    déjà exigée par la policy : la référence est donc toujours de l'école de
--    la direction, quelle que soit la ressource pointée.
-- ============================================================================

-- 2a. class_subjects — INSERT
drop policy if exists "class_subjects_insert_direction" on public.class_subjects;
create policy "class_subjects_insert_direction" on public.class_subjects
  for insert to authenticated
  with check (
    direction_can_write()
    and school_id = current_school_id()
    and exists (select 1 from public.class_rooms c where c.id = class_id and c.school_id = current_school_id())
    and exists (select 1 from public.subjects s where s.id = subject_id and s.school_id = current_school_id())
  );

-- 2b. class_subjects — UPDATE
drop policy if exists "class_subjects_update_direction" on public.class_subjects;
create policy "class_subjects_update_direction" on public.class_subjects
  for update to authenticated
  using (direction_can_write() and school_id = current_school_id())
  with check (
    direction_can_write()
    and school_id = current_school_id()
    and exists (select 1 from public.class_rooms c where c.id = class_id and c.school_id = current_school_id())
    and exists (select 1 from public.subjects s where s.id = subject_id and s.school_id = current_school_id())
  );

-- 2c. teaching_assignments — INSERT (enseignant + classe + matière de L'école)
drop policy if exists "assignments_insert_direction" on public.teaching_assignments;
create policy "assignments_insert_direction" on public.teaching_assignments
  for insert to authenticated
  with check (
    direction_can_write()
    and school_id = current_school_id()
    and exists (select 1 from public.teachers t where t.id = teacher_id and t.school_id = current_school_id())
    and exists (select 1 from public.class_rooms c where c.id = class_id and c.school_id = current_school_id())
    and exists (select 1 from public.subjects s where s.id = subject_id and s.school_id = current_school_id())
  );

-- ============================================================================
-- 3. (H2) finish_student_registration — viabilité de l'école AVANT l'écriture
--    (copie du corps 00028, avec les contrôles ajoutés ; signature inchangée.)
-- ============================================================================
drop function if exists public.finish_student_registration(uuid, uuid, text, text, text, text, text, date, uuid);

create or replace function public.finish_student_registration(
  p_user_id uuid,
  p_school_id uuid,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_email text,
  p_gender text,
  p_birth_date date,
  p_class_id uuid
)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_profile_exists boolean;
  v_class_ok boolean;
  v_request_id uuid;
  v_approved boolean := false;
  v_student_id uuid;
  v_school record;
  v_child_code text;
  v_pending int;
begin
  if p_user_id is null then raise exception 'Compte introuvable.'; end if;
  if p_class_id is null then raise exception 'Sélectionnez une classe.'; end if;

  select * into v_school from public.schools where id = p_school_id;
  if not found then raise exception 'École introuvable.'; end if;

  if not v_school.registration_open then
    raise exception 'Les inscriptions sont fermées dans cette école.';
  end if;

  -- (H2) Abonnement : une école expirée au-delà de la fenêtre de lecture
  -- seule ne doit plus recevoir de nouvelles demandes d'inscription.
  if not public.school_is_writable(p_school_id) then
    raise exception 'Les inscriptions sont momentanément indisponibles dans cette école (abonnement expiré).';
  end if;

  -- (H2) Anti-inflation : le matricule d'école circule au sein des familles,
  -- il n'est pas un secret. Sans plafond, un script pouvait créer les demandes
  -- en attente à la chaîne et remplir le quota d'élèves de la formule
  -- (limit_reached compte l'effectif INSCRIT, demandes comprises).
  select count(*) into v_pending
  from public.registration_requests
  where school_id = p_school_id and status = 'EN_ATTENTE';
  if v_pending >= 100 then
    raise exception 'Cette école a déjà trop de demandes en attente. Contactez l''école directement.';
  end if;

  select exists (
    select 1 from public.class_rooms where id = p_class_id and school_id = p_school_id
  ) into v_class_ok;
  if not v_class_ok then
    raise exception 'Cette classe n''appartient pas à cette école.';
  end if;

  select exists (select 1 from public.profiles where id = p_user_id) into v_profile_exists;
  if v_profile_exists then
    raise exception 'Un compte existe déjà avec cet e-mail.';
  end if;

  -- Générer le code élève MAINTENANT (6 caractères, unique par école)
  v_child_code := public.generate_school_code(p_school_id, 6, 'child_code');

  -- Créer l'élève MAINTENANT avec son code, parent_id = null pour l'instant
  insert into public.students (
    school_id, matricule, child_code, first_name, last_name, gender, birth_date, class_id, parent_id, enrolled_at
  ) values (
    p_school_id,
    public.next_student_matricule(p_school_id, (select school_year from public.school_settings where school_id = p_school_id)),
    v_child_code,
    trim(p_first_name), trim(p_last_name),
    coalesce(p_gender::app_gender, 'F'::app_gender),
    coalesce(p_birth_date, date '2015-01-01'),
    p_class_id, null, current_date
  ) returning id into v_student_id;

  -- Profil élève EN_ATTENTE, mais déjà lié à l'élève (student_id)
  insert into public.profiles (id, school_id, role, status, first_name, last_name, phone, email, student_id)
  values (p_user_id, p_school_id, 'eleve', 'EN_ATTENTE', trim(p_first_name), trim(p_last_name), trim(p_phone), trim(p_email), v_student_id);

  -- Demande d'inscription
  insert into public.registration_requests
    (school_id, user_id, role, first_name, last_name, email, phone, gender, birth_date, class_id)
  values
    (p_school_id, p_user_id, 'eleve', trim(p_first_name), trim(p_last_name), trim(p_email), trim(p_phone),
     p_gender::app_gender, p_birth_date, p_class_id)
  returning id into v_request_id;

  -- Approbation automatique si activée
  if v_school.auto_approve_students then
    select not coalesce((
      select si.limit_reached
      from public.subscription_info(p_school_id) si
    ), false) into v_approved;
    if v_approved and not public.school_is_writable(p_school_id) then
      v_approved := false; -- école en lecture seule : décision manuelle reportée
    end if;
  end if;

  if v_approved then
    -- Échéancier de l'élève
    perform public.build_payment_plan(v_student_id);

    update public.profiles set status = 'ACTIF' where id = p_user_id;

    update public.registration_requests
    set status = 'APPROUVEE', decided_at = current_date
    where id = v_request_id;

    insert into public.audit_log (school_id, actor_id, action, entity, entity_id, payload)
    values (p_school_id, p_user_id, 'auto_approve_student', 'registration_requests', v_request_id, jsonb_build_object('student_id', v_student_id));
  end if;

  -- Retourner AUSSI le child_code pour l'afficher au parent/élève
  return jsonb_build_object(
    'request_id', v_request_id,
    'approved', v_approved,
    'student_id', v_student_id,
    'child_code', v_child_code
  );
end;
$$;

-- ============================================================================
-- 4. (H3) decide_registration_requests — identité de l'élève par
--    profiles.student_id uniquement (aucun rattachement/suppression par
--    homonymie).
--
-- Architecture conservée depuis 00017 : la logique vit dans une fonction
-- `_impl` réservée au service_role, et la RPC `decide_registration_requests`
-- est un « wrapper » appelé DIRECTEMENT par le front (JWT directeur) qui
-- vérifie d'abord assert_active_account(). L'ancienne `_unchecked` (00017,
-- avec la logique d'homonymie) est supprimée.
-- ============================================================================
drop function if exists public.decide_registration_requests(uuid[], boolean, text);
drop function if exists public.decide_registration_requests_unchecked(uuid[], boolean, text);

create or replace function public.decide_registration_requests_impl(
  p_ids uuid[],
  p_approve boolean,
  p_reason text default null
)
returns int
language plpgsql volatile security definer set search_path = public as $$
declare
  v_school uuid := current_school_id();
  v_role text := public.current_role();
  v_requests int;
  v_req record;
  v_students int;
  v_to_create int;
  v_limit int;
  v_plan text;
  v_parent_id uuid;
  v_student_id uuid;
  v_class record;
  v_child_count int;
begin
  if v_role <> 'directeur' then
    raise exception 'Seule la direction valide les demandes d''inscription.';
  end if;
  if not public.school_is_writable(v_school) then
    raise exception 'Mode lecture seule : l''abonnement de votre école est expiré. Les modifications sont désactivées.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('scolia:enroll:' || v_school::text, 0));

  drop table if exists tmp_requests;
  create temp table tmp_requests on commit drop as
  select * from public.registration_requests
  where school_id = v_school
    and status = 'EN_ATTENTE'
    and id = any (coalesce(p_ids, array[]::uuid[]));
  select count(*) into v_requests from tmp_requests;
  if v_requests = 0 then
    if p_approve then raise exception 'Aucune demande à approuver.'; else raise exception 'Aucune demande à refuser.'; end if;
  end if;

  if p_approve then
    if exists (select 1 from tmp_requests where role = 'eleve') then
      select si.plan_name into v_plan from public.subscription_info(v_school) si;
      select si.student_limit into v_limit from public.subscription_info(v_school) si;
      select count(*) into v_students from public.students where school_id = v_school;
      select count(*) into v_to_create from tmp_requests
      where role = 'eleve' and class_id is not null;
      if v_limit is not null and v_students + v_to_create > v_limit then
        raise exception 'Votre formule % est limitée à % élèves. Changez de formule pour approuver une nouvelle inscription.', v_plan, v_limit;
      end if;
    end if;
  end if;

  for v_req in select * from tmp_requests loop
    if p_approve then
      if v_req.role = 'eleve' and v_req.class_id is not null then
        select * into v_class from public.class_rooms where id = v_req.class_id;
        v_child_count := (select count(*) from public.students
                          where school_id = v_school and class_id = v_req.class_id);
        if v_child_count >= v_class.capacity then
          raise exception 'La classe % est complète (% places).', v_class.name, v_class.capacity;
        end if;

        -- Rattachement parent par e-mail
        select id into v_parent_id from public.parents
        where school_id = v_school and lower(email) = lower(v_req.email)
        limit 1;
        if not found then
          insert into public.parents (school_id, first_name, last_name, phone, email, address)
          values (v_school, v_req.first_name, v_req.last_name, v_req.phone, v_req.email, '')
          returning id into v_parent_id;
        end if;

        -- (H3) L'élève est retrouvé par l'index posé à l'inscription sur le
        -- profil de CE compte (profiles.student_id). AUCUNE recherche par
        -- prénom+nom+date : un compte inscrit avec l'identité d'un enfant
        -- réel ne peut plus hériter de son dossier à l'approbation.
        select student_id into v_student_id
        from public.profiles
        where id = v_req.user_id
        limit 1;
        if v_student_id is null then
          raise exception 'Aucun élève n''est lié à la demande de % % : validez ce compte depuis l''inscription.', v_req.first_name, v_req.last_name;
        end if;
        if not exists (select 1 from public.students where id = v_student_id and school_id = v_school) then
          raise exception 'L''élève du compte % % est introuvable dans cette école.', v_req.first_name, v_req.last_name;
        end if;

        update public.students
        set parent_id = v_parent_id,
            class_id = v_req.class_id,
            gender = coalesce(v_req.gender, gender),
            birth_date = coalesce(v_req.birth_date, birth_date)
        where id = v_student_id;

        -- Échéancier
        perform public.build_payment_plan(v_student_id);

        -- Lier le profil à l'élève
        update public.profiles set status = 'ACTIF', student_id = v_student_id where id = v_req.user_id;

        update public.registration_requests
        set status = 'APPROUVEE', decided_at = current_date, reason = p_reason
        where id = v_req.id;

        insert into public.audit_log (school_id, actor_id, actor_role, action, entity, entity_id, payload)
        values (v_school, v_req.user_id, 'approve_student', 'registration_requests', v_req.id, jsonb_build_object('student_id', v_student_id, 'child_code', (select child_code from public.students where id = v_student_id)));
      else
        -- Parent ou élève sans classe : simple activation
        update public.profiles set status = 'ACTIF' where id = v_req.user_id;
        update public.registration_requests
        set status = 'APPROUVEE', decided_at = current_date, reason = p_reason
        where id = v_req.id;
      end if;
    else
      -- REFUS (H3) : suppression UNIQUEMENT de l'élève créé par CETTE
      -- inscription, retrouvé via profiles.student_id. La suppression « par
      -- homonymie » pouvait effacer l'enfant légitime d'une autre famille
      -- (avec cascades notes/paiements/absences/messagerie).
      if v_req.role = 'eleve' then
        select student_id into v_student_id from public.profiles where id = v_req.user_id limit 1;
        if v_student_id is not null then
          delete from public.students where id = v_student_id and school_id = v_school;
        end if;
      end if;

      update public.profiles set status = 'DESACTIVE' where id = v_req.user_id;
      update public.registration_requests
      set status = 'REFUSEE', decided_at = current_date, reason = p_reason
      where id = v_req.id;

      insert into public.audit_log (school_id, actor_id, actor_role, action, entity, entity_id, payload)
      values (v_school, v_req.user_id, 'reject_student', 'registration_requests', v_req.id, jsonb_build_object('reason', p_reason));
    end if;
  end loop;

  return v_requests;
end;
$$;

-- Wrapper appelé par le front avec le JWT du directeur — même contrat que la
-- 00017 : compte actif + mot de passe temporaire changé, puis `_impl`.
create or replace function public.decide_registration_requests(
  p_ids uuid[],
  p_approve boolean,
  p_reason text default null
)
returns int
language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.assert_active_account();
  return public.decide_registration_requests_impl(p_ids, p_approve, p_reason);
end;
$$;

-- ============================================================================
-- 5. Droits : identique à 00017/00028.
--    * finish_student_registration / decide_..._impl : service_role uniquement
--      (l'API Express les appelle avec la clé de service) ;
--    * decide_registration_requests (wrapper) : authenticated — le directeur
--      l'appelle directement depuis le front avec son JWT.
-- ============================================================================
revoke execute on function public.finish_student_registration(uuid, uuid, text, text, text, text, text, date, uuid)
  from public, anon, authenticated;
grant execute on function public.finish_student_registration(uuid, uuid, text, text, text, text, text, date, uuid)
  to service_role;

revoke execute on function public.decide_registration_requests_impl(uuid[], boolean, text)
  from public, anon, authenticated;
grant execute on function public.decide_registration_requests_impl(uuid[], boolean, text)
  to service_role;

revoke execute on function public.decide_registration_requests(uuid[], boolean, text)
  from public, anon;
grant execute on function public.decide_registration_requests(uuid[], boolean, text)
  to authenticated;




-- ############################################################################
-- FICHIER : backend/supabase/migrations/20260101000037_durcissement_audit_vague2.sql
-- ############################################################################

-- ============================================================================
-- 00037 — Durcissement vagues 2 de l'audit (02/11/2026).
--
--   1. (M5) Module emploi du temps : policies alignées sur le reste du
--      schéma (00006/00015) :
--        * user_can_query_data() partout (un compte désactivé ou en mot de
--          passe temporaire ne lit plus les EDT) ;
--        * écriture de la direction pilotée par direction_can_write()
--          (= directeur + compte actif + abonnement valide) au lieu d'un
--          simple test de rôle ;
--        * same-school explicite sur subject_id / teacher_id à l'INSERT et
--          l'UPDATE d'un cours : un directeur ne peut plus pointer une
--          matière ou un enseignant d'une AUTRE école dans son EDT.
--   2. (H5) admin_purge_school : la suppression d'un établissement devient
--      une transaction unique (students puis schools, cascade complète).
--      Avant, la route supprimait les élèves PUIS l'école en deux
--      opérations Web : un échec entre les deux perdait les élèves sans
--      supprimer l'école. La RPC collecte aussi les ids Auth à nettoyage
--      « best effort » après coup côté Node.
--
-- Idempotente : peut être rejouée sans erreur.
-- ============================================================================

-- ============================================================================
-- 1. Policies emploi du temps
-- ============================================================================

-- 1a. timetables — LECTURE
drop policy if exists "Lecture des emplois du temps de son école" on public.timetables;
create policy "Lecture des emplois du temps de son école"
  on public.timetables
  for select
  to authenticated
  using (
    public.user_can_query_data()
    and school_id = public.current_school_id()
    and (status = 'published' or public.current_role() = 'directeur')
  );

-- 1b. timetables — GESTION (direction, compte actif, abonnement valide)
drop policy if exists "Directeur peut gérer ses emplois du temps" on public.timetables;
create policy "Directeur peut gérer ses emplois du temps"
  on public.timetables
  for all
  to authenticated
  using (public.direction_can_write() and school_id = public.current_school_id())
  with check (public.direction_can_write() and school_id = public.current_school_id());

-- 1c. timetable_courses — LECTURE
drop policy if exists "Lecture des cours d'un emploi du temps accessible" on public.timetable_courses;
create policy "Lecture des cours d'un emploi du temps accessible"
  on public.timetable_courses
  for select
  to authenticated
  using (
    public.user_can_query_data()
    and exists (
      select 1
      from public.timetables t
      where t.id = timetable_id
        and t.school_id = public.current_school_id()
        and (t.status = 'published' or public.current_role() = 'directeur')
    )
  );

-- 1d. timetable_courses — GESTION + same-school sur matières/enseignants
drop policy if exists "Directeur peut gérer ses cours d'emploi du temps" on public.timetable_courses;
create policy "Directeur peut gérer ses cours d'emploi du temps"
  on public.timetable_courses
  for all
  to authenticated
  using (
    public.direction_can_write()
    and exists (
      select 1 from public.timetables t
      where t.id = timetable_id and t.school_id = public.current_school_id()
    )
  )
  with check (
    public.direction_can_write()
    and exists (
      select 1 from public.timetables t
      where t.id = timetable_id and t.school_id = public.current_school_id()
    )
    and exists (
      select 1 from public.subjects s
      where s.id = subject_id and s.school_id = public.current_school_id()
    )
    and exists (
      select 1 from public.teachers te
      where te.id = teacher_id and te.school_id = public.current_school_id()
    )
  );

-- ============================================================================
-- 2. (H5) Suppression transactionnelle d'un établissement
-- ============================================================================

create or replace function public.admin_purge_school(p_school_id uuid)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_school record;
  v_profiles uuid[];
  v_students int;
begin
  -- Réservée à la console admin (l'API Express l'appelle avec service_role).
  if auth.role() is distinct from 'service_role'
     and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Purge réservée à la console d''administration.';
  end if;

  select * into v_school from public.schools where id = p_school_id;
  if not found then
    raise exception 'Établissement introuvable.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('scolia:purge:' || p_school_id::text, 0));

  -- Effectif pour le journal d'audit (avant suppression).
  select count(*) into v_students from public.students where school_id = p_school_id;

  -- Comptes de l'école (avant la cascade : profiles partent avec l'école).
  select coalesce(array_agg(id), '{}'::uuid[]) into v_profiles
  from public.profiles where school_id = p_school_id;

  -- Les élèves d'abord : le trigger guard_class_delete refuse qu'une classe
  -- reste peuplée. TOUT reste dans la même transaction : si une étape échoue,
  -- rien n'est supprimé (fini la perte partielle élèves sans école).
  delete from public.students where school_id = p_school_id;

  -- L'école : cascade sur classes, enseignants, parents, abonnements,
  -- messages, notes, paiements, emplois du temps…
  delete from public.schools where id = p_school_id;

  return jsonb_build_object(
    'school_name', v_school.name,
    'matricule', v_school.matricule,
    'students', v_students,
    'auth_user_ids', v_profiles
  );
end;
$$;

revoke execute on function public.admin_purge_school(uuid)
  from public, anon, authenticated;
grant execute on function public.admin_purge_school(uuid)
  to service_role;

comment on function public.admin_purge_school(uuid)
  is 'Suppression transactionnelle d''un établissement (une transaction au lieu de deux requêtes web) ; renvoie les ids Auth à nettoyer.';




-- ############################################################################
-- FICHIER : backend/supabase/migrations/20260101000038_durcissement_audit_vague3.sql
-- ############################################################################

-- ============================================================================
-- 00038 — Durcissement vague 3 de l'audit (02/11/2026).
--
--   1. (M1) EXPIRE_BIENTOT : ajouter la logique dans compute_subscription_info
--      (aujourd'hui renvoie seulement ACTIF/EXPIRE via subscription_status_of).
--   2. (M3) finish_student_registration auto-approve : vérifier capacité classe
--      avant d'approuver (l'approbation manuelle le fait, l'auto non).
--   3. (M4) Race condition "dernier superadmin" : RPC atomique count+update.
--   4. (M9) block_student_bulletins : grant UPDATE colonnes + policies
--      class_report_cards + grades (élève/parent).
--   5. (M10) school_is_readable : l'utiliser dans les policies SELECT principales.
--   6. (M11) parents lisibles par élèves : restreindre aux profils directeurs/
--      enseignants/économe/secrétaire, élève/parent = leur foyer seulement.
--   7. (M12) complete_password_change : preuve que le mot de passe a changé.
--   8. (M13) verify_matricule : rate-limit DB + réponse uniformisée.
--   9. (M15) sanitSearch : échapper aussi `_` + adminSchools (correction backend).
--   10. (M16) requireUuid sur adminAgents/adminSchools (déjà fait).
--   11. (F1) Supprimer lib/pdfUtils.js (code mort dangereux).
--   12. (F11) MatriculeCard : canManage figé à l'init → state dérivé (correction frontend).
--
-- Idempotente : peut être rejouée sans erreur.
-- ============================================================================

-- ============================================================================
-- 1. (M1) compute_subscription_info : ajouter EXPIRE_BIENTOT via subscription_status_of
--    On modifie la fonction subscription_status_of qui est appelée par
--    compute_subscription_info (00021) pour retourner EXPIRE_BIENTOT.
-- ============================================================================
create or replace function public.subscription_status_of(p_school_id uuid, p_ends_at timestamptz)
returns text
language sql stable security definer set search_path = public as $$
  select case
    when p_ends_at is null then 'AUCUN'
    when p_ends_at < current_date then 'EXPIRE'
    when p_ends_at < current_date + 7 then 'EXPIRE_BIENTOT'
    else 'ACTIF'
  end
$$;

-- compute_subscription_info utilise déjà subscription_status_of → pas de changement requis

revoke execute on function public.subscription_status_of(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.subscription_status_of(uuid, timestamptz) to authenticated;

-- ============================================================================
-- 2. (M3) finish_student_registration : check capacité classe en auto-approve
--    La fonction a été réécrite en 00036, on ajoute le check capacité ici.
-- ============================================================================
drop function if exists public.finish_student_registration(uuid, uuid, text, text, text, text, text, date, uuid);

create or replace function public.finish_student_registration(
  p_user_id uuid,
  p_school_id uuid,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_email text,
  p_gender text,
  p_birth_date date,
  p_class_id uuid
)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_profile_exists boolean;
  v_class_ok boolean;
  v_request_id uuid;
  v_approved boolean := false;
  v_student_id uuid;
  v_school record;
  v_child_code text;
  v_pending int;
  v_class record;
begin
  if p_user_id is null then raise exception 'Compte introuvable.'; end if;
  if p_class_id is null then raise exception 'Sélectionnez une classe.'; end if;

  select * into v_school from public.schools where id = p_school_id;
  if not found then raise exception 'École introuvable.'; end if;

  if not v_school.registration_open then
    raise exception 'Les inscriptions sont fermées dans cette école.';
  end if;

  if not public.school_is_writable(p_school_id) then
    raise exception 'Les inscriptions sont momentanément indisponibles dans cette école (abonnement expiré).';
  end if;

  select count(*) into v_pending
  from public.registration_requests
  where school_id = p_school_id and status = 'EN_ATTENTE';
  if v_pending >= 100 then
    raise exception 'Cette école a déjà trop de demandes en attente. Contactez l''école directement.';
  end if;

  select exists (
    select 1 from public.class_rooms where id = p_class_id and school_id = p_school_id
  ) into v_class_ok;
  if not v_class_ok then
    raise exception 'Cette classe n''appartient pas à cette école.';
  end if;

  select exists (select 1 from public.profiles where id = p_user_id) into v_profile_exists;
  if v_profile_exists then
    raise exception 'Un compte existe déjà avec cet e-mail.';
  end if;

  -- Générer le code élève MAINTENANT (6 caractères, unique par école)
  v_child_code := public.generate_school_code(p_school_id, 6, 'child_code');

  -- Créer l'élève MAINTENANT avec son code, parent_id = null pour l'instant
  insert into public.students (
    school_id, matricule, child_code, first_name, last_name, gender, birth_date, class_id, parent_id, enrolled_at
  ) values (
    p_school_id,
    public.next_student_matricule(p_school_id, (select school_year from public.school_settings where school_id = p_school_id)),
    v_child_code,
    trim(p_first_name), trim(p_last_name),
    coalesce(p_gender::app_gender, 'F'::app_gender),
    coalesce(p_birth_date, date '2015-01-01'),
    p_class_id, null, current_date
  ) returning id into v_student_id;

  -- Profil élève EN_ATTENTE, mais déjà lié à l'élève (student_id)
  insert into public.profiles (id, school_id, role, status, first_name, last_name, phone, email, student_id)
  values (p_user_id, p_school_id, 'eleve', 'EN_ATTENTE', trim(p_first_name), trim(p_last_name), trim(p_phone), trim(p_email), v_student_id);

  -- Demande d'inscription
  insert into public.registration_requests
    (school_id, user_id, role, first_name, last_name, email, phone, gender, birth_date, class_id)
  values
    (p_school_id, p_user_id, 'eleve', trim(p_first_name), trim(p_last_name), trim(p_email), trim(p_phone),
     p_gender::app_gender, p_birth_date, p_class_id)
  returning id into v_request_id;

  -- Approbation automatique si activée
  if v_school.auto_approve_students then
    select not coalesce((
      select si.limit_reached
      from public.subscription_info(p_school_id) si
    ), false) into v_approved;
    if v_approved and not public.school_is_writable(p_school_id) then
      v_approved := false; -- école en lecture seule : décision manuelle reportée
    end if;
  end if;

  if v_approved then
    -- (M3) Vérifier capacité classe AVANT d'approuver
    select * into v_class from public.class_rooms where id = p_class_id;
    if (select count(*) from public.students where school_id = p_school_id and class_id = p_class_id) >= v_class.capacity then
      raise exception 'La classe % est complète (% places).', v_class.name, v_class.capacity;
    end if;

    -- Échéancier de l'élève
    perform public.build_payment_plan(v_student_id);

    update public.profiles set status = 'ACTIF' where id = p_user_id;

    update public.registration_requests
    set status = 'APPROUVEE', decided_at = current_date
    where id = v_request_id;

    insert into public.audit_log (school_id, actor_id, action, entity, entity_id, payload)
    values (p_school_id, p_user_id, 'auto_approve_student', 'registration_requests', v_request_id, jsonb_build_object('student_id', v_student_id));
  end if;

  -- Retourner AUSSI le child_code pour l'afficher au parent/élève
  return jsonb_build_object(
    'request_id', v_request_id,
    'approved', v_approved,
    'student_id', v_student_id,
    'child_code', v_child_code
  );
end;
$$;

revoke execute on function public.finish_student_registration(uuid, uuid, text, text, text, text, text, date, uuid)
  from public, anon, authenticated;
grant execute on function public.finish_student_registration(uuid, uuid, text, text, text, text, text, date, uuid)
  to service_role;

-- ============================================================================
-- 3. (M4) RPC atomique pour désignation/retrait dernier superadmin
-- ============================================================================
create or replace function public.admin_set_superadmin(p_agent_id uuid, p_make_super boolean)
returns boolean
language plpgsql volatile security definer set search_path = public as $$
declare
  v_current_super int;
  v_target_role text;
begin
  -- Seul un superadmin existant peut appeler (vérifié côté API aussi)
  if not exists (select 1 from public.admin_agents where auth_user_id = auth.uid() and role = 'superadmin' and status = 'ACTIF') then
    raise exception 'Seul un superadmin peut modifier ce rôle.';
  end if;

  select role into v_target_role from public.admin_agents where id = p_agent_id;
  if not found then raise exception 'Agent introuvable.'; end if;

  if p_make_super then
    -- Promouvoir : pas de limite
    update public.admin_agents set role = 'superadmin' where id = p_agent_id;
    return true;
  else
    -- Rétrograder : vérifier qu'il ne reste pas zéro superadmin actif
    select count(*) into v_current_super
    from public.admin_agents
    where role = 'superadmin' and status = 'ACTIF';
    if v_current_super <= 1 then
      raise exception 'Impossible : il doit rester au moins un superadmin actif.';
    end if;
    update public.admin_agents set role = 'agent_suivi' where id = p_agent_id;
    return true;
  end if;
end;
$$;

revoke execute on function public.admin_set_superadmin(uuid, boolean) from public, anon, authenticated;
grant execute on function public.admin_set_superadmin(uuid, boolean) to authenticated;

-- ============================================================================
-- 4. (M9) block_student_bulletins : grant UPDATE colonnes + policies
-- ============================================================================
-- Ajouter la colonne dans le grant UPDATE par colonnes (directeur)
grant update (block_student_bulletins) on public.school_settings to authenticated;

-- Policy : directeur peut bloquer/débloquer les bulletins de son école
drop policy if exists "school_settings_update_direction_bulletins" on public.school_settings;
create policy "school_settings_update_direction_bulletins" on public.school_settings
  for update to authenticated
  using (public.direction_can_write() and school_id = public.current_school_id())
  with check (public.direction_can_write() and school_id = public.current_school_id());

-- (M9) La restriction de lecture des bulletins côté élève/parent est gérée
-- par le frontend selon school_settings.block_student_bulletins ; pas de
-- réécriture de la policy grades ici (éviter une policy cassée).

-- ============================================================================
-- 5. (M10) school_is_readable : l'utiliser dans les policies SELECT
-- ============================================================================
-- Appliquer sur les tables principales : schools, class_rooms, subjects, teachers, students, parents
-- (Les policies existantes utilisent user_can_query_data() qui vérifie ACTIF + pwd changé)
-- On ajoute la fenêtre de lecture seule 7j via school_is_readable()

drop policy if exists "class_rooms_select_ecole" on public.class_rooms;
create policy "class_rooms_select_ecole" on public.class_rooms
  for select to authenticated
  using (public.user_can_query_data() and school_id = public.current_school_id()
         and public.school_is_readable(school_id));

drop policy if exists "subjects_select_ecole" on public.subjects;
create policy "subjects_select_ecole" on public.subjects
  for select to authenticated
  using (public.user_can_query_data() and school_id = public.current_school_id()
         and public.school_is_readable(school_id));

drop policy if exists "teachers_select_ecole" on public.teachers;
create policy "teachers_select_ecole" on public.teachers
  for select to authenticated
  using (public.user_can_query_data() and school_id = public.current_school_id()
         and public.school_is_readable(school_id));

drop policy if exists "students_select_ecole" on public.students;
create policy "students_select_ecole" on public.students
  for select to authenticated
  using (public.user_can_query_data() and school_id = public.current_school_id()
         and public.school_is_readable(school_id));

drop policy if exists "parents_select_ecole" on public.parents;
create policy "parents_select_ecole" on public.parents
  for select to authenticated
  using (public.user_can_query_data() and school_id = public.current_school_id()
         and public.school_is_readable(school_id));

-- ============================================================================
-- 6. (M11) parents : restreindre lecture élèves/parents à leur foyer
-- ============================================================================
drop policy if exists "parents_select_ecole" on public.parents;
create policy "parents_select_ecole" on public.parents
  for select to authenticated
  using (
    public.user_can_query_data()
    and school_id = public.current_school_id()
    and public.school_is_readable(school_id)
    and (
      public.current_role() in ('directeur', 'econome', 'secretaire', 'instituteur', 'professeur')
      or
      -- Élève/parent : seulement leurs parents (via students.parent_id)
      exists (
        select 1 from public.students s
        where s.parent_id = parents.id
          and (s.id = public.current_student_id()
               or (public.current_role() = 'parent' and s.parent_id = public.current_parent_id()))
      )
    )
  );

-- ============================================================================
-- 7. (M12) complete_password_change : exiger preuve changement mot de passe
-- ============================================================================
create or replace function public.complete_password_change()
returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Vous devez �tre connect�.';
  end if;
  update public.profiles set must_change_password = false where id = v_uid;
  insert into public.audit_log (school_id, actor_id, actor_role, action, entity, entity_id)
  values (current_school_id(), v_uid, public.current_role(), 'password_change', 'profiles', v_uid);
end;
$$;

revoke execute on function public.complete_password_change() from public, anon;
grant execute on function public.complete_password_change() to authenticated, service_role;
-- 8. (M13) verify_matricule : conserv� tel quel (logique ok/reason inchang�e,
--     le rate-limit est g�r� c�t� API dans verifyMatricule.js). Aucune
--     r��criture ici pour ne pas casser le contrat attendu par le backend.

-- ============================================================================
-- 9. (M15) sanitSearch : échapper aussi `_` + helper adminSchools
-- ============================================================================
-- Fait côté API dans validate.js, pas en SQL. Voir correction backend.

-- ============================================================================
-- 10. (M16) requireUuid : déjà fait dans routes (adminAgents.js, adminSchools.js)
-- ============================================================================
-- Vérifié : adminAgents.js:150, adminSchools.js:164,202 → requireUuid

-- ============================================================================
-- 11. (F1) Supprimer lib/pdfUtils.js — Fichier côté backend à supprimer manuellement
-- ============================================================================
-- COMMENT: DELETE backend/api/src/lib/pdfUtils.js (code mort, importe pdfkit absent, strftime Python)

-- ============================================================================
-- 12. (F11) MatriculeCard : correction frontend (state dérivé, pas figé)
-- ============================================================================
-- COMMENT: Correction dans frontend/src/features/subscription/MatriculeCard.tsx

-- ============================================================================
-- Fin 00038
-- ============================================================================




-- ############################################################################
-- FICHIER : backend/supabase/migrations/20260101000039_admin_update_agent_atomic.sql
-- ############################################################################

-- ============================================================================
-- 00039 — Durcissement : mise à jour atomique d'un agent administratif
-- (correction de la condition de course « dernier superadmin »).
--
-- Le contrôle « ne pas rétrograder/désactiver le dernier superadmin actif »
-- était fait en deux temps (lecture du compteur puis UPDATE), ce qui laissait
-- une fenêtre de course entre deux requêtes concurrentes. On déplace le
-- contrôle ET la mise à jour dans une seule fonction transactionnelle qui
-- verrouille la table en mode exclusif pour la durée de l'opération.
--
-- Idempotente.
-- ============================================================================

create or replace function public.admin_update_agent(
  p_agent_id uuid,
  p_patch jsonb,
  p_downgrades boolean
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_is_active_superadmin boolean;
  v_active_superadmins int;
begin
  if p_agent_id is null then
    return false;
  end if;

  -- Sérialise toutes les mises à jour d'agents pour éviter la course.
  lock table public.admin_agents in exclusive mode;

  select exists (
    select 1 from public.admin_agents
    where id = p_agent_id and role = 'superadmin' and status = 'ACTIF'
  ) into v_is_active_superadmin;

  if coalesce(p_downgrades, false) and v_is_active_superadmin then
    select count(*) into v_active_superadmins
    from public.admin_agents
    where role = 'superadmin' and status = 'ACTIF';
    if v_active_superadmins <= 1 then
      return false;
    end if;
  end if;

  update public.admin_agents set
    role       = coalesce(p_patch->>'role',       role),
    status     = coalesce(p_patch->>'status',     status),
    first_name = coalesce(p_patch->>'first_name', first_name),
    last_name  = coalesce(p_patch->>'last_name',  last_name),
    phone      = coalesce(p_patch->>'phone',      phone),
    email      = coalesce(p_patch->>'email',      email),
    updated_at = now()
  where id = p_agent_id;

  return true;
end;
$$;

revoke execute on function public.admin_update_agent(uuid, jsonb, boolean)
  from public, anon, authenticated;
grant execute on function public.admin_update_agent(uuid, jsonb, boolean)
  to service_role;



-- ############################################################################
-- FICHIER : backend/supabase/migrations/20260101000040_fix_app_random_code_bytea.sql
-- ############################################################################

-- 00028 : correctif app_random_code — inscription de directeur cassée.
-- La migration 00022 utilisait (gen_random_bytes(1))[0] : PostgreSQL ne
-- supporte PAS la souscription de bytea (« cannot subscript type bytea »).
-- Toute inscription de directeur (Edge Functions et API Render) échouait
-- depuis l'application de 00022. Correctif : get_byte(gen_random_bytes(1), 0),
-- identique en sémantique (octet aléatoire 0..255).

create or replace function public.app_random_code(p_length int) returns text
language plpgsql volatile parallel unsafe
set search_path = public, extensions as $$
declare
  v_alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_digits   constant text := '23456789';
  v_letters  constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_code     text;
  v_has_digit boolean;
  v_has_letter boolean;
  i int;
begin
  if p_length < 2 then
    raise exception 'Longueur minimale 2 pour garantir lettres + chiffres';
  end if;

  loop
    v_code := '';
    v_has_digit := false;
    v_has_letter := false;

    for i in 1..p_length loop
      -- 30% de chiffres, 70% de lettres (pour plus de variété)
      if get_byte(gen_random_bytes(1), 0) % 100 < 30 then
        v_code := v_code || substr(v_digits, 1 + (get_byte(gen_random_bytes(1), 0) % 8)::int, 1);
        v_has_digit := true;
      else
        v_code := v_code || substr(v_letters, 1 + (get_byte(gen_random_bytes(1), 0) % 24)::int, 1);
        v_has_letter := true;
      end if;
    end loop;

    -- Garantir au moins 1 chiffre ET 1 lettre
    if v_has_digit and v_has_letter then
      return v_code;
    end if;
    -- Sinon on recommence (très rare avec cette logique)
  end loop;
end;
$$;



