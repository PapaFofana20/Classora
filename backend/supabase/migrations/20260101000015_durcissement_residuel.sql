-- ============================================================================
-- Migration 15 — Audit résiduel : durcissement RLS + idempotence paiements
-- + rate limiting atomique.
--
-- 1) Tautologies dans les politiques RLS : dans les sous-requêtes EXISTS,
--    une colonne non qualifiée (class_id, subject_id, school_id, student_id)
--    pré-existante sur la table INTERNE se résolvent sur cette dernière
--    (« a.class_id = class_id » vaut « a.class_id = a.class_id », toujours
--    vrai). Un enseignant avec une seule affectation pouvait ainsi lire/éditer
--    toutes les notes et tous les bulletins de son école. Correction :
--    qualification explicite des colonnes de la ligne filtrée.
-- 2) report_metas : l'élève ciblé doit appartenir à l'école de la ligne.
-- 3) apply_paid_subscription / apply_paid_installment : verrouillage de la
--    ligne transaction (FOR UPDATE), verrou d'application par échéance (les
--    webhooks concurrents ne créditent plus deux fois) et interdiction du
--    passage failed → succeeded (une transaction en échec exige une nouvelle
--    référence prestataire).
-- 4) sys_rate_limit : incrément atomique (upsert en une instruction) qui
--    remplace la lecture-contrôle-écriture de rateLimit.ts (concurrence et
--    clé falsifiable), plus une purge planifiable (pg_cron ou tâche cron
--    Supabase, chaque heure).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Politiques corrigées : qualifications explicites
-- ----------------------------------------------------------------------------

drop policy if exists "grades_select_scoped" on public.grades;
create policy "grades_select_scoped" on public.grades
  for select to authenticated
  using (
    user_can_query_data()
    and grades.school_id = current_school_id()
    and (
      (
        current_teacher_id() is null
        and (
          public.current_role() in ('directeur','econome','surveillant')
          or (current_parent_id() is not null and exists (
            select 1 from public.students s
            where s.school_id = grades.school_id
              and s.id = grades.student_id
              and s.parent_id = current_parent_id()))
          or (current_student_id() is not null and grades.student_id = current_student_id())
        )
      )
      or (current_teacher_id() is not null and (
        exists (select 1 from public.class_rooms c
                where c.id = grades.class_id
                  and c.school_id = grades.school_id
                  and c.head_teacher_id = current_teacher_id())
        or exists (select 1 from public.teaching_assignments a
                   where a.teacher_id = current_teacher_id()
                     and a.school_id = grades.school_id
                     and a.class_id = grades.class_id
                     and a.subject_id = grades.subject_id))
      )
    )
  );

drop policy if exists "grades_insert_enseignant_affecte" on public.grades;
create policy "grades_insert_enseignant_affecte" on public.grades
  for insert to authenticated
  with check (
    school_is_writable(grades.school_id)
    and grades.school_id = current_school_id()
    and current_teacher_id() is not null
    and exists (select 1 from public.teaching_assignments a
                where a.school_id = grades.school_id
                  and a.teacher_id = current_teacher_id()
                  and a.class_id = grades.class_id
                  and a.subject_id = grades.subject_id)
    and exists (select 1 from public.students s
                where s.id = grades.student_id
                  and s.school_id = grades.school_id
                  and s.class_id = grades.class_id)
  );

drop policy if exists "grades_update_enseignant_affecte" on public.grades;
create policy "grades_update_enseignant_affecte" on public.grades
  for update to authenticated
  using (
    school_is_writable(grades.school_id)
    and grades.school_id = current_school_id()
    and current_teacher_id() is not null
    and exists (select 1 from public.teaching_assignments a
                where a.school_id = grades.school_id
                  and a.teacher_id = current_teacher_id()
                  and a.class_id = grades.class_id
                  and a.subject_id = grades.subject_id)
    and exists (select 1 from public.students s
                where s.id = grades.student_id
                  and s.school_id = grades.school_id
                  and s.class_id = grades.class_id)
  )
  with check (
    school_is_writable(grades.school_id)
    and grades.school_id = current_school_id()
    and current_teacher_id() is not null
    and exists (select 1 from public.teaching_assignments a
                where a.school_id = grades.school_id
                  and a.teacher_id = current_teacher_id()
                  and a.class_id = grades.class_id
                  and a.subject_id = grades.subject_id)
    and exists (select 1 from public.students s
                where s.id = grades.student_id
                  and s.school_id = grades.school_id
                  and s.class_id = grades.class_id)
  );

