-- ============================================================================
-- 00017 — Garde de statut sur les RPC métier SECURITY DEFINER.
--
-- Les politiques RLS exigent un compte ACTIF et un mot de passe temporaire
-- déjà changé. Les fonctions SECURITY DEFINER contournent ces politiques :
-- sans garde explicite, un compte DESACTIVE ou en attente de changement de
-- mot de passe pouvait continuer à écrire avec un JWT encore valide.
--
-- Ce correctif ajoute `assert_active_account()` et l'applique à toutes les
-- RPC d'écriture exposées à `authenticated`. Les corps historiques sont
-- conservés sous le suffixe `_unchecked`, inaccessible aux clients ; les
-- fonctions publiques deviennent des enveloppes de garde. `link_child` et
-- `update_report_meta` sont remplacées intégralement (règles métier
-- corrigées au passage).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Garde commune : session, compte ACTIF, mot de passe temporaire changé.
-- ----------------------------------------------------------------------------
create or replace function public.assert_active_account()
returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Vous devez être connecté.';
  end if;
  if not public.is_active_user() then
    raise exception 'Compte inactif. Contactez la direction de votre école.';
  end if;
  if not public.password_changed() then
    raise exception 'Vous devez changer votre mot de passe temporaire avant de continuer.';
  end if;
end;
$$;

revoke execute on function public.assert_active_account() from public, anon;
grant execute on function public.assert_active_account() to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- link_child : garde de statut + refus de réaffecter un enfant déjà rattaché.
-- ----------------------------------------------------------------------------
create or replace function public.link_child(p_child_code text)
returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_profil record;
  v_child record;
begin
  perform public.assert_active_account();

  select * into v_profil from public.profiles where id = v_uid;
  if not found or v_profil.role <> 'parent' or v_profil.parent_id is null then
    raise exception 'Action réservée aux comptes parents.';
  end if;
  if not public.school_is_writable(v_profil.school_id) then
    raise exception 'Mode lecture seule : l''abonnement de votre école est expiré. Les modifications sont désactivées.';
  end if;

  select * into v_child
  from public.students
  where school_id = v_profil.school_id
    and child_code = upper(coalesce(trim(p_child_code), ''))
  limit 1;
  if not found then
    raise exception 'Code élève introuvable dans votre école. Vérifiez le code reçu auprès de l''école.';
  end if;
  if v_child.parent_id = v_profil.parent_id then
    raise exception 'Cet enfant est déjà rattaché à votre compte.';
  end if;
  if v_child.parent_id is not null then
    raise exception 'Cet enfant est déjà rattaché à une autre famille. Contactez l''école.';
  end if;

  update public.students set parent_id = v_profil.parent_id where id = v_child.id;

  insert into public.audit_log (school_id, actor_id, actor_role, action, entity, entity_id)
  values (v_profil.school_id, v_uid, v_profil.role, 'link_child', 'students', v_child.id);

  return v_child.id;
end;
$$;

revoke execute on function public.link_child(text) from anon, public;
grant execute on function public.link_child(text) to authenticated;

-- ----------------------------------------------------------------------------
-- update_report_meta : garde, période valide, titulaire NULL correctement géré.
-- ----------------------------------------------------------------------------
create or replace function public.update_report_meta(
  p_student_id uuid,
  p_period     text,
  p_conduct    text default null,
  p_absences   int  default null,
  p_comment    text default null
)
returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  v_school  uuid := public.current_school_id();
  v_teacher uuid := public.current_teacher_id();
  v_student record;
  v_period_type text;
begin
  perform public.assert_active_account();

  if public.current_role() not in ('directeur','econome','surveillant') and v_teacher is null then
    raise exception 'Modification non autorisée.';
  end if;
  if not public.school_is_writable(v_school) then
    raise exception 'Mode lecture seule : l''abonnement de votre école est expiré. Les modifications sont désactivées.';
  end if;

  select period_type into v_period_type from public.school_settings where school_id = v_school;
  if coalesce(v_period_type, 'semestre') = 'trimestre' then
    if p_period not in ('T1','T2','T3') then
      raise exception 'Période invalide.';
    end if;
  else
    if p_period not in ('S1','S2') then
      raise exception 'Période invalide.';
    end if;
  end if;

  select s.id, s.class_id, c.head_teacher_id into v_student
  from public.students s join public.class_rooms c on c.id = s.class_id
  where s.id = p_student_id and s.school_id = v_school;
  if not found then
    raise exception 'Élève introuvable dans votre école.';
  end if;
  if v_teacher is not null and v_student.head_teacher_id is distinct from v_teacher then
    raise exception 'Modification non autorisée.';
  end if;
  if p_absences is not null and p_absences < 0 then
    raise exception 'Requête invalide.';
  end if;

  insert into public.report_metas (school_id, student_id, period, conduct, absences, comment)
  values (v_school, p_student_id, p_period, coalesce(p_conduct, 'Bonne'), coalesce(p_absences, 0), coalesce(p_comment, ''))
  on conflict (school_id, student_id, period) do update set
    conduct    = coalesce(p_conduct, public.report_metas.conduct),
    absences   = coalesce(p_absences, public.report_metas.absences),
    comment    = coalesce(p_comment, public.report_metas.comment),
    updated_at = now();
