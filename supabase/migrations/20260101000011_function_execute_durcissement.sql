-- ============================================================================
-- SCOLIA — Phase 8 : durcissement des droits d'exécution des fonctions
--
-- PostgreSQL accorde EXECUTE sur toute fonction créée à PUBLIC. Les
-- fonctions SECURITY DEFINER contournent donc la RLS : si elles restent
-- exécutables par `anon` ou par un utilisateur d'une autre école, elles
-- permettent d'écrire ou de divulguer des données d'une école tierce.
--
-- Trois catégories sont traitées ici :
--
--  1. Fonctions à effet de bord (écriture) : aucune n'est exposede à un
--     client. Elles ne sont appelées que depuis des fonctions
--     SECURITY DEFINER (qui s'exécutent avec les droits du propriétaire).
--  2. Fonctions d'information inter-écoles (subscription_info) : usage
--     interne uniquement.
--  3. Helpers utilisés DANS les politiques RLS : ils doivent rester
--     exécutables par le rôle qui interroge (`authenticated`), car une
--     politique est évaluée avec les droits de l'appelant ; on retire donc
--     seulement PUBLIC et `anon`.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Fonctions à effet de bord : accès interne uniquement.
-- ----------------------------------------------------------------------------
revoke execute on function public.build_payment_plan(uuid) from public, anon, authenticated;
revoke execute on function public.next_student_matricule(uuid, text) from public, anon, authenticated;
revoke execute on function public.generate_school_code(uuid, int, text) from public, anon, authenticated;
revoke execute on function public.generate_school_matricule() from public, anon, authenticated;
revoke execute on function public.new_payment_reference(text) from public, anon, authenticated;
revoke execute on function public.app_random_code(int) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. Information inter-écoles : usage interne uniquement.
--    (verify_matricule, exposée publiquement, l'appelle en SECURITY DEFINER
--     et continue donc de fonctionner.)
-- ----------------------------------------------------------------------------
revoke execute on function public.subscription_info(uuid) from public, anon, authenticated;
grant execute on function public.subscription_info(uuid) to service_role;

-- ----------------------------------------------------------------------------
-- 3. Helpers de politique : exécutables par le rôle qui interroge, pas par anon.
-- ----------------------------------------------------------------------------
revoke execute on function public.current_school_id() from public, anon;
revoke execute on function public.current_role() from public, anon;
revoke execute on function public.current_teacher_id() from public, anon;
revoke execute on function public.current_parent_id() from public, anon;
revoke execute on function public.current_student_id() from public, anon;
revoke execute on function public.is_active_user() from public, anon;
revoke execute on function public.password_changed() from public, anon;
revoke execute on function public.user_can_query_data() from public, anon;
revoke execute on function public.school_is_writable(uuid) from public, anon;
revoke execute on function public.school_is_readable(uuid) from public, anon;
revoke execute on function public.can_see_conversation(uuid) from public, anon;
revoke execute on function public.message_actor_id() from public, anon;
revoke execute on function public.assignment_conflicts() from public, anon;
revoke execute on function public.direction_can_write() from public, anon;
revoke execute on function public.school_year_label() from public, anon;
revoke execute on function public.complete_password_change() from public, anon;

grant execute on function public.current_school_id() to authenticated, service_role;
grant execute on function public.current_role() to authenticated, service_role;
grant execute on function public.current_teacher_id() to authenticated, service_role;
grant execute on function public.current_parent_id() to authenticated, service_role;
grant execute on function public.current_student_id() to authenticated, service_role;
grant execute on function public.is_active_user() to authenticated, service_role;
grant execute on function public.password_changed() to authenticated, service_role;
grant execute on function public.user_can_query_data() to authenticated, service_role;
grant execute on function public.school_is_writable(uuid) to authenticated, service_role;
grant execute on function public.school_is_readable(uuid) to authenticated, service_role;
grant execute on function public.can_see_conversation(uuid) to authenticated, service_role;
grant execute on function public.message_actor_id() to authenticated, service_role;
grant execute on function public.assignment_conflicts() to authenticated, service_role;
grant execute on function public.direction_can_write() to authenticated, service_role;
grant execute on function public.school_year_label() to authenticated, service_role;
grant execute on function public.complete_password_change() to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 4. Contrôle : plus aucune fonction sensible accessible à `anon`.
--    Liste blanche : les deux surfaces publiques volontaires
--    (verify_matricule, open_classes), les fonctions de calcul pures
--    (aucun accès aux données) et les fonctions de trigger (inutilisables
--    hors d'un contexte de trigger).
-- ----------------------------------------------------------------------------
do $$
declare
  v_bad text;
begin
  select string_agg(n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', ', ')
    into v_bad
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname not in (
       'verify_matricule', 'open_classes',                     -- surfaces publiques
       'app_valid_cycles', 'subscription_status_of', 'payment_status_of',
       'round2', 'grade_devoirs_average', 'grade_subject_average',
       'weighted_average', 'appreciation_for',                -- calculs purs
       'guard_class_delete', 'guard_class_capacity', 'auto_assign_titular',
       'clean_assignments_on_subject_slot', 'set_payment_status') -- triggers
     and has_function_privilege('anon', p.oid, 'EXECUTE');
  if v_bad is not null then
    raise exception 'Fonctions encore accessibles à anon : %', v_bad;
  end if;
end;
$$;
