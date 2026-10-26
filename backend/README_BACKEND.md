# Backend SCOLIA — guide complet

Backend Supabase du SaaS scolaire SCOLIA (multi-écoles, Sénégal, FCFA,
Wave / Orange Money / Free Money). Ce dépôt contient :

- les migrations PostgreSQL (`supabase/migrations/`) : schéma, RLS multi-écoles,
  RPCs métier ;
- les Edge Functions Deno (`supabase/functions/`) : inscription, staff,
  paiements ;
- les tests pgTAP (`supabase/tests/`) : isolation des rôles et périmètres ;
- le tableau des parités front ⇄ serveur (`SUPABASE_NOTES.md`).

---

## 1. Démarrage

### 1.1 Contre la base hébergée (recommandé, sans Docker)

```bash
# Connexion du CLI au projet (Dashboard > Account > Access Tokens)
npx supabase login --token <ACCESS_TOKEN>
npx supabase link --project-ref <REF> --password <MOT_DE_PASSE_DB>

# Appliquer les migrations + le seed sur la base hébergée
$env:SCOLIA_DB_URL="postgresql://postgres:<mdp>@db.<ref>.supabase.co:5432/postgres"
npm run db:push:remote

# Déployer les Edge Functions et leurs secrets
npx supabase functions deploy --use-api
npx supabase secrets set SCOLIA_WEBHOOK_SECRET=<32 octets hex> APP_ENV=sandbox

# Lancer les 11 suites pgTAP contre la base hébergée (pgTAP doit être dans
# le schéma `pgtap` : voir scripts/run-rls-tests.mjs)
npm run test:rls:remote

# Types TypeScript depuis la base hébergée
npm run types:db:remote

# Front
cp .env.example .env        # VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
npm run dev
```

**Clé du front :** utiliser la clé *publishable* (`sb_publishable_…`), pas
l'ancienne clé anon JWT (`eyJ…`). Le gateway des Edge Functions rejette
l'ancienne clé (`Invalid JWT`) alors qu'elle fonctionne encore sur PostgREST
et sur l'API Auth. Les deux sont publiques et conçues pour le navigateur ;
la RLS fait la séparation.

**`APP_ENV=sandbox` :** à ne PAS définir en production — en sandbox,
`pay-installment` solde les échéances immédiatement au lieu d'attendre la
confirmation signée du prestataire.

### 1.2 Stack locale (Docker) — supprimée

Le projet n'utilise **que la base de données hébergée Supabase** : Docker et la
stack local Supabase (`supabase start` / `db reset` / `test db`) ne sont plus
utilisés. Toute opération passe par la base hébergée :

```bash
npm run test:rls:remote      # suites pgTAP contre la base hébergée
npm run types:db:remote      # régénère ../frontend/src/types/database.generated.ts
npm run db:push:remote       # pousse les migrations vers la base hébergée
```

Secrets Edge Functions (Dashboard > Edge Functions > Secrets) : `PAYMENT_WEBHOOK_SECRET`,
`PAYMENT_PROVIDER_API_KEY`, `SCOLIA_WEBHOOK_SECRET` (sandbox), `NOTIFIER_*`.

---

## 2. Modèle de sécurité (parité front/serveur)

- **`school_id` ne vient jamais du client.** Toutes les fonctions et règles RLS
  le déduisent du JWT (`current_school_id()`).
- **`user_can_query_data()`** : rôle dont le compte est `ACTIF` et le mot de
  passe initial changé. Sans elle, aucune lecture métier.
- **`school_is_writable()`** : école avec abonnement en écriture (jamais
  `EXPIRE` pur). Sans elle, aucune écriture métier (mode lecture seule).
- **`direction_can_write()`** : directeur de SON école. Les écritures
  structurantes (classes, matières, coefficients, enseignants) sont directes ;
  tout le reste passe par des RPC `security definer`.
- Les statuts d'échéances (`paye/partiel/en_retard/a_venir`) sont **calculés par
  un trigger** (`trg_set_payment_status`), jamais fournis par le client.
