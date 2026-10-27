-- Permettre au directeur de bloquer l'accès aux bulletins pour élèves/parents
alter table public.school_settings
  add column if not exists block_student_bulletins boolean not null default false;
