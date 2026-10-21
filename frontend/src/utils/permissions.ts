import type { ClassRoom, Role, StaffRole, Teacher, TeachingAssignment } from "@/types";

export const ROLE_LABELS: Record<Role, string> = {
  directeur: "Directeur",
  econome: "Économe",
  surveillant: "Surveillant général",
  instituteur: "Instituteur",
  professeur: "Professeur",
  eleve: "Élève",
  parent: "Parent",
};

/** Libellés proposés par le directeur lors de la création d'un accès. */
export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  professeur: "Enseignant",
  instituteur: "Instituteur titulaire",
  econome: "Économe",
  surveillant: "Surveillant général",
};

/** Rôles que le directeur peut créer lui-même (aucune inscription publique). */
export const STAFF_ROLES: StaffRole[] = ["professeur", "instituteur", "econome", "surveillant"];

/** Rôles qui peuvent s'inscrire seul sur /inscription. */
export const PUBLIC_SIGNUP_ROLES: Role[] = ["directeur", "eleve", "parent"];

export const isStaffRole = (role: Role): role is StaffRole => (STAFF_ROLES as Role[]).includes(role);

/** Seul le directeur achète un abonnement. */
export const canBuySubscription = (role: Role): boolean => role === "directeur";

/** Seul le directeur crée, modifie ou désactive les accès du personnel. */
export const canManageStaff = (role: Role): boolean => role === "directeur";

/** Seul le directeur valide les demandes d'inscription des élèves et des parents. */
export const canApproveStudents = (role: Role): boolean => role === "directeur";

/**
 * Règle unique de saisie des notes : un enseignant ne peut modifier QUE les
 * couples (classe, matière) qui lui sont affectés.
 */
export function canEditGrades(
  teacher: Teacher | null | undefined,
  classId: string,
  subjectId: string,
  assignments: TeachingAssignment[],
): boolean {
  if (!teacher) return false;
  return assignments.some((a) => a.teacherId === teacher.id && a.classId === classId && a.subjectId === subjectId);
}

export function isHeadTeacher(teacher: Teacher | null | undefined, classRoom: ClassRoom | undefined): boolean {
  return !!teacher && !!classRoom && classRoom.headTeacherId === teacher.id;
}

/** Lecture de toutes les matières d'une classe : instituteur titulaire ou professeur principal. */
export function canReadWholeClass(teacher: Teacher | null | undefined, classRoom: ClassRoom | undefined): boolean {
  return isHeadTeacher(teacher, classRoom);
}

export function canReadSubject(
  teacher: Teacher | null | undefined,
  classRoom: ClassRoom | undefined,
  subjectId: string,
  assignments: TeachingAssignment[],
): boolean {
  if (!teacher || !classRoom) return false;
  return canReadWholeClass(teacher, classRoom) || canEditGrades(teacher, classRoom.id, subjectId, assignments);
}

export function teacherClassIds(teacherId: string, assignments: TeachingAssignment[]): string[] {
  return Array.from(new Set(assignments.filter((a) => a.teacherId === teacherId).map((a) => a.classId)));
}

export const MAX_ASSIGNMENTS_PER_TEACHER = 10;