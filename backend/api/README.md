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
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `FRONTEND_ORIGIN` (origine
   du front en production, obligatoire pour le CORS).
3. Front : définir `VITE_API_URL=https://<service>.onrender.com`.

## Routes (contrat identique aux Edge Functions)

| Route | Accès | Description |
| --- | --- | --- |
| `POST /login-guard` | JWT | contrôle post-connexion (statut, audit) |
| `GET/POST /verify-matricule` | public | vérifier un matricule d'école |
| `POST /register-director` \| `/register-student` \| `/register-parent` | public | inscriptions |
| `POST /create-staff-account` \| `/update-staff` \| `/reset-staff-password` \| `/set-staff-active` | directeur | gestion du personnel |

## Ce qui ne change pas

- Les migrations SQL (`backend/supabase/migrations`) restent appliquées sur
  Supabase (CLI ou SQL Editor) — RLS, RPC et rate limiting server-side
  incluses ; l'API les utilise telles quelles.
- Les sessions/mots de passe restent gérés par Supabase Auth : le front
  `signInWithPassword` est inchangé, le JWT porté à chaque appel est vérifié
  par cette API auprès de Supabase Auth, jamais décodé.
- Rate limiting : RPC atomique `sys_rate_limit` en base (migration 15),
  compatible multi-instances Render.
