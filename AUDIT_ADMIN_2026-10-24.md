# Audit — section Administration Classora (24 octobre 2026)

Périmètre : `/admin/*` (connexion, tableau de bord, établissements, agents),
API `backend/api/src/routes/admin*`, migration `00024_admin_agents.sql` et
`00025_admin_school_stats.sql`.

Méthode : lecture du code, appels réels en lecture seule au projet Supabase et
à l'API déployée, exécution locale de l'API et du front, `tsc --noEmit`, build
Vite. Aucune donnée n'a été modifiée en base.

---

## 0. Mise à jour — services réels vérifiés (24/10, soir)

| Service | URL | État constaté |
| --- | --- | --- |
| API | `https://classora-backend-a7n1.onrender.com` | **En ligne** : `/healthz` → `{"ok":true,"supabaseConfigured":true}` ; `/admin/auth` sans jeton → `401` (routes admin chargées) |
| Front | `https://classora-frontend.onrender.com` | **Suspendu par le propriétaire** (`503 Service Suspended`) |
| CORS | origine du front déployé + `http://localhost:5173` | **Refusées** : `POST /admin/auth` → `403 {"error":"Origine non autorisée."}` |

L'URL `https://scolia-api.onrender.com` citée au §1 n'existe pas (`404`) :
c'était l'ancienne valeur de `.env.example`, corrigée depuis. L'API est donc
bien déployée et connectée à Supabase ; le blocage est **réseau (front
suspendu) + CORS**, avant même la question du profil `admin_agents`.

---

## 1. Verdict

**La section admin est bien câblée à la base de données, mais la connexion ne
peut pas aboutir dans l'état déployé.** Trois causes indépendantes se cumulent :

1. **La chaîne réseau / CORS ne correspond pas aux services réels** : l'API
   est bien déployée (`classora-backend-a7n1`, `/healthz` OK, §0), mais le
   front déployé `classora-frontend` est **suspendu** et l'API **refuse son
   origine** (`403 Origine non autorisée`). L'ancienne URL `scolia-api` du
   dépôt n'existe pas (`404`).
