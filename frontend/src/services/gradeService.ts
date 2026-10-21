import type { ClassRoom, Grade, SessionUser, Student, Subject } from "@/types";
import { canEditGrades, canReadSubject } from "@/utils/permissions";
import { gradeCompletion, subjectAverage, round2 } from "@/utils/grades";
import { supabase } from "@/lib/supabase";
import { ensure, ensureWritable, teacherOf } from "./access";
import { assignmentsOf, classSubjectsOf, classesOf, gradesOf, hydrate, respond, studentsOf, subjectsOf } from "./db";
import { subscriptionInfoOf } from "./subscriptionService";

export interface GradeSheet {
  classRoom: ClassRoom;
  subject: Subject;
  coefficient: number;
  students: Student[];
  grades: Grade[];
  editable: boolean;
  /** Vrai si l'école est en lecture seule (abonnement expiré). */
  readOnly: boolean;
}

export function getGradeSheet(actor: SessionUser, classId: string, subjectId: string, period: string): Promise<GradeSheet> {
  return respond(() => {
    const classRoom = classesOf(actor.schoolId).find((c) => c.id === classId);
    const subject = subjectsOf(actor.schoolId).find((s) => s.id === subjectId);
    if (!classRoom || !subject) throw new Error("Classe ou matière introuvable.");
    const teacher = teacherOf(actor);
    const editable = canEditGrades(teacher, classId, subjectId, assignmentsOf(actor.schoolId));
    ensure(actor.role === "directeur" || canReadSubject(teacher, classRoom, subjectId, assignmentsOf(actor.schoolId)), "Cette classe ou cette matière ne vous est pas affectée.");
    return {
      classRoom,
      subject,
      coefficient: classSubjectsOf(actor.schoolId).find((x) => x.classId === classId && x.subjectId === subjectId)?.coefficient ?? 1,
      students: studentsOf(actor.schoolId).filter((s) => s.classId === classId),
      grades: gradesOf(actor.schoolId).filter((g) => g.classId === classId && g.subjectId === subjectId && g.period === period),
      editable,
      readOnly: subscriptionInfoOf(actor.schoolId).readOnly,
    };
  });
}

export interface SaveGradeInput {
  studentId: string;
  classId: string;
  subjectId: string;
  period: string;
  field: "devoir1" | "devoir2" | "composition";
  value: number | null;
}

export function saveGrade(actor: SessionUser, input: SaveGradeInput): Promise<Grade> {
  return (async () => {
    ensureWritable(actor);
    ensure(canEditGrades(teacherOf(actor), input.classId, input.subjectId, assignmentsOf(actor.schoolId)), "Action non autorisée : cette classe ou cette matière ne vous est pas affectée.");
    ensure(studentsOf(actor.schoolId).some((s) => s.id === input.studentId), "Élève introuvable dans votre école.");
    ensure(input.value === null || (input.value >= 0 && input.value <= 20), "La note doit être comprise entre 0 et 20.");
    const { error } = await supabase.rpc("save_grade", {
      p_student_id: input.studentId,
      p_class_id: input.classId,
      p_subject_id: input.subjectId,
      p_period: input.period,
      p_field: input.field,
      p_value: input.value,
    });
    if (error) {
      if (/comprise entre 0 et 20/.test(error.message)) throw new Error("La note doit être comprise entre 0 et 20.");
      if (/ne vous est pas affectée/.test(error.message)) throw new Error("Action non autorisée : cette classe ou cette matière ne vous est pas affectée.");
      if (/introuvable/.test(error.message)) throw new Error("Élève introuvable dans votre école.");
      if (/lectur/.test(error.message)) throw new Error(error.message);
      throw new Error(error.message);
    }
    await hydrate("grades");
    const g = gradesOf(actor.schoolId).find(
      (x) => x.studentId === input.studentId && x.classId === input.classId && x.subjectId === input.subjectId && x.period === input.period,
    );
    return (
      g ?? {
        schoolId: actor.schoolId,
        studentId: input.studentId,
        classId: input.classId,
        subjectId: input.subjectId,
        period: input.period,
        devoir1: null,
        devoir2: null,
        composition: null,
      }
    );
  })();
}

export interface ContextOverview {
  classId: string;
  subjectId: string;
  className: string;
  subjectName: string;
  studentCount: number;
  completion: number;
  average: number | null;
}

/** Cartes "Mes classes" : une par affectation (classe, matière). */
export function getTeacherOverview(schoolId: string, teacherId: string, period: string): Promise<ContextOverview[]> {
  return respond(() => {
    const my = assignmentsOf(schoolId).filter((a) => a.teacherId === teacherId);
    const classes = classesOf(schoolId);
    const students = studentsOf(schoolId);
    return my
      .map((a) => {
        const cls = classes.find((c) => c.id === a.classId);
        const studentIds = students.filter((s) => s.classId === a.classId).map((s) => s.id);
        const gs = gradesOf(schoolId).filter((g) => g.classId === a.classId && g.subjectId === a.subjectId && g.period === period && studentIds.includes(g.studentId));
        const avgs = gs.map((g) => subjectAverage(g, cls?.cycle ?? "moyen")).filter((x): x is number => x !== null);
        return {
          classId: a.classId,
          subjectId: a.subjectId,
          className: cls?.name ?? "—",
          subjectName: subjectsOf(schoolId).find((s) => s.id === a.subjectId)?.name ?? "—",
          studentCount: studentIds.length,
          completion: gradeCompletion(gs, studentIds.length, cls?.cycle ?? "moyen"),
          average: avgs.length ? round2(avgs.reduce((x, y) => x + y, 0) / avgs.length) : null,
        };
      })
      .sort((a, b) => a.className.localeCompare(b.className, "fr"));
  });
}