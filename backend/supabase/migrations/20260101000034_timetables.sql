-- ============================================================================
-- Module emploi du temps
-- ----------------------------------------------------------------------------
-- Ce fichier est aligné sur le schéma réellement déployé sur Supabase :
--   * public.timetables        (name, class_id, school_year, status, ...)
--   * public.timetable_courses (day, start_time, end_time, subject_id, ...)
--
-- Il est idempotent : il peut être rejoué sans casser une base existante.
-- ============================================================================

create table if not exists public.timetables (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  class_id uuid not null references public.class_rooms(id) on delete cascade,
  school_year text not null default '2026-2027',
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  published_at timestamptz
);

create index if not exists timetables_school_id_idx on public.timetables(school_id);
create index if not exists timetables_class_id_idx on public.timetables(class_id);
create index if not exists timetables_status_idx on public.timetables(status);

create table if not exists public.timetable_courses (
  id uuid primary key default gen_random_uuid(),
  timetable_id uuid not null references public.timetables(id) on delete cascade,
  subject_id uuid not null references public.subjects(id),
  teacher_id uuid not null references public.teachers(id),
  day text not null check (day in ('lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi')),
  start_time time not null,
  end_time time not null,
  room text,
  description text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists timetable_courses_timetable_id_idx on public.timetable_courses(timetable_id);
create index if not exists timetable_courses_subject_id_idx on public.timetable_courses(subject_id);
create index if not exists timetable_courses_teacher_id_idx on public.timetable_courses(teacher_id);
create index if not exists timetable_courses_day_idx on public.timetable_courses(day);
create index if not exists timetable_courses_start_end_idx on public.timetable_courses(start_time, end_time);

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.timetables enable row level security;
alter table public.timetable_courses enable row level security;

drop policy if exists "Directeur peut gérer ses emplois du temps" on public.timetables;
drop policy if exists "Authenticated users can manage timetables" on public.timetables;
drop policy if exists "Élèves peuvent voir les emplois du temps publiés de leur classe" on public.timetables;
drop policy if exists "Anyone can view published timetables" on public.timetables;
drop policy if exists "Lecture des emplois du temps de son école" on public.timetables;

create policy "Lecture des emplois du temps de son école"
  on public.timetables
  for select
  to authenticated
  using (
    school_id = public.current_school_id()
    and (status = 'published' or public.current_role() = 'directeur')
  );
create policy "Directeur peut gérer ses emplois du temps"
  on public.timetables
  for all
  to authenticated
  using (public.current_role() = 'directeur' and school_id = public.current_school_id())
  with check (public.current_role() = 'directeur' and school_id = public.current_school_id());

drop policy if exists "Directeur peut gérer ses cours d'emploi du temps" on public.timetable_courses;
drop policy if exists "Authenticated users can manage timetable courses" on public.timetable_courses;
drop policy if exists "Élèves peuvent voir les cours de leurs emplois du temps publiés" on public.timetable_courses;
drop policy if exists "Anyone can view courses of published timetables" on public.timetable_courses;
drop policy if exists "Lecture des cours d'un emploi du temps accessible" on public.timetable_courses;

create policy "Lecture des cours d'un emploi du temps accessible"
  on public.timetable_courses
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.timetables t
      where t.id = timetable_id
        and t.school_id = public.current_school_id()
        and (t.status = 'published' or public.current_role() = 'directeur')
    )
  );

create policy "Directeur peut gérer ses cours d'emploi du temps"
  on public.timetable_courses
  for all
  to authenticated
  using (
    public.current_role() = 'directeur'
    and exists (
      select 1
      from public.timetables t
      where t.id = timetable_id and t.school_id = public.current_school_id()
    )
  )
  with check (
    public.current_role() = 'directeur'
    and exists (
      select 1
      from public.timetables t
      where t.id = timetable_id and t.school_id = public.current_school_id()
    )
  );
