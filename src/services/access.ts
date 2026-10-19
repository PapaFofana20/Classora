import type { School, SchoolSettings, SessionUser, Student, Teacher } from "@/types";
import { teacherClassIds } from "@/utils/permissions";
import { assignmentsOf, classesOf, schoolOf, settingsOf, studentsOf, teachersOf, db } from "./db";
import { subscriptionInfoOf } from "./subscriptionService";

/** École de la session — toutes les requêtes de données doivent partir d'ici. */
export function requireSchool(actor: SessionUser): string {
  if (!actor.schoolId) throw new Error("Aucune école associée à ce compte. Contactez le support.");
  return actor.schoolId;
}

export const schoolOfActor = (actor: SessionUser): School | undefined => schoolOf(actor.schoolId);
export const settingsOfActor = (actor: SessionUser): SchoolSettings => settingsOf(actor.schoolId);

export function teacherOf(actor: SessionUser): Teacher | undefined {
  return actor.teacherId ? teachersOf(actor.schoolId).find((t) => t.id === actor.teacherId) : undefined;
}

/** Classes qu'un enseignant peut voir (affectations + classes dont il est titulaire / principal). */
export function visibleClassIds(actor: SessionUser): string[] {
  if (actor.role === "instituteur" || actor.role === "professeur") {
    const id = actor.teacherId ?? "";
    const heads = classesOf(actor.schoolId).filter((c) => c.headTeacherId === id).map((c) => c.id);
    return Array.from(new Set([...teacherClassIds(id, assignmentsOf(actor.schoolId)), ...heads]));
  }
  return classesOf(actor.schoolId).map((c) => c.id);
}

/** Élèves visibles selon le rôle : chaque acteur ne voit que son périmètre, dans SON école. */
export function visibleStudents(actor: SessionUser): Student[] {
  const mine = studentsOf(actor.schoolId);
  switch (actor.role) {
    case "eleve":
      return mine.filter((s) => s.id === actor.studentId);
    case "parent":
      return mine.filter((s) => s.parentId === actor.parentId);
    case "instituteur":
    case "professeur": {
      const ids = visibleClassIds(actor);
      return mine.filter((s) => ids.includes(s.classId));
    }
    default:
      return mine;
  }
}

export function ensure(condition: boolean, message = "Accès refusé."): void {
  if (!condition) throw new Error(message);
}

/**
 * Bloque l'écriture quand l'abonnement de l'école est expiré (mode lecture
 * seule pendant 7 jours, puis accès fermé).
 * Ce contrôle est simulé côté client : dans la version réelle il sera refait
 * côté serveur (Supabase RLS + Edge Functions), jamais uniquement ici.
 */
export function ensureWritable(actor: SessionUser): void {
  const info = subscriptionInfoOf(actor.schoolId);
  if (info.status === "EXPIRE") {
    ensure(!info.readOnly, "Mode lecture seule : l'abonnement de votre école est expiré. Les modifications sont désactivées.");
  }
}

/** Vérifie qu'un compte appartient bien à l'école attendue (isolation côté service). */
export function ensureSameSchool(actor: SessionUser, schoolId: string, message = "Cette ressource appartient à une autre école."): void {
  ensure(actor.schoolId === schoolId, message);
}

/** Liste des demandes en attente pour l'école (badge du menu). */
export function pendingCount(schoolId: string): number {
  return db.registrationRequests.filter((r) => r.schoolId === schoolId && r.status === "EN_ATTENTE").length;
}