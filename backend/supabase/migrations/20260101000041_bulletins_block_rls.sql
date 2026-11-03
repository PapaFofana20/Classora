-- ============================================================================
-- 00041 — Blocage des bulletins côté serveur (RLS).
--
-- Auparavant, le masquage des bulletins (block_student_bulletins) n'était
-- appliqué qu'au frontend : un élève/parent pouvait lire ses notes directement
-- via Supabase même si les bulletins étaient bloqués. Cette migration ajoute
-- la condition côté RLS pour grades et report_metas.
--
-- Idempotente.
-- ============================================================================

-- grades : un élève/parent ne lit ses notes que si les bulletins ne sont pas bloqués.
-- Les enseignants et la direction lisent toujours.
drop policy if exists "grades_select_scoped" on public.grades;
create policy "grades_select_scoped" on public.grades
  for select to authenticated
  using (
    user_can_query_data()
    and school_id = current_school_id()
    and (
      -- direction / économie / surveillant : toujours
      (current_teacher_id() is null and public.current_role() in ('directeur','econome','surveillant'))
      -- enseignant affecté : toujours
      or (current_teacher_id() is not null and (
        exists (select 1 from public.class_rooms c
                where c.id = class_id and c.head_teacher_id = current_teacher_id())
        or exists (select 1 from public.teaching_assignments a
                   where a.teacher_id = current_teacher_id()
                     and a.class_id = class_id and a.subject_id = subject_id)))
      -- élève / parent : seulement si les bulletins ne sont pas bloqués
      or (
        coalesce((select ss.block_student_bulletins from public.school_settings ss
                  where ss.school_id = school_id), false) = false
        and (
          (current_parent_id() is not null and exists (
            select 1 from public.students s
            where s.school_id = school_id and s.id = student_id and s.parent_id = current_parent_id()))
          or (current_student_id() is not null and student_id = current_student_id())
        )
      )
    )
  );

-- report_metas : même règle.
drop policy if exists "report_metas_select_scoped" on public.report_metas;
create policy "report_metas_select_scoped" on public.report_metas
  for select to authenticated
  using (
    user_can_query_data()
    and school_id = current_school_id()
    and (
      (current_teacher_id() is null and public.current_role() in ('directeur','econome','surveillant'))
      or (current_teacher_id() is not null and exists (
        select 1 from public.students s join public.class_rooms c on c.id = s.class_id
        where s.id = student_id and c.head_teacher_id = current_teacher_id()))
      or (
        coalesce((select ss.block_student_bulletins from public.school_settings ss
                  where ss.school_id = school_id), false) = false
        and (
          (current_parent_id() is not null and exists (
            select 1 from public.students mps
            where mps.school_id = school_id and mps.id = student_id and mps.parent_id = current_parent_id()))
          or (current_student_id() is not null and student_id = current_student_id())
        )
      )
    )
  );