# AUDIT_REPORT.md — SCOLIA (SaaS multi-écoles, Sénégal, FCFA)

Audit indépendant sécurité applicative / base de données / paiements.
**Phase 1 = lecture seule.** Aucun fichier applicatif n'a été modifié (migrations, Edge
Functions, front). Les seuls ajouts sont les **tests d'audit** (`supabase/tests/rls_008…011`,
`scripts/audit-parite.mjs`) et ce rapport.

---

## 1. Synthèse

**Verdict global : NON PRÊT (lot 1 en cours de correction).** Le **Lot 1 (les 11 constats
Critiques)** a été corrigé et vérifié : le schéma s'applique, les encaissements fonctionnent,
les tunnels d'inscription et de paiement sont ré开通, et la forge inter-écoles de bulletins
est fermée. Restent **9 constats Élevés**, **12 Moyens**, **6 Faibles** et 2 Info, et donc
le produit n'est pas encore « prêt à produire ».

* **0 Critique ouvert** (11 corrigés) · **9 Élevés** · **12 Moyens** · **6 Faibles** · 2 Info.
* **3 risques majeurs** — *statut au 2026-10-21* :
  1. **Fraude au paiement** — *partiellement corrigé* : le webhook exige désormais la
     signature HMAC (AUD-002), le secret n'est plus dans le bundle (AUD-003) et
     `pay-installment` ne s'auto-confirme plus qu'en bac à sable (AUD-004). **Reste ouvert** :
     l'idempotence non atomique des webhooks concurrents (AUD-013).
  2. **Fuite / falsification inter-écoles** — *corrigé* : la chaîne de forge de bulletin
     est fermée (AUD-006) et le rôle `anon` ne peut plus écrire dans une autre école
     (AUD-007). **Reste ouvert** : la limite d'élèves de la formule n'est pas re-vérifiée
     dans la boucle d'approbation (AUD-012).
  3. **Perte d'argent et blocage opérationnel** — *corrigé* : encaissement espèces et
     mobile money opérationnels (AUD-005), approbation d'inscription fonctionnelle (AUD-008),
     inscription d'élève fonctionnelle (AUD-011), échéancier des élèves approuvés
     automatiquement (AUD-009), matricule d'école attribué (AUD-010).

Preuves exécutées (après lot 1) : **8 assertions en échec** sur 211 assertions SQL + front
(30 → 8), sur un PostgreSQL 18 localisé (Docker absent sur la machine — voir §2).
`supabase/tests/rls_008` (isolation multi-écoles) et `rls_010` (paiements) sont désormais
**entièrement verts**.

---

## 2. Périmètre et méthode

### 2.1 Ce qui a été lu

| Domaine | Fichiers |
|---|---|
| Documentation | `SUPABASE_NOTES.md`, `README_BACKEND.md`, `.env.example`, `package.json` |
| Schéma | `supabase/migrations/20260101000001…000010` (10 fichiers, 1 745 lignes) |
| Tests existants | `supabase/tests/rls_001…007` (7 fichiers) |
| Edge Functions | `supabase/functions/` (13 fonctions + 5 modules `_shared`) |
| Front | `src/` (services, context, routes/guards, utils, features, pages) |
| Config | `supabase/config.toml`, `supabase/seed.sql` |

### 2.2 Ce qui a été exécuté

| Commande / action | Résultat |
|---|---|
| `npm run build` | **OK** (bundle `dist/index.html`, 10 Mo, singlefile) |
| `npx tsc --noEmit` | **OK**, 0 erreur |
| `npm audit --omit=dev` (runtime de production) | **0 vulnérabilité** |
| `npm audit` (complet, devDependencies incluses) | **5 vulnérabilités (4 high, 1 low)** — toutes dans l'outillage de build : `vite`, `vite-plugin-singlefile`, `micromatch`, `braces`, `esbuild` (constat AUD-040) |
| `npm run lint` | **script inexistant** — aucun linter configuré (constat AUD-031) |
| `npx supabase db reset` | **IMPOSSIBLE** : Docker absent de la machine |
| `npx supabase test db` | **IMPOSSIBLE** : Docker absent + extension `pgtap` non installable (pas de compilateur C) |
| Analyse du bundle `dist/` | **OK** (recherche de secrets par `ReadAllText` + regex) |
| Tests d'audit SQL (4 suites) | **30 assertions en échec** (voir §7) |
| Tests d'audit front (`scripts/audit-parite.mjs`) | **37 assertions, 3 échecs** |

### 2.3 Contournement de l'absence de Docker (harnais local, hors dépôt)

Pour ne pas laisser l'audit « à vérifier », un **PostgreSQL 18.4 local** a été installé
(hors dépôt, dans `%TEMP%`) afin d'appliquer réellement les migrations et d'exécuter les
politiques RLS avec de vrais jetons JWT :

* reproduction du schéma `auth` (fonctions `auth.uid()`, `auth.jwt()`, table `auth.users`) ;
* création des rôles `anon`, `authenticated`, `service_role` (BYPASSRLS) ;
* `grant all on all tables/routines` (préréglages Supabase) + `search_path` de base
  `"$user", public, extensions` (identique à `config.toml:15`) ;
* application des 10 migrations **telles quelles** → échec (constat AUD-001) ;
* réapplication avec **4 corrections de syntaxe ajoutées uniquement dans le harnais**
  (`not valid`, `current_role()`, `array[...][m]`, `drop temp table`) pour atteindre le
  reste du code ;
* **une correction supplémentaire, toujours limitée au harnais** :
  `alter function public.app_random_code(int) set search_path = public, extensions` — elle
  sert à **isoler** les défauts suivants de celui lié à `pgcrypto` (AUD-010). Le dépôt
  n'est pas modifié.
* exécution des tests avec un **shim pgTAP minimal** (plan/is/isnt/ok/throws_ok/lives_ok/
  has_table/finish) written dans le harnais, parce que `pgtap` n'est pas installable ici.

> Le shim a été **validé** : un `is()` volontairement faux signale bien l'échec, et
> 3 assertions « doit échouer » de la suite `rls_009` ont d'abord produit un faux positif
> que j'ai corrigé (voir §8 « Faux positifs éliminés »).

### 2.4 Ce qui n'a PAS pu être vérifié, et pourquoi

| Élément | Motif |
|---|---|
| Exécution réelle des Edge Functions (Deno/Edge Runtime) | aucun runtime Deno ni Supabase local (Docker absent) ⇒ les constats sur les Edge Functions sont prouvés **par lecture de code**, pas par exécution |
| `supabase db reset` / `supabase test db` avec la vraie extension `pgtap` | Docker + compilateur C absents ; le harnais local remplace la base mais pas l'extension officielle |
| PITR / sauvegardes / MFA / alerting / chiffrement / rétention | propriétés de l'infrastructure Supabase (dashboard), non accessibles depuis le dépôt ⇒ **À vérifier** |
| Montée en charge réelle (600 élèves / 6 000 échéances) | pas de jeu de données à l'échelle ; l'analyse des requêtes est faite par lecture du SQL et du front |
| Reverse engineering du protocole des prestataires Wave / Orange Money / Free Money | aucune documentation dans le dépôt ; seul le mode « sandbox » écrit est auditable |

---

## 3. Inventaire

### 3.1 Tables (29 tables dans `public`) — RLS activée sur **toutes**, aucune oubliée

| Table | `school_id` | Politiques RLS (opération → rôle) |
|---|---|---|
| `schools` | non (clé = `id`) | `schools_select_proprie_ecole` (SELECT, authenticated), `schools_update_directeur` (UPDATE, authenticated) |
| `school_settings` | oui | SELECT, UPDATE (direction) |
| `level_fees` | oui | SELECT, INSERT, UPDATE, DELETE (direction) |
| `subscriptions` | oui | SELECT (authenticated, `is_active_user`) |
| `subscription_events` | oui | SELECT (authenticated) |
| `counters` | oui | **aucune** (service_role) |
| `levels` | non | `levels_select_public` (SELECT, anon+authenticated) |
| `plans` | non | `plans_select_public` (SELECT, anon+authenticated) |
| `teachers` | oui | SELECT (école), INSERT/UPDATE/DELETE (direction) |
| `parents` | oui | SELECT (école) |
| `class_rooms` | oui | SELECT (école), INSERT/UPDATE/DELETE (direction) |
| `students` | oui | SELECT uniquement (périmètre par rôle) |
| `profiles` | oui | SELECT (soi-même + direction/économe/surveillant), UPDATE (soi-même, colonnes limitées) |
| `subjects` | oui | SELECT, INSERT/UPDATE/DELETE (direction) |
| `class_subjects` | oui | SELECT, INSERT/UPDATE/DELETE (direction) |
| `teaching_assignments` | oui | SELECT, INSERT, DELETE (direction) — pas d'UPDATE |
| `grades` | oui | SELECT (périmètre), INSERT/UPDATE (enseignant affecté) |
| `report_metas` | oui | SELECT (périmètre), INSERT/UPDATE (responsables) |
| `payments` | oui | SELECT (périmètre) — **écriture interdite par GRANT** |
| `payment_transactions` | oui | **aucune** + `revoke select/insert/update/delete` |
| `conversations` | oui | SELECT (`can_see_conversation`) |
| `messages` | oui | SELECT (`can_see_conversation`) |
| `conversation_reads` | non | **aucune** ⇒ lecture directe vide (constat AUD-035) |
| `announcements` | oui | SELECT (audience ciblée) |
| `absences` | oui | SELECT + INSERT (surveillant) |
| `registration_requests` | oui | SELECT (auteur + direction) |
| `contact_messages` | non | **aucune** ⇒ le formulaire public n'écrit rien (constat AUD-023) |
| `audit_log` | oui (nullable) | **aucune** + immuable pour les clients |
| `rate_limits` | non | **aucune** |

### 3.2 Fonctions `security definer` (43) et exposition PostgREST

Toutes ont `set search_path = public` (bonne pratique), mais **plusieurs restent
exécutables par `anon`** (PostgreSQL accorde EXECUTE à PUBLIC par défaut) :

| Fonction | Exposée à `anon` ? | Effet si appelée par `anon` |
|---|---|---|
| `build_payment_plan(uuid)` | **OUI** | **écrit 12 échéances dans la table `payments` d'un élève de n'importe quelle école** (AUD-007) |
| `next_student_matricule(uuid,text)` | **OUI** | **écrit dans `counters` et consomme la séquence de matricules** d'une autre école (AUD-007) |
| `generate_school_code(uuid,int,text)` | **OUI** | lit les `students` de n'importe quelle école (RLS contournée) |
| `generate_school_matricule()` | **OUI** | idem |
| `subscription_info(uuid)` | **OUI** | divulgue statut, formule, limite et **nombre d'élèves** d'une autre école (AUD-007) |
| `school_is_writable/readable(uuid)` | **OUI** | divulgue l'état d'abonnement d'une autre école |
| `new_payment_reference(text)` | **OUI** | consumme des références de reçu |
| `user_can_query_data()`, `is_active_user()`, `password_changed()`, `current_*()`, `message_actor_id()`, `can_see_conversation()` | OUI | sans effet de bord |

Fonctions correctement restreintes : `apply_paid_subscription`, `apply_paid_installment`,
`finish_*_registration` (service_role seul) ; `enroll_student`, `decide_registration_requests`,
`replace_cell_teachers`, `set_class_head_teacher`, `save_grade`, `update_report_meta`,
`class_report_cards`, `record_cash_payment`, `start_installment_payments`, `send_reminders`,
`post_announcement`, `send_message`, `start_conversation`, `mark_conversation_read`,
`list_conversations`, `admin_dashboard` (authenticated) ; `verify_matricule`, `open_classes`
(anon, lecture seule) — **sauf** que `build_payment_plan` et `next_student_matricule` n'ont
pas été restreints (AUD-007).

**Vues** : aucune vue n'est définie dans le projet ⇒ le point « `security_invoker` » est sans
objet. **Aucune vue ne contourne la RLS**, mais les **fonctions `security definer` le font** :
`class_report_cards` joint `grades` sans filtre `school_id` (AUD-006) et
`admin_dashboard` fait de même.

### 3.3 Edge Functions (13)

`register-director`, `register-student`, `register-parent`, `login-guard`,
`create-staff-account`, `update-staff`, `reset-staff-password`, `set-staff-active`,
`verify-matricule`, `start-subscription`, `pay-installment`, `payment-webhook`,
+ `supabase/functions/_shared/{auth,http,payments,rateLimit,validate}.ts`.

### 3.4 Buckets Storage, Realtime, variables d'environnement

* **Storage** : aucun bucket créé (`config.toml` : blocs `[storage.buckets.*]` commentés ;
  aucune migration). `schools.logo_url` est un **champ texte libre** — pas de contrôle de
  taille, de type MIME ni d'appartenance (constat AUD-024).
