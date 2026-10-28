-- ============================================================================
-- 00031 — Paramètres généraux de la plateforme Classora.
--
-- Ligne unique (id = 1) lue et écrite UNIQUEMENT par l'API avec la clé
-- service_role. Aucune politique RLS n'est créée : anon/authenticated n'ont
-- aucun accès direct à la table.
--
-- Ces réglages pilotent réellement la plateforme :
--   - registration_open      : ferme/ouvre les inscriptions publiques ;
--   - maintenance_mode       : affiche le bandeau de maintenance et ferme
--                              aussi les inscriptions ;
--   - session_timeout_minutes: déconnexion automatique de la console admin
--                              après inactivité (côté navigateur) ;
--   - audit_retention_days   : durée par défaut avant purge du journal d'audit ;
--   - platform_name / school_year / support_* : identité affichée.
-- ============================================================================

create table if not exists public.platform_settings (
  id                      smallint primary key default 1 check (id = 1),
  platform_name           text not null default 'Classora'
                            check (char_length(platform_name) between 2 and 60),
  support_email           text not null default 'support@classora.sn',
  support_phone           text not null default '',
  school_year             text not null default '2026-2027'
                            check (school_year ~ '^\d{4}-\d{4}$'),
  registration_open       boolean not null default true,
  maintenance_mode        boolean not null default false,
  maintenance_message     text not null default ''
                            check (char_length(maintenance_message) <= 300),
  session_timeout_minutes int not null default 60
                            check (session_timeout_minutes between 5 and 480),
  audit_retention_days    int not null default 365
                            check (audit_retention_days between 30 and 3650),
  updated_at              timestamptz not null default now(),
  updated_by              uuid
);

insert into public.platform_settings (id)
values (1)
on conflict (id) do nothing;

alter table public.platform_settings enable row level security;

revoke all on public.platform_settings from anon, authenticated;
grant all on public.platform_settings to service_role;

comment on table public.platform_settings is
  'Réglages généraux de la plateforme (ligne unique id=1), lus/écrits par l''API service_role.';

-- Accélère le journal d'audit (pagination, purge, supervision).
create index if not exists idx_audit_log_created_at
  on public.audit_log (created_at desc);
create index if not exists idx_audit_log_action_created
  on public.audit_log (action, created_at desc);
