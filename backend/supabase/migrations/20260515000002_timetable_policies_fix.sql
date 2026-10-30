-- Fix policies for timetables to be more permissive
drop policy if exists "Directeur peut gérer ses emplois du temps" on public.timetables;
drop policy if exists "Directeur peut gérer ses cours d'emploi du temps" on public.timetable_courses;
drop policy if exists "Élèves peuvent voir les emplois du temps publiés de leur classe" on public.timetables;
drop policy if exists "Élèves peuvent voir les cours de leurs emplois du temps publiés" on public.timetable_courses;

-- More permissive policies
create policy "Authenticated users can manage timetables"
  on public.timetables
  for all
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated users can manage timetable courses"
  on public.timetable_courses
  for all
  to authenticated
  using (true)
  with check (true);

create policy "Anyone can view published timetables"
  on public.timetables
  for select
  using (status = 'published' or auth.role() = 'authenticated');

create policy "Anyone can view courses of published timetables"
  on public.timetable_courses
  for select
  using (exists (
    select 1 from public.timetables t
    where t.id = timetable_id and (t.status = 'published' or auth.role() = 'authenticated')
  ));