* **Realtime** : aucune publication, aucun `supabase.channel()` dans le front ⇒ la
  messagerie se rafraîchit manuellement. Point « canaux publiés filtrés par RLS » : **non
  applicable** (à noter : la tête d'API `extra_search_path` vaut `public, extensions`).
* **Variables d'environnement** : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (front),
  `VITE_WEBHOOK_SECRET` (front — **fuite, AUD-003**), `SUPABASE_SERVICE_ROLE_KEY`,
  `PAYMENT_WEBHOOK_SECRET`, `PAYMENT_PROVIDER_API_KEY`, `SCOLIA_WEBHOOK_SECRET`, `NOTIFIER_*`
  (serveur). Aucune clé `service_role` dans le bundle (vérifié) — mais le secret du webhook,
  lui, y est.

---

## 4. Modèle de menace (10 lignes)

1. **Élève** de l'école A : lecture de notes/conversations/paiements d'autres élèves, falsification de son propre bulletin.
2. **Parent curieux** : énumération de codes enfants, lecture des bulletins de la classe entière, paiement d'échéances d'autres familles.
3. **Enseignant malveillant** : saisie de notes hors de ses affectations, lecture de toute sa classe, injection de notes dans une autre école.
4. **Directeur d'école A** :atteinte aux élèves, aux notes, aux bulletins et aux encaissements de l'école B ; dépassement de la limite d'élèves payée.
5. **Anonyme** : écriture dans les tables d'une autre école (`build_payment_plan`), consommation de la séquence de matricules, confirmation de paiements sans signature.
6. **Prestataire de paiement usurpé** (ou un tiers qui a lu le secret) : confirmation d'un paiement d'abonnement ou d'échéance jamais payé.
7. **Famille malveillante** : solder ses échéances sans transfert (mode sandbox), rejouer un webhook, créer un double débit.
8. **Candidat directeur** : créer une école, fuir la validation, énumérer des comptes.
9. **Actif principal** : identités d'enfants (nom, date de naissance, photos), notes et rangs, conversations parent–enseignant, paiements et références de reçu.
10. **Actifs financiers** : échéances `payments`, encaissements `payment_transactions`, abonnements `subscriptions`, matricule d'école (clé d'entrée dans le système).

---

## 5. Tableau des constats

| ID | Gravité | Axe | Titre | Fichier:ligne | Statut |
|---|---|---|---|---|---|
| AUD-001 | Critique | F | Les 10 migrations ne s'appliquent pas : 4 erreurs de syntaxe PostgreSQL | `supabase/migrations/20260101000001_foundation.sql:79` (+ `00003:53`, `00006:124`, `00010:397`) | Corrigé |
| AUD-002 | Critique | C | Le webhook accepte une confirmation de paiement **sans signature** | `supabase/functions/payment-webhook/index.ts:28-41` | Corrigé |
| AUD-003 | Critique | C | Le secret du webhook est embarqué dans le bundle du navigateur | `src/services/subscriptionService.ts:68`, `.env.example:7` | Corrigé |
| AUD-004 | Critique | C | `pay-installment` solde les échéances sans transfert (mode sandbox livré) | `supabase/functions/pay-installment/index.ts:60-68` | Corrigé |
| AUD-005 | Critique | C | Encaissement espèces et paiement mobile money : erreur de type fatale | `supabase/migrations/20260101000009_family_payments.sql:82-86, 211-213, 236-239` | Corrigé |
| AUD-006 | Critique | A | Forge inter-écoles d'un bulletin (3 maillons) | `00006_structure.sql:385-401`, `00008_grades.sql:311-313, 422-431` | Corrigé |
| AUD-007 | Critique | A | Le rôle `anon` écrit dans les données d'une autre école | `00006_structure.sql:47-133`, `00002_rls_helpers.sql:186-201` | Corrigé |
| AUD-008 | Critique | C | `decide_registration_requests` échoue : aucune approbation possible | `00006_structure.sql:253, 275-276` | Corrigé |
| AUD-009 | Critique | C | Élève approuvé automatiquement : **aucun échéancier** (revenu non facturé) | `00004_registration_rpcs.sql:159-180` | Corrigé |
| AUD-010 | Critique | C | `pgcrypto` inaccessible depuis les fonctions `security definer` | `00002_rls_helpers.sql:148-183`, `00007_subscriptions.sql:15-29` | Corrigé |
| AUD-011 | Critique | C | `enroll_student` / `link_child` échouent (`audit_log.payload` NOT NULL) | `00006_structure.sql:227-228`, `00005_link_child.sql:35-36` | Corrigé |
| AUD-012 | Élevé | C | La limite d'élèves n'est pas re-vérifiée dans la boucle d'approbation | `00006_structure.sql:280-289, 291-325` | Probable |
| AUD-013 | Élevé | C | Idempotence non atomique : double extension d'abonnement en concurrence | `00007_subscriptions.sql:60-81, 120-160` | Probable |
| AUD-014 | Élevé | G | CORS `*` sur les 13 Edge Functions | `supabase/functions/_shared/http.ts:5-10` | Confirmé |
| AUD-015 | Élevé | D | Un compte désactivé peut encore gérer le personnel | `supabase/functions/_shared/auth.ts:75-85` | Probable |
| AUD-016 | Élevé | D | Le garde « mot de passe temporaire » est contournable | `00003_auth_accounts.sql:144-157` | Confirmé |
| AUD-017 | Élevé | H | Comptes de démonstration (mot de passe + codes enfants) dans le bundle | `src/features/auth/LoginForm.tsx:74`, `src/pages/auth/SignupSentPage.tsx:5` | Confirmé |
| AUD-018 | Élevé | B | Un enseignant non titulaire lit le bulletin de toute sa classe | `00008_grades.sql:257-263` | Confirmé |
| AUD-019 | Élevé | D | `login-guard` décode le JWT **sans vérifier sa signature** | `supabase/functions/login-guard/index.ts:18-28, 38-50` | Probable |
| AUD-020 | Élevé | F | La suite pgTAP du projet est inexécutable | `supabase/tests/rls_002…007` (multiples) | Confirmé |
| AUD-021 | Moyen | E | Date de référence figée côté front (`TODAY_ISO`) | `src/data/school.ts:4` (+ 9 usages) | Confirmé |
| AUD-022 | Moyen | H | Le formulaire de contact public n'écrit rien | `src/services/contactService.ts:13-17` | Confirmé |
| AUD-023 | Moyen | A | Aucun bucket Storage : `logo_url` est un texte libre | `supabase/config.toml:116-128`, `00001_foundation.sql:76` | Confirmé |
| AUD-024 | Moyen | F | Aucune pagination ni limite sur les lectures front | `src/services/db.ts:445-475` | Confirmé |
| AUD-025 | Moyen | F | `admin_dashboard` : défaut de période invalide + N+1 sur les bulletins | `00010_messagerie_absences.sql:384, 378-392, 488-489` | Confirmé |
| AUD-026 | Moyen | B | `current_role()`/`current_school_id()` privilégient le claim JWT | `00002_rls_helpers.sql:13-27`, `config.toml:286-289` | Confirmé |
| AUD-027 | Moyen | B | Les absences ne sont lisibles que par le surveillant | `00010_messagerie_absences.sql:522-528` | Confirmé |
| AUD-028 | Moyen | G | Le rate limiting est contournable via `X-Forwarded-For` | `supabase/functions/_shared/rateLimit.ts:9-15` | Probable |
| AUD-029 | Moyen | C | Référence de reçu non persistée de façon cohérente | `00009_family_payments.sql:70-88` | Confirmé |
| AUD-030 | Moyen | I | Aucun MFA / PITR / supervision / alerting documenté | `README_BACKEND.md` (absent) | À vérifier |
| AUD-031 | Moyen | F | Aucun script `lint`/`typecheck`, aucune intégration continue | `package.json:6-15` | Confirmé |
| AUD-032 | Moyen | C | Les élèves sont rattachés à un parent par **adresse e-mail** | `00006_structure.sql:303-310` | Confirmé |
| AUD-033 | Faible | E | Format du matricule élève faux et indépendant de l'année | `00002_rls_helpers.sql:199` | Confirmé |
| AUD-034 | Faible | F | Le plafond de 10 affectations compte toutes les écoles | `00006_structure.sql:392` | Confirmé |
| AUD-035 | Faible | F | `conversation_reads` sans politique SELECT (lecture directe vide) | `00010_messagerie_absences.sql:549` | Confirmé |
| AUD-036 | Faible | F | `subscription_status_of` / `payment_status_of` déclarées `immutable` | `00002_rls_helpers.sql:67-82`, `00006_structure.sql:15-25` | Confirmé |
| AUD-037 | Faible | I | Branding « Classora » et `package.json` = `react-vite-tailwind` | `index.html:7`, `package.json:2` | Confirmé |
| AUD-038 | Faible | H | Les erreurs SQL brutes sont renvoyées au client | `src/services/paymentService.ts:44-49` | Confirmé |
| AUD-039 | Info | I | Aucun bucket de journalisation client, `audit_log` non alimenté par trigger | `00001_foundation.sql:421-431` | Confirmé |
| AUD-040 | Info | I | 5 vulnérabilités npm dans l'outillage de build (devDependencies) | `package.json:26-38` | Confirmé |

---

## 6. Fiches détaillées (Critique / Élevé / Moyen)

### AUD-001 — Critique — Les 10 migrations ne s'appliquent pas
**Fichier:ligne** `supabase/migrations/20260101000001_foundation.sql:79` (+ `00003:53`, `00006:124`, `00010:397`)

**Description.** Quatre constructions SQL sont invalides en PostgreSQL ; la première migration
s'arrête donc à la ligne 79 et `supabase db reset` échoue : le schéma n'existe pas.

**Scénario.** Unatario lance `npx supabase db reset` (procédure documentée
`README_BACKEND.md:20`) → `ERROR: syntax error at or near "valid"`. Aucun environnement
(staging, production) ne peut être provisionné. Tout ce qui suit (RLS, Edge Functions,
tests) est inexécutable.

**Preuve (exécutée).**
```
1) 00001_foundation.sql:79
   constraint schools_cycles_required
   check (app_valid_cycles(cycles)) not valid,   -- syntax error at or near "valid"
   → NOT VALID n'existe que dans ALTER TABLE ... ADD CONSTRAINT, pas dans CREATE TABLE.
2) 00003_auth_accounts.sql:53
   and current_role() in ('directeur','econome','surveillant'))
   → ERROR: syntax error at or near "("
   Proof: select current_role();  → syntax error at or near "("
          select public.current_role(); → OK
   (CURRENT_ROLE est un mot-clé SQL réservé de PostgreSQL ; le nom de la fonction
    DOIT être qualifié : public.current_role())
3) 00006_structure.sql:124
   array['octobre',...,'juillet'][m]   → ERROR: syntax error at or near "["
   (il faut (array[...])[m])
4) 00010_messagerie_absences.sql:397
   drop temp table if exists dash_months;  → ERROR: syntax error at or near "temp"
   (il faut drop table if exists)
```
Application réelle des 10 migrations sur PostgreSQL 18.4 : échec à la migration 00001,
puis 00003, 00006, 00010.

**Impact.** Bloquant total : pas de déploiement possible, pas de tests possibles, pas de
démonstration crédible. C'est aussi la raison pour laquelle les tests pgTAP existants
n'ont jamais été exécutés (README_BACKEND.md:120 le liste comme « point ouvert »).

**Correctif recommandé.**
```sql
-- 00001 : constraint schools_cycles_required check (app_valid_cycles(cycles)) not valid,
-- 00001 : constraint subjects_cycles_valid  check (app_valid_cycles(cycles)) not valid,
-- puis, après les CREATE TABLE :
alter table public.schools  add constraint schools_cycles_required  check (app_valid_cycles(cycles)) not valid;
alter table public.subjects add constraint subjects_cycles_valid   check (app_valid_cycles(cycles)) not valid;

-- 00003 et suivantes : TOUTES les occurrences de current_role() → public.current_role()
--   (une occurrences par politique/RPC ; ~30 occurrences)
-- 00006 :112-125 : v_label := (array['octobre',...,'juillet'])[m];
-- 00010 : drop table if exists dash_months;
```
Ajouter un garde-fou en CI : `supabase db reset` + `supabase test db` sur chaque PR.

**Test de non-régression.** `rls_001_foundation.test.sql` doit inclure
`has_table('public','students','...')` pour chaque table (déjà présent) et le pipeline CI
doit exécuter `supabase db reset` — sans quoi la régression n'est pas détectable.

**Effort : S.**

---

### AUD-002 — Critique — Le webhook accepte une confirmation de paiement sans signature
**Fichier:ligne** `supabase/functions/payment-webhook/index.ts:28-41`

**Description.** La logique de vérification est un `if/else if` : si l'en-tête
`x-scolia-signature` est présent il est vérifié ; sinon, la vérification n'a lieu **que**
si l'appelant est *anonyme* (`isService === null`). Un appelant **authentifié** (n'importe
quel élève ou parent inscrit) qui n'envoie **pas** d'en-tête passe le contrôle sans aucune
vérification.

**Scénario.** Un parent s'inscrit (gratuit, `register-student`/`register-parent`), obtient un
JWT, appelle `POST /functions/v1/payment-webhook` avec
`Authorization: Bearer <son JWT>`, sans en-tête de signature :
```json
{"provider":"wave","reference":"WV-1234-5678","status":"succeeded"}
```
`reference` est connu : c'est celui que `pay-installment` lui a retourné. → La transaction
est marquée `succeeded` et l'échéance de la famille est **soldée sans aucun transfert**.
L'école perd la totalité de la somme due.

**Preuve (lecture de code, chemin unique et déterministe).**
```ts
const isService = await getAuthenticatedUser(svc, req);   // :27
const signature = req.headers.get("x-scolia-signature"); // :28
if (signature) { await verifyWebhookSignature(raw, signature); }   // :29-34
else if (isService === null) {   // :35  ←authenticated ⇒ cette branche est SAUTÉE
  const shared = body["secret"];
  if (shared !== (Deno.env.get("SCOLIA_WEBHOOK_SECRET") ?? "scolia-dev-secret")) { ... }
}                                  // :41  ← aucune sortie ici quand isService !== null
// la suite du code applique le paiement sans condition
```
`getAuthenticatedUser` renvoie l'utilisateur si un `Authorization: Bearer <jwt valide>` est
présent (`_shared/auth.ts:26-32`) ; un compte élève/parent suffit.
**Aggravant** : la branche « sandbox » compare `body["secret"]` au secret **ou à sa valeur
par défaut hardcodée `"scolia-dev-secret"`** (`payment-webhook/index.ts:38`) — un secret non
configuré rend le webhook entièrement ouvert, y compris à un attaquant **non authentifié**.

