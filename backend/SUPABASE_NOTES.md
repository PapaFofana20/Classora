# Migration Supabase — multi-écoles, Row Level Security

Ce document décrit ce que le front simule aujourd'hui (`src/services/*`, base localeStorage) et
comment le reproduire côté serveur avec Supabase. **Rien de ce qui suit n'est implémenté côté
serveur pour l'instant** : c'est le plan de migration, avec les règles de sécurité à appliquer.

---

## 1. Principe : `school_id` partout

L'isolation repose sur **une seule règle** : toute ligne de données métier appartient à une école,
et aucune requête ne peut lire ni écrire une ligne dont `school_id` diffère de celui de l'utilisateur
connecté. Le `school_id` n'est **jamais** accepté depuis le client : il est déduit du JWT
(claim `app_metadata.school_id`) ou du profil.

Tables concernées (toutes déjà présentes dans `src/types/index.ts` avec un champ `schoolId`) :

| Table | Colonnes clés | Remarques |
|---|---|---|
| `schools` | `id`, `name`, `city`, **`matricule`** (unique), `registration_open`, `auto_approve_students` | `matricule` est `NULL` tant qu'aucun paiement n'est confirmé |
| `subscriptions` | `id`, **`school_id`**, `plan`, `status`, `starts_at`, `ends_at`, `student_limit`, `amount_paid`, `payment_ref` | 1 abonnement courant par école (historiser dans `subscription_events`) |
| `profiles` (utilisateurs) | `id` (= `auth.uid()`), **`school_id`**, `email`, `role`, `status`, `must_change_password`, `teacher_id`, `parent_id`, `student_id` | aucun mot de passe stocké ici : Supabase Auth le gère |
| `teachers` | `id`, **`school_id`**, `first_name`, `last_name`, `kind`, `email`, `phone` | |
| `parents` | `id`, **`school_id`**, `first_name`, `last_name`, `phone`, `email`, `address` | |
| `students` | `id`, **`school_id`**, `matricule`, **`child_code`** (unique par école), `class_id`, `parent_id` | |
| `class_rooms` | `id`, **`school_id`**, `name`, `level_id`, `cycle`, `series`, `head_teacher_id`, `capacity` | |
| `subjects` / `class_subjects` / `teaching_assignments` | **`school_id`** + clés fonctionnelles | |
| `grades` | **`school_id`**, `student_id`, `class_id`, `subject_id`, `period` | |
| `report_metas`, `payments`, `absences`, `conversations`, `announcements`, `registration_requests` | **`school_id`** | |

Index impératifs : `(school_id)` sur chaque table, uniques composites
`unique (school_id, matricule)`, `unique (school_id, child_code)`, `unique (school_id, email)`.

---

## 2. Row Level Security

RLS est activé sur **toutes** les tables, avec une politique par rôle. Rôles applicatifs
(créés dans `app_metadata.role`) : `directeur`, `econome`, `surveillant`, `instituteur`,
`professeur`, `eleve`, `parent`.

```sql
alter table students   enable row level security;
-- ... idem pour chaque table listée ci-dessus

create or replace function current_school_id() returns uuid
language sql stable as $$
  select (auth.jwt() -> 'app_metadata' ->> 'school_id')::uuid
$$;

-- Lecture : uniquement sa propre école
create policy "lecture dans son école" on students
  for select using (school_id = current_school_id());

-- Écriture : directeur de son école, et seulement si l'abonnement le permet
create policy "écriture direction" on students
  for all
  using (
    school_id = current_school_id()
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'directeur'
  )
  with check (
    school_id = current_school_id()
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'directeur'
  );
```

Règles complémentaires :

* **Aucun `service_role` côté client.** Les clés `anon` ne peuvent écrire que dans le périmètre RLS.
* Les tables `schools` / `subscriptions` n'ont qu'une politique de lecture (`school_id = current_school_id()`)
  et **aucune** politique d'insertion client : la création d'école et le changement de formule passent
  par une Edge Function (voir §4).
* Un élève ne lit que la ligne `students.id = profile.student_id` ; un parent ne lit que les élèves dont
  `parent_id = profile.parent_id` (à ajouter en plus du filtre école).
* Les politiques d'écriture des notes vérifient en plus l'affectation
  (`teaching_assignments` pour le couple classe/matière), comme `canEditGrades` côté front.

