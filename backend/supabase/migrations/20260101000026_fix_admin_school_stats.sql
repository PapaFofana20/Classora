-- ============================================================================
-- 00026 — Correctif admin_school_stats : référence « school_id » ambiguë
--
-- Dans une fonction « returns table (school_id …) », PL/pgSQL substitue tout
-- identifiant NON QUALIFIÉ par la variable de sortie correspondante : les
-- sous-requêtes « select school_id … group by school_id » devenaient
-- ambiguës (colonne de sortie vs colonne de table) et la RPC échouait avec
-- « column reference "school_id" is ambiguous » → HTTP 500 sur
-- GET /admin/stats (tableau de bord administratif vide).
--
-- Correctif : chaque référence est qualifiée par l'alias de table. Le contrat
-- de sortie (colonnes, types) est inchangé — aucune modification côté API.
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
    select x.school_id, count(*) as cnt from public.students x group by x.school_id
  ) st on st.school_id = s.id
  left join (
    select x.school_id, count(*) as cnt from public.class_rooms x group by x.school_id
  ) cr on cr.school_id = s.id
  left join (
    select x.school_id, count(*) as cnt from public.teachers x group by x.school_id
  ) t on t.school_id = s.id
  left join public.subscriptions sub on sub.school_id = s.id
  order by s.name;
end;
$$;

revoke execute on function public.admin_school_stats() from public, anon, authenticated;
grant execute on function public.admin_school_stats() to service_role;

comment on function public.admin_school_stats() is 'Statistiques transversales par établissement pour les agents administratifs.';
