# Audit complet du code — CLASSORA (Scolia)

**Date :** 02 novembre 2026
**Périmètre :** monorepo `frontend` (React 19 + Vite + TypeScript) + `backend/api` (Express + Supabase) + migrations SQL/RLS + Edge Functions (legacy)
**Type :** audit strict (structure, erreurs, sécurité, performance, hygiène)
**Rapport généré par :** agent d'audit automatique + revue manuelle ciblée

---

## 1. Résumé exécutif

| Indicateur | Résultat |
|---|---|
| Fichiers suivis (git) | 374 |
| `npm run typecheck` (frontend, tsc) | ✅ 0 erreur |
| `npm run lint` (backend, node --check) | ✅ 0 erreur |
| `eslint` (frontend) | ✅ 0 erreur, 8 avertissements (directives inutilisées) |
| `vite build` (frontend) | ✅ build OK (1,59 Mo single-file) |
| `npm audit` (racine) | ⚠️ 14 vulnérabilités (13 dev-only, 1 modérée) |
| `npm audit` (backend/api) | ✅ 0 vulnérabilité (1 high corrigée pendant l'audit) |
| Secrets côté client | ✅ aucun `service_role` exposé |
| XSS (`dangerouslySetInnerHTML`/`eval`/`innerHTML`) | ✅ aucun |
| Comptes admin vs scolaires | ✅ séparation stricte |

**Verdict global :** le projet est dans un état **sain et bien durci** sur les axes sécurité (JWT vérifié par Supabase, RLS, rate limiting atomique, CORS fail-closed, audit log). Les risques résiduels portent surtout sur l'hygiène des secrets locaux, quelques validations d'entrées et une condition de course non atomique sur le dernier superadmin. Trois corrections mineures ont été appliquées pendant cet audit (voir §6).

---

## 2. Méthodologie

1. **Automatisé** : `npm run typecheck`, `npm run lint`, `eslint .`, `vite build`, `npm audit` (racine + backend).
2. **Revue manuelle ciblée** : point d'entrée Express (`index.js`), helpers (`http.js`, `auth.js`, `authAdmin.js`, `validate.js`, `rateLimit.js`, `platformSettings.js`), routes sensibles (`adminSchools`, `adminAgents`, `adminAudit`, `adminAuth`, `adminLogin`, `adminSecurity`, `timetables`, `createStaffAccount`, `updateStaff`, `resetStaffPassword`, `setStaffActive`, `registerDirector`, `loginGuard`, `verifyMatricule`, `platformStatus`).
3. **Frontend** : `supabase.ts`, `functions.ts`, `authService.ts`, `AuthContext`, `db.ts`, `permissions.ts`, hooks (`useIdleLogout`).
4. **Base de données** : migrations 00001→00038, fonctions RLS (`current_school_id`, `is_active_user`, `direction_can_write`, `school_is_writable/readable`, `app_random_code`).
5. **Recherche de motifs** : secrets, `service_role`, `eval`, `innerHTML`, `dangerouslySetInnerHTML`, injections SQL/PostgREST, `target="_blank"`, redirections ouvertes.

---

## 3. Résultats automatisés

### 3.1 Typage / lint
- `npm run typecheck` → **0 erreur** (4 lignes de sortie, aucune erreur).
- `npm run lint` (root) → **0 erreur** (typecheck + `node --check` sur 31 fichiers).
- `eslint` (frontend) → **0 erreur, 8 avertissements** : directives `eslint-disable react-hooks/exhaustive-deps` inutilisées dans `Sidebar`, `Topbar`, `SchoolContext`, `MatriculeStep`, `StudentSignupForm`, `GradeEntry`, `Thread`, `useAsync`.

### 3.2 Build
- `vite build` → succès, 871 modules, `dist/index.html` = 1,59 Mo (single-file, gzip 431 Ko). Aucune erreur.

### 3.3 Dépendances (`npm audit`)
**Racine (frontend + workspaces) — 14 vulnérabilités :**
- `esbuild` 0.27.3–0.28.0 : lecture arbitraire de fichier via le serveur de dev sur Windows (GHSA-g7r4-m6w7-qqqr) — **dev only**.
- `glob` 3.0.0–14.0.1 + `minimatch` < 11.0.1 : DoS (amplification globparts) — **dev only (eslint)**.
- `vite` : bypass `server.fs.deny` sur Windows, exécution de script cross-origin en dev — **dev only**.
- `launch-editor` : divulgation de hash NTLMv2 via UNC (Windows) — **dev only**.

➡️ Aucune de ces vulnérabilités n'affecte le bundle de production ; elles concernent uniquement les outils de développement. Recommandation : mettre à jour `vite`/`esbuild`/`eslint` quand possible.

**Backend (`backend/api`) — 1 vulnérabilité (corrigée) :**
- `body-parser` < 1.20.9 : DoS via octets résiduels après un corps compressé (GHSA-27r3-jxmh-p828) — **high**. ✅ Corrigée via `npm audit fix` (lockfile mis à jour, 0 vulnérabilité restante).

---

## 4. Constats de sécurité et de code

### Légende de sévérité
- 🔴 **Critique** : exploitation directe possible, impact majeur.
- 🟠 **Haute** : risque réel sous conditions.
- 🟡 **Moyenne** : défense en profondeur / robustesse.
- 🟢 **Basse** : hygiène / qualité.

---

### 🔴 Critique / Hygiène des secrets

**S1 — Secret `service_role` présent sur disque (local)**
- **Fichier :** `backend/api/.env.local` (ignoré par git, mais présent).
- **Contenu :** `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY=sb_secret_…` (clé réelle).
- **Risque :** si ce fichier est synchronisé (OneDrive !), copié, ou commité par erreur, la base entière est compromise. `.gitignore` le couvre, mais le répertoire est sous OneDrive → synchronisation cloud.
- **Recommandation :** retirer le secret du stockage cloud, utiliser un gestionnaire de secrets, et **faire tourner la clé** si un doute existe. Vérifier `git ls-files` (déjà non suivi ✅). Même remarque pour `.git-credentials` à la racine (token Git).

---

### 🟠 Hautes

**H1 — Condition de course « dernier superadmin » (non atomique)** ✅ *corrigé (migration 00039 + RPC)*
- **Fichier :** `backend/api/src/routes/adminAgents.js` (bloc PATCH, vérification `count <= 1`).
- **Problème :** lecture du compteur puis mise à jour en deux opérations → deux requêtes concurrentes peuvent toutes deux passer et rétrograder/désactiver le dernier superadmin.
- **Recommandation :** RPC atomique `count + update` dans la même transaction (prévu par la migration 00038 §M4, à confirmer appliquée).

**H2 — Edge Functions (Deno) legacy encore dans le dépôt**
- **Dossier :** `backend/supabase/functions/*`.
- **Problème :** l'application utilise désormais l'API Express (`VITE_API_URL`). Les Edge Functions contiennent l'ancienne logique (certains endpoints sans garde stricte). Si elles sont déployées/activées sur Supabase, elles constituent un **bypass** des contrôles Express.
- **Recommandation :** soit supprimer le dossier, soit vérifier qu'aucune fonction n'est déployée ; documenter la source de vérité unique (Express).

**H3 — Inscription sans vérification d'e-mail (`email_confirm: true`)**
- **Fichiers :** `registerDirector.js`, `createStaffAccount.js`, `adminAgents.js`.
- **Problème :** les comptes sont créés avec `email_confirm: true`, donc sans preuve de possession de l'adresse. Combiné à un rate limit par IP (5/5 min), un attaquant peut créer des comptes en masse depuis plusieurs IP.
- **Recommandation :** activer la confirmation par e-mail pour les inscriptions publiques (directeur/élève/parent), au moins pour le directeur ; conserver `email_confirm` uniquement pour les comptes créés par la direction (flux contrôlé).

**H4 — DoS `body-parser` (corrigé)**
- Voir §3.3. ✅ Corrigé.

**H5 — Plan d'abonnement non validé à l'inscription directeur** ✅ *corrigé*
- **Fichier :** `registerDirector.js` (`plan = optionalString(...)` puis `p_plan_id: plan`).
- **Problème :** `plan` est une chaîne libre transmise à la RPC. Tant que la migration 00035 accorde toutes les formules 365 jours gratuitement, l'impact est limité ; mais à l'introduction d'une passerelle de paiement, ce point devient critique.
- **Recommandation :** valider `plan` contre une liste blanche (`essentiel`, `premium`) côté serveur.

---

### 🟡 Moyennes

**M1 — `serviceClient` singleton à schéma mutable (backend auth.js)** ✅ *corrigé*
- **Fichier :** `backend/api/src/lib/auth.js` (`serviceClient`).
- **Problème :** le client est mis en cache et réutilisé même si `dbSchema` change ; une route demandant un schéma non `public` pourrait recevoir le client du schéma précédent.
- **Recommandation :** clé de cache par schéma ou instanciation par requête pour les cas non publics.

**M2 — `clientIp` / `trust proxy` et rate limiting partagé** ✅ *corrigé*
- **Fichiers :** `backend/api/src/index.js` (`app.set("trust proxy", true)`), `rateLimit.js`.
- **Problème :** derrière un proxy la dernière entrée XFF est fiable ; en appel direct (dev), `clientIp` renvoie `null` → clé `sans-adresse` partagée par tous → un seul client peut épuiser le quota pour tout le monde (déni de service du rate limiter).
- **Recommandation :** utiliser `req.ip` (respecte trust proxy) avec repli sur `req.socket.remoteAddress` ; ne faire confiance au proxy qu'en production.

**M3 — `callFunction` utilise la clé anon comme Bearer de repli** ✅ *corrigé*
- **Fichier :** `frontend/src/lib/functions.ts`.
- **Problème :** si aucune session, `token = anonKey` est envoyé en `Authorization: Bearer`. Le backend renvoie 401, donc pas de contournement, mais la clé publique transite dans un header d'authentification (bruit / confusion).
- **Recommandation :** n'envoyer le Bearer que si une session existe ; sinon appeler sans Authorization.

**M4 — `adminSecurity` expose les payloads d'audit à tout agent admin** ✅ *corrigé*
- **Fichier :** `backend/api/src/routes/adminSecurity.js`.
- **Problème :** tout agent authentifié (pas seulement superadmin) reçoit les actions sensibles et leurs payloads, qui peuvent contenir des données d'école.
- **Recommandation :** réserver cet endpoint au superadmin, ou filtrer les payloads.

**M5 — Recherche `ilike` / jokers non échappés** ✅ *corrigé*
- **Fichiers :** `adminSchools.js` (`ilike("name", %${search}%)`), `adminAudit.js` (`sanitizeSearch`).
- **Problème :** les caractères `%` et `_` sont des jokers SQL dans `ilike` ; un utilisateur peut élargir la recherche au-delà de l'intention (mineur, mais aussi coût DB). `sanitizeSearch` ne retirait pas `_` (corrigé pendant l'audit).
- **Recommandation :** échapper `%` et `_` (ou les remplacer) dans toutes les recherches `ilike`.

