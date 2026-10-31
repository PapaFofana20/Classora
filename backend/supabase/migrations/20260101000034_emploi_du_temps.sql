-- ---------------------------------------------------------------------------

create or replace function public.get_class_schedule(
create or replace function public.get_subject_schedule(
create or replace function public.check_schedule_conflict(
create or replace function public.save_schedule_entry(
create or replace function public.delete_schedule_entry(
alter table public.schedules enable row level security;
create policy pol_schedules_write_director
-- Trigger pour mettre à jour the updated_at automatiquement
create trigger trg_schedules_updated_at
  before update on public.schedules
  for each row
  execute function public.update_updated_at_column();
on public.schedules for all
to authenticated
using (
  -- Seule la direction peut modifier
  exists (
    select 1 from public.users
    where users.id = auth.uid()::text
      and users.school_id = schedules.school_id
      and users.role = 'directeur'
  )
  or
  -- Le proviseur si autorisé (via admin_agents)
  exists (
    select 1 from public.admin_agents
    where admin_agents.auth_user_id = auth.uid()::text
      and admin_agents.school_id = schedules.school_id
      and admin_agents.role in ('proviseur', 'directeur')
  )
  or
  -- Le secrétaire si autorisé
  exists (
    select 1 from public.admin_agents
    where admin_agents.auth_user_id = auth.uid()::text
      and admin_agents.school_id = schedules.school_id
      and admin_agents.role = 'secretaire'
  )
)
with check (
  -- Même politique que pour la lecture lors de l'écriture
  exists (
    select 1 from public.users
    where users.id = auth.uid()::text
      and users.school_id = schedules.school_id
      and users.role = 'directeur'
  )
  or
  exists (
    select 1 from public.admin_agents
    where admin_agents.auth_user_id = auth.uid()::text
      and admin_agents.school_id = schedules.school_id
      and admin_agents.role in ('proviseur', 'directeur')
  )
  or
  exists (
    select 1 from public.admin_agents
    where admin_agents.auth_user_id = auth.uid()::text
      and admin_agents.school_id = schedules.school_id
      and admin_agents.role = 'secretaire'
  )
);

create policy pol_schedules_read_authenticated
on public.schedules for select
to authenticated
using (true);

create policy pol_schedules_read_public
on public.schedules for select
to public
using (true);
  p_school_id uuid,
  p_id uuid
) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_result jsonb;
begin
  delete from public.schedules where id = p_id and school_id = p_school_id;

  v_result := jsonb_build_object(
    'action', 'deleted',
    'id', p_id
  );

  return v_result;
end;
$$;
  p_school_id uuid,
  p_id uuid default null,
  p_class_id uuid,
  p_subject_id uuid,
  p_teacher_id uuid,
  p_day smallint,
  p_start_time time,
  p_end_time time,
  p_room text default null
) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_result jsonb;
begin
  if p_id is null then
    -- Création nouveau créneau
    insert into public.schedules (school_id, class_id, subject_id, teacher_id, day_of_week, start_time, end_time, room, created_at, updated_at)
    values (p_school_id, p_class_id, p_subject_id, p_teacher_id, p_day, p_start_time, p_end_time, p_room, timezone('utc'::text, now()), timezone('utc'::text, now()));

    v_result := jsonb_build_object(
      'action', 'created',
      'id', (select id from public.schedules where school_id = p_school_id and class_id = p_class_id and subject_id = p_subject_id and teacher_id = p_teacher_id and day_of_week = p_day and start_time = p_start_time and end_time = p_end_time order by created_at desc limit 1)
    );
  else
    -- Mise à jour créneau existant
    update public.schedules
    set class_id = p_class_id,
        subject_id = p_subject_id,
        teacher_id = p_teacher_id,
        day_of_week = p_day,
        start_time = p_start_time,
        end_time = p_end_time,
        room = p_room,
        updated_at = timezone('utc'::text, now()
    where id = p_id and school_id = p_school_id;

    v_result := jsonb_build_object(
      'action', 'updated',
      'id', p_id
    );
  end if;

  return v_result;
end;
$$;
  p_school_id uuid,
  p_class_id uuid,
  p_teacher_id uuid,
  p_day smallint,
  p_start_time time,
  p_end_time time,
  p_exclude_id uuid default null
) returns jsonb
language sql stable parallel safe as $$
declare
  v_where text := 'school_id = ' || quote_literal(p_school_id);
  v_conflict jsonb := '[]'::jsonb;
begin
  if p_exclude_id is not null then
    v_where := v_where || ' and id <> ' || quote_literal(p_exclude_id);
  end if;

  v_where := v_where || '
    and class_id = ' || quote_literal(p_class_id) ||
    ' and day_of_week = ' || to_char(p_day) ||
    ' and (
        (start_time >= ' || quote_literal(p_start_time) || ' and start_time < ' || quote_literal(p_end_time) || ')
        or (end_time > ' || quote_literal(p_start_time) || ' and end_time <= ' || quote_literal(p_end_time) || ')
        or (start_time <= ' || quote_literal(p_start_time) || ' and end_time >= ' || quote_literal(p_end_time) || ')
      )';

  return (
    select jsonb_agg(row_to_json(c)) filter (where c is not null) as conflicts
    from (
      select
        s.id,
        s.class_id,
        s.subject_id,
        su.name as subject_name,
        s.teacher_id,
        t.first_name || ' ' || t.last_name as teacher_name,
        s.day_of_week,
        to_char(s.start_time, 'HH24:MI') as start_time,
        to_char(s.end_time, 'HH24:MI') as end_time,
        s.room
      from public.schedules s
      left join public.subjects su on s.subject_id = su.id and s.school_id = su.school_id
      left join public.teachers t on s.teacher_id = t.id and s.school_id = t.school_id
      where v_where
    ) c
  );
end;
$$;
  p_school_id uuid,
  p_subject_id uuid,
  p_class_id uuid default null
) returns jsonb
language sql stable parallel safe as $$
declare
  v_where text := 'school_id = ' || quote_literal(p_school_id) || ' and subject_id = ' || quote_literal(p_subject_id);
begin
  if p_class_id is not null then
    v_where := v_where || ' and class_id = ' || quote_literal(p_class_id);
  end if;

  return (
    select jsonb_agg(row_to_json(s)) filter (where s is not null) as schedules
    from (
      select
        s.id,
        s.class_id,
        c.name as class_name,
        s.teacher_id,
        t.first_name || ' ' || t.last_name as teacher_name,
        s.day_of_week,
        to_char(s.start_time, 'HH24:MI') as start_time,
        to_char(s.end_time, 'HH24:MI') as end_time,
        s.room,
        s.created_at
      from public.schedules s
      left join public.class_rooms c on s.class_id = c.id and s.school_id = c.school_id
      left join public.teachers t on s.teacher_id = t.id and s.school_id = t.school_id
      where v_where
      order by s.day_of_week, s.start_time
    ) s
  );
end;
$$;
  p_school_id uuid,
  p_class_id uuid default null,
  p_day smallint default null
) returns jsonb
language sql stable parallel safe as $$
declare
  v_where text := 'school_id = ' || quote_literal(p_school_id);
  v_day_cond text := '';
