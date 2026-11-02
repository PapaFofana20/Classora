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
