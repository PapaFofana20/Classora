# Audit — connexion admin impossible après création manuelle de l'utilisateur (25 octobre 2026)

Contexte : un utilisateur a été créé dans le tableau de bord Supabase
(Authentication > Users) et les 25 migrations ont été appliquées, mais la
connexion sur `/admin/connexion` échoue avec un message du type
« cet utilisateur n'est pas connu ».

Correction d'entrée : le vrai front déployé est
**`https://classora-gsay.onrender.com`** (l'URL `classora-frontend.onrender.com`
cité par l'audit du 24/10 correspond à un ancien service Render suspendu, sans
rapport avec le front réel). Avec la bonne origine, **la chaîne réseau déployée
est entièrement fonctionnelle** (§3) — le blocage est purement **côté données**.

Méthode : lecture du code (front + API + migrations), appels réels en lecture
seule à l'API déployée, au front déployé et au projet Supabase
(`wjfgtmaplqfblpidryld`). Aucune donnée n'a été modifiée.

---

## 1. Verdict

**Les migrations ne sont pas en cause** (vérifié, §3). Le blocage vient de la
**donnée**, pas du schéma :

1. **Cause principale — la ligne `admin_agents` n'existe pas.** Créer un
   utilisateur dans le dashboard Supabase crée **uniquement** une entrée
   `auth.users`. Aucun trigger sur `auth.users` n'existe dans les 25
   migrations (vérifié) : rien ne crée la ligne `admin_agents`. Or
   `POST /admin/auth` (`backend/api/src/routes/adminAuth.js:26-27`) exige une
   ligne `admin_agents` avec `auth_user_id = <id du compte>` et
   `status = 'ACTIF'`, sinon il répond **401 « Aucun profil administrateur
   associé à ce compte. »** — c'est ce message que tu vois (reformulé
   « utilisateur non connu »).
2. **E-mail probablement non confirmé.** Le projet a `mailer_autoconfirm =
   false` (constat du 24/10). Un utilisateur créé à la main dans le dashboard
   **sans** cocher « Auto Confirm User » ne peut même pas ouvrir de session
   Supabase Auth : `Invalid login credentials` → le front affiche
   « E-mail ou mot de passe incorrect. » Deux blocages successifs, donc.
3. ~~Chaîne réseau défaillante~~ **Réglée** : front `classora-gsay` en ligne,
   CORS admis, `VITE_API_URL` correct dans le bundle (§3). Reste à traiter si
   tu testes en **local** : l'API locale n'a ni `.env.local` ni clé
   `service_role` (§3).

Autrement dit : même avec le bon mot de passe, un compte créé depuis le
dashboard **ne pourra jamais** passer `/admin/connexion` tant que la ligne
`admin_agents` n'a pas été créée — et le script d'amorçage prévu à cet effet
(`npm run admin:bootstrap`, corrigé hier) n'a visiblement pas été exécuté.

---

## 2. Rappel de la chaîne de connexion attendue

1. `/admin/connexion` → `supabase.auth.signInWithPassword` (Supabase Auth).
2. Si Auth refuse (e-mail inconnu, non confirmé, mauvais mot de passe) →
   « E-mail ou mot de passe incorrect. »
3. Sinon `verify()` → `POST {VITE_API_URL}/admin/auth` avec le JWT.
4. L'API vérifie le JWT puis cherche `admin_agents.auth_user_id = user.id`.
5. Ligne absente → 401 « Aucun profil administrateur associé à ce compte. » ;
   statut ≠ ACTIF → 403 « désactivé / en attente » ; sinon session ouverte.

Le message exact affiché côté front (`AdminLoginPage.tsx`) désigne le maillon
fautif — il n'existe aucun « utilisateur non connu » littéral dans le code.

---

## 3. Preuves exécutées (25/10)

