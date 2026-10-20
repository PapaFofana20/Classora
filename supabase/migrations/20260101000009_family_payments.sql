-- ============================================================================
-- Migration 9 — Phase 6 : paiements des familles (échéanciers).
--
-- Les échéances (payments) sont générées côté serveur à l'inscription
-- (build_payment_plan, migration 6). Le client ne « paye » JAMAIS une ligne
-- directement :
--   - l'économe / la direction encaissent les espèces : record_cash_payment ;
--   - une famille (parent, élève) initie un paiement mobile : la référence
--     prestataire est créée par start_installment_payments (transactions
--     PENDING) puis confirmée de façon IDEMPOTENTE par apply_paid_installment
--     (service_role, appelé par payment-webhook ou pay-installment en sandbox).
-- Status est matérialisé par trg_set_payment_status (jamais fourni par
-- le client). Aucune politique d'écriture directe sur payments.
-- ============================================================================

-- Référence prestataire du même format que le front WV-1234-5678 / OM-… / FM-…,
-- unique dans payment_transactions.
create or replace function public.new_payment_reference(p_method text)
returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  v_prefix text;
  v_ref text;
begin
  v_prefix := (case p_method
    when 'wave' then 'WV'
    when 'orange_money' then 'OM'
    when 'free_money' then 'FM'
    else 'EC' end);
  for attempt in 1..50 loop
    v_ref := v_prefix || '-' || (floor(random() * 9000) + 1000)::int::text
             || '-' || (floor(random() * 9000) + 1000)::int::text;
    if not exists (select 1 from public.payment_transactions t where t.provider_ref = v_ref) then
      return v_ref;
    end if;
  end loop;
  raise exception 'Impossible de générer une référence unique, réessayez.';
end;
$$;

-- ----------------------------------------------------------------------------
-- ENCAISSEMENT EN ESPÈCES (économe / direction), parité paymentService.
-- ----------------------------------------------------------------------------
create or replace function public.record_cash_payment(p_payment_id uuid, p_amount int)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_school uuid := public.current_school_id();
  v_role text := public.current_role();
  v_p record;
  v_added int;
  v_ref text;
begin
  if v_role not in ('directeur','econome') then
    raise exception 'Seuls l''économe et la direction encaissent les espèces.';
  end if;
  if not public.school_is_writable(v_school) then
    raise exception 'Mode lecture seule : l''abonnement de votre école est expiré. Les modifications sont désactivées.';
  end if;
  select * into v_p from public.payments
  where id = p_payment_id and school_id = v_school;
  if not found then
    raise exception 'Échéance introuvable.';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount > v_p.amount - v_p.paid_amount then
    raise exception 'Montant invalide.';
  end if;

  v_added := least(p_amount, v_p.amount - v_p.paid_amount);
  v_ref := 'EC-' || (100000 + floor(random() * 900000))::int::text;
  update public.payments
  set paid_amount = least(v_p.amount, v_p.paid_amount + v_added),
      method = 'especes',
      paid_at = now(),
      reference = coalesce(v_p.reference, v_ref)
  where id = p_payment_id;

  insert into public.audit_log (school_id, actor_id, actor_role, action, entity, entity_id, payload)
  values (v_school, auth.uid(), v_role, 'payment_recorded_cash', 'payments', p_payment_id,
          jsonb_build_object('amount', v_added, 'reference', v_ref));

  select to_jsonb(p) into v_p from public.payments p where p.id = p_payment_id;
  return jsonb_build_object(
    'payment_id', p_payment_id,
    'paid_amount', v_p->>'paid_amount',
    'status', v_p->>'status',
    'reference', v_ref
  );
end;
$$;

revoke execute on function public.record_cash_payment(uuid, int) from anon, public;
grant execute on function public.record_cash_payment(uuid, int) to authenticated;

