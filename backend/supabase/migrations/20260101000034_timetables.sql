-- ============================================================================
-- Timetable Management System
-- ============================================================================

-- Create domain for timetable status
create domain app_timetable_status as text check (value in ('draft','published','archived'));

-- Create timetables table
create table public.timetables (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  title text not null,
  description text,
  class_id uuid references public.class_rooms(id) on delete set null,
  grade_level text, -- e.g., '6ème', '5ème', '4ème', '3ème', etc.
  period_type app_period_type not null default 'semestre',
  status app_timetable_status not null default 'draft',
  created_by uuid not null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  published_at timestamptz
);

-- Indexes for timetables
create index idx_timetables_school on public.timetables (school_id);
create index idx_timetables_class on public.timetables (class_id);
create index idx_timetables_created_by on public.timetables (created_by);
create index idx_timetables_status on public.timetables (status);

-- Create timetable_slots table (individual time slots within a timetable)
create table public.timetable_slots (
  id uuid primary key default gen_random_uuid(),
  timetable_id uuid not null references public.timetables(id) on delete cascade,
  day_of_week int not null check (day_of_week >= 0 and day_of_week <= 6), -- 0=Monday, 6=Sunday
  start_time time not null,
  end_time time not null,
  subject text not null,
  teacher_id uuid references public.teachers(id) on delete set null,
  class_room_id uuid references public.class_rooms(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

-- Indexes for timetable_slots
create index idx_timetable_slots_timetable on public.timetable_slots (timetable_id);
create index idx_timetable_slots_day on public.timetable_slots (day_of_week);
create index idx_timetable_slots_time on public.timetable_slots (start_time, end_time);

-- Create timetable_views table (tracks who has viewed a timetable)
create table public.timetable_views (
  id uuid primary key default gen_random_uuid(),
  timetable_id uuid not null references public.timetables(id) on delete cascade,
  viewer_type text not null check (viewer_type in ('student','teacher','parent')),
  viewer_id uuid not null, -- references the respective table
  viewed_at timestamptz not null default now()
);

-- Indexes for timetable_views
create index idx_timetable_views_timetable on public.timetable_views (timetable_id);
create index idx_timetable_views_viewer on public.timetable_views (viewer_type, viewer_id);

-- Enable RLS
alter table public.timetables enable row level security;
alter table public.timetable_slots enable row level security;
alter table public.timetable_views enable row level security;

-- RLS Policies for timetables
-- Directors can do everything
create policy "Directors can manage their school's timetables"
  on public.timetables
  using (exists (select 1 from public.profiles where id = created_by and school_id = timetables.school_id and role = 'directeur'));

-- Teachers can view timetables for their classes
create policy "Teachers can view timetables"
  on public.timetables
  using (exists (select 1 from public.teaching_assignments where teacher_id = auth.uid() and class_id = timetables.class_id));

-- Students can view timetables for their class
create policy "Students can view their class timetable"
  on public.timetables
  using (exists (select 1 from public.students where id = auth.uid() and class_id = timetables.class_id));

-- Parents can view timetables for their child's class
create policy "Parents can view their child's class timetable"
  on public.timetables
  using (exists (select 1 from public.parents where id = auth.uid() and parents.child_class_id = timetables.class_id));

-- RLS Policies for timetable_slots
create policy "Anyone can view timetable slots"
  on public.timetable_slots
  for select using (true);

-- RLS Policies for timetable_views
create policy "View timetable view tracking"
  on public.timetable_views
  for insert with check (true);

-- Helper function to get timetable by class
create or replace function public.get_timetable_by_class(class_id uuid)
returns table (
  id uuid,
  title text,
  description text,
  class_id uuid,
  grade_level text,
  period_type app_period_type,
  status app_timetable_status,
  created_by uuid,
  created_at timestamptz,
  published_at timestamptz
)
language sql stable
as $$
  select t.id, t.title, t.description, t.class_id, t.grade_level, t.period_type, t.status, t.created_by, t.created_at, t.published_at
  from public.timetables t
  where t.class_id = get_timetable_by_class.class_id;
$$;

-- Helper function to check if user can modify timetable
create or replace function public.can_modify_timetable(timetable_id uuid)
returns boolean
language sql stable
as $$
  select exists (
    select 1 from public.timetables t
    where t.id = timetable_id
    and exists (
      select 1 from public.profiles p
      where p.id = current_setting('app.current_user_id', true)
      and p.role = 'directeur'
      and p.school_id = t.school_id
    )
  );
$$;