-- ============================================================================
-- 00029 — Rôle « secrétaire » (personnel administratif, consultation seule)
--
-- La direction peut désormais créer un accès pour un membre du secrétariat.
-- Le secrétaire consulte les données administratives de SON école (élèves,
-- personnel, classes, notes/bulletins en lecture) mais ne peut ni saisir de
-- notes, ni gérer le personnel, ni encaisser des paiements.
--
-- Aucune politique d'écriture n'est ajoutée : les politiques existantes
-- (direction / enseignants affectés / surveillant) restent inchangées.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Domaine app_role : ajout de « secretaire ».
-- ----------------------------------------------------------------------------
do $$
declare
  v_constraint record;
begin
  -- Le domaine est créé sans nom explicite (app_role_check) : on retire tous
  -- ses CHECK avant d'en reposer un seul, à jour.
  for v_constraint in
    select conname
    from pg_constraint
    where contypid = 'public.app_role'::regtype
      and contype = 'c'
  loop
    execute format('alter domain public.app_role drop constraint %I', v_constraint.conname);
  end loop;
end;
$$;

alter domain public.app_role add constraint app_role_check
  check (value in ('directeur','econome','secretaire','surveillant','instituteur','professeur','eleve','parent'));

-- ----------------------------------------------------------------------------
-- 2. Création d'un accès du personnel : le rôle secrétaire est accepté.
--    (Fonction identique à 00004, seul le contrôle de rôle évolue.)
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
  if p_role not in ('professeur', 'instituteur', 'econome', 'secretaire', 'surveillant') then
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
-- 3. Lecture : le secrétariat voit l'annuaire du personnel et les dossiers
--    administratifs des élèves (aucune donnée financière, aucune écriture).
-- ----------------------------------------------------------------------------
drop policy if exists "profiles_select_self_ou_direction" on public.profiles;
create policy "profiles_select_self_ou_direction" on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or (user_can_query_data()
        and school_id = current_school_id()
        and public.current_role() in ('directeur', 'econome', 'secretaire', 'surveillant'))
  );

drop policy if exists "students_select_ecole" on public.students;
create policy "students_select_ecole" on public.students
  for select to authenticated
  using (
    user_can_query_data()
    and school_id = current_school_id()
    and (
      public.current_role() in ('directeur', 'econome', 'secretaire', 'surveillant')
      or (public.current_role() = 'eleve' and id = current_student_id())
      or (public.current_role() = 'parent' and parent_id = current_parent_id())
      or (
        public.current_role() in ('instituteur', 'professeur')
        and (
          class_id in (
            select ta.class_id from public.teaching_assignments ta
            where ta.teacher_id = current_teacher_id()
              and ta.school_id = current_school_id()
          )
          or class_id in (
            select c.id from public.class_rooms c
            where c.head_teacher_id = current_teacher_id()
              and c.school_id = current_school_id()
          )
        )
      )
    )
  );

-- Notes et bulletins : lecture seule pour le secrétariat (consultation,
-- impression, renseignements aux familles). Les politiques d'INSERT/UPDATE
-- restent réservées aux enseignants affectés et à la direction.
drop policy if exists "grades_select_scoped" on public.grades;
create policy "grades_select_scoped" on public.grades
  for select to authenticated
  using (
    user_can_query_data()
    and grades.school_id = current_school_id()
    and (
      (
        current_teacher_id() is null
        and (
          public.current_role() in ('directeur','econome','secretaire','surveillant')
          or (current_parent_id() is not null and exists (
            select 1 from public.students s
            where s.school_id = grades.school_id
              and s.id = grades.student_id
              and s.parent_id = current_parent_id()))
          or (current_student_id() is not null and grades.student_id = current_student_id())
        )
      )
      or (current_teacher_id() is not null and (
        exists (select 1 from public.class_rooms c
                where c.id = grades.class_id
                  and c.school_id = grades.school_id
                  and c.head_teacher_id = current_teacher_id())
        or exists (select 1 from public.teaching_assignments a
                   where a.teacher_id = current_teacher_id()
                     and a.school_id = grades.school_id
                     and a.class_id = grades.class_id
                     and a.subject_id = grades.subject_id))
      )
    )
  );

drop policy if exists "report_metas_select_scoped" on public.report_metas;
create policy "report_metas_select_scoped" on public.report_metas
  for select to authenticated
  using (
    user_can_query_data()
    and report_metas.school_id = current_school_id()
    and (
      (
        current_teacher_id() is null
        and (
          public.current_role() in ('directeur','econome','secretaire','surveillant')
          or (current_parent_id() is not null and exists (
            select 1 from public.students mps
            where mps.school_id = report_metas.school_id
              and mps.id = report_metas.student_id
              and mps.parent_id = current_parent_id()))
          or (current_student_id() is not null and report_metas.student_id = current_student_id())
        )
      )
      or (current_teacher_id() is not null and exists (
        select 1 from public.students s join public.class_rooms c on c.id = s.class_id
        where s.id = report_metas.student_id
          and s.school_id = report_metas.school_id
          and c.head_teacher_id = current_teacher_id()))
    )
  );