-- ----------------------------------------------------------------------------
-- INITIATION d'un paiement mobile par la famille : transactions PENDING
-- (une par échéance), sans marque d'encaissement avant confirmation.
-- ----------------------------------------------------------------------------
create or replace function public.start_installment_payments(
  p_payment_ids uuid[],
  p_method text,
  p_phone text
)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_school uuid := public.current_school_id();
  v_role text := public.current_role();
  v_parent uuid := public.current_parent_id();
  v_student uuid := public.current_student_id();
  v_p record;
  v_others int;
  v_ref text;
  v_result jsonb := '[]'::jsonb;
begin
  if v_role not in ('parent','eleve') or (v_parent is null and v_student is null) then
    raise exception 'Ces échéances ne vous concernent pas.';
  end if;
  if p_method = 'especes' or p_method not in ('wave','orange_money','free_money') then
    raise exception 'Moyen de paiement invalide.';
  end if;
  if p_phone is null or regexp_replace(p_phone, ' ', '', 'g') !~ '^(\+221)?7[0678]\d{8}$' then
    raise exception 'Numéro de téléphone invalide.';
  end if;
  if not public.school_is_writable(v_school) then
    raise exception 'Mode lecture seule : l''abonnement de votre école est expiré. Les modifications sont désactivées.';
  end if;

  -- Toutes les échéances demandées doivent appartenir à LA famille de l'appelant.
  select count(*) into v_others
  from public.payments p
  where p.id = any (coalesce(p_payment_ids, array[]::uuid[]))
    and (
      p.school_id <> v_school
      or (v_parent is not null and not exists (
        select 1 from public.students s
        where s.id = p.student_id and s.school_id = v_school and s.parent_id = v_parent))
      or (v_student is not null and not exists (
        select 1 from public.students s
        where s.id = p.student_id and s.school_id = v_school and s.id = v_student))
    );

  if v_others > 0 or coalesce(array_length(p_payment_ids, 1), 0) = 0 then
    raise exception 'Ces échéances ne vous concernent pas.';
  end if;

  for v_p in
    select p.* from public.payments p
    where p.id = any (p_payment_ids)
      and p.school_id = v_school
      and (v_parent is null or p.student_id in (select s.id from public.students s where s.parent_id = v_parent))
      and (v_student is null or p.student_id = v_student)
  loop
    if v_p.paid_amount >= v_p.amount then
      continue; -- déjà soldée : rien à encaisser
    end if;
    -- Ré-utilisation d'une transaction PENDING équivalente (retry du client).
    select t.provider_ref into v_ref
    from public.payment_transactions t
    where t.tx_kind = 'installment' and t.payment_id = v_p.id
      and t.method = p_method and t.status = 'pending'
      and t.amount = v_p.amount - v_p.paid_amount
    limit 1;
    if not found then
      v_ref := public.new_payment_reference(p_method);
      insert into public.payment_transactions
        (tx_kind, school_id, payment_id, provider, provider_ref, amount, method, phone, status, payload)
      values
        ('installment', v_school, v_p.id, p_method, v_ref, v_p.amount - v_p.paid_amount, p_method, p_phone,
         'pending', jsonb_build_object('student_id', v_p.student_id, 'kind', v_p.kind));
    end if;
    v_result := v_result || jsonb_build_object(
      'payment_id', v_p.id, 'reference', v_ref,
      'amount', v_p.amount - v_p.paid_amount, 'method', p_method);
  end loop;

  insert into public.audit_log (school_id, actor_id, actor_role, action, entity, entity_id, payload)
  values (v_school, auth.uid(), v_role, 'installment_started', 'payment_transactions', null,
          jsonb_build_object('method', p_method, 'count', jsonb_array_length(v_result)));

  return v_result;
end;
$$;

