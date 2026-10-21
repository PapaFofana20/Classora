# Audit SCOLIA — 21 octobre 2026

> Audit de sécurité applicative et de robustesse fonctionnelle, en **lecture seule**.
> Aucun fichier applicatif, aucune migration et aucun test n'a été modifié.
> Ce rapport **complète** `AUDIT_REPORT.md` (audit antérieur) sans l'écraser.

---

## 1. Synthèse

**Verdict : NON PRÊT POUR LA PRODUCTION.**

L'application dispose de fondations solides (RLS activée partout, écritures
sensibles majoritairement serveur, pas de secret dans le bundle), mais deux
défauts bloquants empêchent un fonctionnement réel, et plusieurs contrôles
d'autorisation restent contournables.

| Sévérité | Nombre | Constats |
|---|---:|---|
| **Critique** | **2** | Création de classe impossible ; hydratation tronquée à 1 000 lignes |
| **Élevé** | **4** | Détournement d'enfant ; gestion des comptes parent/élève par la direction ; RPC sans contrôle de statut ; matricule d'école jamais attribué |
| **Moyen** | **12** | Rattachement parent, métadonnées de bulletin, mot de passe, téléphone élève, contact, lecture seule, périodes, relances, CI, déploiement, capacité de classe, PII parents |
| **Faible** | **7** | E-mail staff, libellé « réinitialiser », code mort, portée élève, CORS/healthz, opérations non atomiques, configuration/doc |
| **Info** | **5** | Abonnement absent = écriture libre, Edge Functions legacy, seed de démo, rate-limit login, logout après auto-approbation |

### 1.1 Les trois risques majeurs

1. **Blocage d'onboarding** — `createClass` envoie une colonne `section` qui
   n'existe pas dans `class_rooms`. Toute création de classe échoue en
   `PGRST204` ; sans classe, aucun élève ne peut être inscrit. **AUD-101**
2. **Données fausses à l'échelle** — le front charge chaque table avec
   `.limit(2000)`, alors que PostgREST/Supabase plafonne à **1 000 lignes**.
   Paiements, notes, profils et messages sont silencieusement tronqués ; les
   soldes, bulletins, moyennes et rangs calculés côté client deviennent faux.
   **AUD-102**
3. **Contournement d'autorisation** — `link_child` peut réaffecter un enfant
   déjà rattaché à une autre famille, et les RPC `SECURITY DEFINER` ne
   vérifient ni `is_active_user()` ni `password_changed()`. Un compte désactivé
   ou encore en mot de passe temporaire peut continuer à écrire via l'API
   Supabase tant que son jeton/refresh token est valide. **AUD-103 / AUD-105**

### 1.2 Écarts par rapport à l'audit antérieur

| Constat antérieur | État constaté le 2026-10-21 |
|---|---|
| Correctif annoncé « matricule d'école attribué » (`AUDIT_REPORT.md` §1) | **Régression.** `00016` supprime `apply_paid_subscription`, seul flux applicatif qui attribuait le matricule. Le SQL d'activation manuelle fourni dans la migration est invalide (colonnes inexistantes). **AUD-106** |
| AUD-024 — aucune pagination/limite front | **Toujours ouvert, désormais Critique.** La limite `2000` dépasse le plafond serveur `1000` ; l'avertissement ne se déclenche jamais. **AUD-102** |
| AUD-015 — compte désactivé et gestion du personnel | **Corrigé côté API Node** (`requireDirecteur` vérifie `status`), mais **le même défaut subsiste dans les RPC SQL** `SECURITY DEFINER`. **AUD-105** |

### 1.3 Ce qui est solide

- RLS activée sur **toutes** les tables ; aucune lecture inter-écoles trouvée
  dans les politiques examinées.
- `save_grade` et `record_cash_payment` valident côté serveur l'école, le rôle,
  l'affectation, la classe, la matière et les bornes de note/montant.
- `sys_rate_limit` est atomique (migration 00015), compatible multi-instances.
- Le webhook de paiement et le mobile money ont été retirés : surface d'attaque
  réduite, plus de secret de webhook dans le bundle.
- `createStaffAccount` limite les rôles créés au personnel et vérifie
  `school_is_writable`.
- `requireDirecteur` (API Node) vérifie le statut ACTIF, contrairement à
  l'ancienne version Edge Function.
- Pas de `dangerouslySetInnerHTML`, pas d'`eval`, pas de CSRF pertinent
  (authentification par Bearer), aucun secret versionné.
- `npx tsc --noEmit -p frontend` passe ; `node --check` passe sur l'API ;
  `npm audit --omit=dev` : 0 vulnérabilité de production.

---

## 2. Périmètre et méthode

### 2.1 Lu

| Domaine | Fichiers |
|---|---|
| Migrations | `backend/supabase/migrations/20260101000001` → `00016` |
| API Node | `backend/api/src/index.js`, `config.js`, `lib/*`, `routes/*` |
| Front | `frontend/src/services/*`, `context/*`, `utils/*`, `features/*`, `pages/*`, `types/*` |
| Configuration | `backend/supabase/config.toml`, `.github/workflows/ci.yml`, `render.yaml`, `package.json` |
| Exploitation | `backend/api/README.md`, `backend/api/.env.example`, `frontend/.env.example` |

### 2.2 Vérifications exécutées

| Commande / action | Résultat |
|---|---|
| `git status --short` | propre |
| `git log --oneline -12` | dernier commit `e0030bd` (2026-10-21) |
| `npx tsc --noEmit -p frontend` | OK |
| `node --check` sur `backend/api/src/**/*.js` | OK |
| `npm audit --omit=dev` | 0 vulnérabilité de production |
| `npm audit` | 5 vulnérabilités de développement (vite/esbuild/braces/micromatch), sans impact runtime |
| Lecture statique des 16 migrations et de toutes les routes API | faite |

### 2.3 Limites

- **Pas de Docker** sur la machine : `supabase db reset` et les tests RLS
  locaux n'ont pas été rejoués dans cet audit.
- **Pas d'accès au projet Supabase hébergé** : aucun test dynamique contre la
  base de production.
