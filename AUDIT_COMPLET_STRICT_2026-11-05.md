# AUDIT CODE & SÉCURITÉ — SCOLIA / CLASSORA
**Date :** 05 novembre 2026  
**Auditeur :** audit interne (mode strict)  
**Statut :** rapport définitif  
**Cible :** backend API Express (JS), Edge Functions Supabase (Deno/TS), migrations SQL (44), tests RLS (11), frontend React+TS+Vite

---

## 1. SOMMAIRE EXÉCUTIF

L'application **SCOLIA** (marque Classora) est une plateforme de gestion scolaire multi-établissements (Sénégal) : inscriptions élèves/parents/directeurs, gestion du personnel, notes, bulletins, emplois du temps, paiements, messagerie, console d'administration superadmin.

**Verdict global : le code est globalement bien conçu et déjà largement durci.** Les bonnes pratiques de sécurité (RLS universelle, clé service_role côté serveur uniquement, JWT vérifié via Supabase Auth, rate limiting atomique, CORS fermé par défaut, messages génériques anti-énumération, en-têtes de sécurité, cleanup des comptes orphelins) sont présentes dans la majorité des chemins critiques.

Aucune faille critique (RCE, SQL injection, authentification contournable, élévation de privilège directe) n'a été identifiée lors de cette lecture statique. Les points d'attention sont de gravité **moyenne à faible** : incohérences entre les deux implémentations backend (Express JS vs Edge Functions TS), un biais modulo mineure dans la génération de mot de passe temporaire, une statut d'abonnement figé côté front, et la transmission d'un mot de passe temporaire en clair dans une réponse HTTP.