drop policy if exists "payments_select_scoped" on public.payments;
create policy "payments_select_scoped" on public.payments
  for select to authenticated
  using (
    user_can_query_data()
    and payments.school_id = current_school_id()
    and (
      public.current_role() in ('directeur','econome','surveillant')
      or (current_parent_id() is not null and exists (
        select 1 from public.students s
        where s.id = payments.student_id
          and s.school_id = payments.school_id
          and s.parent_id = current_parent_id()))
      or (current_student_id() is not null and payments.student_id = current_student_id())
    )
  );

drop policy if exists "report_metas_select_scoped" on public.report_metas;
create policy "report_metas_select_scoped" on public.report_metas
  for select to authenticated
  using (
    user_can_query_data()
    and report_metas.school_id = current_school_id()
    and (
      (
        current_teacher_id() is null
        and (
          public.current_role() in ('directeur','econome','surveillant')
          or (current_parent_id() is not null and exists (
            select 1 from public.students mps
            where mps.school_id = report_metas.school_id
              and mps.id = report_metas.student_id
              and mps.parent_id = current_parent_id()))
          or (current_student_id() is not null and report_metas.student_id = current_student_id())
        )
      )
      or (current_teacher_id() is not null and exists (
        select 1 from public.students s join public.class_rooms c on c.id = s.class_id
        where s.id = report_metas.student_id
          and s.school_id = report_metas.school_id
          and c.head_teacher_id = current_teacher_id()))
    )
  );

drop policy if exists "report_metas_insert_responsables" on public.report_metas;
create policy "report_metas_insert_responsables" on public.report_metas
  for insert to authenticated
  with check (
    school_is_writable(report_metas.school_id)
    and report_metas.school_id = current_school_id()
    and (public.current_role() in ('directeur','econome','surveillant')
      or (current_teacher_id() is not null and exists (
        select 1 from public.students s join public.class_rooms c on c.id = s.class_id
        where s.id = report_metas.student_id
          and s.school_id = report_metas.school_id
          and c.head_teacher_id = current_teacher_id())))
  );

drop policy if exists "report_metas_update_role_resume" on public.report_metas;
create policy "report_metas_update_role_resume" on public.report_metas
  for update to authenticated
  using (
    school_is_writable(report_metas.school_id)
    and report_metas.school_id = current_school_id()
    and (public.current_role() in ('directeur','econome','surveillant')
      or (current_teacher_id() is not null and exists (
        select 1 from public.students s join public.class_rooms c on c.id = s.class_id
        where s.id = report_metas.student_id
          and s.school_id = report_metas.school_id
          and c.head_teacher_id = current_teacher_id())))
  )
  with check (
    school_is_writable(report_metas.school_id)
    and report_metas.school_id = current_school_id()
    and (public.current_role() in ('directeur','econome','surveillant')
      or (current_teacher_id() is not null and exists (
        select 1 from public.students s join public.class_rooms c on c.id = s.class_id
        where s.id = report_metas.student_id
          and s.school_id = report_metas.school_id
          and c.head_teacher_id = current_teacher_id())))
  );

-- ----------------------------------------------------------------------------
-- 2) Idempotence atomique des confirmations de paiement
-- ----------------------------------------------------------------------------

