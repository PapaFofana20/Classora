-- 00027 : statut reel des etablissements dans admin_school_stats.
-- Le statut ignorait la suspension administrative (registration_open) et
-- distinguait EXPIRE/AUCUN. Nouvel etat binaire :
--   ACTIF   = inscriptions ouvertes ET abonnement en cours de validite
--   INACTIF = suspendue, abonnement expire ou absent
-- Nom de colonne conserve (contrat API inchange). A executer dans le SQL Editor.

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
    case
      when not s.registration_open then 'INACTIF'
      when sub.ends_at is null then 'INACTIF'
      when sub.ends_at < current_date then 'INACTIF'
      else 'ACTIF'
    end as subscription_status
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

comment on function public.admin_school_stats() is 'Statistiques par etablissement ; statut reel ACTIF/INACTIF (inscriptions ouvertes et abonnement valide).';
