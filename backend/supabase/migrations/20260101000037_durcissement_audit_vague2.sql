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
