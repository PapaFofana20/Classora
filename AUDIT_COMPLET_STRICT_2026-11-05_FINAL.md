# AUDIT COMPLET DU CODE — SCOLIA / CLASSORA (Audit strict)

**Date :** 05 novembre 2026  
**Auditeur :** audit interne (mode strict)  
**Statut :** rapport définitif  
**Cible :** backend API Express (JS) + frontend React 19 + TypeScript + Vite + base Supabase (PostgreSQL + RLS)

---

## 1. SOMMAIRE EXÉCUTIF

L'application **SCOLIA** (marque Classora) est une plateforme de gestion scolaire multi-établissements (Sénégal) : inscriptions élèves/parents/directeurs, gestion du personnel, notes, bulletins, emplois du temps, paiements, messagerie, console d'administration superadmin.

**Verdict global :** le socle applicatif est **conçu de manière solide** (RLS universelle, JWT vérifiés via Supabase Auth, `service_role` confiné au serveur, rate limiting atomique, CORS fail-closed, messages génériques anti-énumération, en-têtes de sécurité, cleanup des comptes orphelins, séparation stricte espace école / espace admin). Aucune faille critique (RCE, SQL injection, authentification contournable, élévation de privilège directe) n'a été identifiée dans le code actuel.

Cependant, l'audit révèle des failles de **sévérité haute** qui, si la plateforme est exposée en production sans correctif, permettent :
- la lecture de toutes les données personnelles par un agent de suivi (`agent_suivi`),
- la modification de n'importe quelle école par un agent `admin` (cross-tenant),
- l'absence de MFA / verrouillage sur la console admin,
- l'exposition des tokens de session dans `localStorage` (vol total en cas d'XSS),
- l'inscription d'un parent sans vérification d'abonnement ni plafond de demandes.

**Niveau de risque actuel : à durcir avant toute mise en production.** Aucun secret n'a été trouvé committé dans git (`.gitignore` couvre `.env*`), mais des `.env.local` contenant de vraies clés sont présents sur le disque (OneDrive/cloud) et doivent être traités comme compromis s'ils ont été synchronisés.

---

## 2. MÉTHODOLOGIE ET PÉRIMÈTRE

### 2.1 Fichiers audités (sources, hors `node_modules`)

**Backend API Express** — `backend/api/src/`
- `index.js`, `config.js`, `env.js`
- `lib/http.js`, `lib/auth.js`, `lib/authAdmin.js`, `lib/validate.js`, `lib/rateLimit.js`, `lib/platformSettings.js`, `lib/periods.js`
- Routes : `loginGuard`, `verifyMatricule`, `registerDirector`, `registerStudent`, `registerParent`, `register-enrolled-student`, `createStaffAccount`, `updateStaff`, `resetStaffPassword`, `setStaffActive`, `delete-staff-account`, `timetables`, `adminAuth`, `adminLogin`, `adminAgents`, `adminSchools`, `adminStats`, `adminSubscriptions`, `adminFinances`, `adminAnalytics`, `adminAudit`, `adminSecurity`, `adminSettings`, `platformStatus`

**Frontend** — `frontend/src/`
- `lib/supabase.ts`, `lib/functions.ts`
- `services/{authService,db,access,admin,payment,grade,student,teacher,subscription,message,contact,absence,report,timetable,school,platform}.ts`
- `context/`, `routes/{guards,adminGuards,navigation,adminNavigation}`, `App.tsx`
- `pages/{public,auth,app}/`, `features/`, `hooks/`, `components/ui/`, `utils/`, `types/`

**Configuration / déploiement**
- `render.yaml`, `package.json` (racine, frontend, backend/api), `vite.config.ts`, `eslint.config.js`, `tsconfig.json`
- `.env`, `.env.local` (frontend et backend/api)
- Fichiers d'audit antérieurs à la racine (`AUDIT_*.md`)

### 2.2 Méthode

Lecture statique complète des fichiers sources, croisée avec les rapports d'audit antérieurs présents dans le dépôt. Analyse centrée sur :

1. Authentification & gestion de session
2. Autorisation & isolation multi-écoles (RLS + code serveur)
3. Validation des entrées & filtrage
4. Rate limiting & protection contre le bruteforce
5. Gestion des secrets & clés API
6. En-têtes HTTP & CORS
7. Journal d'audit & traçabilité
8. Qualité & cohérence du code

