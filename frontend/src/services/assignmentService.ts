import type { ClassRoom, ClassSubject, Conflict, SessionUser, Subject, Teacher, TeachingAssignment } from "@/types";
import { detectConflicts } from "@/utils/assignments";
import { supabase } from "@/lib/supabase";
import { ensureWritable } from "./access";
import { assignmentsOf, classSubjectsOf, classesOf, hydrate, respond, subjectsOf, teachersOf } from "./db";

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

async function replaceCell(actor: SessionUser, classId: string, subjectId: string, teacherIds: string[]): Promise<void> {
  ensureWritable(actor);
  const { error } = await supabase.rpc("replace_cell_teachers", {
    p_class_id: classId,
    p_subject_id: subjectId,
    p_teacher_ids: teacherIds,
  });
  if (error) {
    throw new Error(/limit|plafond|10/i.test(error.message) ? "Un enseignant est limité à 10 affectations." : error.message);
  }
  await hydrate("assignments");
}

/** Remplace tous les enseignants d'une cellule (classe × matière). */
export function setCellTeacher(actor: SessionUser, classId: string, subjectId: string, teacherId: string | null): Promise<AssignmentBoard> {
  return (async () => {
    await replaceCell(actor, classId, subjectId, teacherId ? [teacherId] : []);
    return board(actor.schoolId);
  })();
}

export function addCellTeacher(actor: SessionUser, classId: string, subjectId: string, teacherId: string): Promise<AssignmentBoard> {
  return (async () => {
    const current = assignmentsOf(actor.schoolId).filter((a) => a.classId === classId && a.subjectId === subjectId).map((a) => a.teacherId);
    await replaceCell(actor, classId, subjectId, current.includes(teacherId) ? current : [...current, teacherId]);
    return board(actor.schoolId);
  })();
}

export function removeCellTeacher(actor: SessionUser, classId: string, subjectId: string, teacherId: string): Promise<AssignmentBoard> {
  return (async () => {
    const current = assignmentsOf(actor.schoolId).filter((a) => a.classId === classId && a.subjectId === subjectId).map((a) => a.teacherId);
    await replaceCell(actor, classId, subjectId, current.filter((id) => id !== teacherId));
    return board(actor.schoolId);
  })();
}

/**
 * Élémentaire : nommer un instituteur titulaire lui attribue automatiquement
 * toutes les matières de la classe (faire côté serveur).
 */
export function setTitular(actor: SessionUser, classId: string, teacherId: string | null): Promise<AssignmentBoard> {
  return (async () => {
    ensureWritable(actor);
    const cls = classesOf(actor.schoolId).find((c) => c.id === classId);
    if (!cls || cls.cycle !== "elementaire") throw new Error("Cette classe n'est pas une classe élémentaire.");
    const { error } = await supabase.rpc("set_class_head_teacher", {
      p_class_id: classId,
      p_teacher_id: teacherId,
      p_mode: "titulaire",
    });
    if (error) {
      if (/cycle/i.test(error.message)) throw new Error("Cette classe n'est pas une classe élémentaire.");
      throw new Error(error.message);
    }
    await Promise.all([hydrate("classes"), hydrate("assignments")]);
    return board(actor.schoolId);
  })();
}

export function setHeadTeacher(actor: SessionUser, classId: string, teacherId: string | null): Promise<AssignmentBoard> {
  return (async () => {
    ensureWritable(actor);
    const cls = classesOf(actor.schoolId).find((c) => c.id === classId);
    if (!cls || cls.cycle === "elementaire") throw new Error("Le professeur principal concerne le moyen et le secondaire.");
    const { error } = await supabase.rpc("set_class_head_teacher", {
      p_class_id: classId,
      p_teacher_id: teacherId,
      p_mode: "principal",
    });
    if (error) {
      if (/cycle/i.test(error.message)) throw new Error("Le professeur principal concerne le moyen et le secondaire.");
      throw new Error(error.message);
    }
    await Promise.all([hydrate("classes"), hydrate("assignments")]);
    return board(actor.schoolId);
  })();
}