---

## 3. Création des comptes staff (fonction serveur)

Les enseignants, économes et surveillants sont créés **uniquement** par la direction.
Dans l'application, cela passe par `services/authService.createStaffAccount`. En production :

1. Edge Function `create-staff-account` (service role, jamais appelée depuis le navigateur).
2. Elle vérifie que l'appelant est `directeur` **de l'école de la requête**.
3. Elle appelle `supabase.auth.admin.createUser({ email, password, user_metadata, app_metadata })`
   avec `app_metadata = { role, school_id }`.
4. Le mot de passe temporaire n'est **jamais stocké** : il est renvoyé une seule fois à la direction,
   qui le transmet (copie ou WhatsApp). `must_change_password = true` est positionné dans le profil.
5. La connexion force `updateUser({ password })` avant tout accès à l'application
   (équivalent du `MustChangePasswordGuard`).

```ts
// edge/functions/create-staff-account/index.ts (résumé)
const { data: caller } = await supabase.auth.getUser(jwt);
if (caller.app_metadata.role !== "directeur") return new Response("Interdit", { status: 403 });
// school_id vient du token, jamais du corps de la requête
const { data, error } = await admin.auth.admin.createUser({
  email,
  password: tempPassword,
  app_metadata: { role, school_id: caller.app_metadata.school_id },
});
```

---

## 4. Activation de l'abonnement et génération du matricule

Le mobile money et le webhook de paiement ont été retirés (migration `00016`).
L'activation est désormais **manuelle par le support**, avec la clé `service_role`.

1. Le directeur crée son école. Le matricule est `NULL` ; il doit être attribué à
   l'activation pour que les familles puissent retrouver l'école avec ce code.
2. Le support encaisse le paiement, puis appelle la RPC :

   ```sql
   select public.activate_school_subscription(
     p_school_id  => '<uuid école>',
     p_plan_id    => 'pro',
     p_cycle      => 'yearly',
     p_amount_paid => 300000,
     p_payment_ref => 'RECU-2026-0001',
     p_method     => 'especes'
   );
   ```

3. La RPC, dans une transaction et sous verrou :
   * valide la formule (`plans`) et le cycle (`monthly`/`yearly`) ;
   * crée ou prolonge l'abonnement (`starts_at`, `ends_at`, `student_limit = plans.student_limit`) ;
   * si `schools.matricule IS NULL`, génère le code et l'écrit
     (5 caractères, alphabet `23456789ABCDEFGHJKLMNPQRSTUVWXYZ`, unicité vérifiée) ;
   * journalise `subscription_events` et `audit_log`.
4. Le directeur récupère son matricule par lecture seule de `schools` — il ne peut pas l'écrire.

Conséquences :

* Le matricule **n'existe pas** avant l'activation (invariant : `NULL` ⇒ école non activée).
* Le matricule **ne change pas** au renouvellement (`only insert if NULL`).
* Le client ne peut pas fabriquer un abonnement : la RPC est révoquée pour
  `anon`/`authenticated` et réservée à `service_role`.
* La limite d'élèves est appliquée **avant** l'approbation d'une demande
  (`count(students) < subscription.student_limit`) ; sinon 403 « changez de formule ».

---

## 5. Mots de passe

* **Aucun mot de passe ni empreinte en clair dans le front.** Le code actuel
  (`utils/passwordHash.ts`) est une simulation déterministe destinée à la démo : il
  s'exécute dans le navigateur et ne protège rien.
* En production : `auth.users.encrypted_password` (bcrypt via Supabase Auth), jamais lisible
  par le client, jamais renvoyé par une politique RLS.
* Les mots de passe temporaires des enseignants sont générés côté serveur et affichés une seule fois.

---

## 6. Points volontairement omis dans la démo

* **QR code** du matricule : génération sans dépendance possible mais volumineuse ; à ajouter
  plus tard (`qrcode` ou `qrcode.react`) si le besoin se confirme.
* **WebSocket temps réel** : la messagerie se rafraîchit par événement local (`ec:messages`).
  En production : Supabase Realtime, filtré par `school_id`.
* **Limitation de débit** sur la vérification de matricule et la connexion (à mettre en place
  côté Edge Functions avant la mise en production).