- Les constats sont donc établis par **lecture de code et de schéma**. Les
  défauts de colonne (`section`) et de plafond (`max_rows`) sont néanmoins
  certains : ils découlent directement du schéma et de la configuration.
- Les tests de charge et le comportement réel des fournisseurs de paiement ne
  sont pas couverts (mobile money retiré).

---

## 3. Constats Critiques

### AUD-101 — Critique — La création de classe échoue toujours (`section` inexistante)

**Statut :** ouvert — **bloquant onboarding**

**Fichier:ligne**
- `frontend/src/services/schoolService.ts:247-257` (`createClass`)
- `backend/supabase/migrations/20260101000001_foundation.sql:180-191` (`class_rooms`)
- `frontend/src/pages/app/ClassesPage.tsx:33,42`
- `frontend/src/types/index.ts:100-110` (`ClassRoom` ne contient pas `section`)

**Description.** `createClass` insère explicitement `section: input.section` :

```ts
// schoolService.ts:247-257
await supabase.from("class_rooms").insert({
  school_id: schoolId,
  level_id: level.id,
  name,
  cycle: level.cycle,
  ...(input.series ? { series: input.series } : {}),
  capacity: input.capacity,
  section: input.section,          // <-- colonne inexistante
});
```

Or `public.class_rooms` ne possède **aucune** colonne `section` :

```sql
-- 00001_foundation.sql:180-191
create table public.class_rooms (
  id uuid primary key ...,
  school_id uuid not null ...,
  name text not null,
  level_id text not null ...,
  cycle app_cycle not null,
  series text,
  head_teacher_id uuid ...,
  capacity int not null default 40 ...,
  created_at timestamptz not null default now(),
  unique (school_id, name)
);
```

`ClassesPage` initialise `section: "A"` et l'envoie **dans tous les cas**
(ligne 42) ; même pour le secondaire, où la section ne sert qu'à composer le
nom, la colonne est transmise. PostgREST répond donc systématiquement
`PGRST204 — Could not find the 'section' column of 'class_rooms' in the schema
cache`.

**Impact.** Aucune classe ne peut être créée. Comme `students.class_id` est
`not null` et que `enroll_student` exige une classe, **tout l'onboarding
s'arrête** : pas d'élève, pas d'échéancier, pas de notes, pas de bulletins.
Le directeur voit seulement un toast d'erreur technique.

**Reproduction.** Se connecter comme directeur, ouvrir `Classes`, créer une
classe. La requête `POST /rest/v1/class_rooms` renvoie 400/PGRST204.

**Remédiation.** Supprimer `section` de l'insert (le nom contient déjà la
section, ex. « CI A »). Si la section doit être persistée, créer une migration
`alter table class_rooms add column section text`, puis l'ajouter au type
`ClassRoom`, au mapper `mapClass` et au formulaire. La suppression est le
correctif minimal et sûr.

**Vérification.** Créer une classe en staging, vérifier la ligne en base, puis
inscrire un élève dans cette classe.

**Effort : S.**

---

### AUD-102 — Critique — Hydratation tronquée à 1 000 lignes : soldes, bulletins et messages faux

**Statut :** ouvert — **reprise d'AUD-024, requalifiée Critique**

**Fichier:ligne**
- `frontend/src/services/db.ts:454-461` (`hydrate`)
- `frontend/src/services/db.ts:358-380` (`assign`, avertissement)
- `frontend/src/services/db.ts:321-356` (`hydrateConversations`)
- `backend/supabase/config.toml:18` (`max_rows = 1000`)
- Consommateurs : `paymentService.ts:11-23,39-42`, `gradeService.ts:20-37,70-85,100-122`,
  `reportService.ts:14-31`, `studentService.ts:22,55-62`, `messageService.ts`

**Description.** Toutes les tables sont chargées en une fois avec une limite
de 2 000 :

```ts
// db.ts:461
return assign(entity, supabase.from(table).select("*").limit(2000));

// db.ts:370-373
if (data.length === 2000) {
  console.warn(`[db] ${tableName} : limite de 2000 lignes atteinte ...`);
}
```

Mais `config.toml` fixe `max_rows = 1000`, et Supabase hébergé applique lui
aussi un plafond de 1 000 lignes par réponse PostgREST. La requête ne renvoie
donc **jamais plus de 1 000 lignes**, et le test `=== 2000` **ne se déclenche
jamais**. Aucun tri n'est demandé : les lignes conservées sont arbitraires.

Volumes concernés (plans 100 / 300 / 500 élèves) :

| Table | Volume approximatif | Dépassement |
|---|---|---|
| `payments` | ~11 échéances/élève | dès ~91 élèves |
| `grades` | 1 ligne / élève / matière / période | dès ~63 à 125 élèves selon le nombre de matières |
| `profiles` | élèves + parents + staff | dès ~500 élèves avec leurs parents |
| `messages` | historique global | dès 1 000 messages dans l'école |

**Impact.**
- Les soldes et l'historique de paiement (`paymentsOf`) sont incomplets :
  familles faussement à jour ou faussement en retard.
- Les bulletins, moyennes, rangs et fiches élèves (`cardsForClass`,
  `getGradeSheet`, `getTeacherOverview`) sont calculés à partir de notes
  manquantes.
- `recordCashPayment` recharge `payments` puis cherche l'échéance par id
  (`paymentService.ts:39-42`). Si la ligne n'est pas dans les 1 000 premières,
  **l'encaissement a réussi en base mais l'UI affiche « Échéance
  introuvable »** ; un nouvel essai peut produire un double encaissement
  partiel.
- `saveGrade` fait la même recherche et, si la note n'est pas dans le cache,
  renvoie un objet synthétique dont les trois devoirs valent `null`
  (`gradeService.ts:74-85`) : la note est enregistrée mais l'écran peut
  afficher une ligne vide.
- `hydrateConversations` demande 2 000 messages triés du plus récent au plus
  ancien, mais n'en reçoit que 1 000 **au niveau global**, pas par
  conversation : les vieux fils perdent tous leurs messages.
- `hydrateAll` se trompe aussi sur `users` : une école de 500 élèves avec deux
  parents par élève dépasse 1 000 profils.

