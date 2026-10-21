# API SCOLIA sur Render

Backend Node/Express 20 (sans Docker) qui **remplace les 12 Edge Functions
Deno**. Le reste de l'architecture est inchangé :

- **Supabase = Auth + base de données** : comptes et mots de passe de
  connexion (Supabase Auth), écoles, élèves, parents, notes, paiements…
  (PostgreSQL + politiques RLS) ;
- **front = React** : il s'adresse à Supabase (lectures RLS, session) ET à
  cette API (inscriptions, gestion du personnel, paiements) ;
- **cette API = logique privilégiée** : elle seule détient le service_role
  et le secret HMAC des webhooks.

> Déployer via le dashboard Render en créant un **Web Service** (voir plus
> bas) — pas selon le Blueprint `render.yaml`, qui ne décrit que le site
> statique du front.

## Démarrage local

```bash
cd backend/api
npm install
cp .env.example .env.local       # renseigner SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SCOLIA_WEBHOOK_SECRET
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
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SCOLIA_WEBHOOK_SECRET`,
   `FRONTEND_ORIGIN` (origine du front en production, obligatoire pour le
   CORS), `APP_ENV=production` (jamais `sandbox`).
3. Front : définir `VITE_API_URL=https://<service>.onrender.com`.
4. Le dashboard du prestataire de paiement doit poster ses confirmations sur
   `https://<service>.onrender.com/payment-webhook` (en-tête
   `x-scolia-signature` = hex SHA-256 du corps brut).

## Routes (contrat identique aux Edge Functions)

| Route | Accès | Description |
| --- | --- | --- |
| `POST /login-guard` | JWT | contrôle post-connexion (statut, audit) |
| `GET/POST /verify-matricule` | public | vérifier un matricule d'école |
| `POST /register-director` \| `/register-student` \| `/register-parent` | public | inscriptions |
| `POST /create-staff-account` \| `/update-staff` \| `/reset-staff-password` \| `/set-staff-active` | directeur | gestion du personnel |
| `POST /start-subscription` | directeur | ouvrir un paiement d'abonnement |
| `POST /pay-installment` | famille | ouvrir un paiement d'échéances |
| `POST /payment-webhook` | HMAC | confirmation des paiements (idempotent) |

## Ce qui ne change pas

- Les migrations SQL (`backend/supabase/migrations`) restent appliquées sur
  Supabase (CLI ou SQL Editor) — RLS, RPC et rate limiting server-side
  incluses ; l'API les utilise telles quelles.
- Les sessions/mots de passe restent gérés par Supabase Auth : le front
  `signInWithPassword` est inchangé, le JWT porté à chaque appel est vérifié
  par cette API auprès de Supabase Auth, jamais décodé.
- Rate limiting : RPC atomique `sys_rate_limit` en base (migration 15),
  compatible multi-instances Render.