2. **Le build analysé n'embarque pas la bonne `VITE_API_URL`** : le bundle
   local pointe vers `http://localhost:3000` ; la valeur de production doit
   être définie sur le service front **puis rebuild** (Vite l'inline).
3. **Le premier superadministrateur n'est créé par aucun fichier du dépôt** :
   la table `admin_agents` existe mais reste vide tant que l'on ne lance pas
   le script d'amorçage ou le SQL du §8. Seule l'API (`service_role`) peut y
   écrire — elle-même réservée au superadmin : le verrou est circulaire.

Tant que ces trois points ne sont pas réglés, `/admin/connexion` affichera
« Aucun accès administratif associé à ce compte » avec des identifiants
pourtant valides.

---

## 2. Preuves de connexion à la base (exécutées)

| Vérification | Résultat |
| --- | --- |
| `GET /rest/v1/admin_agents?select=id,matricule,role,status` (clé publishable) | **HTTP 200 `[]`** → la table existe et la RLS ferme la lecture anonyme (migration 00024 appliquée) |
| `POST /rest/v1/rpc/generate_admin_matricule` (anon) | **HTTP 401 `permission denied for function`** → la fonction existe et est bien réservée à `service_role` |
| `POST /rest/v1/rpc/admin_school_stats` (anon) | **HTTP 401 `permission denied for function`** → migration 00025 appliquée et verrouillée |
| `GET https://scolia-api.onrender.com/healthz` | **HTTP 404 `Not Found`** → cette URL (ancienne) n'existe pas ; l'API réelle est `classora-backend-a7n1` (voir §0) |
| Bundle `frontend/dist/index.html` (avant correctifs) | `scolia-api` : **0 occurrence**, « API non configurée » : **1** → build sans `VITE_API_URL` |
| Développement local (`vite`) | l'appel réel observé est `http://localhost:3000/admin/auth` → `.env.local` pointe vers une API locale **qui ne tourne pas** ; `backend/api` n'a aucun `.env.local` et ne chargeait de toute façon pas les fichiers `.env` (corrigé, ADM-16) |

Conclusion : la couche base est saine (tables, RPC, RLS). Ce sont l'API et
l'amorçage du premier compte qui bloquent.

---

## 3. Chaîne de connexion attendue

1. `/admin/connexion` → `supabase.auth.signInWithPassword` (Supabase Auth).
2. `verify()` → `POST {VITE_API_URL}/admin/auth` avec le JWT.
3. L'API vérifie le JWT via `svc.auth.getUser(jwt)` puis cherche la ligne
   `admin_agents` correspondant à `auth_user_id`.
4. Si le profil est `ACTIF`, la session admin est ouverte ; sinon message.

Un compte créé via l'inscription scolaire possède une ligne `profiles`, **pas**
de ligne `admin_agents` : il est donc normal qu'il soit refusé côté admin.

---

## 4. Constats

Légende statut : **Corrigé** = modifié dans ce lot ; **Action** = dépend du
déploiement ou des données.

| ID | Gravité | Constat | Statut |
| --- | --- | --- | --- |
| ADM-01 | Critique | API admin absente (`/healthz` 404) : toute vérification échoue | **Action** (Render) |
| ADM-02 | Critique | Build sans `VITE_API_URL` : `callFunction` lève « API non configurée » | Corrigé côté code + variable déclarée dans `render.yaml` ; **Action** : renseigner sa valeur et rebuild |
| ADM-03 | Critique | Aucun superadmin d'amorçage ; création réservée au superadmin (verrou) | Corrigé (script `npm run admin:bootstrap`) |
| ADM-04 | Élevé | Création d'agent sans mot de passe (`undefined`) → compte inutilisable | Corrigé (mot de passe **fixe obligatoire**, choisi par le superadmin, aucun temporaire généré) |
| ADM-05 | Élevé | CORS : `PATCH` absent de `Access-Control-Allow-Methods` → préflight bloqué pour modifier un agent / une école | Corrigé |
| ADM-06 | Élevé | `callFunction` n'envoyait un corps **que** pour `POST` → `PATCH` sans `agentId`/`schoolId`, réponse « obligatoire » | Corrigé |
| ADM-07 | Moyen | `notFound` utilisé sans import dans `adminAgents.js` → `ReferenceError` / 500 | Corrigé |
| ADM-08 | Moyen | Filtre statut des écoles : un *builder* Supabase passé à `.in()` → filtre PostgREST invalide | Corrigé (filtre sur `registration_open`, la valeur que `setStatus` modifie et que le badge lit) |
| ADM-09 | Moyen | Toute erreur de vérification affichée comme « Aucun accès administratif » → diagnostic impossible | Corrigé (message serveur réel) |
| ADM-10 | Moyen | `logout()` admin ne fermait pas la session Supabase → reconnexion immédiate au rechargement | Corrigé (`signOut`) |
| ADM-11 | Moyen | `AdminProtectedRoute` jamais branchée : `/admin` sans session affichait une page blanche | Corrigé (garde + écran de vérification) |
| ADM-12 | Moyen | Changement d'e-mail d'un agent non propagé à Supabase Auth → connexion impossible avec la nouvelle adresse | Corrigé |
| ADM-13 | Moyen | `GET /admin/agents` accessible à `admin`/`agent_suivi` alors que documenté superadmin (fuite e-mails/téléphones de l'équipe) | Corrigé (superadmin uniquement) |
| ADM-14 | Faible | Configuration serveur absente → 500 opaque au lieu d'un message d'installation | Corrigé (503 explicite) |
| ADM-15 | Faible | `sortBy` transmis tel quel à PostgREST | Corrigé (liste blanche `name`, `matricule`, `city`, `created_at`) |
| ADM-16 | Élevé | `.env.local` n'était **jamais chargé** par l'API (`node src/index.js`, pas de dotenv) → `SUPABASE_SERVICE_ROLE_KEY` absente en local, donc vérification admin impossible malgré une configuration correcte | Corrigé (`src/env.js`, chargé avant `config.js`) |
| ADM-17 | Critique | `FRONTEND_ORIGIN` ne contient pas l'origine du front déployé ni celle du dev local → **403 « Origine non autorisée »** sur `/admin/auth` | **Action** (Render > API > Environment) : `FRONTEND_ORIGIN=https://classora-frontend.onrender.com,http://localhost:5173` |
| ADM-18 | Critique | Service front `classora-frontend` **suspendu** (`503 Service Suspended`) | **Action** (Render) : reprendre le service |

Points résiduels (non bloquants, non modifiés) : le « statut » d'une école est
porté par `registration_open` faute de colonne dédiée — suspendre une école
ferme donc aussi ses inscriptions ; et la fiche établissement retrouve l'école
dans les 100 premières du tri par nom (au-delà, elle afficherait « introuvable »).

Fichiers modifiés : `backend/api/src/{env.js,index.js,lib/http.js,routes/adminAgents.js,routes/adminSchools.js}`,
`backend/api/scripts/bootstrap-admin.mjs` (nouveau), `backend/api/package.json`,
`backend/api/README.md`, `render.yaml`, `frontend/src/{lib/functions.ts,context/AdminAuthContext.tsx,App.tsx,routes/adminGuards.tsx,services/admin.ts,pages/auth/AdminLoginPage.tsx,pages/app/AdminAgentsPage.tsx}`.

---

## 5. Ce qu'il reste à faire (dans l'ordre)

1. **Corriger le CORS de l'API** — Render > service API
   `classora-backend-a7n1` > Environment :
   `FRONTEND_ORIGIN=https://classora-frontend.onrender.com,http://localhost:5173`
   (chaque origine séparée par une virgule, sans slash final). L'API est déjà
   déployée et connectée : `/healthz` répond `supabaseConfigured:true`. Sans
   cette variable, tout appel du navigateur reçoit `403 Origine non autorisée`.
2. **Remettre le front en ligne** — Render > service `classora-frontend` :
   il est **suspendu** (`503 Service Suspended`) ; le reprendre, puis
   Environment : `VITE_API_URL=https://classora-backend-a7n1.onrender.com`,
   et **rebuild** (les variables `VITE_*` sont figées dans le bundle).
3. **Amorcer le superadministrateur** — depuis `backend/api` :
   ```bash
   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… \
   ADMIN_EMAIL=vous@classora.sn ADMIN_PASSWORD='…' \
   ADMIN_FIRST_NAME=… ADMIN_LAST_NAME=… \
     npm run admin:bootstrap
   ```
   Le script est idempotent ; il rattache le compte Auth existant ou le crée.
4. Vérifier `https://classora-backend-a7n1.onrender.com/healthz` →
   `{"ok":true,"supabaseConfigured":true}`, puis se connecter sur
   `/admin/connexion`.
5. En local : créer `backend/api/.env.local` (`SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`) et lancer `npm run dev` dans `backend/api`
   **avant** le front (le front vise `http://localhost:3000`). Le fichier est
   désormais chargé automatiquement au démarrage de l'API.

Migrations : `00024` et `00025` sont déjà présentes sur le projet Supabase
utilisé par le front (cf. §2). Si vous changez de projet, rejouez
`npm run db:push:remote` avec `SCOLIA_DB_URL`.

---

## 6. Vérifications effectuées sur ce lot

| Test | Résultat |
| --- | --- |
| `node --check` sur les 5 fichiers API + script d'amorçage | OK |
| Script d'amorçage sans variables | échec contrôlé (code 1) avec message d'usage |
| API locale `GET /healthz` | `{"ok":true,"supabaseConfigured":false}` |
| Préflight `OPTIONS /admin/agents` (PATCH) | `204`, `Allow-Methods: GET, POST, PATCH, OPTIONS` |
| `POST /admin/auth` sans configuration | `503` + message explicite |
| `npx tsc --noEmit` (front) | 0 erreur |
| `npm run build` (front) | OK, 874 modules, bundle généré |
| Navigateur : `/admin` sans session | redirige vers `/admin/connexion`, formulaire affiché |
| Connexion admin réelle (JWT valide → ligne `admin_agents`) | **non exécutée** : aucune clé `service_role` ni mot de passe admin disponibles ici |
| Filtres/tri de la liste des écoles contre la base réelle | **non exécutés** (même raison) |

Les deux dernières lignes restent à valider après l'amorçage du compte ; le
message d'erreur affiché par la page de connexion indiquera désormais
précisément lequel des maillons échoue.

---

## 7. Vérification des migrations (25/25 appliquées)

Contrôle effectué sur le projet Supabase utilisé par le front
(`wjfgtmaplqfblpidryld`), par appels REST en lecture seule avec la clé
publishable. Le schéma `supabase_migrations` n'est pas exposé par PostgREST :
la vérification est donc faite **objet par objet**, pas sur l'historique CLI.

| Contrôle | Résultat | Conclusion |
| --- | --- | --- |
| 27 tables attendues (`schools`, `students`, `payments`, `admin_agents`…) | **toutes présentes** (`200` ou `401` sur droits, jamais `404`) | migrations 00001→00010 et 00024 appliquées |
| `payment_transactions` | **absente** (`404`) | normal : supprimée par 00016 |
| Colonnes `admin_agents` (`auth_user_id`, `matricule`, `role`, `status`, `first_name`, `last_name`, `email`, `phone`, `created_at`, `updated_at`) | `200` | 00024 complète |
| Colonnes `schools` (`address`, `matricule`, `cycles`, `registration_open`, `auto_approve_students`…) | `200` | 00001/00023 appliquées |
| Données de référence : `levels` / `plans` | **13** / **4** lignes | 00013 appliquée |
| `request_subscription_activation` (00019), `school_is_writable` (00021), `finish_director_registration` **9 arguments** dont `p_address` (00023) | `401 permission denied` = fonction **existante** | 00019/00021/00023 appliquées |
| `generate_admin_matricule` (00024), `admin_school_stats` (00025) | `401 permission denied` = fonctions **existantes** | 00024/00025 appliquées |
| `apply_paid_subscription`, `apply_paid_installment`, `start_installment_payments`, `new_payment_reference` | **`404` introuvables** | 00016 appliquée (elles ont bien été supprimées) |

**Conclusion : aucune migration ne manque.** L'état de la base est celui attendu
à la migration 00025. Le refus de connexion admin ne vient donc pas du schéma.

---

## 8. Si la connexion admin échoue encore : arbre de décision

Le message affiché sur `/admin/connexion` (corrigé dans ce lot) désigne
directement le maillon fautif :

| Message affiché | Cause | Correctif |
| --- | --- | --- |
| « Service indisponible… » / « API non configurée » | API non démarrée ou `VITE_API_URL` absent du build | Déployer `backend/api`, renseigner `VITE_API_URL`, rebuild |
| « Service d'administration non configuré… » (`503`) | `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` absents côté serveur | Renseigner les variables du Web Service Render |
| « Origine non autorisée. » (`403`) | L'origine exacte du front n'est pas dans `FRONTEND_ORIGIN` de l'API | Ajouter `https://classora-frontend.onrender.com` et `http://localhost:5173` (séparées par une virgule) puis redéployer |
| « Aucun profil administrateur associé à ce compte. » | Le compte Auth existe mais **aucune ligne `admin_agents`** | Amorcer le compte (§5, ou SQL ci-dessous) |
| « Ce compte administratif est désactivé / en attente… » | `admin_agents.status` ≠ `ACTIF` | Passer le statut à `ACTIF` |
| « E-mail ou mot de passe incorrect. » | Refus de **Supabase Auth** : mauvais mot de passe, compte inexistant, **ou e-mail non confirmé** | Vérifier `auth.users` ci-dessous |

Point important relevé sur le projet : `mailer_autoconfirm = false` (confirmation
d'e-mail obligatoire). Un utilisateur créé à la main dans le dashboard Supabase
sans « Auto Confirm User » ne peut **pas** se connecter : Supabase refuse, et le
front affiche « E-mail ou mot de passe incorrect. ».

À exécuter dans **Supabase > SQL Editor** pour voir l'état réel :

```sql
select u.id, u.email, u.email_confirmed_at, u.banned_until,
       a.matricule, a.role, a.status
from auth.users u
left join public.admin_agents a on a.auth_user_id = u.id
order by u.created_at desc;
```

Puis, pour confirmer l'e-mail et créer le profil superadmin s'il manque
(remplacer l'adresse et l'identité) :

```sql
-- 1) Confirmer l'e-mail (sinon Supabase Auth refuse la connexion)
update auth.users
   set email_confirmed_at = coalesce(email_confirmed_at, now())
 where lower(email) = lower('vous@classora.sn');

-- 2) Créer le profil admin manquant
insert into public.admin_agents
  (auth_user_id, matricule, role, status, first_name, last_name, email)
select u.id,
       'CLA-ADM-' || lpad((coalesce((select max(substring(matricule from '\d+$')::int)
                                     from public.admin_agents), 0) + 1)::text, 6, '0'),
       'superadmin', 'ACTIF', 'Prénom', 'Nom', lower(u.email)
  from auth.users u
 where lower(u.email) = lower('vous@classora.sn')
on conflict (auth_user_id) do update
   set role = 'superadmin', status = 'ACTIF';
```

Ne pas utiliser `/connexion` (espace scolaire) pour un agent admin : le bon
écran est `/admin/connexion`.
