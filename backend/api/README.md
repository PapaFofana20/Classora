# API SCOLIA sur Render

Backend Node/Express 20 (sans Docker) qui **remplace les Edge Functions
Deno**. Le reste de l'architecture est inchangé :

- **Supabase = Auth + base de données** : comptes et mots de passe de
  connexion (Supabase Auth), écoles, élèves, parents, notes, paiements…
  (PostgreSQL + politiques RLS) ;
- **front = React** : il s'adresse à Supabase (lectures RLS, session) ET à
  cette API (inscriptions, gestion du personnel) ;
- **cette API = logique privilégiée** : elle seule détient le service_role.

> Déployer via le dashboard Render en créant un **Web Service** (voir plus
> bas) — pas selon le Blueprint `render.yaml`, qui ne décrit que le site
> statique du front.
>
> **Paiement mobile money (Wave / Orange Money / Free)** : retiré pour
> l'instant (`start-subscription`, `pay-installment`, `payment-webhook`
> supprimés, abonnement activé manuellement côté support). Les échéances de
> scolarité restent suivies (soldes + encaissement espèces par l'économe).

## Démarrage local

```bash
cd backend/api
npm install
cp .env.example .env.local       # renseigner SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
npm run dev                      # http://localhost:3000/healthz
```

`.env.local` puis `.env` sont chargés automatiquement au démarrage
(`src/env.js`, sans dépendance) ; les variables déjà définies par
l'environnement restent prioritaires (Render). Sans
`SUPABASE_SERVICE_ROLE_KEY`, les routes `/admin/*` répondent `503` et la
connexion admin est impossible.

Côté front (`frontend/.env.local`) :

```
VITE_API_URL=http://localhost:3000
```

## Déploiement Render — Web Service (dashboard, pas de Blueprint)

1. Render > **New > Web Service** > connecter le dépôt GitHub :
   - **Language / Runtime** : Node 20+
   - **Root Directory** : `backend/api`
   - **Build Command** : `npm ci`
   - **Start Command** : `npm start`
   - **Health Check Path** : `/healthz`
2. Variables d'environnement (Render > Web Service > Environment, voir
   `.env.example` du dossier) :
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, et `FRONTEND_ORIGIN`.
   Ce dernier **doit lister toutes les origines** qui appellent l'API,
   séparées par des virgules, par exemple :
   `FRONTEND_ORIGIN=https://classora-frontend.onrender.com,http://localhost:5173`.
   Sans l'origine exacte du front, le navigateur reçoit
   `403 Origine non autorisée` sur `/admin/auth` — même avec des identifiants
   valides.
3. Front : définir `VITE_API_URL=https://<service>.onrender.com`
   (ex. `https://classora-backend-a7n1.onrender.com`), puis **rebuild** :
   Vite grave cette valeur dans le bundle.

## Amorçage du premier superadministrateur (obligatoire)

Les routes `/admin/*` exigent une ligne dans `public.admin_agents`. La migration
`00024_admin_agents.sql` crée la table **vide** et seule l'API (`service_role`)
peut y écrire : sans amorçage, `/admin/connexion` répond « Aucun profil
administrateur associé à ce compte » même avec des identifiants Supabase valides.

Depuis `backend/api`, avec les variables d'environnement du Web Service :

```bash
SUPABASE_URL=https://<ref>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<clé service_role> \
ADMIN_EMAIL=vous@classora.sn \
ADMIN_PASSWORD='<mot de passe>' \
ADMIN_FIRST_NAME=Papa ADMIN_LAST_NAME=Fofana \
  npm run admin:bootstrap
```

(Sous PowerShell, définir les variables avec `$env:ADMIN_EMAIL = "…"` avant
`npm run admin:bootstrap`.)

Le script est **idempotent** : il réutilise le compte Auth s'il existe, crée la
matricule `CLA-ADM-000001` et le profil `admin_agents` (rôle `superadmin`,
statut `ACTIF`). Les migrations `00024` et `00025` doivent être appliquées
(`npm run db:push:remote` à la racine, avec `SCOLIA_DB_URL`).

## Routes (contrat identique aux Edge Functions)

| Route | Accès | Description |
| --- | --- | --- |
| `POST /login-guard` | JWT | contrôle post-connexion (statut, audit) |
| `GET/POST /verify-matricule` | public | vérifier un matricule d'école |
| `POST /register-director` \| `/register-student` \| `/register-parent` | public | inscriptions |
| `POST /create-staff-account` \| `/update-staff` \| `/reset-staff-password` \| `/set-staff-active` | directeur | gestion du personnel |
| `POST /admin/auth` | agent admin ACTIF | vérifie la session et le profil administrateur |
| `GET/POST/PATCH /admin/agents` | superadmin | liste, création, modification des agents |
| `GET/PATCH /admin/schools` | agent admin | liste et modification des écoles |
| `POST /admin/schools` (`action: "setStatus"`) | superadmin | activation / suspension |
| `GET /admin/stats` | agent admin | statistiques transversales |

## Ce qui ne change pas

- Les migrations SQL (`backend/supabase/migrations`) restent appliquées sur
  Supabase (CLI ou SQL Editor) — RLS, RPC et rate limiting server-side
  incluses ; l'API les utilise telles quelles.
- Les sessions/mots de passe restent gérés par Supabase Auth : le front
  `signInWithPassword` est inchangé, le JWT porté à chaque appel est vérifié
  par cette API auprès de Supabase Auth, jamais décodé.
- Rate limiting : RPC atomique `sys_rate_limit` en base (migration 15),
  compatible multi-instances Render.
