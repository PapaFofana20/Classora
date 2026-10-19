import type { ClassRoom, ClassSubject, Conflict, SessionUser, Subject, Teacher, TeachingAssignment } from "@/types";
import { detectConflicts } from "@/utils/assignments";
import { ensureWritable } from "./access";
import { assignmentsOf, classSubjectsOf, classesOf, db, persist, respond, subjectsOf, teachersOf } from "./db";

export interface AssignmentBoard {
  classes: ClassRoom[];
  subjects: Subject[];
  classSubjects: ClassSubject[];
  teachers: Teacher[];
  assignments: TeachingAssignment[];
  conflicts: Conflict[];
}

function board(schoolId: string): AssignmentBoard {
  const classes = classesOf(schoolId);
  const subjects = subjectsOf(schoolId);
  const classSubjects = classSubjectsOf(schoolId);
  const assignments = assignmentsOf(schoolId);
  const teachers = teachersOf(schoolId);
  return { classes, subjects, classSubjects, assignments, teachers, conflicts: detectConflicts(classes, classSubjects, assignments, teachers, subjects) };
}

export const getAssignmentBoard = (schoolId: string): Promise<AssignmentBoard> => respond(() => board(schoolId), 200, 400);

export const listAssignments = (schoolId: string): Promise<TeachingAssignment[]> => respond(() => assignmentsOf(schoolId));

export function getTeacherAssignments(schoolId: string, teacherId: string): Promise<TeachingAssignment[]> {
  return respond(() => assignmentsOf(schoolId).filter((a) => a.teacherId === teacherId));
}

/** Remplace tous les enseignants d'une cellule (classe × matière). */
export function setCellTeacher(actor: SessionUser, classId: string, subjectId: string, teacherId: string | null): Promise<AssignmentBoard> {
  return respond(() => {
    ensureWritable(actor);
    db.assignments = db.assignments.filter((a) => !(a.schoolId === actor.schoolId && a.classId === classId && a.subjectId === subjectId));
    if (teacherId) db.assignments.push({ schoolId: actor.schoolId, teacherId, classId, subjectId });
    persist();
    return board(actor.schoolId);
  }, 150, 300);
}

export function addCellTeacher(actor: SessionUser, classId: string, subjectId: string, teacherId: string): Promise<AssignmentBoard> {
  return respond(() => {
    ensureWritable(actor);
    if (!assignmentsOf(actor.schoolId).some((a) => a.classId === classId && a.subjectId === subjectId && a.teacherId === teacherId)) {
      db.assignments.push({ schoolId: actor.schoolId, teacherId, classId, subjectId });
    }
    persist();
    return board(actor.schoolId);
  }, 150, 300);
}

export function removeCellTeacher(actor: SessionUser, classId: string, subjectId: string, teacherId: string): Promise<AssignmentBoard> {
  return respond(() => {
    ensureWritable(actor);
    db.assignments = db.assignments.filter((a) => !(a.schoolId === actor.schoolId && a.classId === classId && a.subjectId === subjectId && a.teacherId === teacherId));
    persist();
    return board(actor.schoolId);
  }, 150, 300);
}

/**
 * Élémentaire : nommer un instituteur titulaire lui attribue automatiquement
 * toutes les matières de la classe.
 */
export function setTitular(actor: SessionUser, classId: string, teacherId: string | null): Promise<AssignmentBoard> {
  return respond(() => {
    ensureWritable(actor);
    const cls = classesOf(actor.schoolId).find((c) => c.id === classId);
    if (!cls || cls.cycle !== "elementaire") throw new Error("Cette classe n'est pas une classe élémentaire.");
    db.assignments = db.assignments.filter((a) => !(a.schoolId === actor.schoolId && a.classId === classId));
    cls.headTeacherId = teacherId;
    if (teacherId) {
      classSubjectsOf(actor.schoolId)
        .filter((cs) => cs.classId === classId)
        .forEach((cs) => db.assignments.push({ schoolId: actor.schoolId, teacherId, classId, subjectId: cs.subjectId }));
    }
    persist();
    return board(actor.schoolId);
  }, 150, 300);
}

export function setHeadTeacher(actor: SessionUser, classId: string, teacherId: string | null): Promise<AssignmentBoard> {
  return respond(() => {
    ensureWritable(actor);
    const cls = classesOf(actor.schoolId).find((c) => c.id === classId);
    if (!cls || cls.cycle === "elementaire") throw new Error("Le professeur principal concerne le moyen et le secondaire.");
    cls.headTeacherId = teacherId;
    persist();
    return board(actor.schoolId);
  }, 150, 300);
}