end;
$$;

revoke execute on function public.update_report_meta(uuid, text, text, int, text) from anon, public;
grant execute on function public.update_report_meta(uuid, text, text, int, text) to authenticated;

-- ----------------------------------------------------------------------------
-- complete_password_change : autorisé à un compte ACTIF, même si le mot de
-- passe temporaire n'a pas encore été levé (c'est précisément son rôle).
-- ----------------------------------------------------------------------------
create or replace function public.complete_password_change()
returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Vous devez être connecté.';
  end if;
  if not public.is_active_user() then
    raise exception 'Compte inactif. Contactez la direction de votre école.';
  end if;
  update public.profiles set must_change_password = false where id = v_uid;
  insert into public.audit_log (school_id, actor_id, actor_role, action, entity, entity_id)
  values (current_school_id(), v_uid, public.current_role(), 'password_change', 'profiles', v_uid);
end;
$$;

revoke execute on function public.complete_password_change() from public, anon;
grant execute on function public.complete_password_change() to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- save_grade : garde + période conforme au type de période de l'école.
-- ----------------------------------------------------------------------------
alter function public.save_grade(uuid, uuid, uuid, text, text, numeric)
  rename to save_grade_unchecked;
revoke execute on function public.save_grade_unchecked(uuid, uuid, uuid, text, text, numeric)
  from public, anon, authenticated;

create or replace function public.save_grade(
  p_student_id uuid,
  p_class_id   uuid,
  p_subject_id uuid,
  p_period     text,
  p_field      text,
  p_value      numeric
)
returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  v_period_type text;
begin
  perform public.assert_active_account();

  select period_type into v_period_type
  from public.school_settings where school_id = public.current_school_id();
  if coalesce(v_period_type, 'semestre') = 'trimestre' then
    if p_period not in ('T1','T2','T3') then
      raise exception 'Période invalide.';
    end if;
  else
    if p_period not in ('S1','S2') then
      raise exception 'Période invalide.';
    end if;
  end if;

  perform public.save_grade_unchecked(
    p_student_id, p_class_id, p_subject_id, p_period, p_field, p_value
  );
end;
$$;

revoke execute on function public.save_grade(uuid, uuid, uuid, text, text, numeric) from anon, public;
grant execute on function public.save_grade(uuid, uuid, uuid, text, text, numeric) to authenticated;

-- ----------------------------------------------------------------------------
-- record_cash_payment
-- ----------------------------------------------------------------------------
alter function public.record_cash_payment(uuid, int)
  rename to record_cash_payment_unchecked;
revoke execute on function public.record_cash_payment_unchecked(uuid, int)
  from public, anon, authenticated;

create or replace function public.record_cash_payment(p_payment_id uuid, p_amount int)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.assert_active_account();
  return public.record_cash_payment_unchecked(p_payment_id, p_amount);
end;
$$;

revoke execute on function public.record_cash_payment(uuid, int) from anon, public;
grant execute on function public.record_cash_payment(uuid, int) to authenticated;

-- ----------------------------------------------------------------------------
-- send_reminders
-- ----------------------------------------------------------------------------
alter function public.send_reminders(uuid[])
  rename to send_reminders_unchecked;
revoke execute on function public.send_reminders_unchecked(uuid[])
  from public, anon, authenticated;

create or replace function public.send_reminders(p_student_ids uuid[])
returns int
language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.assert_active_account();
  return public.send_reminders_unchecked(p_student_ids);
end;
$$;

revoke execute on function public.send_reminders(uuid[]) from anon, public;
grant execute on function public.send_reminders(uuid[]) to authenticated;