**Remédiation.** Ne plus charger l'école entière dans le navigateur.
- Calculer les bulletins, moyennes, rangs et soldes **côté serveur** (RPC
  existantes `class_report_cards`, `admin_dashboard`, ou nouvelles RPC
  paginées).
- Pour les listes, utiliser une pagination par clé (`range` + `order by
  created_at, id`) ou des requêtes ciblées (classe, élève, période).
- À défaut immédiat : limiter à **moins** que `max_rows` (ex. 500) et détecter
  la troncature avec un `count` exact, mais cela ne corrige pas les calculs.

**Vérification.** Jeu de données : 150 élèves, 1 650 paiements, 1 200 notes.
Comparer les totaux UI aux `count/sum` SQL ; encaisser une échéance ancienne ;
ouvrir un bulletin et vérifier chaque note ; vérifier un fil de messages ancien.

**Effort : L.**

---

## 4. Constats Élevés

### AUD-103 — Élevé — `link_child` permet de détourner l'enfant d'une autre famille

**Statut :** ouvert

**Fichier:ligne**
- `backend/supabase/migrations/20260101000005_link_child.sql:13-33`
- `frontend/src/services/authService.ts:237-247`
- `frontend/src/features/dashboard/ParentHome.tsx:39-50`

**Description.** `link_child` est `SECURITY DEFINER`, exécutable par tout
`authenticated`. Il vérifie seulement que l'appelant est un parent, puis :

```sql
-- 00005_link_child.sql:29-33
if v_child.parent_id = v_profil.parent_id then
  raise exception 'Cet enfant est déjà rattaché à votre compte.';
end if;
update public.students set parent_id = v_profil.parent_id where id = v_child.id;
```

Aucune condition n'exige que `v_child.parent_id` soit `NULL`. **Si l'enfant est
déjà rattaché à un autre parent, il est silencieusement réaffecté.**

`link_child` ne vérifie ni `is_active_user()` ni `password_changed()` : un
compte parent désactivé ou encore en mot de passe temporaire peut appeler la
RPC avec son JWT.

**Impact.** Un parent de la même école qui connaît (ou devine) un code enfant
de 6 caractères peut rattacher l'enfant d'une autre famille et accéder à ses
notes, paiements, absences et messages. Le code enfant est souvent diffusé
dans les groupes WhatsApp de classe ; ce n'est pas un secret fort. Un compte
désactivé conserve ce pouvoir tant que son jeton est valide.

**Reproduction.** Parent A rattache l'enfant E. Parent B (même école) appelle
`rpc('link_child', { p_child_code: '<code de E>' })` : succès, `students.parent_id`
devient celui de B.

**Remédiation.**
```sql
if not public.is_active_user() or not public.password_changed() then
  raise exception 'Compte inactif ou mot de passe non renouvelé.';
end if;
...
if v_child.parent_id is not null and v_child.parent_id <> v_profil.parent_id then
  raise exception 'Cet enfant est déjà rattaché à une autre famille. Contactez l''école.';
end if;
```
Ajouter une limitation de débit et, pour les cas de recomposition familiale,
une demande de rattachement validée par la direction.

**Vérification.** Parent A → enfant de B : erreur. Parent A → enfant non
rattaché : succès. Parent A → son propre enfant : « déjà rattaché ». Compte
désactivé : erreur.

**Effort : S.**

---

### AUD-104 — Élevé — Les routes « staff » permettent de prendre le contrôle d'un compte parent ou élève

**Statut :** ouvert

**Fichier:ligne**
- `backend/api/src/routes/updateStaff.js:36-38,46-60`
- `backend/api/src/routes/resetStaffPassword.js:34-45,65-72`
- `backend/api/src/routes/setStaffActive.js:43-56`

**Description.** Les trois routes ne bloquent que la cible `role ===
"directeur"`. Elles acceptent ensuite **n'importe quel profil de la même
école**, y compris `parent` et `eleve` :

- `updateStaff` peut changer l'e-mail d'un parent/élève (ligne 54) et ses
  noms/téléphone.
- `resetStaffPassword` génère un mot de passe temporaire et le **renvoie en
  clair** au directeur (lignes 38-72).
- `setStaffActive` peut réactiver un compte parent/élève désactivé par la
  direction (ligne 55).

Aucune des trois ne vérifie `school_is_writable` (contrairement à
`createStaffAccount.js:41-45`), et elles utilisent le client `service_role`
qui contourne la RLS.

**Impact.** Un directeur — ou un directeur dont le compte est compromis — peut
prendre la main sur les comptes des familles : lire leurs messages privés,
envoyer des messages en leur nom, verrouiller leur accès, ou réactiver un
compte que l'école avait suspendu. L'interface `StaffPage` ne liste que le
personnel, mais l'API accepte n'importe quel `userId` de l'école.

**Reproduction.** `POST /reset-staff-password` avec le `userId` d'un parent :
réponse 200 contenant `tempPassword`.

**Remédiation.** Définir une liste blanche commune :
`['professeur','instituteur','econome','surveillant']` et rejeter
`parent`, `eleve`, `directeur` dans les trois routes. Ajouter
`school_is_writable`. Pour les comptes famille, passer par un flux dédié
(renvoi de mot de passe Supabase, ou support).

**Vérification.** Cible parent/élève → 400/403 ; cible staff → OK ; école
expirée → 403.

**Effort : S.**

---

### AUD-105 — Élevé — Les RPC `SECURITY DEFINER` ignorent le statut du compte et le mot de passe temporaire

**Statut :** ouvert — **le correctif AUD-015 n'a été appliqué qu'à l'API Node**

**Fichier:ligne**
- `backend/supabase/migrations/20260101000002_rls_helpers.sql:44-60`
  (`is_active_user`, `password_changed`)
- Exemples de RPC sans contrôle :
  - `20260101000005_link_child.sql:13-19`
  - `20260101000008_grades.sql:121-127` (`save_grade`)
  - `20260101000008_grades.sql:188-194` (`update_report_meta`)
  - `20260101000009_family_payments.sql:53-59` (`record_cash_payment`)
  - `20260101000009_family_payments.sql:257-263` (`send_reminders`)
  - `20260101000006_structure.sql:168-174` (`enroll_student`)
  - `20260101000006_structure.sql:265-280` (`decide_registration_requests`)

