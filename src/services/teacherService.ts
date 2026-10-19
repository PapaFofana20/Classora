import type { SessionUser, Teacher } from "@/types";
import { ensureWritable } from "./access";
import { assignmentsOf, classesOf, db, persist, respond, subjectsOf, teachersOf, uid } from "./db";

export interface TeacherRow extends Teacher {
  classNames: string[];
  subjectNames: string[];
  assignmentCount: number;
  headOf: string[];
  /** Identifiant du compte d'accès, s'il existe (le directeur peut l'avoir créé). */
  userId?: string;
  accountStatus?: "ACTIF" | "DESACTIVE" | "EN_ATTENTE";
  mustChangePassword?: boolean;
}

export function listTeacherRows(schoolId: string): Promise<TeacherRow[]> {
  return respond(() => {
    const classes = classesOf(schoolId);
    const subjects = subjectsOf(schoolId);
    const assignments = assignmentsOf(schoolId);
    const users = db.users.filter((u) => u.schoolId === schoolId);
    return teachersOf(schoolId).map((t) => {
      const mine = assignments.filter((a) => a.teacherId === t.id);
      const account = users.find((u) => u.teacherId === t.id);
      return {
        ...t,
        classNames: Array.from(new Set(mine.map((a) => classes.find((c) => c.id === a.classId)?.name ?? ""))).filter(Boolean),
        subjectNames: Array.from(new Set(mine.map((a) => subjects.find((s) => s.id === a.subjectId)?.name ?? ""))).filter(Boolean),
        assignmentCount: mine.length,
        headOf: classes.filter((c) => c.headTeacherId === t.id).map((c) => c.name),
        ...(account ? { userId: account.id, accountStatus: account.status, mustChangePassword: account.mustChangePassword } : {}),
      };
    });
  });
}

export interface NewTeacherInput {
  firstName: string;
  lastName: string;
  kind: Teacher["kind"];
  email: string;
  phone: string;
  specialties: string[];
}

export function createTeacher(actor: SessionUser, input: NewTeacherInput): Promise<Teacher> {
  return respond(() => {
    ensureWritable(actor);
    if (teachersOf(actor.schoolId).some((t) => t.email.toLowerCase() === input.email.toLowerCase())) throw new Error("Un enseignant avec cet e-mail existe déjà dans votre école.");
    const teacher: Teacher = { schoolId: actor.schoolId, id: uid("t"), ...input };
    db.teachers.push(teacher);
    persist();
    return teacher;
  });
}

export function deleteTeacher(actor: SessionUser, id: string): Promise<void> {
  return respond(() => {
    ensureWritable(actor);
    db.teachers = db.teachers.filter((t) => !(t.schoolId === actor.schoolId && t.id === id));
    db.assignments = db.assignments.filter((a) => !(a.schoolId === actor.schoolId && a.teacherId === id));
    classesOf(actor.schoolId).forEach((c) => {
      if (c.headTeacherId === id) c.headTeacherId = null;
    });
    persist();
  });
}