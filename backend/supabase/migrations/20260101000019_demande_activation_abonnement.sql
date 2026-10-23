-- ============================================================================
-- 00019 - Demande d'activation d'un abonnement par le directeur.
--
-- Le directeur ne peut pas activer lui-meme un abonnement : la RPC
-- activate_school_subscription reste reservee au service_role. Cette migration
-- ajoute donc une demande persistante, visible par le directeur et par le
-- support. Le support encaisse le paiement puis active l'abonnement ; le
-- trigger ci-dessous marque automatiquement la demande comme ACTIVEE.
--
-- Cote support :
--   select * from public.subscription_requests
--   where status = 'EN_ATTENTE'
--   order by created_at;
-- ============================================================================

create table if not exists public.subscription_requests (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references public.schools(id) on delete cascade,
  requested_by  uuid references public.profiles(id) on delete set null,
  plan_id       app_plan_id not null references public.plans(id),
  cycle         text not null check (cycle in ('monthly', 'yearly')),
  student_count int not null check (student_count between 1 and 100000),
  amount        int not null check (amount >= 0),
  status        text not null default 'EN_ATTENTE' check (status in ('EN_ATTENTE', 'ACTIVEE', 'ANNULEE')),
  created_at    timestamptz not null default now(),
  decided_at    timestamptz
);

create index if not exists idx_subscription_requests_school
  on public.subscription_requests (school_id, created_at desc);

-- Une seule demande en attente par ecole : une nouvelle demande remplace la
-- precedente au lieu de creer des doublons.
create unique index if not exists subscription_requests_one_pending
  on public.subscription_requests (school_id)
  where status = 'EN_ATTENTE';

alter table public.subscription_requests enable row level security;

drop policy if exists subscription_requests_director_read on public.subscription_requests;
create policy subscription_requests_director_read
  on public.subscription_requests
  for select
  to authenticated
  using (
    school_id = public.current_school_id()
    and public.current_role() = 'directeur'
    and public.is_active_user()
    and public.password_changed()
  );

revoke all on public.subscription_requests from anon, authenticated;
grant select on public.subscription_requests to authenticated;
grant all on public.subscription_requests to service_role;

-- Demande creee par le directeur. Prix, limite et montant sont toujours
-- recalcules cote serveur depuis public.plans : le client ne peut pas les
-- falsifier.
create or replace function public.request_subscription_activation(
  p_plan_id      text,
  p_cycle        text,
  p_student_count int
)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_profile    record;
  v_plan       record;
  v_request_id uuid;
  v_request    record;
  v_amount     int;
begin
  perform public.assert_active_account();

  select * into v_profile from public.profiles where id = auth.uid();
  if not found
     or v_profile.role <> 'directeur'
     or v_profile.school_id is null then
    raise exception 'Action reservee a la direction de l''ecole.';
  end if;

  if p_student_count is null or p_student_count < 1 or p_student_count > 100000 then
    raise exception 'Effectif invalide.';
  end if;
  if p_cycle is null or p_cycle not in ('monthly', 'yearly') then
    raise exception 'Cycle invalide (monthly ou yearly).';
  end if;

  select * into v_plan from public.plans where id::text = p_plan_id;
  if not found then
    raise exception 'Formule introuvable.';
  end if;
  if v_plan.student_limit is not null and p_student_count > v_plan.student_limit then
    raise exception 'La formule % est limitee a % eleves.', v_plan.name, v_plan.student_limit;
  end if;

  if exists (
    select 1 from public.subscriptions s
    where s.school_id = v_profile.school_id
      and s.ends_at >= current_date
  ) then
    raise exception 'Votre ecole dispose deja d''un abonnement actif.';
  end if;

  v_amount := case when p_cycle = 'yearly' then v_plan.yearly_price else v_plan.monthly_price end;

  insert into public.subscription_requests
    (school_id, requested_by, plan_id, cycle, student_count, amount)
  values
    (v_profile.school_id, auth.uid(), v_plan.id, p_cycle, p_student_count, v_amount)
  on conflict (school_id) where status = 'EN_ATTENTE'
  do update set
    requested_by  = excluded.requested_by,
    plan_id       = excluded.plan_id,
    cycle         = excluded.cycle,
    student_count = excluded.student_count,
    amount        = excluded.amount,
    created_at    = now()
  returning id into v_request_id;

  select * into v_request from public.subscription_requests where id = v_request_id;

  insert into public.audit_log
    (school_id, actor_id, actor_role, action, entity, entity_id, payload)
  values
    (v_profile.school_id, auth.uid(), v_profile.role, 'subscription_requested',
     'subscription_requests', v_request_id,
     jsonb_build_object('plan', v_plan.id, 'cycle', p_cycle,
                        'student_count', p_student_count, 'amount', v_amount));

  return jsonb_build_object(
    'id', v_request.id,
    'school_id', v_request.school_id,
    'plan_id', v_request.plan_id,
    'cycle', v_request.cycle,
    'student_count', v_request.student_count,
    'amount', v_request.amount,
    'status', v_request.status,
    'created_at', v_request.created_at,
    'decided_at', v_request.decided_at
  );
end;
$$;

revoke execute on function public.request_subscription_activation(text, text, int)
  from public, anon;
grant execute on function public.request_subscription_activation(text, text, int)
  to authenticated, service_role;

-- Toute activation (manuelle ou insertion support) cloture la demande en
-- attente de l'ecole. Le directeur voit alors son matricule sans action.
create or replace function public.close_subscription_request_on_activation()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.ends_at >= current_date then
    update public.subscription_requests
       set status = 'ACTIVEE',
           decided_at = now()
     where school_id = new.school_id
       and status = 'EN_ATTENTE';
  end if;
  return new;
end;
$$;

drop trigger if exists subscriptions_close_request on public.subscriptions;
create trigger subscriptions_close_request
  after insert or update of plan_id, ends_at on public.subscriptions
  for each row execute function public.close_subscription_request_on_activation();

comment on table public.subscription_requests
  is 'Demandes d''activation d''abonnement creees par le directeur et traitees par le support.';
comment on function public.request_subscription_activation(text, text, int)
  is 'Cree ou remplace la demande d''activation en attente de l''ecole du directeur connecte.';
comment on function public.close_subscription_request_on_activation()
  is 'Marque la demande en attente comme ACTIVEE quand un abonnement actif est cree ou prolonge.';