**Description.** Les politiques RLS utilisent `user_can_query_data()` =
`is_active_user() and password_changed()`. Mais les fonctions
`SECURITY DEFINER` **contournent la RLS** et ne refont pas ce contrôle : elles
vérifient le rôle (`current_role()`) et parfois l'école, jamais le statut ni
le drapeau `must_change_password`.

```sql
-- save_grade, 00008_grades.sql:121-127
if public.current_role() not in ('instituteur','professeur') or v_teacher is null then
  raise exception 'Action non autorisée ...';
end if;
if not public.school_is_writable(v_school) then ...
```

Rien n'empêche un professeur `DESACTIVE` — dont le JWT et le refresh token
restent valides — d'appeler `save_grade`. De même, un économe qui n'a pas
encore changé son mot de passe temporaire peut appeler `record_cash_payment`.
`setStaffActive` ne révoque pas les sessions Auth : il ne fait que passer
`profiles.status` à `DESACTIVE`.

**Impact.** Les contrôles « compte désactivé » et « mot de passe temporaire »
sont contournables pour toutes les écritures métier : notes, métadonnées de
bulletin, encaissements, inscriptions, décisions d'inscription, rattachement
d'enfants, relances. Un compte révoqué conserve donc des droits d'écriture
jusqu'à expiration du refresh token, voire indéfiniment si l'attaquant le
renouvelle.

