-- ============================================================================
-- SCOLIA — Purge de l'école de DÉMONSTRATION en production.
--
-- Le seed (supabase/seed.sql) avait été poussé une fois sur l'instance
-- hébergée (db push --include-seed) : école « école demo SCOLIA »
-- (matricule X7K9Q) et comptes de test dont le mot de passe est public
-- dans le dépôt (demo1234!). Cette migration les supprime définitivement.
--
-- Sans effet si le seed n'a jamais été appliqué (idempotent).
-- ============================================================================

-- Les élèves d'abord : le trigger trg_guard_class_delete (BEFORE DELETE sur
-- class_rooms) refuse la suppression d'une classe qui contient des élèves,
-- et dans la cascade il voit les élèves avant leur effacement.
delete from public.students
where school_id in (
  select id from public.schools where matricule = 'X7K9Q' and name like '%demo%'
);

-- L'école et TOUTES ses données restantes (FK `on delete cascade` :
-- teachers, class_rooms, subjects, subscriptions, payments, conversations, etc.).
delete from public.schools
where matricule = 'X7K9Q'
  and name like '%demo%';

-- Comptes Auth de la démo : UUIDs déterministes posés par le seed.
delete from auth.users
where id in (
  '00000000-0000-0000-0000-00000000000a', -- directeur
  '00000000-0000-0000-0000-0000000000bb', -- enseignant
  '00000000-0000-0000-0000-0000000000cc', -- parent
  '00000000-0000-0000-0000-0000000000dd', -- élève
  '00000000-0000-0000-0000-0000000000ee'  -- économe
);
