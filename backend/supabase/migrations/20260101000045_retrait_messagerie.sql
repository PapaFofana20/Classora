-- ============================================================================
-- Retrait complet de la messagerie parents-enseignants et des annonces.
--
-- Le front n'utilise plus ni conversations, ni messages, ni annonces :
-- on supprime donc leurs tables, leurs RPCs et leurs helpers.
-- Les migrations historiques qui les ont créées restent dans l'historique,
-- cette migration est la seule à appliquer pour les retirer de la base.
--
-- Point d'attention : send_reminders (relances impayés, 00009, renommée
-- send_reminders_unchecked en 00017) insérait une annonce à chaque relance.
-- On la réécrit d'abord SANS cette insertion (l'audit_log est conservé),
-- sinon la suppression de la table announcements casserait les relances.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. send_reminders_unchecked : même logique, sans insertion d'annonce.
-- ----------------------------------------------------------------------------
create or replace function public.send_reminders_unchecked(p_student_ids uuid[])
returns int
language plpgsql volatile security definer set search_path = public as $$
declare
  v_school uuid := public.current_school_id();
  v_role text := public.current_role();
  v_count int;
begin
  if v_role not in ('directeur','econome') then
    raise exception 'Seuls l''économe et la direction envoient les relances.';
  end if;
  if not public.school_is_writable(v_school) then
    raise exception 'Mode lecture seule : l''abonnement de votre école est expiré. Les modifications sont désactivées.';
  end if;
  select count(*) into v_count
  from public.students s
  where s.school_id = v_school and s.id = any (coalesce(p_student_ids, array[]::uuid[]));
  if v_count = 0 then
    raise exception 'Élève introuvable dans votre école.';
  end if;

  insert into public.audit_log (school_id, actor_id, actor_role, action, entity, entity_id, payload)
  values (v_school, auth.uid(), v_role, 'payment_reminders_sent', 'students', null,
          jsonb_build_object('count', v_count));

  return v_count;
end;
$$;

revoke execute on function public.send_reminders_unchecked(uuid[])
  from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. Suppression des tables (leurs politiques RLS et index partent avec).
--    À faire AVANT les fonctions : les politiques conversations/messages
--    dépendent de can_see_conversation(), qui ne peut donc pas être
--    supprimée tant que les tables existent.
-- ----------------------------------------------------------------------------
drop table if exists public.conversation_reads cascade;
drop table if exists public.messages cascade;
drop table if exists public.conversations cascade;
drop table if exists public.announcements cascade;

-- ----------------------------------------------------------------------------
-- 3. Suppression des RPCs et helpers de messagerie / annonces.
--    (drop ... if exists : rejouable sans erreur)
-- ----------------------------------------------------------------------------
drop function if exists public.list_conversations();
drop function if exists public.start_conversation(uuid, uuid, uuid, text, text);
drop function if exists public.send_message(uuid, text);
drop function if exists public.mark_conversation_read(uuid);
drop function if exists public.post_announcement(text, text, boolean, text[]);
drop function if exists public.can_see_conversation(uuid);
drop function if exists public.message_actor_id();
