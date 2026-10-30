-- Migration: 20260515000001_timetable_module
-- Module emploi du temps

-- Table des emplois du temps
create table if not exists public.timetables (
  id uuid default gen_random_uuid() primary key,
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  class_id uuid not null references public.class_rooms(id) on delete cascade,
  school_year text not null default '2026-2027',
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_by uuid not null references public.profiles(id),
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  published_at timestamp with time zone
);

-- Comment on table public.timetables is 'Un emploi du temps pour une classe donnée';

-- Index pour de meilleures performances
create index if not exists timetables_school_id_idx on public.timetables(school_id);
create index if not exists timetables_class_id_idx on public.timetables(class_id);
create index if not exists timetables_status_idx on public.timetables(status);

-- Table des cours dans les emplois du temps
create table if not exists public.timetable_courses (
  id uuid default gen_random_uuid() primary key,
  timetable_id uuid not null references public.timetables(id) on delete cascade,
  subject_id uuid not null references public.subjects(id),
  teacher_id uuid not null references public.teachers(id),
  day text not null check (day in ('lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi')),
  start_time time not null,
  end_time time not null,
  room text,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Comment on table public.timetable_courses is 'Un cours dans un emploi du temps';

-- Index pour de meilleures performances
create index if not exists timetable_courses_timetable_id_idx on public.timetable_courses(timetable_id);
create index if not exists timetable_courses_subject_id_idx on public.timetable_courses(subject_id);
create index if not exists timetable_courses_teacher_id_idx on public.timetable_courses(teacher_id);
create index if not exists timetable_courses_day_idx on public.timetable_courses(day);
create index if not exists timetable_courses_start_end_idx on public.timetable_courses(start_time, end_time);

-- Sécurité RLS (Row Level Security)
alter table public.timetables enable row level security;
alter table public.timetable_courses enable row level security;

-- Policies pour timetables
create policy "Directeur peut gérer ses emplois du temps"
  on public.timetables
  for all
  using (exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'directeur'
  ))
  with check (exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'directeur'
  ));

-- Policies pour timetable_courses
create policy "Directeur peut gérer ses cours d'emploi du temps"
  on public.timetable_courses
  for all
  using (exists (
    select 1 from public.timetables t
    join public.profiles p on t.school_id = p.school_id
    where t.id = timetable_id and p.id = auth.uid() and p.role = 'directeur'
  ))
  with check (exists (
    select 1 from public.timetables t
    join public.profiles p on t.school_id = p.school_id
    where t.id = timetable_id and p.id = auth.uid() and p.role = 'directeur'
  ));

-- Policy pour que les élèves puissent voir les emplois du temps publiés
create policy "Élèves peuvent voir les emplois du temps publiés de leur classe"
  on public.timetables
  for select
  using (status = 'published');

create policy "Élèves peuvent voir les cours de leurs emplois du temps publiés"
  on public.timetable_courses
  for select
  using (exists (
    select 1 from public.timetables t
    where t.id = timetable_id and t.status = 'published'
  ));