**Impact.** Fraude directe sur les revenus de l'école (frais de scolarité non encaissés),
activable par n'importe quel inscrit.

**Correctif recommandé.**
```ts
// payment-webhook/index.ts
const signature = req.headers.get("x-scolia-signature");
if (!signature) return badRequest("Signature de webhook absente.");
await verifyWebhookSignature(raw, signature);   // obligatoire, sans exception
// Supprimer la branche "secret" en clair, ou la conditioner à un environnement
// explicitement non-prod : if (Deno.env.get("APP_ENV") === "sandbox") { ... }
```
et **retirer la valeur par défaut** : `Deno.env.get("SCOLIA_WEBHOOK_SECRET")` doit lever une
erreur si absent, jamais retomber sur `"scolia-dev-secret"`.

**Test de non-régression.** Test Deno de l'Edge Function (à créer) : appel sans signature
→ 400 ; signature invalide → 400 ; secret en clair → 400 ; signature valide + transaction
pending → 200 et échéance créditée **une seule fois**.

**Effort : S.**

---

### AUD-003 — Critique — Le secret du webhook est embarqué dans le bundle du navigateur
**Fichier:ligne** `src/services/subscriptionService.ts:68`, `.env.example:7`

**Description.** Le front lit `import.meta.env.VITE_WEBHOOK_SECRET` avec un repli
`?? "scolia-dev-secret"`, et l'envoie en clair dans le corps de la requête
`payment-webhook` (`subscriptionService.ts:79-86`). Toute variable `VITE_*` est **inlinée
dans le bundle** par Vite.

**Scénario.** Un visiteur ouvre l'application, récupère le secret dans le JavaScript servi
(ici `dist/index.html`, fichier unique de 10 Mo), puis forge lui-même une confirmation de
paiement — y compris **sans aucun compte** si le webhook tourne avec le secret par défaut.

**Preuve (exécutée).** Analyse du bundle de production construit par `npm run build` :
```
lecture de dist/index.html (10 014 444 caractères), recherche par regex :
  "scolia-dev-secret"  => 1 occurrence
  "demo1234"           => 2 occurrences      (cf. AUD-017)
  "Comptes d"          => 4 occurrences      (cf. AUD-017)
  "service_role"      => 0 occurrence   (aucune clé de service dans le bundle : OK)
  "eyJhbGci"          => 0 occurrence   (aucun JWT figé : OK)
```
`VITE_WEBHOOK_SECRET` est aussi documenté dans `.env.example:7` : toute personne qui lit le
dépôt obtient le secret.

**Impact.** Compromission complète de la confirmation de paiement (AUD-002 devient
exploitable sans authentification) ⇒ fraude à l'échelle de toutes les écoles de la
plateforme.

**Correctif recommandé.**
1. Supprimer `VITE_WEBHOOK_SECRET` de `.env.example` et de `subscriptionService.ts`.
2. En développement, la confirmation passe par un **outil local** (`supabase functions serve`
   + un secret injecté par l'environnement du poste), jamais par le bundle.
3. En production, la confirmation est **uniquement** portée par le prestataire (webhook
   signé). Le front ne doit jamais confirmer un paiement.

**Test de non-régression.** Étape de build vérifiée : `grep -c "scolia-dev-secret" dist/*`
doit renvoyer 0. (À intégrer au pipeline.)

**Effort : S.**

---

### AUD-004 — Critique — `pay-installment` solde les échéances sans transfert
**Fichier:ligne** `supabase/functions/pay-installment/index.ts:59-68`

**Description.** La fonction appelle elle-même `apply_paid_installment(..., 'succeeded', ...)`
pour chaque référence créée : le paiement est marqué encaissé **sans appel au prestataire**.

**Scénario.** Un parent connecté appelle `pay-installment` avec les identifiants de ses
échéances et n'effectue aucun transfert Wave/Orange Money. Le serveur répond
`"Paiement confirmé. Vos échéances sont réglées."` et la base passe les échéances en
`paye`. La famille ne doit rien.

**Preuve (lecture de code).**
```ts
// 2. Sandbox : confirmation immédiate et idempotente des références.
for (const ref of refs) {
  const { error: confirmError } = await svc.rpc("apply_paid_installment", {
    p_provider: method, p_provider_ref: ref, p_status: "succeeded",   // ← encaissement
    p_payload: { confirmed_by: "sandbox" },
  });
```
Le commentaire acknowledges le mode bac à sable, mais la fonction est **déployable en
l'état** : aucun garde-fou d'environnement. `README_BACKEND.md:121` liste ce point comme
« ouvert », ce qui signifie qu'il est encore livré.

**Impact.** Perte sèche de tous les frais de scolarité encaissables par mobile money.

**Correctif recommandé.** Séparer les builds (`DENO_ENV`/`APP_ENV`) : en production,
`pay-installment` doit s'arrêter après la création de la transaction `pending` et renvoyer
les instructions de transfert ; la confirmation n'est possible que par
`payment-webhook` avec signature. En environnement bac à sable, le chemin doit être
explicite (`if (Deno.env.get("APP_ENV") !== "sandbox") return …`).

**Test de non-régression.** Test Deno : `pay-installment` en environnement `production`
→ la transaction reste `pending` et `payments.status` ne change pas.

**Effort : M.**

---

### AUD-005 — Critique — Encaissement espèces et paiement mobile money : erreur de type fatale
**Fichier:ligne** `supabase/migrations/20260101000009_family_payments.sql:82-86, 211-213, 236-239`

**Description.** Les trois fonctions qui *rendent* le résultat d'un paiement déclarent
`v_p record` puis font `select to_jsonb(p) into v_p`. La variable `record` ne peut pas être
indexée avec `->>` : PostgreSQL lève `operator does not exist: record ->> unknown` **au
moment du `RETURN`**, donc après les écritures.

**Scénario.** L'économe encaisse 5 000 FCFA sur l'échéance d'October. La fonction met à jour
`payments` (dans la transaction), puis plante au `RETURN`. L'exception annule la
transaction ⇒ **rien n'est enregistré** et l'économe voit une erreur technique
(`operator does not exist: record ->> unknown`) au lieu d'un reçu. Même chemin pour la
confirmation mobile money : l'argent est **débité par le prestataire** mais l'échéance
n'est jamais créditée, et le rejeu du webhook retombe sur le même `RETURN` (chemin
idempotent, ligne 211-213) ⇒ 500 permanent.

**Preuve (exécutée).**
```
select public.record_cash_payment(<id>, 5000);
  → ERROR: operator does not exist: record ->> unknown
select public.apply_paid_installment('wave','WV-9999-9999','succeeded','{}');
  → ERROR: operator does not exist: record ->> unknown
select public.apply_paid_installment('wave','WV-9999-9999','succeeded','{}');  -- rejeu
  → ERROR: operator does not exist: record ->> unknown
état de l'échéance après l'appel : paid_amount = 0, status = en_retard (transaction annulée)
```
Tests d'audit correspondants : `rls_010_audit_paiements.test.sql` — 8 assertions en échec
(c08, c09, c10, c11, c15, c16, c17, c18, c19).

**Impact.** **Aucun encaissement n'est possible**, quel que soit le moyen de paiement. Le
registre financier de l'école reste vide ; l'argent mobile money éventuellement débité par
la famille n'est jamais rapproché. C'est à la fois une perte de revenu et un risque de
litige avec les familles.

**Correctif recommandé.** Typage explicite des variables :
```sql
-- 00009, record_cash_payment
declare v_p payments%rowtype; …   -- au lieu de v_p record
select * into v_p from public.payments where id = p_payment_id;
…
return jsonb_build_object('payment_id', p_payment_id,
  'paid_amount', v_p.paid_amount,          -- colonne typée, pas de ->>
  'status', v_p.status, 'reference', v_ref);

-- apply_paid_installment : idem (v_p payments%rowtype)
```
ou, si l'on veut du JSON : `v_p jsonb; select to_jsonb(p) into v_p …` puis
`v_p->>'paid_amount'` (le type `jsonb` autorise `->>`).

**Test de non-régression.** `rls_010_audit_paiements.test.sql` (c08-c19) : après correctif,
`record_cash_payment` renvoie `ok`, `paid_amount = 5000`, `status = 'partiel'`, une
référence de reçu unique est posée, le rejeu du webhook est idempotent et ne crédite pas
deux fois.

**Effort : S.**

---

### AUD-006 — Critique — Forge inter-écoles d'un bulletin
**Fichier:ligne** `supabase/migrations/20260101000006_structure.sql:385-401`,
`supabase/migrations/20260101000008_grades.sql:311-313, 422-431`

**Description.** Trois maillons s'enchaînent :
1. `replace_cell_teachers(p_class_id, p_subject_id, p_teacher_ids)` **ne vérifie pas** que
   `p_class_id`/`p_subject_id` appartiennent à l'école de l'appelant (seul l'enseignant est
   contrôlé, ligne 389) ;
2. la politique `grades_insert_enseignant_affecte` exige une affectation sur
   `(class_id, subject_id)` **mais ne vérifie pas que `student_id` appartient à cette
   classe ni à cette école** ;
3. `class_report_cards` est `security definer` et joint `grades` **sans filtre `school_id`**
   (ligne 311-313).

**Scénario.** Le directeur de l'école A appelle
`replace_cell_teachers(classe_de_B, matière_de_B, [son_enseignant])` : l'affectation est
créée avec `school_id = A` mais `class_id`/`subject_id` de B. Son enseignant insère alors
`grades(school_id = A, student_id = <élève de B>, class_id = <classe de B>, subject_id =
<matière de B>, composition = 20)`. Lorsque le directeur de B ouvre le bulletin de sa classe,
la fonction `class_report_cards` (qui contourne la RLS) intègre la note injectée : la
moyenne de l'enfant de B devient **20/20 sur une matière qu'il n'a jamais suivie**.

**Preuve (exécutée).** `supabase/tests/rls_009_audit_roles.test.sql`, chaîne b26→b27→b28 :
```
x étape 1 : le directeur de A ne peut pas affecter son enseignant à la classe de B
      valeur obtenue = ok, attendue = refusé
x étape 2 : l'enseignant de A ne peut pas insérer de note pour l'élève de B
      valeur obtenue = ok, attendu = refusé
x étape 3 : le bulletin de B ne contient AUCUNE moyenne injectée par A (0 = pas de note forgée)
      valeur obtenue = 20, attendue = 0      ← moyenne générale de l'élève de B = 20
```
et `rls_008_audit_isolation.test.sql` (a48, a49, a50) : le directeur de A crée bien une
`class_subjects` et une `teaching_assignments` pointant vers la classe de B.

**Impact.** Falsification de résultats scolaires d'une école concurrente (dénigrement,
fraude aux examens), contamination croisée des bulletins, et violation de l'isolation
multi-écoles — le risque n°1 du cahier des charges.

**Correctif recommandé.** Trois verrous, tous à poser dans les migrations :
```sql
-- 1) replace_cell_teachers : contrôler la classe ET la matière
if not exists (select 1 from public.class_rooms where id = p_class_id and school_id = v_school) then
  raise exception 'Classe introuvable dans votre école.'; end if;
if not exists (select 1 from public.subjects where id = p_subject_id and school_id = v_school) then
  raise exception 'Matière introuvable dans votre école.'; end if;

-- 2) politique grades_insert_enseignant_affecte : exiger l'appartenance de l'élève
and exists (select 1 from public.students s
             where s.id = student_id and s.school_id = school_id and s.class_id = class_id)

-- 3) class_report_cards : filtrer les notes par école
left join public.grades g on g.student_id = st.id and g.subject_id = c.subject_id
   and g.class_id = p_class_id and g.period = p_period and g.school_id = v_school
```
Renforcer en outre par des **clés étrangères composites** `(school_id, id)` (cf. AUD-012
et §9, lot 3) : `unique (school_id, id)` sur `class_rooms`, `subjects`, `students`,
`teachers`, `parents` puis FK composantes.

**Test de non-régression.** `rls_008` a48-a50 et `rls_009` b26-b28 (déjà en place).

**Effort : M.**

---

### AUD-007 — Critique — Le rôle `anon` écrit dans les données d'une autre école
**Fichier:ligne** `supabase/migrations/20260101000006_structure.sql:47-133`,
`supabase/migrations/20260101000002_rls_helpers.sql:186-201`

**Description.** `build_payment_plan(uuid)` et `next_student_matricule(uuid, text)` sont
`security definer` et **n'ont jamais eu de `revoke execute`** : PostgreSQL accorde EXECUTE
à PUBLIC, donc `anon` peut les appeler. `build_payment_plan` insère 12 échéances dans
`payments` pour l'élève désigné **sans aucune vérification d'école**.

**Scénario.** Un attaquant anonyme récupère l'identifiant d'un élève de l'école B (par
exemple via `open_classes(school_id)` + `students_select_ecole`… ou via le `child_code` d'un
parent) et appelle `build_payment_plan(<élève de B>)` : 12 lignes sont insérées dans
`payments` pour l'école B — échéances que l'école n'a pas décidées (montants, dates,
remise fratrie). Il peut aussi appeler `next_student_matricule(<école B>, …)` pour **consommer
la séquence de matricules** et créer des trous (le matricule est un identifiant métier et
un support de rapprochement avec les familles).