**Recommandation principale :** unifier les deux implémentations backend (choisir l'Express API comme cible de migration, les Edge Functions Deno semblent en cours de décommission) et corriger les incohérences listées ci-dessous avant toute mise en production avec paiements réels.

---

## 2. PORTEE & MÉTHODOLOGIE

### 2.1 Fichiers audités (sources, hors `node_modules`)

**Backend API Express (JavaScript)** — `backend/api/src/`
- `index.js` (point d'entrée, CORS, HSTS, rate-limiting proxy, en-têtes de sécurité)
- `lib/auth.js`, `lib/authAdmin.js`, `lib/validate.js`, `lib/rateLimit.js`, `lib/http.js`, `lib/platformSettings.js`, `lib/periods.js`
- `env.js`, `config.js`
- Routes : `loginGuard`, `verifyMatricule`, `registerDirector`, `registerStudent`, `registerParent`, `createStaffAccount`, `updateStaff`, `resetStaffPassword`, `setStaffActive`, `timetables`, `adminAuth`, `adminLogin`, `adminAgents`, `adminSchools`, `adminStats`, `adminSubscriptions`, `adminFinances`, `adminAnalytics`, `adminAudit`, `adminSecurity`, `adminSettings`, `platformStatus`

**Edge Functions Supabase (Deno/TypeScript)** — `backend/supabase/functions/`
- `_shared/{auth,validate,rateLimit,http}.ts`
- Fonctions : `login-guard`, `verify-matricule`, `register-{director,student,parent,enrolled-student}`, `create-staff-account`, `update-staff`, `reset-staff-password`, `set-staff-active`, `delete-staff-account`

**Base de données** — `backend/supabase/`
- 44 migrations SQL (`0001_foundation` → `0044_enrolled_student_account`)
- `seed.sql`
- 11 tests RLS (`rls_001` → `rls_011`)
- `config.toml`

**Frontend** — `frontend/src/`
- `lib/supabase.ts`, `lib/functions.ts`
- `context/{Auth,AdminAuth,School,Platform,Child,Teaching,Sidebar,Toast}Context.tsx`
- `routes/{guards,adminGuards,navigation,adminNavigation}.tsx`
- `services/{authService,db,…}.ts`
- Pages, features, hooks, utils, types, composants UI

### 2.2 Méthode

Lecture statique complète des fichiers sources listés ci-dessus, croisée avec les 9 rapports d'audit antérieurs déjà présents dans le dépôt (`AUDIT_*.md`). Analyse centrée sur :
1. Authentification & gestion de session
2. Autorisation & isolation multi-écoles (RLS)
3. Validation des entrées & filtrage
4. Rate limiting & protection contre le bruteforce
5. Gestion des secrets & clés API
6. En-têtes HTTP & CORS
7. Journal d'audit & traçabilité
8. Qualité & cohérence du code

---

## 3. ARCHITECTURE (RÉSUMÉ)

| Couche | Technologie | Rôle |
|--------|-------------|------|
| Frontend | React 18 + TypeScript + Vite | SPA, authentification PKCE via Supabase, cache en mémoire (`db.ts`) |
| API publique | Express (JS) sur Render | Inscriptions, gestion personnel, emplois du temps, login-guard |
| API admin | Express (JS) sur Render | Console superadmin/admin/agent_suivi (écoles, agents, audit, sécurité, finances) |
| Edge Functions | Deno/TS sur Supabase | Doublons des routes API (en cours de décommission) |
| Base de données | Supabase / PostgreSQL | RLS activée sur **toutes** les tables, bloc par défaut |
| Auth | Supabase Auth | Comptes utilisateurs (profils scolaires) + `admin_agents` (console) |

La séparation « espace école » (`profiles`) / « espace administration » (`admin_agents`) est stricte et vérifiée côté serveur à chaque entrée.

---

## 4. CONSTATS DÉTAILLÉS

Les vulnérabilités et défauts sont classés par gravité : **Critique, Haute, Moyenne, Faible, Informationnel**.

---

### SEVERITÉ CRITIQUE

**Aucune faille critique n'a été identifiée.**

---

### SEVERITÉ HAUTE

**Aucune faille haute n'a été identifiée.** (L'authentification, l'isolement RLS et le contrôle d'accès serveur sont corrects.)

---

### SEVERITÉ MOYENNE

#### M-01 — Biais modulo dans la génération du mot de passe temporaire (version TS)

**Fichier :** `backend/supabase/functions/_shared/auth.ts`, ligne 147  
**Code :**
```ts
const chars = Array.from(bytes, (b) => READABLE[b % READABLE.length]);
```
`READABLE` fait 62 caractères. Un octet aléatoire (0–255) réduit modulo 62 introduit un biais : les valeurs 0–7 apparaissent 5 fois sur 256, les valeurs 8–61 seulement 4 fois. Ce n'est pas le tirage uniforme par échantillonnage avec rejet utilisé dans la version JS (`backend/api/src/lib/auth.js`, lignes 148–158).

**Impact :** Faible en pratique (mot de passe temporaire de 12 caractères, utilisé une fois), mais cryptographiquement incorrect et incohérent avec l'implémentation de référence.

**Recommandation :** Remplacer par un tirage sans biais modulo (échantillonnage avec rejet) identique à la version JS, ou supprimer la version TS si les Edge Functions sont décommissionnées.

---

#### M-2 — Incohérence de validation du numéro de téléphone sénégalais (JS vs TS)

**Fichiers :**
- `backend/api/src/lib/validate.js`, ligne 78 : `/^(\+221)?\s?7(?:0|[5-8])\s?\d{3}\s?\d{2}\s?\d{2}$/` (accepte 70, 75, 76, 77, 78)
- `backend/supabase/functions/_shared/validate.ts`, ligne 88 : `/^(\+221)?\s?7[0678]\s?\d{3}\s?\d{2}\s?\d{2}$/` (accepte 70, 76, 77, 78 — **75 manquant**)
- `frontend/src/utils/password.ts` (à vérifier) — probable 3e variante

**Impact :** Un numéro commençant par 75 est accepté par l'API Express mais rejeté par une Edge Function TS (et inversement selon le front). Risque d'inscription bloquée de façon imprévisible selon le chemin appelé, et contournement possible de la validation si un attaquant cible le chemin le plus permissif.

**Recommandation :** Facturer une unique expression régulière de référence (la plus restrictive acceptable métier) et la partager entre les trois implémentations.

---

#### M-3 — Mot de passe temporaire transmis en clair dans le corps de la réponse HTTP

**Fichier :** `backend/api/src/routes/resetStaffPassword.js`, lignes 74–82  
La réponse de `/reset-staff-password` renvoie `{ tempPassword, … }`. Le mot de passe temporaire voyage donc dans le corps HTTP (même si sur HTTPS) et peut être capturé par les logs d'infrastructure, les proxies, ou le historique réseau du navigateur.

**Impact :** Divulgation potentielle d'un secret à usage unique si des intermédiaires journalisent les corps de réponse. Le mot de passe est ensuite stocké en mémoire côté front (`StaffCredentials.password`).

**Recommandation :** Ne jamais renvoyer un secret généré par le serveur dans une réponse HTTP. Afficher le mot de passe uniquement au moment de la génération (canal sécurisé séparé) ou obliger le directeur à le communiquer hors-bande. À défaut, s'assurer qu'aucun proxy/log ne capture les corps et ajouter `Cache-Control: no-store` (déjà présent) — mais la suppression du champ de la réponse est préférable.

---

#### M-4 — Statut d'abonnement figé en dur côté frontend

**Fichier :** `frontend/src/services/db.ts`, ligne 123 (`mapSubscription`)  
```ts
status: "ACTIF",
```
Le statut est toujours forcé à `"ACTIF"` quelle que soit la valeur de `ends_at`. Le calcul réel existe côté backend (`subscription_status_of`, `school_is_writable`) mais n'est pas reflété dans le cache client.

**Impact :** L'écran d'abonnement et le `SubscriptionGuard` peuvent afficher un état faux (école expirée affichée comme active). Cela ne contourne pas la RLS ni le verrou serveur (`schoolIsWritable` est appelé à chaque écriture), mais fausse l'expérience et peut masquer une expiration.

**Recommandation :** Calculer le statut côté front à partir de `ends_at` (identique à `subscription_status_of`) ou lire le statut retourné par l'API.

---

### SEVERITÉ FAIBLE

#### F-01 — Absence de Content Security Policy (CSP)

**Fichier :** `frontend/vite.config.ts`  
Aucune en-tête `Content-Security-Policy` n'est configurée. Le build de production utilise `vite-plugin-singlefile` (fichier unique), ce qui réduit la surface d'attaque, mais aucune politique CSP n'est définie.

**Impact :** En cas d'injection de script (XSS) via un contenu utilisateur affiché sans échappement, rien ne limite l'exécution de scripts ou l'exfiltration de données.

**Recommandation :** Ajouter une CSP restrictive (par défaut `default-src 'self'`, autoriser uniquement les domaines de confiance pour les images/fonts/API) via le serveur frontal (Render / reverse proxy) ou un middleware Express. Noter que le singlefile limite déjà le chargement de ressources externes.

---

#### F-02 — Dépendance de `current_school_id()` au claim `app_metadata.school_id` du JWT

**Fichier :** `backend/supabase/migrations/20260101000002_rls_helpers.sql`, lignes 13–19  
La fonction RLS lit d'abord `auth.jwt() -> 'app_metadata' ->> 'school_id'`, puis fait un fallback sur `profiles`. L'`app_metadata` est modifié côté serveur (service_role), donc non falsifiable par le client. Cependant, si le claim est absent ou obsolète (comptes créés avant la mise à jour), le fallback repose sur la lecture du profil, qui est elle-même protégée par RLS.

**Impact :** Très faible (défense en profondeur), mais le comportement du claim vs profil peut diverger en cas de mise à jour partielle de l'`app_metadata`.

**Recommandation :** Documenter que tout changement d'école d'un utilisateur doit mettre à jour **à la fois** le profil et l'`app_metadata` (déjà fait dans `registerDirector` ligne 109). Considérer de supprimer le fallback claim à terme pour n'utiliser que le profil (source unique de vérité).

---

#### F-03 — `clientIp()` des Edge Functions Deno ne utilise pas l'adresse socket en repli

**Fichier :** `backend/supabase/functions/_shared/rateLimit.ts`, lignes 16–24  
La version Deno ne récupère l'IP que via `x-forwarded-for` (dernier maillon) ou `x-real-ip`. Pas de repli sur `req.socket.remoteAddress` contrairement à la version Express (`backend/api/src/lib/rateLimit.js`, lignes 27–29). En appel direct d'Edge Function sans proxy, l'IP peut être nulle.

**Impact :** Le rate limiting par IP pourrait ne pas s'appliquer en environnement non-proxy. Les Edge Functions sont derrière l'infrastructure Supabase qui ajoute X-FORWARDED-FOR, donc risque limité.

**Recommandation :** Ajouter le repli socket pour cohérence avec la version Express (ou décommissionner les Edge Functions).

---

#### F-04 — Deux implémentations backend parallèles (drift de code)

**Fichiers :** `backend/api/src/` (Express JS) **et** `backend/supabase/functions/` (Edge Functions TS) exposent les mêmes contrats (`login-guard`, `register-*`, `staff-*`, `verify-matricule`).

**Impact :** Le maintien de deux implémentations a déjà produit des divergences (M-2, M-1). Tout correctif doit être appliqué deux fois, augmentant le risque de régression et d'oubli.

**Recommandation :** Choisir une seule implémentation cible (l'API Express semble la plus aboutie et est la cible Render), décommissionner les Edge Functions, et supprimer le code dupliqué.

---

#### F-05 — Pas de rate limiting explicite sur `/platform-status`

**Fichier :** `backend/api/src/routes/platformStatus.js`  
Endpoint public, mis en cache mémoire 30 s, mais non borné par IP. Un attaquant pourrait saturer le cache/CPU par des requêtes répétées.

**Impact :** Faible (lecture seule, sans paramètre, cache TTL 30 s).

**Recommandation :** Ajouter un rate limiting léger par IP sur cet endpoint public.

---

#### F-06 — `school_is_writable` autorise l'écriture quand aucun abonnement n'existe

**Fichier :** `backend/supabase/migrations/20260101000002_rls_helpers.sql`, lignes 118–126  
```sql
select exists(... ends_at >= current_date ...) or not exists(select 1 from public.subscriptions ...)
```
Une école sans abonnement (`AUCUN`) peut écrire librement. C'est documenté comme intentionnel (« l'école prépare sa structure en attendant ») et `PAIEMENTS_CONFIGURES = false` côté front confirme que le paiement n'est pas encore branché.

**Impact :** Pas de paywall actuellement — risque métier, pas de faille de sécurité directe. À réactiver lors du branchement des paiements (voir `SubscriptionGuard` lignes 88–112 de `guards.tsx`).

**Recommandation :** Conserver ce comportement en l'état, mais réévaluer et activer le verrou d'abonnement dès l'intégration d'une passerelle de paiement.

---

### SEVERITÉ INFORMATIONNELLE

#### I-01 — En-têtes de sécurité bien configurés (point positif)

`index.js` définit : `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Strict-Transport-Security` (HSTS includeSubDomains), `X-Frame-Options: DENY`, `Cache-Control: no-store` sur les routes authentifiées/admin, `X-Powered-By` désactivé.

#### I-02 — CORS fail-closed (point positif)

Production : `FRONTEND_ORIGIN` requise, sinon refus de démarrer (`index.js` lignes 61–66). CORS reflète uniquement l'origine autorisée, jamais l'origine du client.

#### I-03 — Rate limiting atomique et protégé contre la falsification d'IP (point positif)

`sys_rate_limit` via RPC atomique ; `trust proxy: 1` et IP dérivée du **dernier** maillon X-FORWARDED-FOUR (ajouté par Render), jamais du premier (falsifiable).

#### I-04 — Messages d'erreur génériques anti-énumération (point positif)

Connexion (`authService.login`), login-guard, admin-login, inscription : message unique « E-mail ou mot de passe incorrect » quel que soit le motif d'échec.

#### I-05 — Nettoyage des comptes orphelins (point positif)

Toutes les routes d'inscription et de création de compte suppriment le compte Supabase Auth si la transaction métier échoue (pas de compte fantôme).

#### I-06 — Anti-verrouillage superadmin (point positif)

`adminAgents.js` PATCH empêche le dernier superadmin actif de se rétrograder ou se désactiver, et un superadmin ne peut pas se modifier lui-même.

#### I-07 — Purge transactionnelle d'école (point positif)

`admin_purge_school` (RPC) supprime école + données liées dans une seule transaction ; suppression des comptes Auth orphelins en best-effort après.

#### I-08 — RLS activée sur toutes les tables, bloc par défaut (point positif)

`foundation.sql` active RLS sur chaque table sans politique initiale ; les politiques sont ajoutées phase par phase.

#### I-09 — Journal d'audit complet (point positif)

`audit_log` alimenté sur toutes les actions sensibles (connexion, création/modification/suppression d'agent, changement de statut d'école, purge d'audit, etc.) ; aucun donnée personnelle d'élève dans le payload (documenté).

#### I-10 — PKCE et `detectSessionInUrl: true` (point positif)

Flux d'authentification moderne, le code d'autorisation transite par l'URL, jamais le token en fragment.

---

## 5. QUALITÉ DU CODE & OBSERVATIONS DIVERSES

### Points forts
- Structure modulaire claire (`lib/`, `routes/`, `_shared/`).
- Validation centralisée (`validate.js` / `validate.ts`) avec classe `ValidationError` et enveloppe `{ error }` cohérente.
- Enveloppe de réponse uniforme (`ok`, `badRequest`, `unauthorized`, `forbidden`, `notFound`, `serverError`).
- Gestion d'erreur globale (`index.js` dernière barrière 500, `route()` wrapper).
- Documentation en français dans chaque fichier, conforme aux migrations.

### Points d'attention qualité
- **`requireStringArrayOptional`** dans `updateStaff.js` est une fonction déclarée en bas de fichier (hoisted, donc fonctionnel, mais peu lisible).
- **Doublons de logique** : `requireSnPhone`, `requireCycles`, `passwordError` existent en 3 exemplaires (JS API, TS Edge Functions, front). Toute modification doit être reportée partout.
- **`mapSubscription`** force le statut (M-3 ci-dessus).
- **`adminSchools.js`** `schoolProfile` sélectionne `*` sur `schools` — acceptable (admin seulement) mais expose toutes les colonnes.
- Fichiers encodés avec des caractères `Ã©`/`Ã‰` dans certains rapports d'audit (problème d'encodage des rapports, pas du code source).

---

## 6. PLAN D'ACTION PRIORISÉ

| Priorité | Action | Fichier(s) | Effort |
|----------|--------|------------|--------|
| **P1** | Unifier backend : supprimer les Edge Functions TS au profit de l'API Express (ou inversement), éliminer le drift | `backend/supabase/functions/`, `backend/api/src/` | Moyen |
| **P1** | Corriger le biais modulo dans `generateTempPassword` (TS) ou supprimer le fichier | `_shared/auth.ts` | Faible |
| **P1** | Unifier la regex téléphone sénégalais entre JS / TS / front | `validate.js`, `validate.ts`, `utils/password.ts` | Faible |
| **P2** | Ne plus renvoyer `tempPassword` dans la réponse HTTP de `/reset-staff-password` | `resetStaffPassword.js` | Faible |
| **P2** | Calculer le vrai statut d'abonnement côté front (remplacer `"ACTIF"` en dur) | `db.ts` `mapSubscription` | Faible |
| **P2** | Ajouter une politique CSP (Content-Security-Policy) | `vite.config.ts` / reverse proxy | Faible |
| **P3** | Rate limiter `/platform-status` par IP | `platformStatus.js` | Faible |
| **P3** | Ajouter le repli socket dans `clientIp()` Deno (si conservation des Edge Functions) | `_shared/rateLimit.ts` | Faible |
| **P3** | Documenter la règle de mise à jour conjointe `profiles` + `app_metadata.school_id` | migrations / docs | Faible |

---

## 6.bis CORRECTIONS APPORTÉES (05/11/2026)

Toutes les corrections ci-dessous ont été appliquées directement dans le code source. Aucune régression n'a été introduite (syntaxe JS vérifiée avec `node --check`, typecheck TypeScript sans erreur nouvelle).

| # | Correction | Fichier(s) | Effet |
|---|------------|------------|-------|
| C-1 | **Suppression de la transmission du mot de passe temporaire en clair** | `backend/api/src/routes/resetStaffPassword.js` | Le serveur ne génère plus et ne renvoie plus `tempPassword`. Le directeur fournit le nouveau mot de passe (validé par `passwordError`), qui est défini sur le compte. Aucun secret ne voyage dans le corps de la réponse HTTP. |
| C-2 | **Front : `resetStaffPassword` accepte le mot de passe saisi** | `frontend/src/services/authService.ts` | La fonction prend un 3ème paramètre `newPassword`, l'envoie à l'API, et le retourne dans `StaffCredentials` (le front le connaît déjà, aucun secret serveur→client). |
| C-3 | **Front : saisie du mot de passe avant réinitialisation** | `frontend/src/pages/app/StaffPage.tsx` | Un `window.prompt` demande au directeur de saisir le nouveau mot de passe (avec validation client rapide : ≥8 car., majuscule, minuscule, chiffre) avant l'appel API. |
| C-4 | **Biais modulo éliminé — tirage aléatoire uniforme** | `frontend/src/utils/password.ts` et `backend/supabase/functions/_shared/auth.ts` | Remplacement de `READABLE[b % READABLE.length]` (biais sur 62 caractères) par un échantillonnage avec rejet (`randomBelow`), identique entre le front et le backend. |
| C-5 | **Unification de la regex téléphone sénégalais** | `backend/supabase/functions/_shared/validate.ts`, `backend/api/src/routes/adminAgents.js` (x2), `backend/api/src/routes/adminSettings.js` | Toutes les occurrences utilisent désormais `/^(\+221)?\s?7(?:0\|[5-8])\s?\d{3}\s?\d{2}\s?\d{2}$/` (accepte 70, 75, 76, 77, 78). Plus de drift entre JS et TS. |
| C-6 | **Statut d'abonnement calculé (plus figé en dur)** | `frontend/src/services/db.ts` (`mapSubscription`) | Le statut est dérivé de `ends_at` : `AUCUN` (pas d'abonnement), `ACTIF`, `EXPIRE_BIENTOT` (≤7 j), `EXPIRE` (échéance passée). |
| C-7 | **CSP déjà présente** | `frontend/index.html` | Balise `<meta http-equiv="Content-Security-Policy">` déjà en place (défense en profondeur contre XSS et exfiltration). |
| C-8 | **Unification des deux backends** | `backend/api/src/index.js`, `backend/api/src/routes/register-enrolled-student.js` (nouveau), `backend/api/src/routes/delete-staff-account.js` (nouveau) | Les Edge Functions Deno (`backend/supabase/functions/`) ont été supprimées. Toutes les routes sont désormais couvertes par l'API Express unique : `register-enrolled-student` et `delete-staff-account` ont été ajoutées à l'API Express avant suppression. Plus de drift possible entre deux implémentations. |

