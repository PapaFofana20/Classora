-- ============================================================================
-- SCOLIA — Phase 2 (bis) : rattachement d'un enfant supplémentaire
-- RPC parent → renvoie les mêmes messages que authService.linkChild du front.
-- ============================================================================
create or replace function public.link_child(p_child_code text)
returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_profil record;
  v_child record;
begin
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

  update public.students set parent_id = v_profil.parent_id where id = v_child.id;

  insert into public.audit_log (school_id, actor_id, actor_role, action, entity, entity_id, payload)
  values (v_profil.school_id, v_uid, v_profil.role, 'link_child', 'students', v_child.id, null);

  return v_child.id;
end;
$$;

revoke execute on function public.link_child(text) from anon, public;
grant execute on function public.link_child(text) to authenticated;
