# Audit des logiques métier — CLASSORA

**Date :** 03 novembre 2026
**Périmètre :** logique fonctionnelle du frontend (services, pages, features) et des RPC Supabase.
**Objectif :** repérer les règles métier qui ne sont pas respectées ou sont contournables.

---

## 1. Affectations (assignments) — cause probable de l'échec

### Constat
L'affectation d'un enseignant à une classe/matière repose sur la RPC `replace_cell_teachers` (wrapper 00017, garde `assert_active_account`). Le frontend appelle cette RPC directement via Supabase.

### Conditions pour que ça fonctionne
1. **La migration 00006 et 00017 doivent être appliquées** (fonctions `replace_cell_teachers`, `replace_cell_teachers_unchecked`, `assert_active_account`). ✅ confirmé appliqué.
2. **Le compte directeur doit être ACTIF** et avoir changé son mot de passe temporaire (`is_active_user()` + `password_changed()`). Pour un directeur auto-inscrit, `must_change_password` est `false` par défaut → OK.
3. **La classe ET la matière doivent appartenir à l'école** (vérifié dans la RPC). ✅
4. **L'enseignant doit appartenir à l'école** (vérifié). ✅
5. **Plafond de 10 affectations par enseignant** (vérifié dans la RPC). ✅
6. **Des matières doivent être rattachées à la classe** via Paramètres → Coefficients (table `class_subjects`). **Sans cela, la page Affectations affiche "Aucune matière rattachée à cette classe" et il n'y a rien à affecter.** ⚠️

### Logique respectée ?
- ✅ Multi-enseignants par cellule (classe × matière) : `replace_cell_teachers` accepte un tableau `p_teacher_ids`.
- ✅ Titulaire (élémentaire) : `set_class_head_teacher` mode `titulaire` attribue toutes les matières de la classe.
- ✅ Professeur principal (moyen/secondaire) : mode `principal`.
- ✅ Conflits détectés (matière sans prof, surcharge, doublon, titulaire multiple).
- ⚠️ **Aucune affectation au niveau "classe" sans matière** : impossible d'affecter un enseignant à une classe sans passer par les matières. Le titre de la page ("affecter un ou plusieurs professeurs à une classe") suggère un flux plus simple qui n'existe pas.
- ⚠️ **Cache client** : `addCellTeacher` lit `assignmentsOf(actor.schoolId)` depuis le cache global avant d'appeler la RPC. Si le cache est désynchronisé, la liste envoyée peut être incorrecte (doublon ou omission). Mitigation : `replaceCell` re-hydrate après coup.

### Recommandation
- Ajouter une vue "par enseignant" permettant de voir et modifier toutes ses classes d'un coup.
- Vérifier côté utilisateur que des matières sont bien rattachées aux classes (Paramètres → Coefficients) avant d'affecter.
- Ajouter un log d'erreur côté frontend (console) pour capturer le message exact de la RPC en cas d'échec.

---

## 2. Emplois du temps (timetables)

### Constat
- **Bug corrigé** : le frontend envoyait une colonne `school_id` inexistante dans `timetable_courses` → échec d'enregistrement. Corrigé (commit c036e0b).
- **Logique respectée** : création, modification, suppression de cours, publication/dépublication, vérification de chevauchement côté client.
- ⚠️ **Vérification de chevauchement uniquement côté client** : deux utilisateurs concurrents peuvent créer des cours qui se chevauchent. Pas de contrainte DB `EXCLUDE` sur (timetable_id, day, start_time, end_time). Recommandation : ajouter une contrainte d'exclusion ou vérifier côté RPC.
- ⚠️ **`updateCourse` n'est pas routé par l'API Express** : le frontend écrit directement en Supabase (RLS). La policy 00037 l'autorise pour le directeur. OK si la migration est appliquée.
- ⚠️ **`school_id` envoyé dans `update` retiré** : la RLS 00037 vérifie l'école via `timetables`. OK.

---

## 3. Notes (grades)

### Logique respectée
- ✅ `canEditGrades` vérifie que l'enseignant est affecté à (classe, matière).
- ✅ `save_grade` RPC (00017 wrapper) vérifie `assert_active_account`, la période, l'affectation serveur (`teaching_assignments`), et la plage 0-20.
- ✅ Le directeur ne peut pas saisir de notes via `save_grade` (rôle non autorisé). Les notes sont saisies par les enseignants uniquement.
- ⚠️ **Le directeur n'a pas de voie pour saisir des notes** : si l'école veut que le directeur saisisse, il faut un RPC dédié ou étendre `save_grade` au rôle directeur.

---

## 4. Bulletins (report cards)

### Constat
- Le blocage des bulletins (`block_student_bulletins` sur `school_settings`) est **uniquement frontend** : la page `BulletinsPage` masque les bulletins si `isRestricted`.
- La RLS sur `grades` n'est **pas** conditionnée par `block_student_bulletins` : un élève/parent pourrait lire ses notes directement via Supabase même si les bulletins sont bloqués.
- ⚠️ **Logique contournable** : un utilisateur technique peut contourner le masquage frontend.