-- ----------------------------------------------------------------------------
-- enroll_student
-- ----------------------------------------------------------------------------
alter function public.enroll_student(uuid, text, text, text, date, jsonb, uuid, text, text, text, text, text)
  rename to enroll_student_unchecked;
revoke execute on function public.enroll_student_unchecked(uuid, text, text, text, date, jsonb, uuid, text, text, text, text, text)
  from public, anon, authenticated;

create or replace function public.enroll_student(
  p_class_id uuid,
  p_first_name text,
  p_last_name text,
  p_gender text,
  p_birth_date date,
  p_options jsonb,
  p_parent_id uuid,
  p_parent_first text,
  p_parent_last text,
  p_parent_phone text,
  p_parent_email text,
  p_parent_address text
)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.assert_active_account();
  return public.enroll_student_unchecked(
    p_class_id, p_first_name, p_last_name, p_gender, p_birth_date, p_options,
    p_parent_id, p_parent_first, p_parent_last, p_parent_phone, p_parent_email, p_parent_address
  );
end;
$$;

revoke execute on function public.enroll_student(uuid, text, text, text, date, jsonb, uuid, text, text, text, text, text)
  from anon, public;
grant execute on function public.enroll_student(uuid, text, text, text, date, jsonb, uuid, text, text, text, text, text)
  to authenticated;

-- ----------------------------------------------------------------------------
-- decide_registration_requests
-- ----------------------------------------------------------------------------
alter function public.decide_registration_requests(uuid[], boolean, text)
  rename to decide_registration_requests_unchecked;
revoke execute on function public.decide_registration_requests_unchecked(uuid[], boolean, text)
  from public, anon, authenticated;

create or replace function public.decide_registration_requests(
  p_ids uuid[],
  p_approve boolean,
  p_reason text default null
)
returns int
language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.assert_active_account();
  return public.decide_registration_requests_unchecked(p_ids, p_approve, p_reason);
end;
$$;

revoke execute on function public.decide_registration_requests(uuid[], boolean, text)
  from anon, public;
grant execute on function public.decide_registration_requests(uuid[], boolean, text)
  to authenticated;

-- ----------------------------------------------------------------------------
-- replace_cell_teachers
-- ----------------------------------------------------------------------------
alter function public.replace_cell_teachers(uuid, uuid, uuid[])
  rename to replace_cell_teachers_unchecked;
revoke execute on function public.replace_cell_teachers_unchecked(uuid, uuid, uuid[])
  from public, anon, authenticated;

create or replace function public.replace_cell_teachers(
  p_class_id uuid,
  p_subject_id uuid,
  p_teacher_ids uuid[]
)
returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.assert_active_account();
  perform public.replace_cell_teachers_unchecked(p_class_id, p_subject_id, p_teacher_ids);
end;
$$;

revoke execute on function public.replace_cell_teachers(uuid, uuid, uuid[]) from anon, public;
grant execute on function public.replace_cell_teachers(uuid, uuid, uuid[]) to authenticated;

-- ----------------------------------------------------------------------------
-- set_class_head_teacher
-- ----------------------------------------------------------------------------
alter function public.set_class_head_teacher(uuid, uuid, text)
  rename to set_class_head_teacher_unchecked;
revoke execute on function public.set_class_head_teacher_unchecked(uuid, uuid, text)
  from public, anon, authenticated;

create or replace function public.set_class_head_teacher(
  p_class_id uuid,
  p_teacher_id uuid,
  p_mode text
)
returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.assert_active_account();
  perform public.set_class_head_teacher_unchecked(p_class_id, p_teacher_id, p_mode);
end;
$$;

revoke execute on function public.set_class_head_teacher(uuid, uuid, text) from anon, public;
grant execute on function public.set_class_head_teacher(uuid, uuid, text) to authenticated;

-- ----------------------------------------------------------------------------
-- post_announcement
-- ----------------------------------------------------------------------------
alter function public.post_announcement(text, text, boolean, text[])
  rename to post_announcement_unchecked;
revoke execute on function public.post_announcement_unchecked(text, text, boolean, text[])
  from public, anon, authenticated;

create or replace function public.post_announcement(
  p_title text,
  p_body text,
  p_audience_all boolean,
  p_audience_roles text[]
)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.assert_active_account();
  return public.post_announcement_unchecked(p_title, p_body, p_audience_all, p_audience_roles);
end;
$$;

revoke execute on function public.post_announcement(text, text, boolean, text[]) from anon, public;
grant execute on function public.post_announcement(text, text, boolean, text[]) to authenticated;
