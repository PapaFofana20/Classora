import type { AbsenceRecord } from "@/types";
import { absencesOf, classesOf, db, persist, respond, studentsOf, uid } from "./db";

export interface AbsenceRow extends AbsenceRecord {
  studentName: string;
  className: string;
}

export function listAbsences(schoolId: string): Promise<AbsenceRow[]> {
  return respond(() => {
    const classes = classesOf(schoolId);
    const students = studentsOf(schoolId);
    return absencesOf(schoolId).map((a) => {
      const s = students.find((x) => x.id === a.studentId);
      return { ...a, studentName: s ? `${s.firstName} ${s.lastName}` : "—", className: classes.find((c) => c.id === s?.classId)?.name ?? "—" };
    });
  });
}

export function addAbsence(schoolId: string, input: Omit<AbsenceRecord, "id" | "schoolId">): Promise<AbsenceRecord> {
  return respond(() => {
    const rec: AbsenceRecord = { id: uid("ab"), schoolId, ...input };
    db.absences.unshift(rec);
    persist();
    return rec;
  });
}