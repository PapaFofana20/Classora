-- ============================================================================
-- SCOLIA — Phase 2 : inscriptions transactionnelles
-- Les Edge Functions créent le compte Auth (échec rapide si e-mail pris),
-- PUIS appellent ces fonctions security definer qui effectuent TOUTES les
-- écritures de contrôle (institutionnelles) dans un seul bloc SQL atomique.
-- En cas d'échec de la fonction, l'Edge Function supprime le compte Auth créé.
-- Executable uniquement par le service_role (les rôles client n'ont pas EXECUTE).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Inscription DIRECTEUR : école + paramètres + frais par niveau + matières
-- par défaut + profil ACTIF (pas d'abonnement, pas de matricule, encore RIEN
-- d'ayant trait à la facturation).
-- ----------------------------------------------------------------------------
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

  insert into public.schools (name, city, address, phone, email, cycles, registration_open, auto_approve_students)
  values (trim(p_school_name), trim(p_city), '', trim(p_phone), trim(p_email), v_cycles_text::app_cycle[], true, false)
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

  insert into public.audit_log (school_id, actor_id, actor_role, action, entity, entity_id)
  values (v_school_id, p_user_id, 'directeur', 'register_director', 'schools', v_school_id);

  return v_school_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- Inscription ÉLÈVE : profil EN_ATTENTE + demande d'inscription.
-- Si auto_approve_students : création immédiate de l'élève (limite pour élèves
-- de la formule incluse, identique à l'approbation manuelle de la phase 3).
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

  insert into public.profiles (id, school_id, role, status, first_name, last_name, phone, email)
  values (p_user_id, p_school_id, 'eleve', 'EN_ATTENTE', trim(p_first_name), trim(p_last_name), trim(p_phone), trim(p_email));

  insert into public.registration_requests
    (school_id, user_id, role, first_name, last_name, email, phone, gender, birth_date, class_id)
  values
    (p_school_id, p_user_id, 'eleve', trim(p_first_name), trim(p_last_name), trim(p_email), trim(p_phone),
     p_gender::app_gender, p_birth_date, p_class_id)
  returning id into v_request_id;

  -- Approbation automatique (option de l'école) : mêmes règles que la
  -- validation manuelle, y compris la limite d'élèves de la formule.
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
    insert into public.students (
      school_id, matricule, child_code, first_name, last_name, gender, birth_date, class_id, parent_id, enrolled_at
    ) values (
      p_school_id,
      public.next_student_matricule(p_school_id, (select school_year from public.school_settings where school_id = p_school_id)),
      public.generate_school_code(p_school_id, 6, 'child_code'),
      trim(p_first_name), trim(p_last_name),
      coalesce(p_gender::app_gender, 'F'::app_gender),
      coalesce(p_birth_date, date '2015-01-01'),
      p_class_id, null, current_date
    ) returning id into v_student_id;

    update public.profiles set status = 'ACTIF', student_id = v_student_id where id = p_user_id;

    update public.registration_requests
    set status = 'APPROUVEE', decided_at = current_date
    where id = v_request_id;

    insert into public.audit_log (school_id, actor_id, action, entity, entity_id, payload)
    values (p_school_id, p_user_id, 'auto_approve_student', 'registration_requests', v_request_id, jsonb_build_object('student_id', v_student_id));
  end if;

  return jsonb_build_object(
    'request_id', v_request_id,
    'approved', v_approved,
    'student_id', v_student_id
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- Inscription PARENT : le child_code rattache le compte à un élève de CETTE école.
-- ----------------------------------------------------------------------------
create or replace function public.finish_parent_registration(
  p_user_id uuid,
  p_school_id uuid,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_email text,
  p_child_code text
)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_child record;
  v_request_id uuid;
  v_parent_id uuid;
  v_approved boolean := false;
  v_school record;
begin
  if p_user_id is null then raise exception 'Compte introuvable.'; end if;
  select coalesce(trim(p_child_code), '')::text into p_child_code;
  select * into v_school from public.schools where id = p_school_id;
  if not found then raise exception 'École introuvable.'; end if;
  if not v_school.registration_open then
    raise exception 'Les inscriptions sont fermées dans cette école.';
  end if;

  if exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'Un compte existe déjà avec cet e-mail.';
  end if;

  select * into v_child
  from public.students
  where school_id = p_school_id and upper(child_code) = upper(trim(p_child_code))
  limit 1;
  if not found then
    raise exception 'Code élève introuvable dans cette école. Vérifiez le code reçu auprès de l''école.';
  end if;

  insert into public.parents (school_id, first_name, last_name, phone, email, address)
  values (p_school_id, trim(p_first_name), trim(p_last_name), trim(p_phone), trim(p_email), '')
  returning id into v_parent_id;

  insert into public.profiles (id, school_id, role, status, first_name, last_name, phone, email, parent_id)
  values (p_user_id, p_school_id, 'parent', 'EN_ATTENTE', trim(p_first_name), trim(p_last_name), trim(p_phone), trim(p_email), v_parent_id);

  insert into public.registration_requests
    (school_id, user_id, role, first_name, last_name, email, phone, class_id, child_code)
  values
    (p_school_id, p_user_id, 'parent', trim(p_first_name), trim(p_last_name), trim(p_email), trim(p_phone),
     v_child.class_id, v_child.child_code)
  returning id into v_request_id;

  if v_school.auto_approve_students then
    v_approved := true;
    update public.profiles set status = 'ACTIF' where id = p_user_id;
    update public.registration_requests set status = 'APPROUVEE', decided_at = current_date where id = v_request_id;
    insert into public.audit_log (school_id, actor_id, action, entity, entity_id, payload)
    values (p_school_id, p_user_id, 'auto_approve_parent', 'registration_requests', v_request_id, jsonb_build_object('student_id', v_child.id));
  end if;

  return jsonb_build_object(
    'request_id', v_request_id,
    'approved', v_approved,
    'child_id', v_child.id,
    'child_name', v_child.first_name || ' ' || v_child.last_name
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- Personnel (professeur / instituteur / econome / surveillant) : créé uniquement
-- par la direction via l'Edge Function create-staff-account.
-- ----------------------------------------------------------------------------
create or replace function public.finish_staff_registration(
  p_user_id uuid,
  p_school_id uuid,
  p_role text,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_email text,
  p_specialties text[]
)
returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  v_teacher_id uuid;
begin
  if p_user_id is null then raise exception 'Compte introuvable.'; end if;
  select coalesce(trim(p_role), '')::text into p_role;
  if p_role not in ('professeur', 'instituteur', 'econome', 'surveillant') then
    raise exception 'Rôle invalide.';
  end if;
  if exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'Un compte existe déjà avec cet e-mail.';
  end if;

  if p_role in ('professeur', 'instituteur') then
    insert into public.teachers (school_id, kind, first_name, last_name, email, phone, specialties)
    values (
      p_school_id,
      (case when p_role = 'professeur' then 'professeur' else 'instituteur' end)::app_teacher_kind,
      trim(p_first_name), trim(p_last_name), trim(p_email), trim(p_phone),
      case when p_role = 'professeur' then coalesce(p_specialties, '{}')::text[] else '{}' end
    )
    returning id into v_teacher_id;
  end if;

  insert into public.profiles (id, school_id, role, status, first_name, last_name, phone, email,
                               must_change_password, teacher_id)
  values (p_user_id, p_school_id, p_role::app_role, 'ACTIF', trim(p_first_name), trim(p_last_name),
          trim(p_phone), trim(p_email), true, v_teacher_id);

  insert into public.audit_log (school_id, actor_id, actor_role, action, entity, entity_id)
  values (p_school_id, p_user_id, p_role, 'staff_account_created', 'profiles', p_user_id);
end;
$$;

-- ----------------------------------------------------------------------------
-- Exécution réservée au service_role (Edge Functions).
-- ----------------------------------------------------------------------------
revoke execute on function public.finish_director_registration(uuid, text, text, text, text, text, text, text[])
  from anon, authenticated, public;
revoke execute on function public.finish_student_registration(uuid, uuid, text, text, text, text, text, date, uuid)
  from anon, authenticated, public;
revoke execute on function public.finish_parent_registration(uuid, uuid, text, text, text, text, text)
  from anon, authenticated, public;
revoke execute on function public.finish_staff_registration(uuid, uuid, text, text, text, text, text, text[])
  from anon, authenticated, public;
grant execute on function public.finish_director_registration(uuid, text, text, text, text, text, text, text[])
  to service_role;
grant execute on function public.finish_student_registration(uuid, uuid, text, text, text, text, text, date, uuid)
  to service_role;
grant execute on function public.finish_parent_registration(uuid, uuid, text, text, text, text, text)
  to service_role;
grant execute on function public.finish_staff_registration(uuid, uuid, text, text, text, text, text, text[])
  to service_role;