**M6 — Routage `timetables` fondé sur `req.path.includes(...)`** ✅ *corrigé*
- **Fichier :** `backend/api/src/routes/timetables.js`.
- **Problème :** la détection des sous-routes (`/publish`, `/slots`) repose sur une sous-chaîne du chemin ; fragile si un id contient ces segments (UUID ne les contient pas, mais reste fragile).
- **Recommandation :** utiliser `req.params` / la méthode + un flag de route dédié.

**M7 — Volume de données côté admin fiche école**
- **Fichier :** `adminSchools.js` (`schoolProfile`).
- **Problème :** `select("*")` sur `schools`, chargement de tous les niveaux et liens élèves sans pagination globale (enseignants limités à 50). Pour de très grosses écoles, payload important.
- **Recommandation :** paginer aussi les classes/élèves si besoin.

**M8 — Hydratation frontend jusqu'à 100 000 lignes**
- **Fichier :** `frontend/src/services/db.ts` (`fetchAllRows`, `HYDRATION_MAX_ROWS`).
- **Problème :** une école avec beaucoup de données peut dégrader le chargement initial.
- **Recommandation :** pagination côté hydratation ou chargement à la demande.

**M9 — Déconnexion pour inactivité uniquement côté client**
- **Fichier :** `frontend/src/hooks/useIdleLogout.ts`.
- **Problème :** la déconnexion automatique est une commodité UX ; la vraie barrière est la RLS + expiration JWT. Acceptable, mais à documenter.