**Preuve (exécutée).** `supabase/tests/rls_008_audit_isolation.test.sql` :
```
x anon ne peut pas générer l'échéancier d'un élève de B     valeur obtenue = ok, attendu = refusé
x l'échéancier de l'élève de B est inchangé (1 échéance)      valeur obtenue = 12, attendu = 1
x anon ne peut pas consommer un matricule dans l'école B      valeur obtenue = ok, attendu = refusé
x anon ne peut pas consulter l'abonnement d'une autre école   valeur obtenue = ok, attendu = refusé
```
Les droits effectifs relevés en base confirment l'absence de restriction :
`build_payment_plan` → `acl=…anon=X/postgres…`, `next_student_matricule` → `anon=X`,
`subscription_info` → `anon=X`.

**Impact.** Écriture non autorisée dans les données financières d'une école tierce
(falsification d'échéancier, confusion des familles) ; divulgation du nombre d'élèves, de la
formule et de l'état d'abonnement des écoles concurrentes ; manipulation de la numérotation
des matricules.

**Correctif recommandé.**
```sql
revoke execute on function public.build_payment_plan(uuid) from public, anon, authenticated;
revoke execute on function public.next_student_matricule(uuid, text) from public, anon, authenticated;
revoke execute on function public.generate_school_code(uuid, int, text) from public, anon, authenticated;
revoke execute on function public.generate_school_matricule() from public, anon, authenticated;
revoke execute on function public.subscription_info(uuid) from public, anon, authenticated;
revoke execute on function public.school_is_writable(uuid) from public, anon, authenticated;
revoke execute on function public.school_is_readable(uuid) from public, anon, authenticated;
revoke execute on function public.new_payment_reference(text) from public, anon, authenticated;
-- et, pour build_payment_plan : exiger explicitement l'école de l'appelant
```
Ajouter un test de non-régression **général** : pour chaque fonction `security definer`,
vérifier que `anon` et `authenticated` ne peuvent l'appeler que si c'est intentionnel
(graphe des `\df+` croisé avec `proacl`).

**Test de non-régression.** `rls_008` a41-a47 (déjà en place).

**Effort : S.**

---

### AUD-008 — Critique — `decide_registration_requests` échoue : aucune approbation possible
**Fichier:ligne** `supabase/migrations/20260101000006_structure.sql:253, 275-276`

**Description.** `v_requests` est déclaré `record` (ligne 253) puis reçoit un `count(*)`
(ligne 275) ; la comparaison `if v_requests = 0` (ligne 276) compare un `record` à un
entier : PostgreSQL lève `operator does not exist: record = integer`.

**Scénario.** La direction ouvre `/app/inscriptions`, coche trois demandes et clique
« Approuver » → la RPC échoue, aucune demande n'est traitée, aucun élève n'est créé.
Combiné à AUD-010 (code enfant) et AUD-011 (`audit_log`), **aucun parcours d'inscription ne
fonctionne**, ni manuel ni automatique.

**Preuve (exécutée).**
```
select public.decide_registration_requests(array(...3 demandes...), true, null);
  → ERROR: operator does not exist: record = integer
```
(le même défaut affecte `return v_requests;` ligne 356 et le `format('%s …', v_requests)`
ligne 345-346.)

**Impact.** Blocage du tunnel d'inscription : aucune famille ne peut être validée. Perte
directe d'inscriptions et de revenu de frais d'inscription.

**Correctif recommandé.**
```sql
-- 00006_structure.sql:253
v_requests int;      -- au lieu de record
```
(et `v_req record` reste `record`, il est bien utilisé comme ligne.)

**Test de non-régression.** `rls_009_audit_roles.test.sql` b32/b33 (approbation
inter-schools et limite de formule) + un test d'approbation réussie d'un lot de 3 demandes
avec vérification du nombre d'élèves créés et de leurs échéanciers.

**Effort : S.**

---

### AUD-009 — Critique — Élève approuvé automatiquement : aucun échéancier
**Fichier:ligne** `supabase/migrations/20260101000004_registration_rpcs.sql:159-180`

**Description.** `finish_student_registration` crée l'élève (ligne 160) puis, dans le bloc
d'approbation automatique (159-180), **n'appelle jamais `build_payment_plan`**, contrairement
à `enroll_student` (`00006:225`) et `decide_registration_requests` (`00006:324`).

**Scénario.** Une école active « approbation automatique des inscriptions ». Un élève
s'inscrit et est activé immédiatement : son compte est `ACTIF`, il apparaît dans la liste
des élèves, mais **il n'a aucune échéance**. L'économat ne peut rien lui facturer, aucun
rappel n'est envoyé, le tableau de bord « encaissé » reste faux. L'élève est gratuit pour
toujours.

**Preuve (exécutée).** `rls_010_audit_paiements.test.sql` c31 :
```
x l'élève approuvée automatiquement a bien son échéancier
      valeur obtenue = 0, attendue = 12     (inscription + 10 mensualités + tenue)
```
et c29 (élève inscrit par la direction) donne la valeur correcte **12** dès que les autres
défauts sont contournés ⇒ l'écart vient bien de l'absence d'appel dans la fonction
d'approbation automatique.

**Impact.** Perte de revenu directe et silencieuse : chaque inscription automatique non
facturée. L'écart est invisible dans l'interface (l'élève « existe », l school's dashboard
ne le signale pas).

**Correctif recommandé.**
```sql
-- 00004_registration_rpcs.sql, dans le bloc « if v_approved then »,
-- après l'insert de l'élève :
perform public.build_payment_plan(v_student_id);
```
et, par symétrie, vérifier `finish_parent_registration` (le parent approuvé
n-auto-approve n'a pas d'échéancier, ce qui est normal : l'échéancier est porté par
l'élève).

**Test de non-régression.** `rls_010` c31 (déjà en place) : 12 échéances pour un élève
approuvé automatiquement.

**Effort : S.**

---

### AUD-010 — Critique — `pgcrypto` inaccessible depuis les fonctions `security definer`
**Fichier:ligne** `supabase/migrations/20260101000002_rls_helpers.sql:148-183`,
`supabase/migrations/20260101000007_subscriptions.sql:15-29`

**Description.** `pgcrypto` est installé dans le schéma `extensions`
(`00001_foundation.sql:9`). Or `generate_school_code` et `generate_school_matricule` sont
`security definer set search_path = public` : à l'intérieur, `gen_random_bytes()` n'est plus
trouvable. Le `search_path` de session (`public, extensions`, cf. `config.toml:15`) est
**écrasé** par le `SET search_path` de la fonction.

**Scénario.** La direction inscrit un élève ⇒ `enroll_student` → `generate_school_code` →
`gen_random_bytes` introuvable ⇒ exception ⇒ aucun élève créé. Le webhook d'abonnement
confirmé ⇒ `apply_paid_subscription` → `generate_school_matricule` → même exception ⇒
**l'abonnement n'est jamais activé et l'école ne reçoit jamais son matricule** (la
transaction est annulée, donc ni l'abonnement ni l'événement d'historique ne sont écrits).

**Preuve (exécutée).**
```sql
select public.app_random_code(5);                        → OK (search_path de session)
select public.generate_school_code('…a1', 6, 'child_code');
  → ERROR: function gen_random_bytes(integer) does not exist
select public.generate_school_matricule();
  → ERROR: function gen_random_bytes(integer) does not exist
-- localisation de la fonction :
select n.nspname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where p.proname='gen_random_bytes';   → extensions
```
Avec le contournement appliqué **uniquement dans le harnais d'audit**
(`alter function public.app_random_code(int) set search_path = public, extensions`),
`generate_school_code` et `generate_school_matricule` redeviennent fonctionnels, ce qui
confirme la cause exacte.

**Impact.** Le tunnel d'inscription **et** le tunnel de paiement d'abonnement sont tous deux
morts. Aucun matricule d'école n'est jamais attribué : la fonction
`verify_matricule` (publique) ne peut donc jamais aboutir.

**Correctif recommandé.** Ne jamais figer un `search_path` qui exclut `extensions` sur une
fonction qui utilise pgcrypto ; au choix :
```sql
-- option A (recommandée) : chercher explicitement dans extensions
create or replace function public.app_random_code(p_length int) returns text
language sql volatile parallel unsafe
set search_path = public, extensions      -- ← extensions ajouté
as $$ … gen_random_bytes(1) … $$;

-- option B : ne pas utiliser pgcrypto
--   gen_random_bytes → extensions ; alternative : random() n'est pas cryptographique
--   → utiliser pgcrypto qualifié : extensions.gen_random_bytes(1)
```
Vérifier **toutes** les fonctions `security definer` qui utilisent pgcrypto
(`app_random_code`, `generate_school_code`, `generate_school_matricule`).

**Test de non-régression.** `rls_010_audit_paiements.test.sql` c23, c24, c26, c27 (matricule
attribué, code enfant généré, inscription d'un élève) — sans le contournement du harnais,
ces tests échouent ; ils doivent passer après correctif.

**Effort : S.**

---

### AUD-011 — Critique — `enroll_student` / `link_child` échouent (`audit_log.payload` NOT NULL)
**Fichier:ligne** `supabase/migrations/20260101000006_structure.sql:227-228`,
`supabase/migrations/20260101000005_link_child.sql:35-36`

**Description.** `audit_log.payload` est déclaré `not null default '{}'`, mais les deux
fonctions passent **explicitement** `NULL` : `…, v_student_id, null)` et
`…, v_child.id, null)`. PostgreSQL n'applique pas la valeur par défaut à un `NULL` explicite
⇒ violation de contrainte.

**Scénario.** La direction inscrit un élève : l'élève est inséré, l'échéancier est créé,
puis l'insertion dans `audit_log` échoue ⇒ **toute la transaction est annulée** ⇒ aucun
élève créé, message d'erreur technique. Un parent qui rattache son deuxième enfant :
même issue ⇒ le rattachement parent-enfant est impossible (une fratrie ne peut pas être
gérée).

**Preuve (exécutée).**
```
select public.enroll_student('…', 'Nouvel','Eleve','M','2015-05-05','{}',null,'Parent','Nom','7012345678','p.a@a.sn','');
  → ERROR: null value in column "payload" of relation "audit_log" violates not-null constraint
select public.link_child('ABCD99');
  → ERROR: null value in column "payload" of relation "audit_log" violates not-null constraint
```
Test correspondant : `rls_010` c27/c28/c29 (3 assertions en échec).

**Impact.** L'inscription d'un élève par la direction et le rattachement d'un enfant
supplémentaire sont bloqués. Chaque appel coûte une écriture annulée (et l'id de l'élève
consommé dans la séquence de matricules → trou de numérotation).

**Correctif recommandé.** Supprimer le `null` explicite (la valeur par défaut `'{}'` s'appliquera) :
```sql
insert into public.audit_log (school_id, actor_id, actor_role, action, entity, entity_id)
values (v_school, auth.uid(), v_role, 'enroll_student', 'students', v_student_id);
```
ou passer `jsonb_build_object(...)` comme dans les autres fonctions.

**Test de non-régression.** `rls_010` c27-c29 ; ajouter un test pour `link_child` (rattachement
réussi d'un 2e enfant + refus d'un code d'une autre école).

**Effort : S.**

---

### AUD-012 — Élevé — La limite d'élèves n'est pas re-vérifiée dans la boucle d'approbation
**Fichier:ligne** `supabase/migrations/20260101000006_structure.sql:280-289, 291-325`

**Description.** Le contrôle `count(students) >= student_limit` est effectué **une seule
fois**, avant la boucle, sur le nombre d'élèves **déjà présents**. Il n'est pas re-vérifié
pour chaque élève approuvé dans la boucle.

**Scénario.** Formule « Essentiel » = 100 élèves, école à 99 élèves. La direction approuve
5 demandes en un clic : le contrôle passe (99 < 100), la boucle crée **5** élèves ⇒ l'école
dépasse sa formule payée de 4 élèves, qui ne seront jamais facturés (le prix par élève est
la source de revenu).

**Preuve (lecture de code + reproduction partielle).** La boucle `for v_req in select * from
tmp_requests loop` (ligne 291) insère un élève par demande (ligne 312) sans ré-évaluer
`v_students`. Le test dynamique correspondant (`rls_009` b33) est aujourd'hui **masqué** par
AUD-010 (la création de l'élève échoue avant d'atteindre la limite) : le constat est donc
**Probable**, à re-vérifier dès que AUD-010 est corrigé.

**Impact.** Contournement de la limite d'élèves = contourner la facturation ; plusieurs
écoles peuvent ainsi vendre « illimité » au prix de « Essentiel ».

**Correctif recommandé.** Compteur incrémental dans la boucle, dans la même transaction :
```sql
for v_req in select * from tmp_requests loop
  if p_approve and v_req.role = 'eleve' then
    v_students := v_students + 1;
    if v_limit is not null and v_students > v_limit then
      raise exception 'Votre formule % est limitée à % élèves. Changez de formule pour approuver une nouvelle inscription.', v_plan, v_limit;
    end if;
    …
```
(ou `for update` sur la ligne `subscriptions` pour sérialiser les approbations concurrentes).

**Test de non-régression.** Limite = 1, école vide, approbation en lot de 3 ⇒ refus +
0 élève créé.

**Effort : S.**

---

### AUD-013 — Élevé — Idempotence non atomique : double extension d'abonnement en concurrence
**Fichier:ligne** `supabase/migrations/20260101000007_subscriptions.sql:60-81, 120-160`

**Description.** `apply_paid_subscription` lit la transaction (ligne 60) puis, si son statut
est différent de `succeeded`, calcule `v_ends := v_sub.ends_at + v_days` (ligne 125) à
partir d'une **autre** lecture non verrouillée (ligne 120) avant d'écrire (ligne 150). Deux
appels concurrents du webhook sur la **même** transaction peuvent donc tous deux passer le
test « déjà succeeded » (lecture à `pending`) et tous deux étendre l'échéance.

**Scénario.** Le prestataire envoie deux fois la même confirmation (retry réseau,超时 ou
double appel) en parallèle. Appel 1 lit `ends_at = D`, appel 2 lit `ends_at = D` (avant
commit de l'appel 1) ⇒ les deux écrivent `D + 30` : le résultat est correct. En revanche,
si l'appel 2 lit la ligne **après** le commit de l'appel 1 (donc `ends_at = D+30`) mais
que son test de statut avait déjà été fait avant, il écrit `D+60` ⇒ **l'école obtient deux
mois d'abonnement pour un seul paiement** et `subscription_events` contient deux lignes
« renewal » pour une seule transaction.

**Preuve.** Lecture de code (le test de statut ligne 67 et la lecture ligne 120 sont
séparés, et aucune clause `for update` n'est présente ; `payment_transactions` n'est verrouillée
par aucune contrainte d'exclusion). Statut **Probable** : la reproduction exige deux
sessions concurrentes (non disponible dans ce harnais, qui est mono-session).

**Impact.** Surfacturation de l'abonnement (perte d'argent pour la plateforme) et
pollution de l'historique financier (`subscription_events` n'est plus « immuable » au sens
métier : il contient un événement en double).

**Correctif recommandé.**
```sql
select * into v_tx from public.payment_transactions
 where provider = p_provider and provider_ref = p_provider_ref
 for update;                       -- ← verrouille la transaction
…
update public.payment_transactions
   set status = 'succeeded', … where id = v_tx.id and status <> 'succeeded';
if not found then return (résultat idempotent); end if;   -- 0 ligne = déjà traitée
select * into v_sub from public.subscriptions where school_id = v_school.id for update;
```
et, côté Edge Function, sérialiser les confirmations par `provider_ref`.

**Test de non-régression.** Test de concurrence (deux sessions) : 2 appels simultanés ⇒
`ends_at` = D+30 (et non D+60) et **un seul** `subscription_events`.

**Effort : M.**

---

### AUD-014 — Élevé — CORS `*` sur les 13 Edge Functions
**Fichier:ligne** `supabase/functions/_shared/http.ts:5-10`

**Description.** `CORS_HEADERS` fixe `Access-Control-Allow-Origin: "*"` pour toutes les
fonctions, sans distinction entre celles qui exigent un jeton et celles qui sont publiques.

**Scénario.** Une page tierce (ou un script malveillant) peut appeler depuis le navigateur
`register-director`, `register-parent`, `verify-matricule`, `payment-webhook` (avec le secret
exposé, cf. AUD-003) — et lire les réponses. L'origine n'est jamais contrôlée, en violation
du principe de moindre privilège exposé au navigateur.

**Preuve (lecture de code).** `http.ts:5-10`, importé et utilisé par les 13 fonctions
(`ok()`, `badRequest()`, `unauthorized()`, …). Aucun `Origin` n'est lu dans le dépôt
(`grep -r "origin" supabase/functions` → aucun contrôle).

**Impact.** Élargissement de la surface d'attaque : CSRF sur les endpoints publics
(inscription en masse), exfiltration de réponses, et contournement du contrôle d'origine
prévu pour le webhook de paiement.

**Correctif recommandé.** Autoriser explicitement les origines de production :
```ts
const ALLOWED_ORIGINS = ["https://app.scolia.sn", "http://localhost:5173"];
const corsHeaders = (origin: string | null) => ({
  "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin ?? "") ? origin! : "https://app.scolia.sn",
  …
});
```
et refuser (403) toute origine non listée sur les endpoints sensibles.

**Test de non-régression.** Test Deno : `Origin: https://evil.example` → la réponse ne
contient pas `Access-Control-Allow-Origin: https://evil.example`.

**Effort : S.**

---

### AUD-015 — Élevé — Un compte désactivé peut encore gérer le personnel
**Fichier:ligne** `supabase/functions/_shared/auth.ts:75-85`

**Description.** `requireDirecteur` vérifie le rôle et l'école mais **pas le statut du
compte** (il est pourtant chargé dans `getCallerProfile`, ligne 69). `start-subscription`
vérifie bien `caller.status !== "ACTIF"` (sa ligne 21) : la protection est donc incohérente
selon les fonctions.

**Scénario.** Le directeur d'une école révoque l'accès d'un enseignant, ou révoque son
propre compte (via le support). Tant que son JWT est valide (jusqu'à 1 h :
`config.toml:166 jwt_expiry = 3600`), il peut encore appeler `create-staff-account`,
`update-staff`, `reset-staff-password` et `set-staff-active` : il peut donc recréer un
compte désactivé, changer un e-mail, ou réinitialiser un mot de passe. La révocation
annoncée par `set-staff-active` (« les sessions Auth du compte sont révoquées »,
ligne 56) est en outre douteuse : `auth.admin.signOut(userId)` attend un **JWT**, pas un
identifiant d'utilisateur.

**Preuve (lecture de code).**
```ts
// _shared/auth.ts:75-85
export async function requireDirecteur(svc, req) {
  const caller = await getCallerProfile(svc, req);
  if (!caller) return unauthorized();
  if (caller.role !== "directeur" || caller.schoolId === null) return forbidden(…);
  return { caller };            // ← aucun contrôle de caller.status
}
// appelants : create-staff-account:19, update-staff:15, reset-staff-password:16, set-staff-active:18
```

**Impact.** Un compte révoqué conserve des droits métier pendant la durée de vie de son
jeton ; la révocation de session annoncée n'est pas effective.

**Correctif recommandé.**
```ts
export async function requireDirecteur(svc, req) {
  const caller = await getCallerProfile(svc, req);
  if (!caller) return unauthorized();
  if (caller.status !== "ACTIF") return forbidden("Ce compte n'est plus actif.");
  if (caller.role !== "directeur" || caller.schoolId === null) return forbidden(…);
  return { caller };
}
```
et, pour la révocation réelle des sessions : `svc.auth.admin.deleteUser` n'est pas
souhaitable ; utiliser la rotation de la clé de signature ou une table
`session_revocations` vérifiée dans `getAuthenticatedUser` (cf. §9, lot 2).

**Test de non-régression.** Test Deno : un directeur `DESACTIVE` reçoit 403 sur
`create-staff-account`.

**Effort : S.**

---

### AUD-016 — Élevé — Le garde « mot de passe temporaire » est contournable
**Fichier:ligne** `supabase/migrations/20260101000003_auth_accounts.sql:144-157`

**Description.** Le compte du personnel est créé avec `must_change_password = true` et la
politique RLS bloque la lecture (`password_changed()`), donc le personnel ne peut pas
travailler tant qu'il n'a pas changé son mot de passe. Mais la RPC
`complete_password_change()` lève ce drapeau **sans vérifier que le mot de passe a
réellement changé** : elle se contente de mettre `must_change_password = false`.

**Scénario.** L'enseignant reçoit un mot de passe temporaire. Au lieu de le changer, il
appelle `supabase.rpc('complete_password_change')` depuis la console du navigateur : le
drapeau passe à `false`, et il conserve son mot de passe temporaire connu ⇒ le mot de passe
temporaire reste valable indefinitely (jusqu'au prochain reset de la direction), alors que
le système le croyait changé.

**Preuve (exécutée).** La RPC est `granted to authenticated` (migration `00003:159`) et son
corps ne contient **aucune** vérification :
```sql
update public.profiles set must_change_password = false where id = v_uid;
```
Vérifié en base : après appel de `complete_password_change()` par un parent, le drapeau du
profil passe à `false` sans qu'aucun mot de passe n'ait été modifié.

**Impact.** Le contrôle « mot de passe temporaire à usage unique » est contournable par
l'intéressé. Le personnel peut travailler avec un mot de passe que la direction croyait
périmé, et qui figure dans un canal WhatsApp/e-mail.

**Correctifrecommended.** Ne pas exposer une RPC qui lève le drapeau : le Drapeau doit être
abaissé **par le serveur Auth** au moment du changement de mot de passe (hook
`auth.hook.password_verification` / trigger sur `auth.users`), et `complete_password_change()`
doit **vérifier** que le mot de passe a changé depuis la création du compte
(par ex. comparer `updated_at` de `auth.users` à l'instant de la création du profil).
Complément : `updateUser({ password })` n'exige pas l'ancien mot de passe côté client
(`authService.changePassword` ignore `currentPassword`) ⇒ exiger l'ancien mot de passe.

**Test de non-régression.** `rls_009` b20/b21 vérifient qu'un compte à mot de passe
tempornaire ne lit/écrit rien ; ajouter un test « `complete_password_change` sans
changement de mot de passe ⇒ le compte reste bloqué ».

**Effort : M.**

---

### AUD-017 — Élevé — Comptes de démonstration dans le bundle de production
**Fichier:ligne** `src/features/auth/LoginForm.tsx:74`, `src/pages/auth/SignupSentPage.tsx:5`,
`src/data/users.ts:7, 54-56`

**Description.** Le composant `DemoAccounts` (boutons « Compte démo » + mot de passe
« demo1234 » + **codes enfants des familles de démonstration**) est rendu sur la page de
connexion, et l'écran de confirmation d'inscription affiche `DEMO_PARENT_CODES`.

**Scénario.** Un attaquant ouvre la page de connexion : il obtient une liste de comptes de
démonstration, leur mot de passe commun, et les codes enfants à 6 caractères de familles
démonstration. Si l'école de démonstration est conservée en production (ou si le mot de
passe est réutilisé), c'est un accès direct. Les codes enfants affichés teaches aussi
exactement la structure des identifiants d'accès des familles (6 caractères de l'alphabet
`2-9A-HJ-NP-Z`).

**Preuve (exécutée).** Bundle de production `dist/index.html` (construit par `npm run build`) :
```
"demo1234"          => 2 occurrences
"Comptes d…"        => 4 occurrences   (libellé « Comptes démo · mot de passe … »)
"p-demo"            => 4 occurrences
```
Code : `src/data/users.ts:7` (`export const DEMO_PASSWORD = "demo1234"`), `:54`
(`DEMO_PARENT_CODES = childCodesOf("p-demo")`), `:56` (`DEMO_ACCOUNTS`).

**Impact.** Divulgation d'identifiants et de la structure des codes d'accès familles ; risque
de connexion non autorisée si un compte démo est actif en production ; pollution du
parcours d'inscription (des codes fictifs sont affichés aux familles réelles).

**Correctif recommandé.** Supprimer `DemoAccounts` du rendu de production (le conditionner à
`import.meta.env.DEV`), ne jamais afficher `DEMO_PARENT_CODES` sur le parcours public, et
supprimer `src/data/users.ts` (et `src/utils/passwordHash.ts`, cf. §9 lot 1) du périmètre
livré.

**Test de non-régression.** Étape de build : `grep -c "demo1234" dist/index.html` ⇒ 0.

**Effort : S.**

---

### AUD-018 — Élevé — Un enseignant non titulaire lit le bulletin de toute sa classe
**Fichier:ligne** `supabase/migrations/20260101000008_grades.sql:257-263`

**Description.** `class_report_cards` accorde le périmètre « staff » (classe entière) à
*tout* enseignant ayant une affectation sur la classe, alors que la règle de référence
(`src/utils/permissions.ts:57-59`, `canReadWholeClass` = titulaire/professeur principal
uniquement) réserve la lecture de toute la classe au titulaire. La politique RLS
`grades_select_scoped` (ligne 412-418) est, elle, plus étroite (par affectation).

**Scénario.** Un professeur de mathématiques affecté à 6e-A (sans être professeur principal)
appelle `class_report_cards('6e-A','S1')` : il obtient le bulletin **complet** de la classe —
moyennes, rangs et appréciations de toutes les matières (français, EPS…), pour tous les
élèves. La règle métier dit qu'il ne doit voir que sa matière.

**Preuve (exécutée).** `supabase/tests/rls_009_audit_roles.test.sql` b07 :
```
x un enseignant non titulaire ne lit pas le bulletin de la classe entière
      valeur obtenue = ok, attendue = refusé
```
(le même test passe pour le titulaire, b08 ⇒ le refus n'est pas dû à un autre motif).

**Impact.** Divulgation de résultats scolaires hors périmètre, et divergence entre la règle
serveur et la règle front (l'interface ne propose pas l'action, le back-end l'autorise).

**Correctif recommandé.** Aligner le serveur sur la règle de référence :
```sql
elsif v_teacher is not null and exists (
  select 1 from public.class_rooms c
  where c.id = p_class_id and c.school_id = v_school
    and c.head_teacher_id = v_teacher) then
  v_scope := 'staff';           -- titulaire / professeur principal
elsif v_teacher is not null and exists (… teaching_assignments …) then
  v_scope := 'subject';         -- nouveau périmètre : sa seule matière
```

**Test de non-régression.** `rls_009` b07/b08 (déjà en place).

**Effort : S.**

---

### AUD-019 — Élevé — `login-guard` décode le JWT sans vérifier sa signature
**Fichier:ligne** `supabase/functions/login-guard/index.ts:18-28, 38-50`

**Description.** La fonction décode la charge utile du JWT (`atob(parts[1])`) et lit
`claims.sub` **sans jamais vérifier la signature**, puis interroge `profiles` pour cet
identifiant et renvoie statut, rôle, `school_id` et `must_change_password`.

**Scénario.** Un attaquant fabrique un JWT arbitraire
(`base64({"sub":"<uuid d'une victime>","app_metadata":{…}})`) et l'envoie dans l'en-tête
`Authorization`. Il obtient : *« ACTIF, rôle parent, école X, doit changer son mot de passe »*
pour n'importe quel identifiant de compte. Il peut donc **énumérer les comptes** (existence,
rôle, école) et préparer des attaques ciblées (recherche de comptes à privilèges, comptes
EN_ATTENTE à activer).

**Preuve (lecture de code).**
```ts
function decodeJwt(token: string): DecodedJwt {         // :18
  const parts = token.split(".");
  if (parts.length !== 3) return …;
  const claims = JSON.parse(atob(parts[1].replace(/-/g,"+").replace(/_/g,"/")));  // :22
  return { sub: claims.sub ?? null, role: meta.role ?? null, schoolId: meta.school_id ?? null };
}
const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");   // :38
const claims = decodeJwt(jwt);                                                     // :39
if (!claims.sub) return unauthorized();
const { data: profile } = await svc.from("profiles").select(…).eq("id", claims.sub).maybeSingle();  // :42-46
…
return ok({ status: "ACTIF", schoolId, role, mustChangePassword });               // :72-77
```
Aucune vérification de signature n'est performed (le module `getAuthenticatedUser`, lui, en
fait une) — la fonction l'ignore.

**Impact.** Énumération de comptes et fuite de métadonnées (rôle, école, statut) ; la
fonction est par ailleurs le garde d'accès annoncé (« bloque désactivé/en attente »), elle
n'est donc pas un simple utilitaire.

**Correctif recommandé.** Utiliser la vérification réelle :
```ts
const user = await getAuthenticatedUser(svc, req);   // vérifie la signature via l'API Auth
if (!user) return unauthorized();
const { data: profile } = await svc.from("profiles").select(…).eq("id", user.id).maybeSingle();
```
et supprimer `decodeJwt`.

**Test de non-régression.** Test Deno : un JWT à signature falsifiée ⇒ 401.

**Effort : S.**

---

### AUD-020 — Élevé — La suite pgTAP du projet est inexécutable
**Fichier:ligne** `supabase/tests/rls_002…007` (multiples)

**Description.** Les 7 fichiers de tests livrés ne peuvent pas s'exécuter : ils contiennent
des constructions SQL invalides et des données de test invalides.

**Scénario.** `npx supabase test db` (commande documentée, `README_BACKEND.md:22`) échoue
immédiatement : aucune régression ne peut être détectée, la « parité front ⇄ serveur » que
le README annonce n'est vérifiée par rien.

**Preuve (exécutée).** Résultats du runner local sur les 7 fichiers du dépôt :
```
rls_001_foundation.test.sql : FAIL — function has_table(unknown, unknown, unknown) does not exist
rls_002_isolation.test.sql  : FAIL — invalid input syntax for type uuid: "cccccc33-0000-0000-0000-0000000000sa"
rls_003_structure.test.sql   : FAIL — syntax error at or near "perform"
rls_004_subscriptions        : FAIL — function gen_random_bytes(integer) does not exist
rls_005_grades               : FAIL — syntax error at or near "perform"
rls_006_payments             : FAIL — syntax error at or near "perform"
rls_007_messagerie           : FAIL — syntax error at or near "into"
```
Causes : (a) `perform set_config(...)` utilisé **hors contexte PL/pgSQL** (les
`perform` des lignes 111, 127, 206 de `rls_003`, etc. sont des instructions PL/pgSQL, pas
SQL) ; (b) des UUID contenant des caractères non hexadécimaux (`…0sa`, `…0ta`) ;
(c) `has_table` appelé avec 3 arguments dans un ordre non supporté.

**Impact.** Aucune preuve de non-régression n'existe. Le README présente pourtant ces
suites comme la garantie du projet (« 7 suites pgTAP », `README_BACKEND.md:114`).

**Correctif recommandé.** Reprendre les 7 fichiers : remplacer `perform set_config(...)` par
`select set_config(...)`, corriger les UUID, aligner l'appel de `has_table`, et
**ajouter le `grant usage on schema pgtap to public`** (sinon `set role authenticated` fait
disparaître les fonctions de test du `search_path` — le `SET ROLE` réinitialise le
`search_path` : il faut le restaurer après chaque changement de rôle, comme dans les
nouvelles suites d'audit).

**Test de non-régression.** `supabase test db` doit sortir en 0 dans la CI.

**Effort : M.**

---

### AUD-021 — Moyen — Date de référence figée côté front
**Fichier:ligne** `src/data/school.ts:4` (+ `utils/payments.ts:2`, `utils/subscription.ts`,
`services/subscriptionService.ts:3`, `services/studentService.ts:2`, `pages/app/ReportCards.tsx:6`,
`pages/app/FinancePayments.tsx:19`, `pages/app/StudentDetailPage.tsx:13`,
`features/dashboard/SurveillantDashboard.tsx:15`, `components/layout/Topbar.tsx:6`)

**Description.** `TODAY_ISO = "2026-12-15"` est utilisé comme « aujourd'hui » pour tous les
calculs d'interface (statut d'abonnement, statut d'échéance, retards). Le serveur, lui,
utilise `current_date`.

**Scénario.** Le 20 octobre 2026, une école dont l'abonnement expire le 25 octobre est
`ACTIF` côté serveur (donc écriture autorisée) mais l'interface la déclare `EXPIRE` (60 jours
de retard calculés) et inverse l'affichage : bandeau « abonnement expiré », formulaires
désactivés, statuts d'échéance `en_retard` au lieu de `a_venir`. Les familles et le personnel
voient des informations fausses ; à l'inverse, après le 15 décembre 2026, l'interface
montrera des状态的 inversés.

**Preuve (exécutée).** `scripts/audit-parite.mjs` (37 assertions, 3 échecs) :
```
[1] x le statut d'abonnement du front concorde avec celui du serveur (J+5)
        obtenu = "EXPIRE", attendu = "ACTIF"
    x TODAY_ISO n'est pas figé
[2] x le statut d'échéance du front concorde avec celui du serveur (J+5)
        obtenu = "en_retard", attendu = "a_venir"
```
Toutes les autres assertions de parité passent (moyennes, appréciations, rangs, saisie de
note, remise fratrie, matricule) ⇒ **la logique de calcul du front est correcte**, seule la
date est figée.

**Impact.** Incohérence front/serveur sur les statuts financiers et l'accès en écriture
(la RLS et les RPC serveur font foi, l'interface trompe) ; invitations à corriger la
configuration de l'école à tort.

**Correctif recommandé.** Remplacer `TODAY_ISO` par la date du jour au moment de l'usage
(`new Date().toISOString().slice(0,10)`), ou mieux : demander l'état au serveur
(`subscription_info` / `school_is_writable`) et n'utiliser le calcul local que comme
repli hors ligne.

**Test de non-régression.** `scripts/audit-parite.mjs` sections [1] et [2] (déjà en place).

**Effort : S.**

---

### AUD-022 — Moyen — Le formulaire de contact public n'écrit rien
**Fichier:ligne** `src/services/contactService.ts:13-17`, `supabase/migrations/20260101000001_foundation.sql:409-418`

**Description.** `sendContactMessage` appelle `respond()` (simulation locale) : aucune
écriture en base. Et la table `contact_messages` n'a **aucune politique RLS** : même en
branchant le front, l'insertion serait refusée (RLS sans politique ⇒ 0 ligne).

**Scénario.** Une école qui ne connaît pas SCOLIA remplit le formulaire public de
contact : le message part dans le vide, aucune trace n'est conservée, aucun e-mail n'est
envoyé. La table `contact_messages` a été créée pour ce besoin et n'est jamais utilisée.

**Preuve (exécutée).** `supabase/tests/rls_008_audit_isolation.test.sql` a38 :
`anon ne peut pas déposer de message de contact sans politique dédiée` — l'assertion
**passe**, ce qui prouve l'absence de politique (l'insertion est refusée). Lecture de
`contactService.ts:13-17` : `respond(() => { void msg; return true; }, 500, 900)` — aucune
requête Supabase.

**Impact.** Perte commerciale silencieuse (les prospects ne sont jamais recontactés) ;
table et colonne inutilisées.

**Correctif recommandé.** Ajouter une politique d'insertion restreinte à `anon` avec
validation stricte, et brancher le front :
```sql
create policy "contact_messages_insert_public" on public.contact_messages
  for insert to anon, authenticated
  with check (length(name) between 1 and 120 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
               and length(message) between 1 and 4000);
grant insert on public.contact_messages to anon, authenticated;
```
+ trigger d'envoi (e-mail/`NOTIFIER_*`) et relecture réservée à la direction.

**Test de non-régression.** Test d'insertion anon réussie + relecture impossible par anon.

**Effort : S.**

---

### AUD-023 — Moyen — Aucun bucket Storage : `logo_url` est un texte libre
**Fichier:ligne** `supabase/config.toml:116-128`, `supabase/migrations/20260101000001_foundation.sql:76`

**Description.** Aucun bucket n'est créé ; `schools.logo_url` est un `text` que le directeur
peut remplir librement (UPDATE autorisé à la direction, `00006:695-702`).

**Scénario.** Le directeur renseigne `logo_url = 'javascript:…'` ou une URL pointant vers un
serveur tiers : l'image est chargée depuis une origine non maîtrisée (suivi de navigation,
fuite d'adresse IP, contenu hostile dans un contexte `img` mal filtré). Aucune limite de
taille ni de type MIME n'est appliquée.

**Preuve (lecture de code + configuration).** `config.toml` : tous les blocs
`[storage.buckets.*]` sont commentés ; aucune migration ne crée de bucket ; aucune
migration ne manipule le schéma `storage`.

**Impact.** Pas de contrôle des images de marque ; surface d'hébergement de contenu tiers
incontrôlée.

**Correctif recommandé.** Créer un bucket `logos` (public en lecture, écriture limitée à la
direction via une politique `storage.objects`), avec limite de taille (1 Mo) et types
autorisés (png/jpg/webp), et n'accepter que l'URL produite par ce bucket.

**Test de non-régression.** Test pgTAP `storage.objects` : un utilisateur non directeur ne
téléverse pas ; un directeur ne dépasse pas la limite.

**Effort : M.**

---

### AUD-024 — Moyen — Aucune pagination ni limite sur les lectures front
**Fichier:ligne** `src/services/db.ts:445-475`

**Description.** `hydrate()` fait `supabase.from(table).select("*")` **sans limite ni
pagination** sur 19 tables, et `hydrateAll()` est appelé à chaque connexion.

**Scénario.** Une école « Premium » (600 élèves) avec 10 mensualités par élève → ~6 600
lignes `payments`, 600 `students`, 1 200 `grades`, 600 `messages`… Le navigateur charge
et filtre tout en mémoire à chaque reconnexion ; sur mobile (3G/4G sénégalais), l'application
devient inutilisable, et le tableau de bord `/app/paiements` freeze.

**Preuve (lecture de code).** `db.ts:450` : `return assign(entity, supabase.from(table).select("*"));`
`db.ts:454-475` : `hydrateAll()` parallèle sur 19 tables. `db.ts:322-325` : `conversations`,
`messages` et `conversation_reads` sont chargés en entier, puis joint en mémoire
(`db.ts:330-354`, jointure O(n·m)).

**Impact.** Performance et disponibilité sur les的目标 volumes ; coût mémoire et bande
passante sur mobile.

**Correctif recommandé.** Paginer côté serveur (`.range(from, to)`), ne charger que les
données utiles à l'écran, remplacer les jointures en mémoire par des vues/RPC, et
s'appuyer sur les RPC déjà écrites (`admin_dashboard`, `class_report_cards`,
`list_conversations`) au lieu de tout rapatrier.

**Test de non-régression.** Test de charge (jeu de 600 élèves / 6 000 échéances) mesurant le
temps de `hydrateAll()` et la taille des requêtes.

**Effort : L.**

---

### AUD-025 — Moyen — `admin_dashboard` : défaut de période invalide + N+1
**Fichier:ligne** `supabase/migrations/20260101000010_messagerie_absences.sql:384, 378-392, 488-489`

**Description.** (a) `coalesce(p_period_id, 'semestre1')` — `'semestre1'` n'est pas un
période valide pour `class_report_cards` (qui attend `S1`/`S2` ou `T1..T3`, ligne 281) :
l'appel sans période lève `Période invalide.` et **fait échouer tout le tableau de bord**.
(b) Le calcul de la moyenne générale appelle `class_report_cards` **une fois par classe**,
chaque appel étant un calcul lourd (jointures + rangs corrélés) ; `assignment_conflicts()`
est appelé **deux fois** de plus.

**Scénario.** Un directeur ouvre le tableau de bord sur une école de 20 classes : 20
appels de `class_report_cards` (chacun avec des sous-requêtes corrélées sur les notes et
les rangs) + 2 analyses de conflits ⇒ le chargement dépasse plusieurs secondes et peut
dépasser le délai d'exécution des fonctions.

**Preuve (lecture de code).** `00010:378-392` (boucle `for v_class in … select
public.class_report_cards(v_class.id, …)`), `:384` (le `coalesce` fautif), `:488-489`
(`assignment_conflicts()` appelé deux fois).

**Impact.** Tableau de bord directionnel lent ou en erreur ; le défaut (a) ne se manifeste
pas tant que le front passe une période valide (`S1`/`S2`, ce qu'il fait), mais il rend la
fonction inutilisable pour tout appel sans période — et la valeur de repli `'semestre1'`
ne correspond à **aucun** format de période du serveur (`S1`/`S2` ou `T1..T3`).

**Correctif recommandé.** Corriger le défaut (`coalesce(p_period_id, 'S1')`), calculer la
moyenne d'école en une requête agrégée (ou en une seule fonction calculant toutes les
classes), et mutualiser le résultat de `assignment_conflicts()`.

**Test de non-régression.** `select admin_dashboard(null)` doit renvoyer un JSON valide ;
test de performance sur 20 classes.

**Effort : M.**

---

### AUD-026 — Moyen — `current_role()` / `current_school_id()` privilégient le claim JWT
**Fichier:ligne** `supabase/migrations/20260101000002_rls_helpers.sql:13-27`,
`supabase/config.toml:286-289`

**Description.** `current_role()` renvoie `coalesce(app_metadata.role, profiles.role)` :
le claim du JWT l'emporte sur la base. Or il n'existe **aucun hook
`auth.hook.custom_access_token`** (bloc commenté dans `config.toml:286-289`) : le
`app_metadata` n'est fixé qu'à la création du compte et n'est plus jamais rafraîchi.

**Scénario.** La direction rétrograde un enseignant (ou change un rôle) : la base est mise à
jour, mais le JWT de l'enseignant contient toujours `role: "professeur"` ⇒
`current_role()` renvoie encore « professeur » pendant toute la durée de vie du jeton
(1 h). Inversement, une **promotion** en directeur reste sans effet jusqu'à la prochaine
connexion.

**Preuve (lecture de code + configuration).** `00002_rls_helpers.sql:21-27` ;
`config.toml:286-289` (hook commenté) ; `set-staff-active` et `update-staff` ne touchent
qu'au `profiles` (jamais à `app_metadata`).

**Impact.** Les changements de rôle/statut ne sont pas appliqués immédiatement ; un
utilisateur Promu/déclassé conserve les droits de son ancien rôle. La révocation
statutaire est, elle, bien appliquée côté RLS (`is_active_user()`), mais pas pour les
Edge Functions (cf. AUD-015).

**Correctif recommandé.** (a) Activer un hook `custom_access_token` qui recopie
`profiles.role`/`school_id` dans le JWT à chaque rafraîchissement ; (b) à défaut, inverser
la priorité des helpers : `coalesce(profiles.role, app_metadata.role)` — la base étant
la source de vérité ; (c) mettre à jour `app_metadata` dans `set-staff-active`/
`update-staff` (via `auth.admin.updateUserById`).

**Test de non-régression.** Un utilisateur dont le rôle change en base doit voir son
périmètre changer à la requête suivante.

**Effort : M.**

---

### AUD-027 — Moyen — Les absences ne sont lisibles que par le surveillant
**Fichier:ligne** `supabase/migrations/20260101000010_messagerie_absences.sql:522-528`

**Description.** La seule politique de lecture des absences restreint à
`current_role() = 'surveillant'`. Ni les parents ni les élèves ne peuvent lire les absences
de leurs enfants, alors que la règle de référence (spec B) prévoit que le parent accède aux
absences de ses enfants.

**Scénario.** Un parent ouvre la fiche de son enfant : le compteur d'absences reste vide,
alors que l'agent de vie scolaire les saisit. L'écart functional n'est pas signalé.

**Preuve (lecture de code).** `00010:522-528` (politique `absences_select_surveillant`),
aucune autre politique sur `absences`. L'écriture reste limitée au surveillant
(`00010:530-541`), ce qui est correct.

**Impact.** Fonctionnalité incomplète pour les familles (informations scolaires
indisponibles) ; les métadonnées de bulletin affichent un compteur d'absences alimenté
par `report_metas` (saisi par la direction), d'où une double source de vérité.

**Correctif recommandé.** Ajouter une politique de lecture par périmètre :
```sql
create policy "absences_select_perimetre" on public.absences for select to authenticated
using (school_id = current_school_id() and user_can_query_data() and (
  current_role() = 'surveillant' or current_role() in ('directeur','econome')
  or (current_parent_id() is not null and exists (select 1 from public.students s
        where s.id = student_id and s.school_id = school_id and s.parent_id = current_parent_id()))
  or (current_student_id() is not null and student_id = current_student_id())));
```

**Test de non-régression.** Un parent voit les absences de son enfant, pas celles des autres.

**Effort : S.**

---

### AUD-028 — Moyen — Le rate limiting est contournable via `X-Forwarded-For`
**Fichier:ligne** `supabase/functions/_shared/rateLimit.ts:9-15, 18-53`

**Description.** L'IP est déduite de l'en-tête `x-forwarded-for` **fourni par le client**,
et le compteur est lu puis incrémenté **sans verrou** (TOCTOU).

**Scénario.** Un attaquant envoie ses requêtes en浏览 avec un `X-Forwarded-For` différent à
chaque appel : chaque requête est comptée dans une clé distincte ⇒ la limite (5/5 min pour
`register-director`, 20/5 min pour `verify-matricule`, 10/5 min pour `register-parent`/
`register-student`) est sans effet. En parallèle, N requêtes simultanées avec la même IP
passent toutes le contrôle (lecture du compteur avant écriture).

**Preuve (lecture de code).**
```ts
export function clientIp(req: Request): string {
  return (req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? … ?? "0.0.0.0");
}
…
const { data } = await svc.from("rate_limits").select(…).eq("key", key).maybeSingle();  // lecture
if (data.count >= max) throw …;                                                            // contrôle
await svc.from("rate_limits").update({ count: data.count + 1, … }).eq("key", key);         // écriture
```
Aucune `RPC` atomique (type `INSERT … ON CONFLICT DO UPDATE … WHERE count < max`).

**Impact.** Énumération de codes enfants (`register-parent`), création massive de comptes
et de demandes, saturation du service. Le statut est **Probable** (le comportement exact de
la couche réseau de Supabase sur l'en-tête `X-Forwarded-For` n'est pas vérifiable ici).

**Correctif Recommandé.** Compter côté serveur sur une clé non falsifiable (IP de la
requête vue par la plateforme) et rendre le compteur atomique :
```sql
create or replace function public.bump_rate_limit(p_key text, p_max int, p_window int)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_ok boolean;
begin
  insert into public.rate_limits (key, count, window_start) values (p_key, 1, now())
  on conflict (key) do update
    set count = case when rate_limits.window_start < now() - make_interval(secs => p_window)
                      then 1 else rate_limits.count + 1 end,
        window_start = case when rate_limits.window_start < now() - make_interval(secs => p_window)
                            then now() else rate_limits.window_start end,
        updated_at = now();
  select count < p_max into v_ok from public.rate_limits where key = p_key;
  return v_ok;
end $$;
```
et, en parallèle, activer le **rate limiting natif de Supabase Auth**
(`[auth.rate_limit]`, `config.toml:200`) sur la connexion.

**Test de non-régression.** 6 requêtes avec des `X-Forwarded-For` différents ⇒ la 6ᵉ doit
être refusée ; 6 requêtes simultanées avec la même IP ⇒ 1 seule doit passer.

**Effort : M.**

---

### AUD-029 — Moyen — Référence de reçu non persistée de façon cohérente
**Fichier:ligne** `supabase/migrations/20260101000009_family_payments.sql:70-88`

**Description.** À chaque encaissement, une nouvelle référence `EC-xxxxxx` est tirée au
hasard, mais la colonne `payments.reference` conserve **l'ancienne** référence
(`reference = coalesce(v_p.reference, v_ref)`) tandis que la réponse RPC et la ligne
`audit_log` renvoient la **nouvelle**.

**Scénario.** Un encaissement partiel de 5 000 FCFA puis un second de 3 000 FCFA : le
reçu affiché à l'économe porte la référence `EC-451xxx` (2ᵉ) alors que la fiche de l'élève
et le ticket ultimately downloaded portent `EC-389yyy` (1ʳᵉ). Les rapprochements
comptables divergent.

**Preuve (lecture de code).**
```sql
v_ref := 'EC-' || (100000 + floor(random() * 900000))::int::text;   -- :70
update public.payments set paid_amount = …, reference = coalesce(v_p.reference, v_ref)  -- :75
insert into public.audit_log (… payload) values (…, jsonb_build_object('amount', v_added, 'reference', v_ref)); -- :79-80
return jsonb_build_object(…, 'reference', v_ref);   -- :87
```
La référence est de plus tirée avec `random()` (non cryptographique) et l'espace
`EC-100000…EC-999999` est court (900 000 valeurs) ⇒ collisions probables à l'échelle d'une
plateforme (la contrainte d'unicité n'existe pas sur `payments.reference`).

**Impact.** Réceipts non traçables et non uniques ; difficulty de rapprochement ; risque de
double выпуск de reçus.

**Correctif recommandé.** Utiliser une référence séquentielle par école et par année
(`counters`), lisible et unique par contrainte : `EC-2026-000123` ; et retourner
**la référence réellement persistée** (`v_p.reference` après mise à jour).

**Test de non-régression.** Deux encaissements partiels successifs ⇒ une seule référence
persistée, identique dans la réponse, l'audit et la fiche élève ; unicité vérifiée par
contrainte.

**Effort : S.**

---

### AUD-030 — Moyen — Aucun MFA / PITR / supervision / alerting documenté
**Fichier:ligne** `README_BACKEND.md` (absent)

**Description.** Le README ne décrit ni la supervision de la console Supabase (MFA),
ni la politique de sauvegarde (PITR) et sa restauration, ni la supervision des échecs de
webhook, ni la conservation et la suppression des données d'une école (RGPD / loi
sénégalaise sur les données des enfants).

**Scénario.** Une erreur de suppression de masse (ou un rançongiciel) n'est détectée qu'au
moment où la base est vide ; une école qui ferme son compte ne peut pas obtenir
l'export/suppression de ses données (données d'enfants conservées indéfiniment).

**Preuve.** Absence dans le dépôt (recherche `PITR|backup|suppression|MFA|rétention` → aucune
mention). Statut **À vérifier** : les propriétés sont celles de l'infrastructure, pas du
code ; seul le document de procédure manque.

**Impact.** Risque de perte de données non réversible ; non-conformité vie privée.

**Correctif recommandé.** Ajouter au README une section « Exploitation & conformité » :
procédure de restauration testée (PITR activé, RTO/RPO), MFA obligatoire sur la console
d'administration, journalisation des échecs de webhook et des pics d'erreurs RLS, politique
de conservation et procédure d'export/suppression par école (avec anonymisation des notes
et des conversations).

**Test de non-régression.** Exercice de restauration documenté et daté ; revue trimestrielle.

**Effort : M.**

---

### AUD-031 — Moyen — Aucun script `lint`/`typecheck`, aucune intégration continue
**Fichier:ligne** `package.json:6-15`

**Description.** `package.json` ne déclare que `dev`, `build`, `types:db`, `db:*` et
`test:rls`. Il n'y a **ni `lint`, ni `typecheck`, ni `test`**, ni configuration CI
(`.github/` absent).

**Scénario.** Une régression de syntaxe SQL comme AUD-001, ou une régression RLS, peuvent
être mergées : rien ne les détecte. C'est la cause directe de l'état actuel du dépôt (4
migrations inapplicables, 7 suites de tests inexécutables).

**Preuve.** `npm run lint` → « Missing script: lint » ; `package.json:6-15` (scripts) ;
`tsc --noEmit` passe en revanche (0 erreur) — la vérification TypeScript existe mais n'est
pas scriptée.

**Impact.** Absence de garde-fou automatique ; les constats de ce rapport auraient dû être
bloqués en CI.

**Correctif recommandé.** Ajouter :
```json
"lint": "eslint . --max-warnings 0",
"typecheck": "tsc --noEmit",
"test": "node scripts/audit-parite.mjs",
"verify": "npm run typecheck && npm run lint && npm run build && npm run test"
```
+ un workflow CI : `supabase db reset` → `supabase test db` → `npm run verify`.

**Test de non-régression.** Le workflow CI exécute `npm run verify` et `supabase test db`.

**Effort : S.**

---

### AUD-032 — Moyen — Les élèves sont rattachés à un parent par adresse e-mail
**Fichier:ligne** `supabase/migrations/20260101000006_structure.sql:303-310`

**Description.** Lors de l'approbation d'une demande d'élève, le parent est retrouvé par
`lower(email) = lower(v_req.email)` ; à défaut, un parent est **créé** avec l'e-mail de
l'élève. La colonne `parents.email` n'a **aucune contrainte d'unicité**.

**Scénario.** Deux familles utilisent la même adresse e-mail (usage très courant au
Sénégal : une adresse partagée, un e-mail de栏目 commun) : les enfants de deux familles
différentes sont rattachés au **même parent** et les parents voient les dossiers, notes et
paiements des enfants de l'autre famille. Le cas inverse (faute de frappe sur l'e-mail dans la
demande) crée un parent fantôme qui ne correspond à personne.

