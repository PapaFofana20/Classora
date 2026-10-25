# Audit complet code & sécurité — Classora (25 octobre 2026)

Périmètre : frontend (React/TS), backend (API Express), base de données
(Schéma SQL + projet Supabase `wjfgtmaplqfblpidryld` en lecture seule),
déploiement (Render). Aucune donnée modifiée hors corrections de code
explicitement listées.

Méthode : deux revues de code exhaustives (backend : 15 routes + libs ;
frontend : services/context/gardes/composants), vérifications live de la
base (RLS testée en anonyme et utilisateur authentifié sans profil),
inspection de l'historique git pour secrets, tests réels de l'API corrigée
en local, `tsc --noEmit`, `node --check` sur tous les fichiers, build.

---

## 1. Verdict global

Le socle est **sain** : JWT toujours vérifié côté serveur (jamais décodé),
IDOR fermé sur les routes staff (`school_id` toujours tiré du profil),
RLS **hermétique** (toutes les tables protégées ; tests anonyme +
authentifié-sans-profil : zéro ligne accessible), rate limiting atomique en
base, aucun secret dans l'historique git, aucune XSS (rendu JSX partout,
aucun `dangerouslySetInnerHTML`), aucun token manipulé manuellement.

**17 problèmes significatifs ont été corrigés** (ci-dessous), dont une
escalade de privilèges admin, un verrou d'abonnement jamais monté, un secret
dans le dossier du front, et plusieurs plantages 500 évitables.

---

## 2. Corrections appliquées (toutes vérifiées)

### Sécurité

| # | Problème | Correction | Fichier(s) |
| --- | --- | --- | --- |
| S1 | **Escalade** : `PATCH /admin/schools` laissait tout agent (même `agent_suivi`) modifier `registrationOpen`/`autoApproveStudents` — contournement du verrou superadmin de `setStatus` | Ces deux champs réservés au superadmin | `adminSchools.js` |
| S2 | **Secret serveur dans le front** : `SCOLIA_WEBHOOK_SECRET` (HMAC réel) dans `frontend/.env` | Ligne supprimée (+ commentaire trompeur) ; à ne déclarer QUE côté serveur | `frontend/.env` |
| S3 | **Verrou d'abonnement mort** : `SubscriptionGuard` défini mais jamais monté — écoles bloquées/sans abonnement naviguaient librement | Garde montée dans `/app` ; liens `/inscription/abonnement` (route inexistante) réparés vers `/app/abonnement` | `App.tsx`, `SubscriptionScreens.tsx`, `SubscriptionPage.tsx` |
| S4 | **Anti-énumération par latence** sur `/admin/login` : matricule inconnue répondait instantanément vs lent pour une matricule valide | Vérification de mot de passe factice sur chemin inconnu | `adminLogin.js` |
| S5 | `fetch` sans timeout vers Supabase Auth dans `/admin/login` | `AbortSignal.timeout(10 s)` | `adminLogin.js` |
| S6 | CORS fail-open silencieux en production sans `FRONTEND_ORIGIN` | Avertissement au démarrage en production | `index.js` |
| S7 | Chemins inconnus → HTML Express (fuiteur de stack) | Catch-all JSON 404 | `index.js` |
| S8 | Corps JSON invalide renvoyé 400 **sans en-têtes CORS** | Parseur déplacé après le middleware CORS | `index.js` |
| S9 | En-têtes de durcissement absents | `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` | `index.js` |
| S10 | Mot de passe de confirmation (et champs annexes) transmis à l'API à l'inscription parent/directeur | Payloads explicites | `ParentSignupForm.tsx`, `DirectorSignupForm.tsx` |
| S11 | **Anti-verrouillage console** : un superadmin pouvait se rétrograder/désactiver lui-même, ou toucher le dernier superadmin actif → console injoignable | Interdits explicites (403) dans `PATCH /admin/agents` | `adminAgents.js` |

### Bugs

