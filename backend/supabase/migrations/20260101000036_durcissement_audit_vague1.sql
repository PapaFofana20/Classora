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