**Remédiation.**
1. Ajouter en tête de chaque RPC authentifiée :
```sql
if not public.is_active_user() then
  raise exception 'Compte inactif.';
end if;
if not public.password_changed() then
  raise exception 'Renouvelez votre mot de passe temporaire.';
end if;
```
Exception : `complete_password_change()` ne doit exiger que
`is_active_user()`.
2. Ou centraliser dans un helper `assert_can_write()`.
3. Lors d'une désactivation, révoquer réellement les sessions :
`auth.admin.updateUserById(userId, { ban_duration: 'none' })` ne suffit pas ;
utiliser `signOut` avec le JWT courant ou une table de révocation vérifiée
par l'API/RPC.
4. Envisager de faire dériver `current_role()` du profil plutôt que du claim
   JWT (cf. AUD-026 de l'audit antérieur).

**Vérification.** Économe désactivé → `record_cash_payment` doit échouer.
Enseignant avec `must_change_password=true` → `save_grade` doit échouer.
Compte ACTIF et mot de passe changé → opération OK.

**Effort : M.**

---

### AUD-106 — Élevé — Le matricule d'école n'est plus jamais attribué ; les familles ne peuvent plus s'inscrire

**Statut :** ouvert — **régression d'un correctif annoncé dans l'audit antérieur**

**Fichier:ligne**
- `backend/supabase/migrations/20260101000016_retrait_mobile_money.sql:15-26`
- `backend/supabase/migrations/20260101000001_foundation.sql:69-71`
- `frontend/src/features/auth/LoginForm.tsx:19-23`
- `frontend/src/features/auth/DirectorSignupForm.tsx:51-53,103`
- `frontend/src/services/schoolService.ts:119-127` (`generateMatriculeFor`)
- `backend/api/src/routes/registerStudent.js:41-45`

**Description.** Le matricule est `NULL` à la création de l'école :

```sql
-- 00001_foundation.sql:69-71
-- null tant qu'aucun paiement n'est confirmé, jamais modifié ensuite
matricule text unique check (matricule is null or length(matricule) = 5)
```

Il était attribué par `apply_paid_subscription` au premier paiement. La
migration `00016` **supprime cette fonction** et documente une activation
manuelle avec un SQL **invalide** :

```sql
-- 00016:18-19 — colonnes inexistantes
insert into public.subscriptions (school_id, plan, cycle, amount, paid_at, ends_at)
values ('<uuid école>', 'staffroom', 'yearly', 84000, now(), now() + interval '1 year');
```

Le schéma réel utilise `plan_id`, `starts_at`, `ends_at`, `student_limit`,
`amount_paid`, `payment_ref`, `method`, `paid_at` (00001:113-126). Ce SQL
échoue ; et même s'il réussissait, **il ne génère pas le matricule**.

Conséquences :
- `verify_matricule` ne trouve jamais l'école → les inscriptions parent/élève
  publiques sont impossibles.
- `LoginForm` exige un matricule de 5 caractères. Pour une école non activée,
  `authService.login` tolère un matricule vide (`expected` vide), mais
  l'interface impose une saisie : l'utilisateur doit inventer 5 caractères.
- `DirectorSignupForm` promet « votre matricule d'école est généré à
  l'activation » : c'est faux depuis 00016.
- `generateMatriculeFor` est un stub qui ne fait que relire l'école.

**Impact.** Après la première école, **aucune nouvelle famille ne peut
rejoindre la plateforme** et le directeur ne peut pas communiquer un matricule
valide. Le support doit intervenir manuellement en SQL, avec une procédure
documentée qui ne fonctionne pas.

**Remédiation.**
1. Créer une RPC `SECURITY DEFINER` réservée au `service_role` :
   `activate_subscription(p_school_id, p_plan_id, p_cycle, p_amount, p_payment_ref, p_method)`
   qui valide le prix, insère/étend l'abonnement, appelle
   `generate_school_matricule()` et écrit `subscription_events`.
2. Mettre à jour la documentation et le SQL d'exemple de `00016`.
3. Afficher le matricule dans l'espace direction et sur la page abonnement.
4. Rendre le champ matricule facultatif à la connexion pour les écoles non
   activées, ou adapter le message.

**Vérification.** Activer une école de test → `schools.matricule` non nul,
5 caractères ; `verify_matricule` OK ; inscription parent OK ; connexion avec
le matricule OK.

**Effort : M.**

---

## 5. Constats Moyens

### AUD-107 — Moyen — Toute l'école peut lire les coordonnées de tous les parents

**Fichier:ligne** `20260101000003_auth_accounts.sql:75-77`,
`20260101000003_auth_accounts.sql:71-73`

```sql
create policy "parents_select_ecole" on public.parents
  for select to authenticated
  using (user_can_query_data() and school_id = current_school_id());
```

`user_can_query_data()` est vrai pour tout compte ACTIF ayant changé son mot
de passe, **y compris un élève**. La politique `teachers_select_ecole` a la
même portée.

**Impact.** Un élève ou un parent peut interroger `GET /rest/v1/parents` et
obtenir nom, téléphone et e-mail de toutes les familles de l'école ; idem pour
les enseignants. Risque de harcèlement, de phishing et de fuite de données
personnelles. Aucune UI n'affiche cette liste, mais PostgREST l'expose.

**Remédiation.** Réserver `parents` à `directeur`, `econome`, `surveillant` ;
pour un parent, `id = current_parent_id()` ; pour un enseignant, une vue/RPC
limitée aux parents des élèves de ses classes. Même principe pour `teachers`.

**Effort : M.**

---

### AUD-108 — Moyen — L'inscription d'un parent ne rattache jamais l'enfant

**Fichier:ligne** `20260101000004_registration_rpcs.sql:227-255`,
`20260101000006_structure.sql:339-340`

`finish_parent_registration` valide le `child_code`, crée le parent et le
profil, puis, en auto-approbation, passe seulement le profil à `ACTIF`. Il ne
met **jamais** `students.parent_id = v_parent_id`. `decide_registration_requests`
fait de même pour un parent (branche `else`, ligne 340).

**Impact.** Un parent auto-approuvé arrive sur un écran « Aucun enfant
rattaché » et doit saisir à nouveau le code via `link_child`. Si l'enfant est
déjà rattaché à quelqu'un, rien n'est signalé. Cela aggrave AUD-103 (le parent
peut alors « voler » l'enfant au lieu de demander un rattachement).

**Remédiation.** Après validation du code :
```sql
update public.students
set parent_id = v_parent_id
where id = v_child.id and parent_id is null;
```
Si `parent_id` est déjà renseigné et différent, créer une demande de
rattachement ou refuser avec un message explicite. Faire la même chose dans
`decide_registration_requests` pour les demandes parent.

**Effort : S/M.**

---

### AUD-109 — Moyen — `update_report_meta` laisse un enseignant modifier les classes sans titulaire

**Fichier:ligne** `20260101000008_grades.sql:201-203`

```sql
if v_teacher is not null and v_student.head_teacher_id <> v_teacher then
  raise exception 'Modification non autorisée.';
end if;
```

Si `head_teacher_id` est `NULL`, `NULL <> v_teacher` vaut `NULL`, donc la
condition est fausse : **aucune exception**. Tout enseignant peut modifier
conduite, absences et commentaire de tous les élèves des classes sans
titulaire.

**Impact.** Atteinte à l'intégrité des bulletins (données disciplinaires) sur
les classes non encore affectées à un titulaire. Pas de fuite de notes, mais
falsification possible.

**Remédiation.**
```sql
if v_teacher is not null
   and v_student.head_teacher_id is distinct from v_teacher then
  raise exception 'Modification non autorisée.';
end if;
```
Et ajouter `is_active_user()` / `password_changed()` (AUD-105).

**Effort : S.**

---

### AUD-110 — Moyen — Changement de mot de passe : mot de passe actuel ignoré et erreur systématique

**Fichier:ligne** `frontend/src/services/authService.ts:344-353`,
`frontend/src/pages/auth/ChangePasswordPage.tsx:23-31`

- `changePassword` reçoit `currentPassword` mais fait `void actor;` et ne
  vérifie **jamais** le mot de passe actuel ; il appelle directement
  `supabase.auth.updateUser({ password: nextPassword })`.
- `ChangePasswordPage.tsx:28` affiche une erreur **dès que le champ courant
  n'est pas vide** :
  `const currentErr = form.current ? "Mot de passe incorrect ..." : null;`
  Même avec le bon mot de passe, l'utilisateur voit « incorrect ».
- `navigate("/app")` est appelé **pendant le rendu** (ligne 24), ce qui peut
  provoquer un avertissement React et un double rendu.

**Impact.** Contrôle de sécurité affaibli (un jeton volé suffit à changer le
mot de passe) et expérience bloquante/confuse à la première connexion.

**Remédiation.** Réauthentifier avec `signInWithPassword({ email, password:
currentPassword })` avant `updateUser` ; supprimer `currentErr` ; déplacer la
redirection dans `useEffect` ; n'appeler `complete_password_change` qu'après
succès.

**Effort : S.**

---

### AUD-111 — Moyen — Téléphone élève : facultatif dans l'UI, obligatoire dans l'API

**Fichier:ligne** `frontend/src/features/auth/StudentSignupForm.tsx:45,109`,
`backend/api/src/routes/registerStudent.js:24`

L'UI affiche « Téléphone (facultatif) » et ne valide que si le champ est
rempli. L'API fait `requireSnPhone(body, "phone", "Le téléphone")` : sans
téléphone, l'inscription échoue avec un message serveur.

**Impact.** Parcours d'inscription élève cassé pour les familles qui suivent
l'indication de l'UI.

**Remédiation.** Soit marquer le champ obligatoire (label + validation +
`required`), soit utiliser `optionalString` côté API et enregistrer `''`.
Aligner les deux.

**Effort : S.**

---

### AUD-112 — Moyen — Le formulaire de contact affiche un succès mais ne stocke rien

**Fichier:ligne** `frontend/src/services/contactService.ts:12-18`,
`frontend/src/features/landing/ContactForm.tsx:28-32`,
`20260101000001_foundation.sql:417-426`

`sendContactMessage` est un stub :

```ts
export function sendContactMessage(msg: ContactMessage): Promise<boolean> {
  return respond(() => { void msg; return true; });
}
```

La table `contact_messages` existe et a la RLS activée, mais aucun code ne
l'écrit. Le formulaire affiche « Message envoyé. Nous vous répondons sous 24
heures. ».

**Impact.** Perte silencieuse des demandes commerciales/support ; promesse
non tenue.

**Remédiation.** Ajouter `POST /contact` à l'API Node (validation, limite de
débit par IP, insertion `service_role`), ou une Edge Function dédiée. Prévoir
une notification au support. Ne pas exposer d'INSERT `anon` sans limite.

**Effort : S/M.**

---

### AUD-113 — Moyen — `ensureWritable` est inversé : l'UI autorise l'écriture après J+7

**Fichier:ligne** `frontend/src/services/access.ts:51-62`,
`frontend/src/services/absenceService.ts:22-27`,
`frontend/src/utils/subscription.ts:49-50`

```ts
if (info.status === "EXPIRE") {
  ensure(!info.readOnly, "Mode lecture seule ...");
}
```

`readOnly` est vrai de J+0 à J+7 (fenêtre de lecture seule) et `blocked` est
vrai après J+7. Le code bloque donc **pendant la fenêtre où le serveur bloque
déjà**, et **laisse passer après J+7**, alors que le serveur refuse aussi.
`absenceService.addAbsence` reproduit exactement la même condition.

**Impact.** Incohérence UI/serveur : après J+7, l'utilisateur peut ouvrir des
formulaires et saisir des données, puis reçoit une erreur RLS au moment
d'enregistrer. Le mode lecture seule n'est pas correctement signalé.

**Remédiation.** `ensure(!info.readOnly && !info.blocked, ...)` ou simplement
`if (info.status === "EXPIRE") throw` ; utiliser `blocked` pour afficher un
écran de blocage. Le serveur reste la source de vérité
(`school_is_writable`).

**Effort : S.**

---

### AUD-114 — Moyen — `save_grade` accepte n'importe quelle période

**Fichier:ligne** `20260101000008_grades.sql:106-168` (`p_period` utilisé aux
lignes 154 et 163)

Aucune validation de `p_period` : un client peut écrire `period = 'HACK'` ou
`'S99'`. La ligne est créée mais n'apparaît dans aucun bulletin (les périodes
sont dérivées de `school_settings.period_type`).