| Vérification | Résultat | Conclusion |
| --- | --- | --- |
| `GET /rest/v1/admin_agents` (clé publishable) | **HTTP 200 `[]`** | table existante, RLS fermée : migration 00024 **appliquée** |
| `POST /admin/auth` sans jeton (API déployée) | **401** `{"error":"Session expirée. Reconnectez-vous."}` | route en ligne et fonctionnelle |
| `GET https://classora-gsay.onrender.com` | **200** | **vrai front déployé en ligne** |
| Préflight `OPTIONS /admin/auth` Origin `https://classora-gsay.onrender.com` | **204 + `access-control-allow-origin: https://classora-gsay.onrender.com`** | **CORS fonctionnel** pour le vrai front |
| `POST /admin/auth` Origin `https://classora-gsay.onrender.com` | **401** (jeton absent) — pas de 403 | l'origine est admise par `FRONTEND_ORIGIN` |
| `POST /admin/auth` Origin `classora-frontend.onrender.com` / `localhost:5173` | **403 « Origine non autorisée. »** | ancien service / dev local absents de `FRONTEND_ORIGIN` — sans impact sur le site déployé |
| Bundle du front déployé (`index.html` inliné) | `classora-backend-a7n1` : **1 occurrence** ; `localhost:3000` : **0** | **`VITE_API_URL` correcte dans le build** (API déployée) |
| Bundle du front déployé — projet Supabase | `wjfgtmaplqfblpidryld.supabase.co` | le bon projet Supabase |
| `GET https://classora-backend-a7n1.onrender.com/healthz` | **200 `{"ok":true,"supabaseConfigured":true}`** | API déployée saine et configurée |
| Supabase Auth, mot de passe volontairement faux | **400 `invalid_credentials`** | message Auth traduit par le front en « E-mail ou mot de passe incorrect. » |
| Triggers `on auth.users` dans les 25 migrations | **aucun** | création dashboard ≠ profil admin (ni `profiles`, ni `admin_agents`) |
| `backend/api/.env.local` / `.env` | **absents** | API locale non configurée (sans effet sur le site déployé) |
| Ports 3000 / 5173 en écoute | **aucun** | ni API ni front locaux ne tournent au moment de l'audit |
| `frontend/.env.local` | `VITE_API_URL=http://localhost:3000` | le front **dev** vise l'API locale (le build déployé, lui, est correct) |

---

## 4. Correctif recommandé (dans l'ordre)

### Étape 1 — amorcer le superadministrateur (règle les causes 1 et 2)

Le script `backend/api/scripts/bootstrap-admin.mjs` est **idempotent** et gère
précisément ton cas : il retrouve le compte créé dans le dashboard, **confirme
son e-mail**, réinitialise son mot de passe, puis crée la ligne
`admin_agents` (`superadmin`, `ACTIF`) :

```bash
cd backend/api
SUPABASE_URL=https://wjfgtmaplqfblpidryld.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<clé service_role — Dashboard > Project Settings > API> \
ADMIN_EMAIL=ton.adresse@classora.sn \
ADMIN_PASSWORD='<mot de passe souhaité (≥ 8 caractères)>' \
ADMIN_FIRST_NAME=Papa ADMIN_LAST_NAME=Fofana \
  npm run admin:bootstrap
```

Alternative sans script (SQL Editor Supabase, voir AUDIT_ADMIN_2026-10-24.md
§8) : `update auth.users set email_confirmed_at = coalesce(email_confirmed_at,
now()) where lower(email) = lower('…');` puis insertion manuelle dans
`admin_agents` avec `role = 'superadmin'`, `status = 'ACTIF'`.

À vérifier aussi dans le dashboard : que l'utilisateur a bien été créé dans le
**projet `wjfgtmaplqfblpidryld`** (celui du front), pas dans un autre projet.

### Étape 2 — se connecter sur le bon écran

