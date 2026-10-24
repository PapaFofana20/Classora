-- ============================================================================
-- 00025 — Statistiques transversales par établissement (admin_school_stats)
--
-- Fonction de calcul côté serveur, exécutable par service_role uniquement.
-- Retourne pour chaque école : effectif, classes, enseignants, statut abonnement.
-- Évite de télécharger toutes les données dans le navigateur.
-- ============================================================================

create or replace function public.admin_school_stats()
returns table (
  school_id uuid,
  school_name text,
  matricule text,
  student_count bigint,
  class_count bigint,
  teacher_count bigint,
  subscription_status text
)
language plpgsql volatile security definer set search_path = public as $$
begin
  return query
  select
    s.id as school_id,
    s.name as school_name,
    s.matricule as matricule,
    coalesce(st.cnt, 0) as student_count,
    coalesce(cr.cnt, 0) as class_count,
    coalesce(t.cnt, 0) as teacher_count,
    coalesce(
      case
        when sub.ends_at is null then 'AUCUN'
        when sub.ends_at < current_date then 'EXPIRE'
        else 'ACTIF'
      end,
      'AUCUN'
    ) as subscription_status
  from public.schools s
  left join (
    select school_id, count(*) as cnt from public.students group by school_id
  ) st on st.school_id = s.id
  left join (
    select school_id, count(*) as cnt from public.class_rooms group by school_id
  ) cr on cr.school_id = s.id
  left join (
    select school_id, count(*) as cnt from public.teachers group by school_id
  ) t on t.school_id = s.id
  left join public.subscriptions sub on sub.school_id = s.id
  order by s.name;
end;
$$;

revoke execute on function public.admin_school_stats() from public, anon, authenticated;
grant execute on function public.admin_school_stats() to service_role;

comment on function public.admin_school_stats() is 'Statistiques transversales par établissement pour les agents administratifs.';