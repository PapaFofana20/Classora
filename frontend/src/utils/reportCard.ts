import type {
  ClassRoom,
  ClassSubject,
  Grade,
  Period,
  ReportCardData,
  ReportLine,
  ReportMeta,
  Student,
  Subject,
  Teacher,
  TeachingAssignment,
} from "@/types";
import { appreciation, computeRanks, devoirsAverage, round2, subjectAverage, weightedAverage } from "./grades";

export interface ReportInput {
  classRoom: ClassRoom;
  students: Student[];
  grades: Grade[];
  classSubjects: ClassSubject[];
  subjects: Subject[];
  assignments: TeachingAssignment[];
  teachers: Teacher[];
  metas: ReportMeta[];
  period: Period;
}

export function buildClassReportCards(input: ReportInput): ReportCardData[] {
  const { classRoom, students, grades, classSubjects, subjects, assignments, teachers, metas, period } = input;
  const cs = classSubjects.filter((x) => x.classId === classRoom.id);
  const gradeOf = (studentId: string, subjectId: string) =>
    grades.find((g) => g.studentId === studentId && g.subjectId === subjectId && g.classId === classRoom.id && g.period === period.id);

  const subjectRanks = new Map<string, Map<string, number>>();
  cs.forEach((c) => {
    subjectRanks.set(
      c.subjectId,
      computeRanks(students.map((s) => ({ id: s.id, value: subjectAverage(gradeOf(s.id, c.subjectId), classRoom.cycle) }))),
    );
  });

  const teacherName = (subjectId: string): string => {
    const a = assignments.find((x) => x.classId === classRoom.id && x.subjectId === subjectId);
    const t = a ? teachers.find((x) => x.id === a.teacherId) : undefined;
    return t ? `${t.firstName} ${t.lastName}` : "—";
  };
  const head = teachers.find((t) => t.id === classRoom.headTeacherId);
  const headTeacherName = head ? `${head.firstName} ${head.lastName}` : "—";

  const partial = students.map((s) => {
    const lines: ReportLine[] = cs.map((c) => {
      const g = gradeOf(s.id, c.subjectId);
      const average = subjectAverage(g, classRoom.cycle);
      return {
        subjectId: c.subjectId,
        subjectName: subjects.find((x) => x.id === c.subjectId)?.name ?? c.subjectId,
        coefficient: c.coefficient,
        devoir1: g?.devoir1 ?? null,
        devoir2: g?.devoir2 ?? null,
        devoirsAvg: devoirsAverage(g),
        composition: g?.composition ?? null,
        average,
        rank: subjectRanks.get(c.subjectId)?.get(s.id) ?? null,
        teacherName: teacherName(c.subjectId),
        appreciation: appreciation(average),
      };
    });
    return { student: s, lines, generalAverage: weightedAverage(lines.map((l) => ({ average: l.average, coefficient: l.coefficient }))) };
  });

  const ranks = computeRanks(partial.map((p) => ({ id: p.student.id, value: p.generalAverage })));
  const avgs = partial.map((p) => p.generalAverage).filter((x): x is number => x !== null);
  const classAverage = avgs.length ? round2(avgs.reduce((a, b) => a + b, 0) / avgs.length) : null;

  return partial.map((p) => ({
    student: p.student,
    classRoom,
    period,
    lines: p.lines,
    generalAverage: p.generalAverage,
    rank: ranks.get(p.student.id) ?? null,
    classSize: students.length,
    classAverage,
    // Aucune valeur inventée : sans saisie réelle, la fiche affiche « Non renseigné ».
    meta: metas.find((m) => m.studentId === p.student.id && m.period === period.id) ?? null,
    headTeacherName,
  }));
}