`https://classora-gsay.onrender.com/admin/connexion` (pas `/connexion`,
réservé à l'espace scolaire). La chaîne déployée étant fonctionnelle (§3),
**aucune action Render n'est nécessaire**.

### Étape 3 (optionnel) — pour tester en local

1. Créer `backend/api/.env.local` :
   `SUPABASE_URL=https://wjfgtmaplqfblpidryld.supabase.co` et
   `SUPABASE_SERVICE_ROLE_KEY=<clé service_role>`.
2. `npm run dev` dans `backend/api` **avant** le front (le front dev vise
   `http://localhost:3000`).
3. `npm run dev` dans `frontend`, puis `/admin/connexion`.
4. Si tu préfères que le front local appelle l'API **déployée**, ajoute
   `http://localhost:5173` à `FRONTEND_ORIGIN` sur Render (actuellement
   refusée — sans impact sur le site déployé).

---

## 5. Arbre de décision — quel message désigne quel maillon

| Message affiché | Maillon fautif | Correctif |
| --- | --- | --- |
| « E-mail ou mot de passe incorrect. » | Supabase Auth refuse : e-mail non confirmé, mauvais mot de passe, ou compte dans un autre projet | Étape 1 (le script confirme l'e-mail + fixe le mot de passe) |
| « Service indisponible… » | API locale absente / `VITE_API_URL` faux | Étape 2 locale |
| « Service d'administration non configuré » (503) | `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` absents côté API | `.env.local` (local) ou Environment (Render) |
| « Origine non autorisée. » (403) | Origine appelante absente de `FRONTEND_ORIGIN` | n'affecte pas le site déployé (admise) ; ne concerne que le dev local contre l'API déployée (étape 3.4) |
| « Aucun profil administrateur associé à ce compte. » | Compte Auth OK mais **pas de ligne `admin_agents`** | Étape 1 — **cause principale de cet audit** |
| « …désactivé / en attente de validation » | `admin_agents.status` ≠ `ACTIF` | `update admin_agents set status='ACTIF' …` |

---

## 6. Suites données aux constats du 24/10

| Constat du 24/10 | État au 25/10 |
| --- | --- |
| ADM-16 `.env.local` non chargé par l'API | corrigé (code), mais le fichier n'a **toujours pas été créé** — sans effet sur le site déployé |
| ADM-03 script d'amorçage | livré, **pas encore exécuté** (aucune ligne `admin_agents`) |
| ADM-17 `FRONTEND_ORIGIN` sur Render | **réglé** : l'origine du vrai front (`classora-gsay.onrender.com`) est admise ; l'ancien audit testait la mauvaise URL (`classora-frontend`, ancien service suspendu) |
| ADM-18 front « suspendu » | **non applicable** : le vrai front `classora-gsay` est en ligne (200) ; `classora-frontend` est un ancien service sans rapport |
| ADM-02 `VITE_API_URL` dans le build | **réglé** : le bundle déployé embarque `https://classora-backend-a7n1.onrender.com` (zéro `localhost:3000`) |
| Migrations 25/25 | confirmées appliquées (§3) — hors cause |

---

## 7. Résolution appliquée (25/10, avec l'accord du propriétaire)

Cause réelle affinée pendant la correction : la ligne `admin_agents`
(matricule **CLA-ADM-000002**, créée manuellement le 24/10 au SQL Editor)
pointait vers un **ancien compte Auth supprimé** (`36b71862…`), tandis que le
compte créé dans le dashboard (`0188cc0a…`, `admin@classora.sn`) n'en avait
pas. Supabase Auth acceptait donc la connexion (une session réussie figure à
01:58), puis `/admin/auth` répondait « Aucun profil administrateur associé à
ce compte. » — le message reformulé « utilisateur non connu ».

Actions exécutées :

1. `backend/api/.env.local` créé (URL + clé `service_role`, gitignoré).
2. `npm run admin:bootstrap` sur `admin@classora.sn` : mot de passe fixé,
   e-mail confirmé (`email_confirmed_at` rempli).
3. Ligne `admin_agents` (CLA-ADM-000002) **rattachée** au compte réel
   `0188cc0a…` (`update auth_user_id`), statut `superadmin / ACTIF` inchangé.
4. Test de bout en bout exécuté : `signInWithPassword` → **HTTP 200**, puis
   `POST /admin/auth` sur l'API déployée avec l'origine
   `https://classora-gsay.onrender.com` → **HTTP 200** avec le profil agent.

**Connexion désormais fonctionnelle** sur
`https://classora-gsay.onrender.com/admin/connexion` avec `admin@classora.sn`.

Hygiène recommandée : la clé `service_role` a transité dans la conversation —
la **recycler** (Dashboard > Project Settings > API Keys) et mettre à jour
`backend/api/.env.local` ainsi que l'environnement Render si elle y est utilisée.