| # | Problème | Correction | Fichier(s) |
| --- | --- | --- | --- |
| B1 | `ValidationError` convertie en **500** au lieu de 400 sur admin schools/agents (contrat de validation cassé) | Branches `ValidationError` → 400 dans les `catch` | `adminSchools.js`, `adminAgents.js` |
| B2 | `?page=abc` → NaN → **500** sur la liste des écoles | Repli sur valeurs par défaut si non entier | `adminSchools.js` |
| B3 | PATCH d'un établissement inexistant/UUID invalide → **500** | `requireUuid` + `maybeSingle` + 404 | `adminSchools.js` |
| B4 | Filtre `status` inconnu ignoré silencieusement ; `POST` sans action → 405 au lieu de 400 | Liste blanche + 400 explicite | `adminSchools.js` |
| B5 | **L'adresse de l'école était perdue à l'inscription directeur** : la migration 00023 a ajouté `p_address`, l'ancienne Edge Function la transmettait, la route Express non | `p_address` transmis (testé contre la vraie RPC) | `registerDirector.js`, `DirectorInput` |
| B6 | `loginGuard` : panne Supabase affichée « identifiants incorrects » ; statut inconnu traité comme ACTIF (fall-through) | Erreur → 500 ; liste blanche stricte des statuts | `loginGuard.js` |
| B7 | `loadingSession` ignoré : rechargement d'un lien profond `/app/...` → redirection injustifiée vers `/connexion` (URL perdue) | Attente de restauration dans `ProtectedRoute`/`PublicOnlyRoute` | `guards.tsx` |
| B8 | `MatriculeStep` : promesse rejetée non catchée → bloqué sur « Vérification… » à vie en cas de panne | try/catch avec message | `MatriculeStep.tsx` |
| B9 | Dashboard direction : RPC `null` → crash « Cannot read properties of null » | Garde explicite | `statsService.ts` |
| B10 | Écritures Supabase dont les erreurs étaient ignorées (matière auto-titulaire, copie de coefficients) | Erreurs levées avec message FR | `schoolService.ts` |
| B11 | `TODAY_ISO` figé au chargement → dérive après minuit UTC (échéances, jours d'abonnement, date affichée) | Fonction `todayIso()` évaluée à l'appel (9 fichiers) | `data/school.ts` + usages |
| B12 | Crash potentiel `a.action.replace` si valeur nulle ; `inserted` indéfini dans l'audit de création d'agent ; garçons = total − filles (sexe non renseigné compté garçon) | Gardes + requête explicite `gender='M'` | `AdminDashboardPage.tsx`, `adminAgents.js`, `adminSchools.js` |
| B13 | Divers : favicon dupliqué, ternaire mort (`authService`), `logout()` admin sans `void`, type `refresh` menteur, `formatDate` sur ISO cassé, deps `ChildContext`, `requireUuid` sur les 3 routes staff, `PORT` NaN, commentaires inline `.env`, e-mail support incohérent (`support@classora.com` → `contact@classora.sn`), rate limit PATCH admin absent, imports morts, `RATE_LIMIT_RE` dédupliqué | Corrigés | multiples |

## 3. Constats vérifiés SANS problème

- **Base de données** : 29/29 tables avec RLS activée ; lecture anonyme et
  authentifié-sans-profil → 0 ligne sur students, profiles, payments,
  conversations, messages, grades, audit_log, admin_agents, subscriptions,
  schools (tests live). `payments`/`rate_limits` : aucun privilège anon du tout.
- **Git** : aucun secret committé (`.git-credentials`, `.env`, webhook
  vérifiés dans tout l'historique).
- **Frontend** : 0 XSS (aucun `dangerouslySetInnerHTML`/`innerHTML`), liens
  externes protégés, PKCE, sessions Supabase non persistées en clair.
- **Backend** : pas d'injection PostgREST (pas d'`ilike` sur entrée libre,
  tris en liste blanche), school_id jamais lu depuis le client.

## 4. Points NON corrigés (décision produit ou infrastructure requise)

1. **Edge Functions Supabase toujours déployées** (login-guard,
   register-director… vérifiées actives) : duplicata de l'API Render.
   Recommandé : les supprimer du dashboard Supabase pour réduire la surface
   (elles valident correctement leurs entrées, pas de faille active).
2. **Inscription publique sans vérification d'e-mail** (`email_confirm:
   true` immédiat) : possible usurpation d'adresse tierce. Décision produit
   (activer la confirmation d'e-mail dans Supabase Auth) — changer ce
   comportement casserait le parcours d'inscription actuel.
3. Sessions non révoquées à la réinitialisation/désactivation d'un compte
   (les JWT vivent jusqu'à expiration) — nécessite un `session_version` ou
   TTL plus court : changement de schéma.
4. Suppression d'école non transactionnelle (élèves puis école en deux
   requêtes) : une RPC transactionnelle serait plus sûre — migration SQL à
   planifier.
5. `hydrateAll` télécharge 18 tables à chaque connexion (performance) :
   refonte d'hydratation recommandée mais hors périmètre correctif sûr.
6. Témoignages/affirmations marketing du site public (mobile money in-app,
   « répond sous 24 h », % d'impayés) : contenu éditorial à valider par le
   propriétaire — je n'ai rien inventé ni supprimé.
7. Rotation des secrets déjà conseillée : clé `service_role` (transitée en
   conversation) et `SCOLIA_WEBHOOK_SECRET` (présent dans le dossier front).

## 5. Vérifications exécutées

| Test | Résultat |
| --- | --- |
| `tsc --noEmit` (front) | 0 erreur |
| `node --check` sur les 21 fichiers backend | OK |
| `npm run build` (front) | OK (1,43 Mo) |
| API locale : `GET /chemin-inconnu` | 404 JSON ✓ (avant : HTML Express) |
| API locale : JSON invalide + Origin front | 400 **avec** `Access-Control-Allow-Origin` ✓ |
| API locale : PATCH école UUID invalide | 400 « identifiant invalide » ✓ (avant : 500) |
| API locale : PATCH téléphone invalide | 400 « téléphone invalide » ✓ (avant : 500) |
| API locale : `?page=abc` | 200, repli page 1 ✓ (avant : 500) |
| API locale : `/admin/login` matricule inconnue | 401 générique, latence égalisée ✓ |
| RLS live (10 tables, 2 rôles) | 0 fuite ✓ |
| Historique git (3 secrets) | 0 occurrence ✓ |

## 6. Déploiement

Toutes les corrections sont côté code (API + front) : déploiement manuel
Render des deux services, aucune migration SQL. Rappel en attente :
migration corrective `admin_school_stats` (00026) dans le SQL Editor, et
commit/push de l'ensemble des lots en attente sur demande.