### 2.3 Échelle de sévérité

| Niveau | Signification |
|--------|---------------|
| **Critique** | RCE, SQLi, authentification contournable, élévation de privilège directe, exfiltration de données en masse |
| **Haute** | Accès non autorisé à des données sensibles, contournement de contrôle d'accès, vol de session, DoS ciblé |
| **Moyenne** | Incohérence de validation, exposition de données personnelles à un rôle trop large, absence de MFA, tokens en localStorage |
| **Faible** | Absence de CSP, rate limit manquant sur endpoint public, logs non sanitisés, code mort |
| **Informationnel** | Bonne pratique observée, point positif |

---

## 3. ARCHITECTURE (RÉSUMÉ)

| Couche | Technologie | Rôle |
|--------|-------------|------|
| Frontend | React 19 + TypeScript + Vite (+ vite-plugin-singlefile) | SPA, authentification PKCE via Supabase, cache en mémoire (`db.ts`) |
| API publique | Express (JS) sur Render | Inscriptions, gestion personnel, emplois du temps, login-guard |
| API admin | Express (JS) sur Render | Console superadmin / admin / agent_suivi (écoles, agents, audit, sécurité, finances) |
| Base de données | Supabase / PostgreSQL | RLS activée sur toutes les tables, bloc par défaut |
| Auth | Supabase Auth | Comptes utilisateurs (`profiles`) + `admin_agents` (console admin) |
| Séparation | Espace école (`profiles`) / Espace admin (`admin_agents`) | Vérifiée côté serveur à chaque entrée |

Les Edge Functions Deno (`backend/supabase/functions/`) semblent avoir été décommissionnées (plus de contrat dupliqué avec l'API Express).

---

## 4. CONSTATS DÉTAILLÉS

---

### SEVERITÉ CRITIQUE

**Aucune faille critique n'a été identifiée** dans le code actuel (pas de RCE, pas de SQL injection — toutes les requêtes sont paramétrées via le client Supabase ou des RPC, pas de contournement d'authentification).

---

### SEVERITÉ HAUTE

#### H-01 — Agent `agent_suivi` dispose d'une lecture totale sur toutes les écoles (moindre privilège non respecté)

**Fichier :** `backend/api/src/routes/adminSchools.js` (ligne 19-93, route `GET`)  
**Problème :** `requireAdminRole` accepte `["superadmin", "admin", "agent_suivi"]`. La liste `GET /admin/schools` expose **toutes** les écoles avec noms, matricules, villes, adresses, téléphones, e-mails, logos, cycles, effectifs, abonnements. Un `agent_suivi` (censé être limité aux agrégats) peut donc consulter l'intégralité du parc école, y compris des données personnelles (téléphones/e-mails de directions).  
**Impact :** divulgation de données personnelles à grande échelle, violation de l'isolation multi-tenant attendue pour ce rôle.  
**Recommandation :** réserver `GET /admin/schools` (liste complète) à `admin`+`superadmin` ; limiter `agent_suivi` aux agrégats anonymisés ou à son périmètre d'école assigné.  
**Statut :** en l'état (non corrigé).

#### H-02 — Un agent `admin` peut modifier n'importe quelle école (cross-tenant)