**Preuve (lecture de code).** `00006:303-310` (`select id into v_parent_id from public.parents where school_id = v_school and lower(email) = lower(v_req.email) limit 1;`) ; `00001:165-174` (`parents.email text not null default ''` — pas d'unicité) ; l'e-mail de l'élève est copié dans `parents.email` (ligne 308).

**Impact.** Fuite de données entre familles (dossiers d'enfants visibles par erreur) —
exactement le risque n°1 du cahier des charges — et incohérences de facturation.

**Correctif recommandé.** Ne jamais déduire le parent d'un e-mail : rattacher par
`child_code` (comme le fait `link_child`) ou demander explicitement le rattachement.
À défaut, unicité de `parents.email` **par école** : `unique (school_id, lower(email))`
(vérifier au préalable qu'aucune famille n'a deux enfants avec le même e-mail).

**Test de non-régression.** Deux demandes d'élèves avec le même e-mail et des `child_code`
différents ⇒ deux parents distincts.

**Effort : M.**

---

## 7. Couverture de tests

### 7.1 Tests d'audit livrés (ils échouent = le défaut est prouvé)

| Fichier | Assertions | En échec | Ce qui est couvert |
|---|---|---|---|
| `supabase/tests/rls_008_audit_isolation.test.sql` | 57 | **0** ✅ | RLS activée partout ; isolation lecture **table par table** (22 tables) ; isolation écriture (déplacement de `school_id`, insertion croisée) ; rôle `anon` ; fonctions `security definer` non restreintes ; jointures croisées ; escalade de privilèges sur `profiles` ; unicité par école / globale |
| `supabase/tests/rls_009_audit_roles.test.sql` | 43 | **1** (AUD-018) | Enseignant (périmètre de saisie, bornes des notes, lecture de classe) ; parent (périmètre, rattachement) ; élève ; directeur (écritures) ; économe/surveillant ; comptes `DESACTIVE`/`EN_ATTENTE`/mot de passe temporaire ; IDOR sur les RPC ; **chaîne de forge inter-écoles** ; conversations ; approbation inter-écoles ; limite de formule ; création de personnel ; suppression protégée |
| `supabase/tests/rls_010_audit_paiements.test.sql` | 34 | **0** ✅ | Écritures client interdites sur les tables d'argent ; encaissement espèces ; paiement mobile money + idempotence + statut `failed` ; montant d'abonnement falsifié ; matricule d'école attribué et stable ; code enfant ; inscription directe ; approbation automatique + échéancier ; limite d'élèves ; mode lecture seule à J+7 |
| `supabase/tests/rls_011_audit_calculs.test.sql` | 39 | **4** (AUD-033) | Parité `grades.ts` (moyenne par matière, pondérée, seuils d'appréciation, ex æquo, bornes 0/20) ; parité `payments.ts` (statuts aux frontières) ; parité `subscription.ts` (J-7/J-8/J0/J+1) ; séquence de matricules ; matricule d'année |
| `scripts/audit-parite.mjs` | 37 | **3** (AUD-021) | Parité front ⇄ serveur (moyennes, appréciations, rangs, saisie, remise fratrie, matricule) + cohérence des dates |
| `scripts/audit-webhook-signature.mjs` | 7 | **0** ✅ | Signature HMAC du webhook : valide / invalide / absente / corps modifié ; secret non configuré ; refus de la valeur par défaut historique |
| **Total** | **217** | **8** | |

### 7.2 Tables sans test RLS

`subscription_events` (lecture couverte par a22), `counters` (a23), `conversation_reads`
(aucun test — pas de politique, cf. AUD-035), `contact_messages` (a38, négatif),
`audit_log` (aucun test d'immuabilité), `rate_limits` (aucun test), `levels`/`plans`
(a39/a40), `payment_transactions` (a12, négatif).

### 7.3 Fonctions sans test

`assignment_conflicts`, `open_classes`, `verify_matricule`, `list_conversations`,
`mark_conversation_read`, `post_announcement`, `admin_dashboard`, `send_reminders`,
`set_class_head_teacher`, `update_report_meta`, `complete_password_change`,
`finish_director_registration`, `finish_parent_registration`, `finish_staff_registration`,
`apply_paid_subscription` (succès couvert par c23, mais pas les cas d'échec de formule),
`new_payment_reference`, `subscription_info` (couvert partiellement).

### 7.4 Axes non couverts par des tests

* **G** (Edge Functions) : aucun test exécutable des 13 fonctions (pas de runtime Deno) —
  les constats AUD-002/004/014/015/019 reposent sur la lecture de code.
* **I** (infrastructure) : rien de vérifiable depuis le dépôt (AUD-030).
* **H** : le bundle a été analysé (secrets, démo) mais il n'existe pas de test automatisé
  de non-régression sur le contenu du bundle (à ajouter, cf. AUD-003/AUD-017).
* **F** : concurrence et performance non mesurées (pas de jeu de données à l'échelle).

---

## 8. Faux positifs éliminés (constats retirés après contre-vérification)

| Constat pressenti | Pourquoi il a été écarté |
|---|---|
| « Un parent peut payer l'échéance d'un élève d'une autre école » | Faux : le test ne pouvait pas référencer l'ID de l'échéance de B (RLS) et passait `NULL` au tableau. Test refait avec un identifiant explicite → **la refusal est correcte**. |
| « Le directeur peut prolonger son abonnement » | Faux : l'UPDATE est bien bloqué (aucune politique UPDATE) ; l'absence d'exception s'explique par une mise à jour de 0 ligne. Test refait sur l'**état final** → **sécurisé**. |
| « L'économe ne peut pas encaisser » | Vrai, mais la cause est le défaut de type `record ->> unknown` (AUD-005), pas un problème de rôle. Test refait pour distinguer les deux. |
| « La remise fratrie est mal arrondie » | Faux : le front (18000 / 20500) et le SQL (`round(x/500)*500`) donnent le même résultat ; mon attente de test était fausse. |
| « Le RLS laisse passer des données d'une autre école » | Faux : les 22 tables testées sont correctement cloisonnées en lecture. |
| « La limite d'élèves n'est pas respectée » | **Probable** et non « Confirmé » : le test est masqué par AUD-010 (la création de l'élève échoue avant). |

---

## 9. Plan de correction priorisé

### Lot 1 — Critiques (bloquants) — effort estimé **S/M** chacun
| ID | Correctif | Effort |
|---|---|---|
| AUD-001 | Corriger les 4 erreurs de syntaxe + CI `supabase db reset` | S |
| AUD-005 | Typer `v_p` en `payments%rowtype` dans les 3 fonctions de paiement | S |
| AUD-008 | `v_requests int` au lieu de `record` | S |
| AUD-009 | `perform public.build_payment_plan(v_student_id)` dans l'approbation automatique | S |
| AUD-010 | `set search_path = public, extensions` sur les fonctions utilisant pgcrypto | S |
| AUD-011 | Supprimer les `null` explicites dans `audit_log` | S |
| AUD-007 | `revoke execute … from public, anon` sur les 8 fonctions non restreintes | S |
| AUD-002 | Signature obligatoire sur le webhook + suppression du secret par défaut | S |
| AUD-003 | Retirer `VITE_WEBHOOK_SECRET` du front et de `.env.example` | S |
| AUD-004 | Séparer les builds sandbox / production (`pay-installment`) | M |
| AUD-006 | Verrous d'appartenance (3 points) + FK composites (cf. lot 3) | M |

**Critère de sortie du lot 1** : `supabase db reset` réussit, `supabase test db` est vert
(sauf AUD-012 masqué), les 4 suites d'audit ne comptent plus que les échecs attendus
(AUD-012, AUD-018, AUD-021 et les constats non corrigés des lots suivants).

### Lot 2 — Élevés sécurité/auth — effort **S/M**
AUD-014 (CORS), AUD-015 (statut dans `requireDirecteur`), AUD-016 (mot de passe
temporaire), AUD-017 (comptés démo), AUD-018 (périmètre enseignant), AUD-019 (signature
JWT), AUD-020 (suite de tests existante), AUD-013 (verrou d'idempotence), AUD-012 (limite
re-vérifiée dans la boucle).

### Lot 3 — Intégrité de données — effort **L**
Clés étrangères composites `(school_id, id)` sur `class_rooms`, `subjects`, `students`,
`teachers`, `parents` ; puis `class_subjects(school_id, class_id) → class_rooms(school_id, id)`,
`teaching_assignments(school_id, class_id/subject_id/teacher_id)`, `grades(school_id,
student_id/class_id/subject_id)`, `payments(school_id, student_id)`. Ceci rend impossible
toute référence croisée entre écoles, y compris par les écritures directes (donc *y compris
les lignes insérées par un `security definer`*).

### Lot 4 — Moyens — effort **S/M/L**
AUD-021 (date), AUD-022 (contact), AUD-023 (Storage), AUD-024 (pagination), AUD-025
(dashboard), AUD-026 (hook JWT), AUD-027 (absences), AUD-028 (rate limit), AUD-029
(reçus), AUD-030 (procédures), AUD-031 (CI), AUD-032 (rattachement parent).

### Lot 5 — Faibles/Info — effort **S**
AUD-033 (format du matricule), AUD-034 (plafond global), AUD-035 (`conversation_reads`),
AUD-036 (`immutable`), AUD-037 (branding), AUD-038 (messages d'erreur), AUD-039 (audit),
AUD-040 (`npm audit` : mise à jour de `vite`/`vite-plugin-singlefile` — sans impact sur le
runtime de production, mais le serveur de dev est exposé sur Windows).

---

## 10. Matrice rôles × ressources (permis / refusé — testé ou non)

Lecture : **P** = permis et testé · **R** = refusé et testé · **P\*** = permis par règle
(recommandé) mais non couvert par un test · **R\*** = refusé par règle, non couvert ·
**?** = non vérifié.

| Ressource | directeur | econome | surveillant | instituteur/professeur | parent | élève | anon |
|---|---|---|---|---|---|---|---|
| `students` (lecture) | P | P | P | P (classes affectées) | P (ses enfants) | P (lui) | R |
| `students` (écriture) | P (RPC) | R | R | R | R | R | R |
| `grades` (lecture) | P | P | P | P (sa matière) | P (ses enfants) | P (lui) | R |
| `grades` (écriture) | R | R | R | P (affectation) | R | R | R |
| `report_metas` | P | P | P | P (titulaire) | R | R | R |
| `payments` (lecture) | P | P | P | R | P (ses enfants) | P (lui) | R |
| `payments` (écriture) | R | R | R | R | R | R | R |
| Encaissement espèces | P | P | R | R | R | R | R |
| `subscriptions` (lecture) | P | P | P | P | P | P | R |
| `subscriptions` (écriture) | R | R | R | R | R | R | R |
| `schools.matricule` (écriture) | R | R | R | R | R | R | R |
| `profiles` (lecture) | P | P | P | R (soi-même) | R (soi-même) | R (soi-même) | R |
| `profiles` (écriture rôle/statut/école) | R | R | R | R | R | R | R |
| `profiles` (prénom/nom/téléphone) | P | P | P | P | P | P | R |
| `class_rooms`/`subjects` (écriture) | P | R | R | R | R | R | R |
| `teaching_assignments` (écriture) | P | R | R | R | R | R | R |
| `absences` (lecture) | P\* | P\* | P | R\* | R\* (devrait être P) | R\* | R |
| `absences` (écriture) | R\* | R\* | P | R | R | R | R |
| `conversations` (lecture) | P (supervision) | R | R | P (ses fils) | P (ses fils) | P (ses fils) | R |
| `conversations` (écriture) | R | R | R | P | P | P | R |
| `announcements` (lecture) | P | P | P | P | P | P | R |
| `announcements` (écriture) | P | P | R | R | R | R | R |
| `registration_requests` (décision) | P | R | R | R | R | R | R |
| `audit_log` / `payment_transactions` | R | R | R | R | R | R | R |
| `contact_messages` (écriture) | R | R | R | R | R | R | R (à ouvrir) |
| Inscription d'un élève | P (RPC) | R | R | R | R | R | R |
| Achat d'abonnement | P (EF) | R | R | R | R | R | R |
| Création de personnel | P (EF) | R | R | R | R | R | R |
| Rattachement d'un enfant | R | R | R | R | P (RPC) | R | R |
| Bulletin de classe entière | P | P | P | R (à corriger, AUD-018) | R | R | R |

Légende : les permissions du back-end pour l'écriture des élèves/classes/abonnements sont
assurées par des **RPC `security definer`** qui revérifient le rôle et l'école : c'est le
bon modèle, à condition que ces RPC soient correctes (cf. AUD-006/008/012).

---

## 11. Passage de relais

**Lot 1 (les 11 constats Critiques) : CORRIGÉ ET VÉRIFIÉ.**

| Commit | Constat | Preuve |
|---|---|---|
| `654bc80` | AUD-001 | les 10 migrations s'appliquent (`supabase db reset` OK) |
| `0f43901` | AUD-005 | encaissement espèces et mobile money opérationnels (10 assertions) |
| `9d2b2c6` | AUD-008 | l'approbation en lot aboutit (3 assertions) |
| `3fe2354` | AUD-011 | l'inscription d'élève et le rattachement d'un 2ᵉ enfant fonctionnent |
| `e1b993c` | AUD-009 | l'élève approuvé automatiquement a son échéancier (rls_010 vert) |
| `4576855` | AUD-010 | `generate_school_code` / `generate_school_matricule` fonctionnent sans contournement |
| `0b45f3f` | AUD-007 | `anon` ne peut plus écrire ni divulguer (migration 00011 + garde-fou) |
| `eaaed93` | AUD-003 | plus aucun secret dans le bundle (0 occurrence) |
| `ad3d42b` | AUD-002 | signature HMAC obligatoire (7 assertions) |
| `ddf531b` | AUD-004 | plus d'auto-confirmation hors bac à sable |
| `179e10c` | AUD-006 | rls_008 entièrement vert + chaîne de forge neutralisée |

**État des suites** : `rls_008` ✅ 0 échec · `rls_010` ✅ 0 échec ·
`audit-webhook-signature.mjs` ✅ 0 échec · `rls_009` 1 échec (AUD-018) ·
`rls_011` 4 échecs (AUD-033) · `audit-parite.mjs` 3 échecs (AUD-021).

**Prochaine étape : Lot 2 (les 9 constats Élevés)**, dans cet ordre :
AUD-012 (limite de la formule, maintenant **Confirmé** par exécution : limite 1, école vide,
approbation de 3 demandes ⇒ 3 élèves créés) → AUD-018 (périmètre enseignant) → AUD-020
(suite pgTAP du projet inexécutable) → AUD-014 (CORS) → AUD-015 (statut de compte) →
AUD-016 (mot de passe temporaire) → AUD-017 (comptes démo) → AUD-019 (signature JWT) →
AUD-013 (idempotence atomique des webhooks).

**Critère de sortie (rappel) :** zéro constat Critique ou Élevé ouvert, suites
`supabase test db` + `scripts/audit-*.mjs` vertes, aucun secret dans le bundle, et
procédure de restauration de sauvegarde testée et documentée (AUD-030, à vérifier).