revoke execute on function public.start_installment_payments(uuid[], text, text) from anon, public;
grant execute on function public.start_installment_payments(uuid[], text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- CONFIRMATION idempotente d'un paiement d'échéance (service_role UNIQUEMENT) :
-- le webhook / sandbox EF l'appelle après la vérification de la signature.
-- ----------------------------------------------------------------------------
create or replace function public.apply_paid_installment(
  p_provider text,
  p_provider_ref text,
  p_status text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_tx record;
  v_p record;
begin
  select * into v_tx from public.payment_transactions
  where provider = p_provider and provider_ref = p_provider_ref and tx_kind = 'installment';
  if not found then
    raise exception 'Transaction inconnue.';
  end if;

  if v_tx.status = 'succeeded' then
    select to_jsonb(p) into v_p from public.payments p where p.id = v_tx.payment_id;
    return jsonb_build_object('idempotent', true, 'payment_id', v_tx.payment_id,
                              'paid_amount', v_p->>'paid_amount', 'status', v_p->>'status');
  end if;

  if p_status <> 'succeeded' then
    update public.payment_transactions set status = 'failed', updated_at = now() where id = v_tx.id;
    return jsonb_build_object('status', 'failed', 'reference', p_provider_ref);
  end if;

  update public.payment_transactions
  set status = 'succeeded', payload = v_tx.payload || coalesce(p_payload, '{}'), updated_at = now()
  where id = v_tx.id;

  update public.payments p
  set paid_amount = least(p.amount, p.paid_amount + v_tx.amount),
      method = v_tx.method,
      paid_at = now(),
      reference = coalesce(p.reference, p_provider_ref)
  where p.id = v_tx.payment_id;

  insert into public.audit_log (school_id, actor_id, actor_role, action, entity, entity_id, payload)
  values (v_tx.school_id, null, 'service_role', 'installment_paid', 'payment_transactions', v_tx.id,
          jsonb_build_object('provider', p_provider, 'amount', v_tx.amount));

  select to_jsonb(p) into v_p from public.payments p where p.id = v_tx.payment_id;
  return jsonb_build_object('idempotent', false, 'payment_id', v_tx.payment_id,
                            'paid_amount', v_p->>'paid_amount',
                            'status', v_p->>'status',
                            'reference', p_provider_ref);
end;
$$;

revoke execute on function public.apply_paid_installment(text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.apply_paid_installment(text, text, text, jsonb) to service_role;

-- ----------------------------------------------------------------------------
-- Relances impayés (direction) : annonce ciblée économat + direction.
-- ----------------------------------------------------------------------------
create or replace function public.send_reminders(p_student_ids uuid[])
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

  insert into public.announcements (school_id, title, body, author, audience_all, audience_roles)
  values (v_school, 'Relance de paiement',
          format('Une relance a été envoyée à %s famille%s.', v_count, case when v_count > 1 then 's' else '' end),
          'Économat', false, array['econome','directeur']::text[]);

  insert into public.audit_log (school_id, actor_id, actor_role, action, entity, entity_id, payload)
  values (v_school, auth.uid(), v_role, 'payment_reminders_sent', 'students', null,
          jsonb_build_object('count', v_count));

  return v_count;
end;
$$;

revoke execute on function public.send_reminders(uuid[]) from anon, public;
grant execute on function public.send_reminders(uuid[]) to authenticated;

-- ============================================================================
-- Privilèges : l'échéancier est lisible par les clients (politique ci-dessus),
-- mais JAMAIS écrit directement ; le registre des transactions mobiles est
-- réservé au service_role.
-- ============================================================================
revoke select, insert, update, delete on public.payments from authenticated, anon;
grant select on public.payments to authenticated;

revoke select, insert, update, delete on public.payment_transactions from authenticated, anon;

-- ============================================================================
-- Politique de LECTURE de l'échéancier (écritures = RPCs ci-dessus SEULS).
-- ============================================================================
create policy "payments_select_scoped" on public.payments
  for select to authenticated
  using (
    user_can_query_data()
    and school_id = current_school_id()
    and (
      current_role() in ('directeur','econome','surveillant')
      or (current_parent_id() is not null and exists (
        select 1 from public.students s
        where s.id = student_id and s.school_id = school_id and s.parent_id = current_parent_id()))
      or (current_student_id() is not null and student_id = current_student_id())
    )
  );