### Recommandation
- Ajouter une policy RLS sur `grades` (SELECT pour élève/parent) qui vérifie `school_settings.block_student_bulletins = false` OU le rôle est directeur/enseignant.
- Migration 00038 §4 tentait cela mais référençait une table inexistante (`class_report_cards`) ; correction nécessaire.

---

## 5. Abonnements / écriture (school_is_writable)

### Logique respectée
- ✅ `school_is_writable` vérifié dans les RPC d'écriture (assignments, grades, timetables, registration).
- ✅ Frontend `ensureWritable` affiche le mode lecture seule.
- ⚠️ **`ensureWritable` est client-side only** : les écritures directes via Supabase (ex. `updateProfile`, `updateStaff` partiellement) ne sont pas toutes gardées par `school_is_writable`. Les RPC critiques le sont, mais les updates directs sur `profiles` (ex. `updateProfile` dans authService) ne vérifient pas l'abonnement.
- ⚠️ **`school_is_writable` retourne `true` si aucun abonnement** (`not exists (select 1 from subscriptions)`). C'est voulu (école en attente de premier achat peut créer sa structure), mais cela signifie qu'une école sans abonnement peut écrire indéfiniment. À clarifier selon le modèle commercial.

---

## 6. Inscriptions (registration)

### Logique respectée
- ✅ Viabilité de l'école vérifiée avant écriture (00036).
- ✅ Plafond de 100 demandes en attente par école.
- ✅ Auto-approve vérifie la capacité de la classe (00038).
- ✅ Rattachement par `profiles.student_id` (pas par homonymie) — 00036.
- ⚠️ **`auto_approve_students`** : si activé, l'élève est approuvé immédiatement sans validation humaine. La limite d'élèves (`limit_reached`) est vérifiée, mais pas la capacité de la classe avant 00038 (corrigé).
- ⚠️ **Email non vérifié** à l'inscription (`email_confirm: true`) : un compte peut être créé avec un email arbitraire. Recommandation : activer la confirmation par email pour les inscriptions publiques.

---

## 7. Paiements / finances

### Logique respectée
- ✅ Les paiements sont créés côté serveur (RPC `build_payment_plan`).
- ⚠️ **Aucune passerelle de paiement intégrée** : tous les abonnements sont accordés 365 jours sans encaissement (migration 00035). C'est un choix produit temporaire, mais la logique "paiement = activation" n'existe pas encore.
- ⚠️ **`record_cash_payment`** : vérifie `assert_active_account` mais pas que le montant correspond. Un directeur peut enregistrer un montant arbitraire.

---

## 8. Messagerie / annonces

### Logique respectée
- ✅ `list_conversations` RPC (SECURITY DEFINER) filtre par école et par participant.
- ⚠️ **Pas de vérification que l'expéditeur est actif** dans l'envoi de message (RLS `user_can_query_data` le fait pour la lecture, mais l'insertion ?). À vérifier dans les policies `messages`.

---

## 9. Absences

### Logique respectée
- ✅ Absences liées à l'école et à l'élève.
- ⚠️ **Pas de vérification que l'élève appartient à la classe de l'enseignant** qui saisit l'absence. La policy RLS peut le permettre si l'enseignant est dans la même école. À renforcer : seuls les enseignants affectés à la classe de l'élève (ou le surveillant) devraient pouvoir saisir.

---

## 10. Sécurité logique transversale

### Logique respectée
- ✅ Séparation stricte comptes scolaires vs agents admin.
- ✅ Dernier superadmin protégé (migration 00039 atomique).
- ✅ Rate limiting par IP et par identifiant (admin login).
- ✅ CORS fail-closed en production.
- ⚠️ **`trust proxy = true`** : en développement local, `clientIp` peut être null → clé partagée. Corrigé (utilise `req.ip`).
- ⚠️ **`adminSecurity` expose les payloads d'audit** : corrigé (masqués pour non-superadmins).

---

## Synthèse des priorités

| Priorité | Logique | Statut |
|---|---|---|
| P1 | Affectation multi-enseignants | ✅ fonctionne (si matières configurées) |
| P1 | Emploi du temps enregistrement | ✅ corrigé |
| P2 | Blocage bulletins (RLS) | ⚠️ frontend-only, à renforcer |
| P2 | Absences par classe | ⚠️ à renforcer |
| P3 | Écriture sans abonnement | ⚠️ à clarifier selon modèle commercial |
| P3 | Notes par le directeur | ⚠️ non prévu |
| P3 | Email non vérifié à l'inscription | ⚠️ à activer |

---

**Conclusion :** la majorité des logiques métier sont respectées et protégées côté serveur (RPC SECURITY DEFINER + RLS). Les principaux écarts sont l'absence de RLS sur le blocage des bulletins et la saisie d'absences non restreinte à la classe de l'enseignant. L'affectation d'enseignants fonctionne techniquement ; si l'utilisateur ne peut pas affecter, c'est probablement parce qu'aucune matière n'est rattachée aux classes (à configurer dans Paramètres → Coefficients).