- Les limites de formule (nombre d'élèves) sont vérifiées côté serveur, avec
  les **messages français identiques à ceux du front**.

## 3. Migrations

| Fichier | Contenu |
|---|---|
| `00001_foundation` | tables (schools, classes, students, parents, grades, payments, abonnements…), enums `app_*` |
| `00002_rls_helpers` | `current_school_id`, `current_role`, `user_can_query_data`, `school_is_writable`, `direction_can_write`, année scolaire / périodes |
| `00003_auth_accounts` | profils, comptes staff/parent/élève, RLS, comptes désactivés/en attente |
| `00004_registration_rpcs` | `finish_*_registration`, demandes d'inscription, `decide_registration_requests` |
| `00005_link_child` | rattachement parent ⇄ code enfant (`link_child`) |
| `00006_structure` | classes/matières/coefficients/affectations, conflits, plafond de trimestre, `enroll_student`, `open_classes` |
| `00007_subscriptions` | abonnements, matricule d'école, `verify_matricule`, `apply_paid_subscription` |
| `00008_grades` | `save_grade`, `update_report_meta`, `class_report_cards` |
| `00009_family_payments` | `record_cash_payment`, `start_installment_payments`, `apply_paid_installment`, `send_reminders` |
| `00010_messagerie_absences` | conversations/annonces (`list_conversations`, `start_conversation`, `send_message`, `mark_conversation_read`, `post_announcement`), absences (surveillant), `admin_dashboard` |
| `00011_function_execute_durcissement` | droits d'exécution des fonctions `security definer` : aucune n'est accessible à `anon` en dehors des surfaces publiques (`verify_matricule`, `open_classes`) |
| `00012_fix_student_matricule` | correctif matricule élève |
| `00013_referentiels_globaux` | insertions idempotentes des référentiels `levels` et `plans` (données de production ; sorties du seed) |
| `00029_role_secretaire` | rôle `secretaire` (domaine `app_role`), création d'accès par la direction, lecture seule des élèves/notes/annuaire du personnel |

## 4. Edge Functions (Deno)

Toutes répondent en JSON `{...}` ou `{error: "<message FR>"}` avec code HTTP.

| Fonction | Rôle | Entrée → Sortie |
|---|---|---|
| `register-director` | anon | `{firstName,lastName,email,phone,password,schoolName,city,cycles}` |
| `register-student` | anon | `{schoolId\|matricule, ...}` → `{user, requestId, approved}` |
| `register-parent` | anon | idem → `{user, requestId, approved, childName}` |
| `login-guard` | session | `POST` vide → statut du compte (`ACTIF`…), bloque désactivé/en attente |
| `create-staff-account` | directeur | `{role,firstName,lastName,email,phone,specialties,tempPassword}` → `userId, tempPassword` |
| `update-staff` / `reset-staff-password` / `set-staff-active` | directeur | gestion du staff |
| `verify-matricule` | anon | `{matricule}` → `{ok, reason, message, school?}` (mêmes motifs que le front) |
| `start-subscription` | directeur | `{planId,cycle,method,phone}` → transaction PENDING (prix serveur) |
| `pay-installment` | parent/élève | `{paymentIds,method,phone}` → échéances de SA famille uniquement |
| `payment-webhook` | prestataire | HMAC `x-scolia-signature` ou `secret` sandbox ; idempotent, dispatch par `tx_kind` |

## 5. RPCs côté front (js client)

- Structure : `replace_cell_teachers`, `set_class_head_teacher`, `open_classes`,
  `assignment_conflicts`
- Comptes / inscriptions : `finish_director_registration`,
  `finish_staff_registration`, `finish_parent_registration`,
  `finish_student_registration`, `complete_password_change`, `link_child`
- Élèves : `enroll_student`, `decide_registration_requests(p_ids, p_approve, p_reason)`
- Notes : `save_grade`, `update_report_meta`
- Paiements : `record_cash_payment`, `send_reminders`
- Messagerie : `list_conversations`, `start_conversation`, `send_message`,
  `mark_conversation_read`, `post_announcement`
- Tableau de bord : `admin_dashboard('S1'|'S2')`

## 6. Côté front (`src/`)

- `src/lib/supabase.ts` : client sans générique (le type `Database` reste dans
  `src/types/database.generated.ts`, régénéré par `npm run types:db:remote`).
- `src/lib/functions.ts` : `callFunction(name, body)` — fetch vers
  `/functions/v1/…` avec `apikey` + `Authorization`, erreur `{error}` → `Error` FR.
- `src/services/db.ts` : **cache de référence hydraté Supabase** (même surface
  que l'ancien store localStorage : `db`, `xOf`, `respond`, `hydrate(entité)`,
  `hydrateAll`, `resetDatabase`). Lectures = cache (hydraté selon la RLS du
  rôle) ; écritures = RPC/EF puis `hydrate(entité)`. Latence simulée conservée.
- Services (`authService`, `studentService`, …) : signatures publiques
  inchangées ; seuls « renouveler un abonnement » (passe par le checkout) et
  `sendReminders(studentIds)` diffèrent (clés en moins).

## 7. Tests pgTAP

`supabase/tests/rls_001…007` (plans 14/10/30/25/23/24/33) : deux écoles,
personas de tous rôles, vérification de l'isolation et des écritures.
`supabase/tests/rls_008…011` : suites d'audit (isolation multi-écoles,
contrôle d'accès par rôle, encaissements/abonnements, parité des calculs) ;
elles décrivent le comportement attendu et doivent être vertes.
`scripts/audit-parite.mjs` : parité front ⇄ serveur (calculs, seuils, dates).
Exécution : `npx supabase test db` (nécessite Docker).

## 8. Paiement de bout en bout (bac à sable local)

Le secret de signature du webhook **n'est jamais connu du navigateur** : il vit
dans l'environnement du poste de développement. Le front crée la transaction
(`start-subscription`), puis **attend** la confirmation du prestataire.

```bash
# 1. le directeur lance l'achat depuis /app/abonnement
#    → référence WV-1234-5678 affichée par l'Edge Function
# 2. le poste de développement joue le rôle du prestataire :
$env:SCOLIA_WEBHOOK_SECRET = "scolia-dev-secret"   # secret côté serveur
node scripts/confirm-sandbox-payment.mjs wave WV-1234-5678 succeeded
# 3. le front détecte l'abonnement actif et affiche le matricule d'école
```

En production, l'étape 2 est faite par le prestataire (Wave / Orange Money /
Free Money) avec la même signature HMAC.

Variables d'environnement des Edge Functions :

| Variable | Rôle |
|---|---|
| `SCOLIA_WEBHOOK_SECRET` | secret HMAC du webhook (≥ 16 caractères, **jamais** `scolia-dev-secret`) |
| `APP_ENV` | `sandbox` active l'auto-confirmation des échéances de famille (bac à sable local uniquement) |

En production, `APP_ENV` n'est **pas** défini : `pay-installment` ouvre les
transactions chez le prestataire et laisse la confirmation au webhook signé.

## 9. Points ouverts

- Exécution des tests pgTAP contre la base hébergée (`npm run test:rls:remote`).
- En production : brancher le vrai agrégateur (`PAYMENT_PROVIDER_API_KEY`).