**Impact.** Pollution de la table `grades`, notes invisibles, incohérences de
calcul, difficulté de support. Pas de fuite.

**Remédiation.** Valider contre les périodes autorisées :
`S1/S2` si `period_type='semestre'`, `T1/T2/T3` si `trimestre`. Faire de même
dans `update_report_meta` et `class_report_cards`.

**Effort : S.**

---

### AUD-115 — Moyen — Les relances de paiement ne notifient pas les familles

**Fichier:ligne** `20260101000009_family_payments.sql:271-274`

`send_reminders` insère une annonce interne :

```sql
insert into public.announcements (...)
values (v_school, 'Relance de paiement', 'Une relance a été envoyée à %s famille%s.',
        'Économat', false, array['econome','directeur']);
```

L'annonce est réservée à l'économe et à la direction. Aucune notification
n'est créée pour les parents, aucun SMS/e-mail n'est envoyé.

**Impact.** Les familles ne reçoivent rien ; l'économe croit avoir relancé. Le
libellé de l'annonce est trompeur.

**Remédiation.** Créer une annonce par famille avec `audience_roles =
['parent']` (ou un message dans la conversation parent), ou brancher un
fournisseur SMS/e-mail. Journaliser les destinataires et le canal.

**Effort : M.**

---

### AUD-116 — Moyen — La CI échoue et ne protège plus des régressions

**Fichier:ligne** `.github/workflows/ci.yml:32-47`, `package.json:9-11`,
`backend/package.json:7-11`

La CI appelle :
- `npm run audit:front` → OK ;
- `npm run audit:webhook` → racine mappe vers `npm run audit -w backend`, mais
  `backend/package.json` **n'a pas de script `audit`** → échec ;
- `npm run pay:confirm:sandbox` (documenté) → script absent.

De plus, les tests RLS (`backend/supabase/tests/rls_001` → `rls_011`) ne sont
pas exécutés. La CI se contente de `supabase db reset`, qui n'exécute pas les
assertions.

**Impact.** Les régressions AUD-101/AUD-102 peuvent être mergées sans
détection. La couverture de tests existante (11 suites) n'est pas exploitée.

**Remédiation.** Supprimer les étapes mortes ou implémenter les scripts ;
ajouter `node scripts/run-rls-tests.mjs` contre une base de test ; ajouter
`npx tsc --noEmit -p frontend` (déjà présent) et un `lint` ; mettre à jour le
commentaire « 11 migrations ».

**Effort : S/M.**

---

### AUD-117 — Moyen — `render.yaml` ne déploie pas l'API et ne configure pas `VITE_API_URL`

**Fichier:ligne** `render.yaml:18-32`, `frontend/src/lib/functions.ts:11-13`,
`backend/api/README.md:13-15,37-49`

Le Blueprint ne déclare qu'un site statique. Il ne contient ni service API, ni
`VITE_API_URL`. Or `callFunction` lève immédiatement si la variable manque :

```ts
if (!base) throw new Error("API non configurée : définissez VITE_API_URL.");
```

**Impact.** Si le déploiement suit `render.yaml` à la lettre, **connexion,
inscriptions et gestion du personnel sont impossibles**. Le README explique
le déploiement manuel, mais le Blueprint reste un piège opérationnel.

