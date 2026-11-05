-- ============================================================================
-- 00044 — Compte élève créé à partir du matricule d'élève.
--
-- Parcours : le directeur inscrit l'élève (enroll_student génère son matricule
-- unique, ex. EC260001). L'élève crée ensuite son compte en saisissant SON
-- matricule : le compte est rattaché à la fiche déjà inscrite (profiles.
-- student_id), ACTIF immédiatement — plus de fiche en double, plus d'attente
-- de validation. Le matricule élève ne sert qu'à cette création : la connexion
-- reste matricule d'école + e-mail + mot de passe.
-- Exécution réservée au service_role (Edge Function register-enrolled-student).
-- ============================================================================

create or replace function public.finish_enrolled_student_registration(
  p_user_id uuid,
  p_school_id uuid,
  p_student_matricule text,
  p_email text,
  p_phone text
)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_student record;
  v_school record;
begin
  if p_user_id is null then raise exception 'Compte introuvable.'; end if;
  select * into v_school from public.schools where id = p_school_id;
  if not found then raise exception 'École introuvable.'; end if;

  if exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'Un compte existe déjà avec cet e-mail.';
  end if;

  select * into v_student
  from public.students
  where school_id = p_school_id and upper(matricule) = upper(trim(p_student_matricule))
  limit 1;
  if not found then
    raise exception 'Matricule élève introuvable dans cette école. Vérifiez le matricule reçu auprès de l''école.';
  end if;

  if exists (select 1 from public.profiles where student_id = v_student.id) then
    raise exception 'Un compte existe déjà pour cet élève. Connectez-vous avec votre e-mail et votre mot de passe.';
  end if;

  insert into public.profiles (id, school_id, role, status, first_name, last_name, phone, email, student_id)
  values (p_user_id, p_school_id, 'eleve', 'ACTIF', v_student.first_name, v_student.last_name, trim(coalesce(p_phone, '')), trim(p_email), v_student.id);

  insert into public.audit_log (school_id, actor_id, action, entity, entity_id, payload)
  values (p_school_id, p_user_id, 'student_account_created_by_matricule', 'students', v_student.id,
          jsonb_build_object('student_matricule', v_student.matricule));

  return jsonb_build_object(
    'student_id', v_student.id,
    'first_name', v_student.first_name,
    'last_name', v_student.last_name,
    'class_id', v_student.class_id,
    'student_matricule', v_student.matricule
  );
end;
$$;

revoke execute on function public.finish_enrolled_student_registration(uuid, uuid, text, text, text)
  from anon, authenticated, public;
grant execute on function public.finish_enrolled_student_registration(uuid, uuid, text, text, text)
  to service_role;