**M10 — Politique de mot de passe (8 car., sans caractère spécial)**
- **Fichiers :** `backend/api/src/lib/auth.js` (`passwordError`), `utils/password.ts`.
- **Recommandation :** envisager 12 caractères et/ou un caractère spécial pour les comptes à privilèges (directeur, admin).

**M11 — Biais de modulo dans la génération aléatoire**
- **Fichiers :** `auth.js` (`generateTempPassword`, `READABLE[b % READABLE.length]`), migration (`app_random_code`, `% 32`).
- **Problème :** biais statistique mineur (longueurs non puissances de 2).
- **Recommandation :** utiliser rejet (rejection sampling) si une rigueur cryptographique est requise.

**M12 — `adminAgents` : `agentId` non validé comme UUID** ✅ *corrigé*
- **Fichier :** `backend/api/src/routes/adminAgents.js`.
- **Problème :** `requireString(..., { max: 64 })` au lieu de `requireUuid` ; une valeur malformée provoque une erreur DB → 500 générique.
- **Recommandation :** `requireUuid`.

**M13 — `verifyMatricule` : rate limit par IP uniquement (20/10 min)** ✅ *corrigé*
- **Fichier :** `backend/api/src/routes/verifyMatricule.js`.
- **Problème :** un attaquant peut énumérer les matricules d'école (semi-publics) depuis de nombreuses IP. La réponse est déjà uniformisée côté RPC (migration 00038 §M13), mais le rate limit n'est pas par matricule.
- **Recommandation :** ajouter un rate limit par valeur de matricule (comme `admin-login`).

