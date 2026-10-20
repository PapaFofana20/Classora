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

```bash
# Prérequis : Docker + Supabase CLI
npx supabase start          # API : http://127.0.0.1:54321
npx supabase db reset       # applique les 10 migrations
npx supabase functions serve --env-file supabase/.env   # (facultatif, local)
npx supabase test db        # 7 suites pgTAP
npm run types:db            # régénère src/types/database.generated.ts

# Front
cp .env.example .env        # VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
npm run dev
```

Secrets Edge Functions (Dashboard > Edge Functions > Secrets, ou
`supabase/.env` en local) : `PAYMENT_WEBHOOK_SECRET`, `PAYMENT_PROVIDER_API_KEY`,
`SCOLIA_WEBHOOK_SECRET` (sandbox), `NOTIFIER_*`.

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
  `src/types/database.generated.ts`, régénéré par `npm run types:db`).
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
Exécution : `npx supabase test db` (nécessite Docker).

## 8. Points ouverts

- Exécution des tests pgTAP et `npm run types:db` (Docker requis).
- En production : brancher le vrai agrégateur (`PAYMENT_PROVIDER_API_KEY`) et
  retirer la confirmation sandbox du front (achat réel via le prestataire).