create or replace function public.apply_paid_subscription(
  p_provider     text,
  p_provider_ref text,
  p_status       text,
  p_payload      jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_tx          record;
  v_school      record;
  v_plan        record;
  v_sub         record;
  v_result      jsonb;
  v_cycle       text;
  v_days        int;
  v_amount      int;
  v_event       text;
  v_starts      date;
  v_ends        date;
  v_matricule   text;
  v_created     boolean := false;
  v_new         boolean := false;
begin
  select * into v_tx from public.payment_transactions
  where provider = p_provider and provider_ref = p_provider_ref
  for update;   -- verrou de ligne : les webhooks concurrents sont sérialisés
  if not found then
    raise exception 'Transaction inconnue.';
  end if;

  -- Verrou de sérialisation par école : deux confirmations concurrentes ne
  -- peuvent plus étendre l'abonnement deux fois.
  perform pg_advisory_xact_lock(hashtextextended('scolia:subscription:' || v_tx.school_id::text, 0));

  if v_tx.status = 'succeeded' then
    select * into v_sub from public.subscriptions where school_id = v_tx.school_id;
    select matricule into v_matricule from public.schools where id = v_tx.school_id;
    select jsonb_build_object(
      'idempotent', true,
      'matricule', v_matricule,
      'matriculeCreated', false,
      'plan_id', v_sub.plan_id,
      'amount', v_sub.amount_paid,
      'starts_at', v_sub.starts_at,
      'ends_at', v_sub.ends_at,
      'paid_at', v_sub.paid_at
    ) into v_result;
    return v_result;
  end if;

  -- Une transaction terminée en échec ne peut pas être confirmée :
  -- le prestataire doit initier un nouveau paiement.
  if v_tx.status = 'failed' and p_status = 'succeeded' then
    raise exception 'Transaction terminée en échec : initialisez un nouveau paiement.';
  end if;

  if p_status <> 'succeeded' then
    update public.payment_transactions
    set status = 'failed', updated_at = now()
    where id = v_tx.id;
    insert into public.audit_log (school_id, actor_id, actor_role, action, entity, entity_id, payload)
    values (v_tx.school_id, null, 'service_role', 'subscription_payment_failed',
            'payment_transactions', v_tx.id, jsonb_build_object('provider', p_provider));
    return jsonb_build_object('status', 'failed', 'payment_ref', p_provider_ref);
  end if;

  select * into v_school from public.schools where id = v_tx.school_id;
  if not found then
    raise exception 'École introuvable.';
  end if;

  v_cycle  := v_tx.payload->>'cycle';
  v_amount := v_tx.amount;

  if v_cycle not in ('monthly', 'yearly') then
    raise exception 'Formule de facturation invalide.';
  end if;

  select * into v_plan from public.plans where id = v_tx.payload->>'plan_id';
  if not found then
    raise exception 'Formule d''abonnement introuvable.';
  end if;

  if v_amount <> (case when v_cycle = 'yearly' then v_plan.yearly_price else v_plan.monthly_price end) then
    raise exception 'Le montant payé ne correspond pas à la formule choisie.';
  end if;

  -- Marque la transaction (unique par (provider, provider_ref) : un seul état).
  update public.payment_transactions
  set status = 'succeeded', payload = v_tx.payload || coalesce(p_payload, '{}'), updated_at = now()
  where id = v_tx.id;

  v_days  := (case when v_cycle = 'yearly' then 365 else 30 end);
  select * into v_sub from public.subscriptions where school_id = v_school.id;

  if found then
    if v_sub.ends_at >= current_date then
      -- CUMULATIF : l'échéance active est repoussée de la durée achetée.
      v_ends   := v_sub.ends_at + v_days;
      v_starts := v_sub.starts_at;
    else
      -- L'abonnement était expiré : reprise au jour du paiement.
      v_ends   := current_date + v_days;
      v_starts := current_date;
    end if;
    if v_sub.plan_id = v_plan.id then
      v_event := 'renewal';
    else
      v_event := 'plan_change';
    end if;
  else
    v_ends   := current_date + v_days;
    v_starts := current_date;
    v_event  := 'purchase';
    v_new    := true;
  end if;

  if v_new then
    insert into public.subscriptions
      (school_id, plan_id, starts_at, ends_at, student_limit, amount_paid, payment_ref, method, paid_at)
    values
      (v_school.id, v_plan.id, v_starts, v_ends, v_plan.student_limit, v_amount, p_provider_ref, v_tx.method, now());
  else
    update public.subscriptions
    set plan_id       = v_plan.id,
        starts_at     = v_starts,
        ends_at       = v_ends,
        student_limit = v_plan.student_limit,
        amount_paid   = v_amount,
        payment_ref   = p_provider_ref,
        method        = v_tx.method,
        paid_at       = now()
    where school_id = v_school.id;
  end if;

  -- Matricule : attribué au PREMIER paiement confirmé, jamais après.
  if v_school.matricule is null then
    v_matricule := public.generate_school_matricule();
    update public.schools set matricule = v_matricule where id = v_school.id;
    v_created := true;
  else
    v_matricule := v_school.matricule;
  end if;

  insert into public.subscription_events
    (school_id, event_type, plan_id, amount_paid, payment_ref, method, starts_at, ends_at)
  values
    (v_school.id, v_event, v_plan.id, v_amount, p_provider_ref, v_tx.method, v_starts, v_ends);

  insert into public.audit_log (school_id, actor_id, actor_role, action, entity, entity_id, payload)
  values (v_school.id, null, 'service_role',
          case when v_new then 'subscription_purchased' else 'subscription_renewed' end,
          'subscriptions', null,
          jsonb_build_object('plan', v_plan.id, 'amount', v_amount, 'cycle', v_cycle));

  return jsonb_build_object(
    'idempotent', false,
    'matricule', v_matricule,
    'matriculeCreated', v_created,
    'plan_id', v_plan.id,
    'plan_name', v_plan.name,
    'amount', v_amount,
    'method', v_tx.method,
    'starts_at', v_starts,
    'ends_at', v_ends,
    'paid_at', now()
  );
end;
$$;

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
  v_p public.payments%rowtype;
begin
  select * into v_tx from public.payment_transactions
  where provider = p_provider and provider_ref = p_provider_ref and tx_kind = 'installment'
  for update;   -- verrou de ligne : les webhooks concurrents sont sérialisés
  if not found then
    raise exception 'Transaction inconnue.';
  end if;

  -- Verrou partagé avec start_installment_payments (une échéance, un crayon).
  perform pg_advisory_xact_lock(hashtextextended('scolia:installment:' || v_tx.payment_id::text, 0));

  if v_tx.status = 'succeeded' then
    select * into v_p from public.payments where id = v_tx.payment_id;
    return jsonb_build_object('idempotent', true, 'payment_id', v_tx.payment_id,
                              'paid_amount', v_p.paid_amount, 'status', v_p.status);
  end if;

  -- Une transaction déjà en échec ne peut pas être confirmée : une nouvelle
  -- référence prestataire est nécessaire.
  if v_tx.status = 'failed' and p_status = 'succeeded' then
    raise exception 'Transaction terminée en échec : initialisez un nouveau paiement.';
  end if;

  if p_status <> 'succeeded' then
    update public.payment_transactions set status = 'failed', updated_at = now() where id = v_tx.id;
    return jsonb_build_object('status', 'failed', 'reference', p_provider_ref);
  end if;

  select * into v_p from public.payments where id = v_tx.payment_id for update;
  if not found then
    raise exception 'Échéance introuvable.';
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

  select * into v_p from public.payments where id = v_tx.payment_id;
  return jsonb_build_object('idempotent', false, 'payment_id', v_tx.payment_id,
                            'paid_amount', v_p.paid_amount,
                            'status', v_p.status,
                            'reference', p_provider_ref);
end;
$$;

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
    -- Même verrou que apply_paid_installment : aucune transaction ne peut
    -- être créée ni lue pendant la confirmation d'un webhook.
    perform pg_advisory_xact_lock(hashtextextended('scolia:installment:' || v_p.id::text, 0));
    select * into v_p from public.payments where id = v_p.id for update;
    if not found or v_p.paid_amount >= v_p.amount then
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

-- ----------------------------------------------------------------------------
-- 3) Rate limiting atomique (remplace la lecture-contrôle-écriture d'avant)
--    + purge planifiable.
-- ----------------------------------------------------------------------------

create or replace function public.sys_rate_limit(p_key text, p_max int, p_window_secs int)
returns boolean
language plpgsql volatile security definer set search_path = public as $$
declare
  v_now timestamptz := now();
begin
  insert into public.rate_limits (key, count, window_start, updated_at)
  values (p_key, 1, v_now, v_now)
  on conflict (key) do update
    set count        = case
                         when rate_limits.window_start + make_interval(secs => p_window_secs) <= v_now
                         then 1 else rate_limits.count + 1 end,
        window_start = case
                         when rate_limits.window_start + make_interval(secs => p_window_secs) <= v_now
                         then v_now else rate_limits.window_start end,
        updated_at   = v_now
    where rate_limits.window_start + make_interval(secs => p_window_secs) <= v_now
       or rate_limits.count < p_max;
  if not found then
    return false;  -- limite atteinte pour cette clé
  end if;
  return true;
end;
$$;

create or replace function public.sys_purge_rate_limits()
returns int
language sql volatile security definer set search_path = public as $$
  with gone as (delete from public.rate_limits where updated_at < now() - interval '2 hours' returning 1)
  select count(*) from gone
$$;

revoke execute on function public.sys_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function public.sys_rate_limit(text, int, int) to service_role;
revoke execute on function public.sys_purge_rate_limits() from public, anon, authenticated;
grant execute on function public.sys_purge_rate_limits() to service_role;

-- Aucun accès PostgREST direct à la table (RLS sans politique + grants) :
-- la seule voie est la RPC ci-dessus, référencée par _shared/rateLimit.ts.
revoke all on table public.rate_limits from anon, authenticated;

-- Purge planifiée (à activer une fois la migration appliquée) :
--   avec pg_cron : select cron.schedule('purge rate_limits', '0 * * * *',
--     $$ select public.sys_purge_rate_limits() $$);
--   sinon une tâche Supabase « Cron » horaire peut appeler la RPC service_role.