**Remédiation.** Ajouter le service API et les variables (`SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `FRONTEND_ORIGIN`) au Blueprint, ainsi que
`VITE_API_URL` côté front. Sinon, retirer le Blueprint et faire du README la
seule procédure.

**Effort : S/M.**

---

### AUD-118 — Moyen — L'auto-approbation d'un élève ne vérifie pas la capacité de la classe

**Fichier:ligne** `20260101000004_registration_rpcs.sql:147-170`,
comparer à `20260101000006_structure.sql:306-312`

L'approbation manuelle vérifie `v_child_count >= v_class.capacity` et refuse.
L'auto-approbation vérifie la limite de la formule (`limit_reached`) mais
**pas la capacité de la classe** : elle insère directement l'élève.

**Impact.** Une classe peut dépasser sa capacité (ex. 35/35) lors d'une
inscription auto-approuvée. Incohérence avec la règle affichée et avec
l'approbation manuelle.

**Remédiation.** Avant l'insert, compter les élèves de `p_class_id` et
comparer à `class_rooms.capacity` ; si complet, laisser la demande
`EN_ATTENTE` ou lever une exception explicite.

**Effort : S.**

---

## 6. Constats Faibles

### AUD-119 — Faible — `updateStaff` : unicité e-mail sur `profiles` seulement, format non validé

**Fichier:ligne** `backend/api/src/routes/updateStaff.js:42,46-60`

L'e-mail est normalisé par `optionalString` mais pas validé par `EMAIL_RE`.
L'unicité est testée sur `profiles.email`, pas sur `auth.users.email`. Un
compte Auth orphelin ou une désynchronisation peut produire un échec générique
ou un `profiles.email` invalide. La mise à jour `profiles` puis `teachers`
n'est pas transactionnelle.

**Remédiation.** Valider avec `EMAIL_RE`, s'appuyer sur l'erreur de
`auth.admin.updateUserById`, et compenser ou transactionnaliser.

**Effort : S.**

---

### AUD-120 — Faible — « Réinitialiser les données » ne réinitialise rien

**Fichier:ligne** `frontend/src/services/db.ts:499-501`,
`frontend/src/features/settings/SettingsTabs.tsx:66-68`

Le bouton appelle `resetDatabase()`, qui fait `clearCache().then(hydrateAll())`
puis `window.location.reload()`. Aucune donnée n'est supprimée, alors que la
confirmation annonce « Toutes vos modifications (notes, paiements,
affectations, messages) seront perdues. ».

**Impact.** Libellé dangereux et trompeur ; un utilisateur peut croire avoir
tout effacé. Aucun risque de perte réelle, mais confusion.

**Remédiation.** Renommer en « Recharger les données » et adapter le message ;
ou implémenter une vraie réinitialisation réservée au support.

**Effort : S.**

---

### AUD-121 — Faible — Code mort dangereux (`deleteTeacher`) et fonctions fantômes

**Fichier:ligne** `frontend/src/services/teacherService.ts:48,83-93`,
`frontend/src/services/authService.ts:355-373`,
`frontend/src/services/schoolService.ts:119-127`

- `deleteTeacher` supprime la ligne `teachers` mais laisse le profil et le
  compte Auth ACTIF. Aucun appelant actuellement, mais réutiliser cette
  fonction rouvrirait un accès orphelin.
- `updateProfile` tente d'écrire `email` dans `profiles`, alors que le GRANT
  ne porte que sur `first_name, last_name, phone` (00003:64-65) : échec
  garanti si réactivé.
- `generateMatriculeFor` ne génère rien.

**Remédiation.** Supprimer le code mort ou l'implémenter correctement
(désactivation Auth pour `deleteTeacher`).

**Effort : S.**

---

### AUD-122 — Faible — Un élève voit toutes les classes dans les bulletins

**Fichier:ligne** `frontend/src/services/reportService.ts:34-40`

`classAllowed` renvoie `true` pour `eleve` sur toutes les classes. En pratique,
`getClassReportCards` filtre ensuite les cartes à `student.id === actor.studentId`,
donc **aucune fuite** ; mais l'UI propose des classes sans contenu et le calcul
est inutilement large.

**Remédiation.** Restreindre à la classe de l'élève.

**Effort : S.**

---

### AUD-123 — Faible — CORS ouvert si `FRONTEND_ORIGIN` manque ; `/healthz` divulgue la configuration

**Fichier:ligne** `backend/api/src/lib/http.js:19-33`,
`backend/api/src/index.js:54-56`

Sans `FRONTEND_ORIGIN`, `allowedOrigin` renvoie `true` pour toute origine.
`/healthz` renvoie `{ ok, service, supabaseConfigured }`.

**Impact.** En cas d'oubli de variable, l'API accepte des appels navigateur de
n'importe quelle origine. Le healthz ne fuit pas de secret mais expose un
booléen de configuration.

**Remédiation.** Échouer au démarrage en production si `FRONTEND_ORIGIN` est
absent ; n'autoriser `*` qu'en développement. Réduire `/healthz` à `{ ok: true }`.

**Effort : S.**

---

### AUD-124 — Faible — Opérations multi-étapes non atomiques

**Fichier:ligne** `frontend/src/services/schoolService.ts:29-67` (paramètres +
frais + école), `283-291` (`deleteClass`), `198-205` (affectation ignorée)

`updateSettings` enchaîne plusieurs `update/upsert` sans transaction : une
panne au milieu laisse des paramètres partiels. `deleteClass` supprime les
affectations et matières **avant** de supprimer la classe ; si la suppression
échoue (FK), les affectations sont déjà perdues. L'insertion d'affectation
automatique pour l'instituteur ignore son erreur.

**Remédiation.** Déplacer ces opérations dans des RPC transactionnelles ;
vérifier toutes les erreurs ; supprimer la classe en premier ou utiliser
`ON DELETE CASCADE` de façon maîtrisée.

**Effort : M.**

---

### AUD-125 — Faible — Configuration et documentation incohérentes

**Fichier:ligne** `backend/supabase/config.toml:18,179,224,231`,
`20260101000016_retrait_mobile_money.sql:15-19`,
`.github/workflows/ci.yml:43`, `frontend/src/features/auth/DirectorSignupForm.tsx:103`

- `[auth] enable_signup = false` mais `[auth.email] enable_signup = true`.
- `secure_password_change = false`.
- `max_rows = 1000` mais le front demande 2 000.
- Le commentaire de `schools.matricule` dit « écriture réservée au webhook »,
  webhook supprimé.
- Le SQL d'activation de `00016` est invalide.
- La CI parle de « 11 migrations » alors qu'il y en a 16.
- L'UI promet un matricule « généré à l'activation », ce qui n'est plus vrai.

**Remédiation.** Aligner les flags, corriger les commentaires, mettre à jour
la procédure d'activation et la CI.

**Effort : S.**

---

## 7. Informations et points d'attention

### AUD-I1 — Abonnement absent = école libre en écriture

`school_is_writable` (00002:118-126) renvoie `true` s'il n'existe **aucun**
abonnement. C'est probablement voulu pour permettre l'essai, mais cela signifie
qu'une école peut rester indéfiniment sans abonnement tout en écrivant. À
valider comme décision produit ; sinon, créer un abonnement d'essai avec date
de fin.

### AUD-I2 — Edge Functions legacy toujours présentes

`backend/supabase/functions/*` contient 13 fonctions Deno remplacées par l'API
Node. Elles ne sont plus déployées/utilisées, mais constituent une surface
d'attaque et une source de confusion (deux implémentations à maintenir).

### AUD-I3 — Seed de démonstration

`backend/supabase/seed.sql` contient des comptes de démo (`demo1234!`) et des
codes enfants. Il est exclu du push production par `scripts/db-push.mjs` ;
**ne pas le charger en production**. La migration 00014 purge l'école X7K9Q.

### AUD-I4 — `login-guard` : limite par utilisateur, pas par IP

La limite `login-guard:${user.id}` (loginGuard.js:22) s'applique après
authentification. Le brute force des mots de passe est délégué à Supabase Auth.
C'est acceptable, mais il n'existe pas de limite par IP/e-mail côté API ; à
surveiller si Supabase Auth est contourné.

### AUD-I5 — Inscription parent auto-approuvée : connexion puis déconnexion

`authService.registerParent` se connecte si `approved` (ligne 232), puis
`ParentSignupForm` appelle `logout()` (ligne 52). Le parent auto-approuvé est
donc déconnecté juste après son inscription. UX à corriger : rediriger
directement vers l'espace parent si approuvé.

---

## 8. Plan de remédiation priorisé

### Lot 1 — Débloquer et sécuriser (Sprint 1)

| Ordre | ID | Correctif | Effort |
|---:|---|---|---|
| 1 | AUD-101 | Retirer `section` de l'insert `class_rooms` | S |
| 2 | AUD-103 | `link_child` : statut + refus de réaffectation | S |
| 3 | AUD-105 | Garde `is_active_user()`/`password_changed()` dans toutes les RPC | M |
| 4 | AUD-104 | Liste blanche staff dans les 3 routes | S |
| 5 | AUD-106 | RPC d'activation + attribution du matricule | M |
| 6 | AUD-102 | Requêtes serveur/pagination pour paiements, notes, profils | L |

**Critère de sortie :** une école neuve peut créer une classe, inscrire un
élève, encaisser un paiement et afficher un bulletin juste ; un compte
désactivé ne peut plus écrire.

### Lot 2 — Intégrité métier (Sprint 2)

| ID | Correctif | Effort |
|---|---|---|
| AUD-107 | Restreindre `parents`/`teachers` aux rôles légitimes | M |
| AUD-108 | Rattacher l'enfant à l'approbation parent | S/M |
| AUD-109 | `head_teacher_id is distinct from` | S |
| AUD-110 | Réauthentification + page mot de passe | S |
| AUD-111 | Téléphone élève cohérent UI/API | S |
| AUD-112 | API de contact + stockage | S/M |
| AUD-113 | `ensureWritable` + écran bloqué | S |
| AUD-114 | Validation des périodes | S |
| AUD-118 | Capacité en auto-approbation | S |

### Lot 3 — Exploitation et qualité (Sprint 3)

| ID | Correctif | Effort |
|---|---|---|
| AUD-115 | Relances réellement envoyées aux familles | M |
| AUD-116 | CI : scripts, tests RLS, lint | S/M |
| AUD-117 | `render.yaml` + `VITE_API_URL` | S/M |
| AUD-119 | `updateStaff` e-mail/atomicité | S |
| AUD-120 | Libellé « recharger » | S |
| AUD-121 | Supprimer/implémenter le code mort | S |
| AUD-122 | Portée élève | S |
| AUD-123 | CORS fail-closed + healthz | S |
| AUD-124 | RPC transactionnelles | M |
| AUD-125 | Config/doc | S |

---

## 9. Tests de non-régression à ajouter

1. **Création de classe** : `createClass` réussit, la ligne existe, un élève
   peut y être inscrit.
2. **Volume** : 150 élèves, 1 650 paiements, 1 200 notes ; les totaux UI
   égalent les agrégats SQL ; un encaissement ancien renvoie la bonne ligne.
3. **Rattachement** : parent A ne peut pas prendre l'enfant de B ; un enfant
   libre se rattache ; un parent auto-approuvé voit son enfant sans ressaisie.
4. **Statut** : un compte DESACTIVE et un compte `must_change_password`
   échouent sur `save_grade`, `record_cash_payment`, `link_child`,
   `update_report_meta`, `enroll_student`.
5. **Matricule** : activation manuelle → matricule 5 caractères ;
   `verify_matricule` OK ; inscription parent/élève OK.
6. **Staff** : les routes refusent parent/élève ; acceptent
   professeur/instituteur/econome/surveillant ; refusent si l'école est expirée.
7. **PII** : un élève ne peut pas lire la table `parents` ; un directeur le
   peut ; un enseignant ne voit que les parents de ses classes.
8. **Périodes** : `save_grade` refuse `S99`/`HACK`.
9. **Contact** : le message est présent dans `contact_messages`.
10. **CI** : `npm run audit:front`, `audit:webhook` (ou suppression),
    `supabase db reset`, tests RLS et `tsc` passent.

---

## 10. Conclusion

Les deux constats Critiques sont **immédiatement bloquants** : sans création de
classe, l'application ne peut pas être utilisée ; sans pagination/agrégation
serveur, les données financières et scolaires deviennent fausses dès qu'une
école dépasse ~90 élèves. Les constats Élevés doivent être corrigés avant
d'ouvrir la plateforme à de nouvelles écoles, en particulier `link_child`, les
routes staff, les RPC sans contrôle de statut et l'attribution du matricule.

Une fois les lots 1 et 2 traités, l'architecture (RLS + RPC serveur + API
privilégiée) est saine et peut servir de base à une mise en production
contrôlée.