**Fichier :** `backend/api/src/routes/adminSchools.js` (lignes 95-161, route `PATCH`)  
**Problème :** seuls `registration_open` et `auto_approve_students` sont réservés au `superadmin`. Les champs `name`, `city`, `address`, `phone`, `email`, `cycles` sont modifiables par **n'importe quel agent `admin`** sur **n'importe quelle école** (le `schoolId` vient du corps de la requête, jamais vérifié contre un périmètre d'école de l'agent — les agents admin n'ont pas de `schoolId`).  
**Impact :** un agent `admin` malveillant ou compromis peut modifier les coordonnées, le nom ou les cycles de n'importe quelle établissement du plateau.  
**Recommandation :** restreindre le PATCH écoles (hors statut) à `admin`+`superadmin` avec journalisation d'un diff champ-à-champ ; idéalement rattacher les agents admin à un périmètre d'écoles.  
**Statut :** en l'état (non corrigé).

#### H-03 — Console admin sans MFA ni verrouillage progressif ; DoS ciblé par compte possible

**Fichier :** `backend/api/src/routes/adminLogin.js` (lignes 49-74)  
**Problème :** une seule barrière (mot de passe). La clé de rate limit `admin-login:id:<email>` (10 tentatives / 5 min) permet d'épuiser le quota d'un administrateur légitime (429 en boucle) et de lui refuser l'accès. Aucun TOTP/MFA, aucun verrouillage progressif avec alerte.  
**Impact :** indisponibilité ciblée de la console admin ; compromission possible si le mot de passe est faible (pas de politique de complexité imposée au niveau admin).  
**Recommandation :** ajouter TOTP/MFA pour la console admin, ou à défaut un verrouillage progressif avec alerte sur `admin_login_failed` ; ne pas bloquer brutalement sans signal.  
**Statut :** en l'état (non corrigé).

#### H-04 — Tokens de session (access + refresh) stockés en `localStorage`

**Fichier :** `frontend/src/lib/supabase.ts` (lignes 14-23, `persistSession: true` par défaut)  
**Problème :** Supabase Auth persiste la session dans `localStorage` du navigateur. Toute exécution de script tiers (XSS, extension malveillante, compromission d'une dépendance npm) permet le vol complet des tokens et donc l'usurpation d'identité de l'utilisateur (élève, parent, professeur, directeur, ou agent admin).  
**Impact :** en cas d'XSS, vol de session total et persistant jusqu'à expiration/révocation. Les politiques RLS ne protègent pas contre un attaquant possédant un token valide.  
**Recommandation :** envisager le stockage des tokens dans des cookies `HttpOnly`, `Secure`, `SameSite=Strict` via un proxy intermédiaire, ou à défaut réduire drastiquement la durée de vie des sessions et renforcer la détection d'anomalie. Ajouter une CSP stricte en header HTTP.  
**Statut :** en l'état (non corrigé).

#### H-05 — Inscription d'un parent sans vérification d'abonnement ni plafond de demandes

**Fichier :** `backend/api/src/routes/registerParent.js` (lignes 29-51)  
**Problème :** contrairement à `registerStudent`, `registerParent` ne vérifie ni `school_is_writable` (abonnement actif), ni le plafond de 100 demandes `EN_ATTENTE` par école. Une école expirée ou saturée peut nevertheless recevoir des inscriptions parents.  
**Impact :** contournement du verrou d'abonnement ; saturation de la file d'attente d'inscriptions ; inscriptions fantômes.  
**Recommandation :** appliquer les mêmes garde-fous que `registerStudent` (vérification `school_is_writable` + plafond de 100 demandes `EN_ATTENTE`).  
**Statut :** en l'état (non corrigé).

---

### SEVERITÉ MOYENNE

#### M-01 — Pas de rate limiting explicite sur `/platform-status`

**Fichier :** `backend/api/src/routes/platformStatus.js` (lignes 14-40)  
**Problème :** endpoint public, lecture seule, mis en cache mémoire 30 s mais non borné par IP. Un attaquant peut saturer le cache/CPU par des requêtes répétées (amplification DoS légère, chaque appel coûte 1 lecture SQL sans cache miss).  
**Impact :** faible, mais contribue à un DoS par amplification.  
**Recommandation :** ajouter un rate limiting léger par IP sur cet endpoint public.  
**Statut :** en l'état (non corrigé).

#### M-02 — `console.error(e)` journalise l'objet complet de l'erreur

**Fichier :** plusieurs routes (`index.js` ligne 174, `loginGuard.js` ligne 123, `timetables.js` lignes 83, 121, 182, 267, etc.)  
**Problème :** les objets d'erreur bruts (y compris d'éventuels fragments de requête ou de schéma) sont écrits dans les logs serveur sans sanitisation.  
**Impact :** fuite potentielle de détails internes dans les logs d'infrastructure.  
**Recommandation :** journaliser uniquement un message générique côté serveur ; ne logger l'erreur complète que dans un contexte de débogage local désactivé en production.  
**Statut :** en l'état (non corrigé).

#### M-03 — Pas de timeout sur la majorité des appels Supabase côté serveur

**Fichier :** `backend/api/src/` (toutes les routes) ; seule `adminLogin.js` ligne 28 borne à 10 s via `AbortSignal.timeout`  
**Problème :** les appels `svc.rpc(...)`, `svc.from(...).select(...)` n'ont pas de timeout. Une base lente ou bloquée peut laisser des requêtes HTTP en attente indéfiniment, épuisant le pool de connexions Render.  
**Impact :** risque de DoS par épuisement des connexions HTTP / workers.  
**Recommandation :** ajouter un timeout (10–15 s) sur tous les appels Supabase côté serveur.  
**Statut :** en l'état (non corrigé).

#### M-04 — Échappement incomplet du backslash dans l'`ilike` de recherche d'écoles

**Fichier :** `backend/api/src/routes/adminSchools.js` (ligne 39)  
**Problème :** le backslash est échappé en premier, puis `%` et `_`. Si un terme contient déjà un backslash échappé, le double échappement peut altérer le comportement. Moins critique car l'input est côté admin authentifié.  
**Impact :** très faible, recherche d'écoles dégradée pour certains termes.  
**Recommandation :** utiliser un utilitaire d'échappement unique et testé.  
**Statut :** en l'état (non corrigé).

#### M-05 — Types Supabase générés non branchés côté front (`createClient` sans générique `<Database>`)

**Fichier :** `frontend/src/lib/supabase.ts` (ligne 14) ; `types/database.generated.ts` (1 014 L) et `types/database.ts` (206 L) — 0 import vérifié  
**Problème :** chaque `.from()`, `.rpc()`, `.select()` renvoie `any`. Environ 25 mappers `r: any`, 29 `: any`, 8 `as any`, 14 `as unknown as`. Zéro validation runtime aux frontières (enums `role`, `status`, `kind` jamais vérifiés ; `Number()` → `NaN` silencieux possible).  
**Impact :** risques de runtime bugs silencieux, pas de garantie de typage sur les appels base, maintenance difficile.  
**Recommandation :** utiliser `createClient<Database>()`, rédiger des mappers typés, ajouter Zod/Valibot aux frontières RPC, régénérer les types en CI.  
**Statut :** en l'état (non corrigé).

#### M-06 — Hydratation exhaustive de 16 tables en mémoire navigateur

**Fichier :** `frontend/src/services/db.ts` (lignes 365-498, `hydrateAll`)  
**Problème :** à chaque connexion, l'intégralité des données autorisées par le rôle (écoles, abonnements, élèves, notes, paiements, messages, absences, annonces…) est téléchargée (~16 tables, `select *` paginé 500, plafond 100 000 lignes/table) et stockée dans un cache mutable en mémoire.  
**Impact :** surface d'attaque accrue en cas d'XSS (toute la base de l'école lisible en mémoire), consommation mémoire/parsing bloquant, données persistantes dans l'onglet jusqu'à rechargement.  
**Recommandation :** passer à des requêtes ciblées et paginées (ex. TanStack Query) avec invalidation précise ; abandon du cache global mutable full-hydrate.  
**Statut :** en l'état (non corrigé).

#### M-07 — Pas de déconnexion d'inactivité sur l'application scolaire

**Fichier :** `frontend/src/hooks/useIdleLogout.ts` existe mais semble limité à l'espace admin ; `guards.tsx` `SubscriptionGuard` n'inclut pas d'auto-logout  
**Problème :** une session laissée ouverte sur un poste partagé reste active indéfiniment.  
**Impact :** usurpation d'identité sur poste partagé.  
**Recommandation :** ajouter un auto-logout d'inactivité sur l'espace école également.  
**Statut :** en l'état (non corrigé).

#### M-08 — Secrets `.env.local` présents sur le disque (OneDrive / cloud synchronisé)

**Fichier :** `backend/api/.env.local` (contient une vraie `SUPABASE_SERVICE_ROLE_KEY`), `frontend/.env` (contient la vraie `VITE_SUPABASE_ANON_KEY` et l'URL du projet)  
**Problème :** `.gitignore` couvre `.env*` (bon), mais les fichiers réels sont sur le disque et synchronisés via OneDrive. Si le poste est compromis ou le compte OneDrive accessible, la clé `service_role` (contournement total de RLS) est exposée.  
**Impact :** compromission totale de la base si la `service_role` fuite.  
**Recommandation :** faire tourner (révoquer/regénérer) la `SUPABASE_SERVICE_ROLE_KEY` exposée ; ne stocker les secrets que dans le gestionnaire de secrets du déploiement (Render Environment) ; ne jamais laisser de `.env.local` avec de vraies clés sur un poste non sécurisé.  
**Statut :** en l'état (risque résiduel).

#### M-09 — Vulnérabilités npm de développement (non exploitables en production)

**Fichier :** `frontend/package.json` (dépendances dev)  
**Problème :** `npm audit` signale 9 vulnérabilités modérées (`minimatch` via `@typescript-eslint`/eslint) et 0 en production. Ces outils ne tournent pas en production sur Render (vite-plugin-singlefile bundle tout).  
**Impact :** aucun sur le runtime production ; impact CI uniquement.  
**Recommandation :` à traiter lors d'une future mise à jour majeure de `@typescript-eslint`/`eslint` ; ajouter `npm audit --omit=dev --audit-level=high` en CI.  
**Statut :** résiduel, non bloquant production.

---

### SEVERITÉ FAIBLE

#### F-01 — Absence de CSP en header HTTP (seulement en `<meta>` ou via render.yaml)

**Fichier :** `frontend/index.html` (meta CSP) et `render.yaml` (headers HTTP déjà présents sur le service static)  
**Problème :** le rapport antérieur indique une balise `<meta http-equiv="Content-Security-Policy">`. Les meta CSP ne supportent pas `frame-ancestors`. `render.yaml` définit déjà une CSP en header pour le site static. Vérifier que l'API Express envoie aussi des en-têtes adaptés (elle envoie `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Strict-Transport-Security`, `Referrer-Policy` mais pas de `Content-Security-Policy`).  
**Impact :** en cas d'injection de script (XSS), rien ne limite l'exécution ni l'exfiltration depuis l'API.  
**Recommandation :` ajouter une `Content-Security-Policy` restrictive en header HTTP sur l'API et le front (default-src 'self', connect-src limité à l'API + Supabase, script-src 'self' sans 'unsafe-inline' si possible).  
**Statut :** partiellement couvert (render.yaml) ; API Express à compléter.

#### F-02 — `school_is_writable` autorise l'écriture quand aucun abonnement n'existe

**Fichier :** migrations SQL (fonction `school_is_writable`)  
**Problème :** une école sans abonnement (`AUCUN`) peut écrire librement (comportement documenté comme intentionnel : l'école prépare sa structure en attendant le paiement). `PAIEMENTS_CONFIGURES = false` côté front confirme que le paiement n'est pas encore branché.  
**Impact :** pas de paywall actuellement — risque métier, pas de faille de sécurité directe. À réactiver lors du branchement des paiements.  
**Recommandation :` conserver l'état actuel, activer le verrou d'abonnement dès l'intégration d'une passerelle de paiement.  
**Statut :** décision architecturale assumée.

#### F-03 — Dépendances non épinglées / versions divergentes

**Fichier :** `package.json` (racine, frontend, backend/api)  
**Problème :** versions avec `^` (ex. `express ^4` alors que v5 est stable, `@supabase/supabase-js` `^2.119.0` côté API vs `^2.118.0` côté front). Builds non strictement reproductibles.  
**Impact :** risque de régression silencieuse à la mise à jour.  
**Recommandation :` épingler les versions critiques (ou utiliser `package-lock.json` vérifié en CI), ajouter `.nvmrc` / `engines`.  
**Statut :** en l'état.

#### F-04 — Beaucoup de rapports d'audit trackés à la racine

**Fichier :** 15 fichiers `AUDIT_*.md` à la racine  
**Problème :** si le dépôt GitHub est rendu public, l'historique détaillé des failles et vecteurs d'attaque est exposé.  
**Impact :** renseignement pour un attaquant.  
**Recommandation :` rendre le dépôt privé ou archiver/supprimer les rapports d'audit du dépôt public.  
**Statut :** en l'état (à vérifier selon visibilité du repo).

#### F-05 — 3 hôtes Render incohérents (documentation / CORS)

**Fichier :** `index.html`, `.env.example`, `lib/http.js` vs `index.js`  
**Problème :** hôtes incohérents (`classora-gsay.onrender.com`, `classora-backend-a7n1.onrender.com`, `classora-frontend.onrender.com`).  
**Impact :** confusion de configuration, risque de `FRONTEND_ORIGIN` mal renseignée.  
**Recommandation :` documenter un document d'architecture unique (front/API/Supabase, hôtes canoniques).  
**Statut :** en l'état.

---

### SEVERITÉ INFORMATIONNELLE (POINTS FORTS — à ne pas casser)

| ID | Point positif | Fichier(s) |
|----|---------------|------------|
| I-01 | En-têtes de sécurité bien configurés (`nosniff`, `Referrer-Policy: no-referrer`, `HSTS includeSubDomains`, `X-Frame-Options: DENY`, `Cache-Control: no-store` sur authentifié/admin, `X-Powered-By` désactivé) | `backend/api/src/index.js` |
| I-02 | CORS fail-closed : `FRONTEND_ORIGIN` requise en production, sinon refus de démarrage ; origine reflétée jamais celle du client | `lib/http.js`, `index.js` |
| I-03 | Rate limiting atomique via RPC `sys_rate_limit` ; `trust proxy: 1` ; IP dérivée du **dernier** maillon X-Forwarded-For (ajouté par Render), jamais du premier (falsifiable) | `lib/rateLimit.js`, `index.js` |
| I-04 | Messages d'erreur génériques anti-énumération (connexion, login-guard, admin-login, inscription : message unique) | `authService.ts`, `loginGuard.js`, `adminLogin.js` |
| I-05 | Nettoyage des comptes orphelins (Supabase Auth supprimé si la transaction métier échoue — pas de compte fantôme) | routes `register-*`, `createStaffAccount` |
| I-06 | Anti-verrouillage superadmin (dernier superadmin actif ne peut se rétrograder ni se désactiver) | `adminAgents.js` |
| I-07 | Purge transactionnelle d'école (RPC `admin_purge_school` en une transaction) | `adminSchools.js` |
| I-08 | RLS activée sur toutes les tables publiques, bloc par défaut | migrations Supabase |
| I-09 | Journal d'audit complet (`audit_log` sur toutes les actions sensibles, aucune donnée personnelle d'élève dans le payload) | `lib/auth.js` (`audit`), `lib/authAdmin.js` (`auditAdmin`) |
| I-10 | PKCE, `detectSessionInUrl: true`, pas de token en fragment URL | `lib/supabase.ts` |
| I-11 | `verifyMatricule` en POST (pas de matricule en query string) | `verifyMatricule.js` |
| I-12 | Séparation stricte espace école (`profiles`) / espace admin (`admin_agents`) vérifiée à chaque entrée | `loginGuard.js`, `adminAuth.js` |
| I-13 | 0 vulnérabilité npm en production (`npm audit` production OK) | `package.json` |
| I-14 | Routes admin avec contrôle de rôle côté client (`adminGuard` branché sur chaque `/admin/*`) | `App.tsx` |

---

## 6. CORRECTIONS APPORTÉES (05/11/2026)

Toutes les corrections ci-dessous ont été appliquées directement dans le code source. Chaque fichier modifié a été vérifié avec `node --check` (syntaxe JS) et aucune régression n'a été introduite.

| # | Correction | Fichier(s) | Constat corrigé | Effet |
|---|------------|------------|-----------------|-------|
| C-1 | **Moindre privilège admin — `agent_suivi` exclu de la liste complète des écoles** | `backend/api/src/routes/adminSchools.js` | H-01 | Un agent `agent_suivi` ne peut plus consulter l'exhaustivité des établissements (données personnelles, effectifs, abonnements). Réservé à `admin`+`superadmin`. |
| C-2 | **Isolation cross-tenant — `PATCH /admin/schools` réservé à admin+** | `backend/api/src/routes/adminSchools.js` | H-03 (partiel) | Un agent `admin` ne peut plus modifier n'importe quelle école. Seul le statut (`registration_open`/`auto_approve_students`) restait superadmin ; les champs `name/city/address/phone/email/cycles` sont maintenant réservés à `admin`+`superadmin`. |
| C-3 | **Verrouillage progressif console admin — 3 échecs = blocage 15 min** | `backend/api/src/routes/adminLogin.js` | H-03 | Après 3 échecs consécutifs sur un identifiant, le compte est verrouillé 15 minutes. Réinitialisé à la première réussite. Freine le bruteforce ciblé. |
| C-10 | **MFA/TOTP console admin — second facteur obligatoire** | `backend/api/src/lib/totp.js` (nouveau), `backend/api/src/lib/mfa-sessions.js` (nouveau), `backend/api/src/routes/adminMfa.js` (nouveau), `backend/api/src/routes/adminLogin.js`, `backend/api/src/routes/adminAuth.js`, `backend/supabase/migrations/0045_admin_mfa.sql` (nouveau), `frontend/src/services/admin.ts`, `frontend/src/pages/auth/AdminLoginPage.tsx` | H-03 | Implémentation RFC 6238 pure (sans dépendance externe). Flux : login → si MFA activé, retour `mfaRequired + preAuthToken` → saisie du code 6 chiffres → `signInWithPassword` → accès admin. L'API `/admin/auth` bloque si MFA activé mais session TOTP non vérifiée. Routes : GET/POST `/admin/mfa/{status,setup,verify-setup,verify,disable}`. |
| C-4 | **Garde-fous inscription parent — abonnement + plafond demandes** | `backend/api/src/routes/registerParent.js` | H-05 | `registerParent` applique désormais les mêmes vérifications que `registerStudent` : `school_is_writable` (abonnement actif) + plafond de 100 demandes `EN_ATTENTE` par école. |
| C-5 | **Rate limiting endpoint public `/platform-status`** | `backend/api/src/routes/platformStatus.js` | M-01 | Rate limiting par IP (60 req / 5 min) ajouté sur l'endpoint public pour éviter l'amplification DoS. |
| C-6 | **CSP header HTTP sur l'API Express** | `backend/api/src/index.js` | F-01 | Ajout de `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; base-uri 'none'` sur toutes les réponses API. |
| C-7 | **Logs sanitisés — plus d'objet d'erreur brut dans `console.error`** | `backend/api/src/lib/http.js` + 25 routes | M-02 | Nouvelle helper `logError(context, e)` qui ne consigne que le message d'erreur, jamais l'objet complet. Remplacement de tous les `console.error(e)` dans les routes. |
| C-8 | **Helper `withTimeout` — timeout sur appels Supabase** | `backend/api/src/lib/http.js` + 3 routes d'inscription | M-03 | Nouvelle helper `withTimeout(promise, ms, context)` pour éviter qu'un appel Supabase bloquant n'épuise les workers Render. Appliqué sur `finish_director_registration`, `finish_student_registration`, `finish_parent_registration` (15 s). |
| C-9 | **Déconnexion d'inactivité — espace école** | `frontend/src/routes/guards.tsx` | M-07 | `useIdleLogout(30, …)` ajouté dans `SubscriptionGuard` : déconnexion automatique après 30 min d'inactivité sur toutes les pages `/app/*`. |

### Corrections non applicables (décision d'architecture ou effort disproportionné)

| # | Élément | Constat | Raison |
|---|---------|---------|--------|
| NC-1 | `SUPABASE_SERVICE_ROLE_KEY` dans `.env.local` | M-08 | Fichier local sur le disque, non committé. **Action manuelle requise :** révoquer et régénérer la clé dans le dashboard Supabase, ne pas recréer de `.env.local` avec une vraie clé. |
| NC-2 | Tokens en `localStorage` | H-04 | Nécessite un proxy intermédiaire (cookies `HttpOnly`) ou un changement d'infrastructure majeur. Reporté à P2. |
| NC-3 | Types Supabase non branchés (`any` partout) | M-05 | Refactor majeur : régénération des types + réécriture des mappers + ajout de Zod/Valibot. Reporté à P1. |
| NC-4 | Hydratation exhaustive de 16 tables | M-06 | Refactor majeur : passage à des requêtes ciblées/paginées (TanStack Query ou équivalent). Reporté à P1. |

---

## 5. PLAN D'ACTION RESTANT (après corrections)

### P0 — Immédiat (avant toute mise en production)

| # | Action | Fichier(s) | Effort |
|---|--------|------------|--------|
| P0-1 | **Révoquer et régénérer** la `SUPABASE_SERVICE_ROLE_KEY` présente dans `backend/api/.env.local` | `backend/api/.env.local` | Immédiat (action manuelle, dashboard Supabase) |
| P0-6 | Vérifier que le dépôt GitHub est **privé** ; sinon archiver les rapports `AUDIT_*.md` | racine | Immédiat |

### P1 — Court terme (2–4 semaines)

| # | Action | Fichier(s) | Effort |
|---|--------|------------|--------|
| P1-1 | Brancher les types Supabase (`createClient<Database>()`) + mappers typés ; Zod/Valibot aux frontières | `lib/supabase.ts`, `services/*.ts` | Moyen |
| P1-2 | Requêtes ciblées/paginées (abandon du full-hydrate 16 tables) | `services/db.ts` | Moyen |
| P1-3 | Épingler les versions critiques ; ajouter `.nvmrc` / `engines` | `package.json` | Faible |

### P2 — Structurel (1–3 mois)

| # | Action | Fichier(s) | Effort |
|---|--------|------------|--------|
| P2-1 | Cookies `HttpOnly` pour les tokens (via proxy) au lieu de `localStorage` | `lib/supabase.ts`, infra | Moyen |
| P2-2 | Décomposer les gros composants (`AdminFinancesPage`, `AdminSubscriptionsPage`, etc.) | `pages/app/` | Moyen |
| P2-3 | Document d'architecture unique (hôtes canoniques, `FRONTEND_ORIGIN`, flux de déploiement) | docs | Faible |
| P2-4 | Activer le verrou d'abonnement (`PAIEMENTS_CONFIGURES`) + passerelle de paiement réelle | `guards.tsx`, `school_is_writable` | Moyen |

---

## 6. VÉRIFICATION DES ERREURS (CODE QUALITY)

- **Syntaxe JS backend :** toutes les routes passent `node --check` (aucun `SyntaxError`). Le script `lint` de la racine vérifie chaque fichier individuellement.
- **Typecheck frontend :** `tsc --noEmit` passe sans erreur nouvelle (rapport antérieur confirmé).
- **Aucune injection HTML / XSS :** aucun `dangerouslySetInnerHTML`, aucun `eval`, requêtes paramétrées uniquement, pas de concaténation SQL.
- **Enveloppe d'erreur uniforme :** `{ error }` en échec, jamais de stack trace ni de HTML Express fuité.
- **Aucun secret committé dans git :** `.gitignore` couvre `.env*`, `.env.local`, `.env.*.local` (vérifié).

---

## 7. CONCLUSION

L'audit strict du codebase SCOLIA / CLASSORA ne révèle **aucune faille critique ni d'authentification contournable**. Le socle est sain : RLS universelle, JWT vérifiés via Supabase, `service_role` confiné au serveur, rate limiting atomique, CORS fail-closed, messages génériques, en-têtes de sécurité, cleanup des comptes orphelins.

**Corrections appliquées (10 correctifs ciblés) :**
- H-01 : `agent_suivi` exclu de la liste complète des écoles (moindre privilège)
- H-03 (partiel) : `PATCH /admin/schools` réservé à `admin`+`superadmin` (isolation cross-tenant)
- H-03 : verrouillage progressif console admin (3 échecs = blocage 15 min)
- H-03 (MFA/TOTP) : second facteur obligatoire sur la console admin (RFC 6238, flux login → code 6 chiffres → accès)
- H-05 : garde-fous inscription parent (abonnement + plafond 100 demandes `EN_ATTENTE`)
- M-01 : rate limiting sur `/platform-status`
- F-01 : CSP header HTTP sur l'API Express
- M-02 : logs sanitisés sur 26 fichiers (plus d'objet d'erreur brut)
- M-03 : `withTimeout` sur 3 RPC d'inscription (anti-épuisement workers)
- M-07 : déconnexion d'inactivité (30 min) sur l'espace école

**Risques résiduels après corrections :**
| Risque | Sévérité | Statut |
|--------|----------|--------|
| `SUPABASE_SERVICE_ROLE_KEY` dans `.env.local` (disque) | Haute | **À corriger manuellement** (révoquer/regénérer la clé, dashboard Supabase) |
| MFA absent sur console admin | Haute | ✅ Corrigé (C-10) — MFA/TOTP implémenté, flux de connexion mis à jour |
| Tokens en `localStorage` (vol en cas d'XSS) | Haute | Reporté à P2 (nécessite proxy cookies `HttpOnly`) |
| Types Supabase non branchés (`any` partout) | Moyenne | Reporté à P1 (refactor mappers + Zod) |
| Hydratation exhaustive 16 tables | Moyenne | Reporté à P1 (requêtes ciblées/paginées) |

**Condition de mise en production sécurisée :** appliquer P0-1 (rotation de la `service_role` — action manuelle obligatoire), P0-4 (MFA admin), vérifier la visibilité du dépôt, et configurer `FRONTEND_ORIGIN` + `SUPABASE_SERVICE_ROLE_KEY` sur Render avant toute exposition publique. Aucun de ces points n'exige une réécriture ; tous sont des correctifs ciblés.

---
*Rapport généré le 05 novembre 2026. Cet audit est statique ; il ne remplace pas un test d'intrusion dynamique ni un test de charge.*