begin
  if p_class_id is not null then
    v_where := v_where || ' and class_id = ' || quote_literal(p_class_id);
  end if;

  if p_day is not null then
    v_day_cond := ' and day_of_week = ' || to_char(p_day);
  end if;

  return (
    select jsonb_agg(row_to_json(s)) filter (where s is not null) as schedules
    from (
      select
        s.id,
        s.class_id,
        c.name as class_name,
        s.subject_id,
        su.name as subject_name,
        s.teacher_id,
        t.first_name || ' ' || t.last_name as teacher_name,
        s.day_of_week,
        to_char(s.start_time, 'HH24:MI') as start_time,
        to_char(s.end_time, 'HH24:MI') as end_time,
        s.room,
        s.created_at,
        s.updated_at
      from public.schedules s
      left join public.class_rooms c on s.class_id = c.id and s.school_id = c.school_id
      left join public.subjects su on s.subject_id = su.id and s.school_id = su.school_id
      left join public.teachers t on s.teacher_id = t.id and s.school_id = t.school_id
      where v_where
        and (p_day is null or s.day_of_week = p_day)
      order by s.day_of_week, s.start_time
    ) s
  );
end;
$$;
-- Emploi du temps hebdomadaire
-- ---------------------------------------------------------------------------

create table if not exists public.schedules (
  id uuid not null generated by default as identity primary key,
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid references public.class_rooms(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  teacher_id uuid references public.teachers(id) on delete set null,
  day_of_week smallint not null check (day_of_week >= 0 and day_of_week <= 5),
  start_time time not null,
  end_time time not null,
  room text,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

