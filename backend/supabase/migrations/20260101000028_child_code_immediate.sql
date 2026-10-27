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
      -- REFUS : supprimer l'élève créé à l'inscription (si élève)
      if v_req.role = 'eleve' then
        delete from public.students
        where school_id = v_school
          and first_name = v_req.first_name
          and last_name = v_req.last_name
          and (birth_date = v_req.birth_date or (birth_date is null and v_req.birth_date is null));
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