**M14 — Bundle frontend monolithique (1,59 Mo)**
- **Problème :** `vite-plugin-singlefile` produit un seul fichier ; pas de code splitting. Impact performance, pas sécurité.
- **Recommandation :** lazy-loading des routes lourdes (recharts, pages admin).

---

### 🟢 Basses

**B1 — Avertissements ESLint** (8 directives `eslint-disable` inutilisées) → nettoyage.
**B2 — `pdfUtils.js` code mort dangereux** (utilisait `.strftime` Python inexistant en JS, importait `pdfkit` absent) → ✅ **supprimé pendant l'audit**.
**B3 — `console.warn` dans `platformStatus`** sur repli par défaut (acceptable, mais bruyant).
**B4 — `adminSchools` `setStatus`/`DELETE` validaient mal `schoolId`** → ✅ **corrigé** (`requireUuid`).
**B5 — `adminAudit.sanitizeSearch` n'échappait pas `_`** → ✅ **corrigé**.
**B6 — Lint root ne vérifiait pas `pdfUtils.js`** (désormais supprimé).
**B7 — Migrations possiblement non appliquées** : vérifier que les migrations 00036/00037/00038 (durcissement) sont bien appliquées en production (`supabase db push`).

---

## 5. Points positifs (défenses déjà en place)

- ✅ JWT Supabase vérifié côté serveur (`svc.auth.getUser`), jamais décodé sans signature.
- ✅ `service_role` uniquement côté serveur (Express), jamais au navigateur.
- ✅ CORS fail-closed en production si `FRONTEND_ORIGIN` absent (avertissement + refus).
- ✅ Rate limiting **atomique en base** (`sys_rate_limit` RPC), compatible multi-instances.
- ✅ `clientIp` utilise le dernier maillon de `X-Forwarded-For` (anti-spoofing).
- ✅ Validation stricte des entrées (`validate.js`) avec UUID, e-mail, téléphone SN, dates ISO.
- ✅ RLS : fonctions `SECURITY DEFINER` avec `search_path` fixé ; `is_active_user`, `password_changed`, `direction_can_write`.
- ✅ Tautologies corrigées (migration 00036) : `class_subjects`, `teaching_assignments`.
- ✅ Inscription élève : viabilité de l'école vérifiée **avant** écriture + plafond 100 demandes en attente.
- ✅ Rattachement élève par `profiles.student_id` (plus par homonymie) — migration 00036.
- ✅ Suppression d'école transactionnelle (`admin_purge_school`) — migration 00037.
- ✅ TRUNCATE révoqué sur tout le schéma public.
- ✅ Audit log pour actions sensibles (connexion, création/suppression, purge).
- ✅ Séparation stricte comptes scolaires vs agents admin (`adminAuth.js`).
- ✅ Dernier superadmin protégé (vérification côté serveur).
- ✅ Mot de passe temporaire obligatoire à changer (`must_change_password` + RPC `complete_password_change`).
- ✅ Aucun `dangerouslySetInnerHTML`, `eval`, `new Function`, `innerHTML`.
- ✅ Aucun secret dans `frontend/src`.
- ✅ Build frontend OK, typecheck OK, lint OK.