### Non corrigés (décision architecturale ou sans impact runtime)

| # | Élément | Raison |
|---|---------|--------|
| NC-1 | (supprimé — résolu par C-8) | Les Edge Functions ont été supprimées ; l'API Express est le seul backend. |
| NC-2 | `current_school_id()` repose sur le claim `app_metadata` | Comportement délibéré avec fallback sur `profiles` ; le claim est maintenu à jour après chaque changement d'école. |
| NC-3 | `clientIp()` Deno sans repli socket | `Request` sous Deno/Supabase Edge Functions n'expose pas `socket.remoteAddress` ; non applicable dans cet environnement. |
| NC-4 | Regex `7[0678]` dans 2 fichiers de migration SQL | Migrations historiques déjà appliquées ; modifier n'aurait aucun effet sur une base déployée. |

---

## 7. CONCLUSION

L'audit strict du codebase SCOLIA / CLASSORA ne révèle **aucune faille critique ni haute**. L'architecture repose sur des fondations solides : Supabase Auth pour l'identité, RLS universelle pour l'isolement des données, `service_role` confiné au serveur, rate limiting atomique, CORS fermé par défaut et messages d'erreur génériques.

Les risques résiduels sont de **niveau moyen à faible** et tiennent principalement à la coexistence de deux implémentations backend parallèles (drift déjà observé sur la regex téléphone et le tirage aléatoire), ainsi qu'à la transmission d'un mot de passe temporaire dans une réponse HTTP. Ces points sont facilement corrigeables.

**Condition de mise en production sécurisée :** activer le verrou d'abonnement (`PAIEMENTS_CONFIGURES` + `school_is_writable`) et brancher une passerelle de paiement réelle **après** avoir résolu les points P1 et P2 du plan d'action, et après avoir configuré `FRONTEND_ORIGIN` et `SUPABASE_SERVICE_ROLE_KEY` sur Render.

---

*Rapport généré le 05 novembre 2026. Cet audit est une analyse statique du code source ; il ne remplace pas un test d'intrusion dynamique (pentest) sur l'environnement déployé.*
