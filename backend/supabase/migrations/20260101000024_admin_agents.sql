-- ============================================================================
-- 00024 — Agents administratifs Classora (interne, hors école)
--
-- Table dédiée aux agents internes de Classora (superadmin, admin, agent_suivi).
-- Ces agents ne sont rattachés à AUCUNE école : ils supervisent l'ensemble
-- de la plateforme. L'authentification passe par Supabase Auth (création via
-- service_role, jamais d'inscription publique).
--
-- Chaque agent reçoit une matricule immuable au format CLA-ADM-000001,
-- générée côté serveur, protégée par une contrainte d'unicité.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table des agents administratifs
-- ----------------------------------------------------------------------------
create table if not exists public.admin_agents (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid not null unique references auth.users (id) on delete cascade,
  matricule     text unique not null check (matricule ~ '^CLA-ADM-\d{6}$'),
  role          text not null check (role in ('superadmin', 'admin', 'agent_suivi')),
  status        text not null default 'ACTIF' check (status in ('ACTIF', 'EN_ATTENTE', 'DESACTIVE')),
  first_name    text not null,
  last_name     text not null,
  email         text not null unique,
  phone         text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.admin_agents enable row level security;

-- Index
create index if not exists idx_admin_agents_auth_user on public.admin_agents (auth_user_id);
create index if not exists idx_admin_agents_matricule on public.admin_agents (matricule);
create index if not exists idx_admin_agents_email on public.admin_agents (email);
create index if not exists idx_admin_agents_role_status on public.admin_agents (role, status);

-- ----------------------------------------------------------------------------
-- Fonction de génération de matricule administrateur (CLA-ADM-000001)
-- Sécurité definer, exécutable uniquement par service_role.
-- ----------------------------------------------------------------------------
create or replace function public.generate_admin_matricule()
returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  v_seq   int;
  v_matricule text;
begin
  -- Détermine le prochain numéro à partir du maximum existant
  select coalesce(max(substring(matricule from '\d+$')::int), 0) + 1
    into v_seq
    from public.admin_agents;

  v_matricule := 'CLA-ADM-' || lpad(v_seq::text, 6, '0');

  -- Vérification de l'unicité (double sécurité, devrait toujours passer)
  if exists (select 1 from public.admin_agents where matricule = v_matricule) then
    raise exception 'Impossible de générer une matricule administrative unique.';
  end if;

  return v_matricule;
end;
$$;

revoke execute on function public.generate_admin_matricule() from public, anon, authenticated;
grant execute on function public.generate_admin_matricule() to service_role;

-- ----------------------------------------------------------------------------
-- Politiques RLS
-- ----------------------------------------------------------------------------
-- Lecture : un agent authentifié peut lire son propre profil.
create policy "admin_agents_select_self" on public.admin_agents
  for select to authenticated
  using (auth_user_id = auth.uid());

-- Lecture : les superadmins peuvent lire tous les agents.
create policy "admin_agents_select_superadmin" on public.admin_agents
  for select to authenticated
  using (
    exists (
      select 1 from public.admin_agents aa
      where aa.auth_user_id = auth.uid()
        and aa.role = 'superadmin'
        and aa.status = 'ACTIF'
    )
  );

-- Écriture : aucune écriture directe côté client (tout passe par l'API service_role).
-- Pas de politique d'insert/update/delete pour authenticated/anon.

-- ----------------------------------------------------------------------------
-- Commentaires
-- ----------------------------------------------------------------------------
comment on table public.admin_agents is 'Agents administratifs internes de Classora (superadmin, admin, agent_suivi). Aucun lien avec une école.';
comment on column public.admin_agents.matricule is 'Matricule administrative immuable, format CLA-ADM-000001, générée côté serveur.';
comment on function public.generate_admin_matricule() is 'Génère une matricule administrative unique (CLA-ADM-000001). Réservée au service_role.';