---

## 6. Modifications appliquées pendant cet audit

| # | Fichier | Changement |
|---|---|---|
| 1 | `backend/api/src/lib/pdfUtils.js` | Supprimé (code mort dangereux, import `pdfkit` absent, `.strftime` Python). |
| 2 | `backend/api/src/routes/adminSchools.js` | `schoolId` dans `setStatus` et `DELETE` validé via `requireUuid` au lieu de `requireString({max:64})`. |
| 3 | `backend/api/src/routes/adminAudit.js` | `sanitizeSearch` échappe aussi `_` (joker `ilike`). |
| 4 | `backend/api/package-lock.json` | `npm audit fix` : `body-parser` corrigé (0 vulnérabilité). |
| 5 | `frontend/src/lib/functions.ts` | Bearer envoyé uniquement si session (plus de clé anon en repli). |
| 6 | `backend/api/src/lib/rateLimit.js` | `clientIp` utilise `req.ip` en priorité (évite la clé partagée « sans-adresse »). |
| 7 | `backend/api/src/routes/registerDirector.js` | Validation de la formule (`essentiel`/`premium`). |
| 8 | `backend/api/src/routes/adminAgents.js` | `agentId` validé en UUID + mise à jour atomique via RPC `admin_update_agent`. |
| 9 | `backend/api/src/routes/adminSchools.js` | Échappement des jokers dans la recherche `ilike`. |
| 10 | `backend/api/src/routes/adminAudit.js` | `sanitizeSearch` échappe aussi `_`. |
| 11 | `backend/api/src/routes/adminSecurity.js` | Payloads d'audit masqués pour les non-superadmins. |
| 12 | `backend/api/src/routes/timetables.js` | Détection des sous-routes via `req.route.path`. |
| 13 | `backend/api/src/routes/verifyMatricule.js` | Rate limit supplémentaire par valeur de matricule. |
| 14 | `backend/api/src/lib/auth.js` | `serviceClient` mis en cache par schéma. |
| 15 | `frontend/src/...` (8 fichiers) | Suppression des directives ESLint inutilisées. |
| 16 | `backend/supabase/migrations/20260101000039_*.sql` | Nouvelle migration : RPC atomique `admin_update_agent`. |

---

## 7. Recommandations prioritaires (ordre)

1. **Faire tourner la clé `service_role`** si le fichier `.env.local` a pu être synchronisé (OneDrive) ou partagé ; retirer le secret du stockage cloud.
2. **Vérifier le déploiement des Edge Functions** : désactiver/supprimer si l'API Express est la source de vérité.
3. **Activer la confirmation par e-mail** pour les inscriptions publiques (directeur).
4. **Rendre atomique** la protection du dernier superadmin (RPC).
5. **Valider `plan`** contre une liste blanche dans `register-director`.
6. **Mettre à jour** `vite`/`esbuild`/`eslint` pour effacer les vulnérabilités dev-only.
7. **Vérifier l'application des migrations** 00036/00037/00038 en production.
8. **Échapper `%` et `_`** dans toutes les recherches `ilike` (adminSchools, etc.).
9. **Réserver `adminSecurity`** au superadmin.
10. **Nettoyer** les 8 avertissements ESLint.

---

## 8. Périmètre non couvert (à auditer séparément)

- Revue ligne-à-ligne des **43 pages** et **56 features** frontend (logique métier, gestion d'état).
- Matrice complète des **policies RLS** par table (lecture/écriture/suppression) — seule une sélection a été vérifiée.
- Tests E2E / tests unitaires (aucun détecté dans le dépôt).
- Infrastructure Render (variables d'environnement, headers HTTP, TLS, backups Supabase).
- Conformité RGPD / données personnelles (mineurs) — hors scope technique.

---

**Fin du rapport.**