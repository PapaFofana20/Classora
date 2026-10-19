import type { ClassRoom, ClassSubject, Conflict, Subject, Teacher, TeachingAssignment } from "@/types";
import { MAX_ASSIGNMENTS_PER_TEACHER } from "./permissions";

export function detectConflicts(
  classes: ClassRoom[],
  classSubjects: ClassSubject[],
  assignments: TeachingAssignment[],
  teachers: Teacher[],
  subjects: Subject[],
): Conflict[] {
  const out: Conflict[] = [];
  const tName = (id: string) => {
    const t = teachers.find((x) => x.id === id);
    return t ? `${t.firstName} ${t.lastName}` : "Inconnu";
  };
  const sName = (id: string) => subjects.find((s) => s.id === id)?.name ?? id;

  for (const c of classes) {
    if (c.cycle === "elementaire") {
      if (!c.headTeacherId) out.push({ id: `nt-${c.id}`, severity: "error", classId: c.id, message: `${c.name} : aucun instituteur titulaire.` });
      continue;
    }
    if (!c.headTeacherId) out.push({ id: `nh-${c.id}`, severity: "warning", classId: c.id, message: `${c.name} : aucun professeur principal désigné.` });
    for (const cs of classSubjects.filter((x) => x.classId === c.id)) {
      const list = assignments.filter((a) => a.classId === c.id && a.subjectId === cs.subjectId);
      if (list.length === 0) {
        out.push({ id: `ns-${c.id}-${cs.subjectId}`, severity: "error", classId: c.id, subjectId: cs.subjectId, message: `${c.name} · ${sName(cs.subjectId)} : aucun professeur affecté.` });
      } else if (list.length > 1) {
        out.push({
          id: `dup-${c.id}-${cs.subjectId}`,
          severity: "warning",
          classId: c.id,
          subjectId: cs.subjectId,
          message: `${c.name} · ${sName(cs.subjectId)} : ${list.length} professeurs affectés (${list.map((a) => tName(a.teacherId)).join(", ")}).`,
        });
      }
    }
  }

  const titulars = new Map<string, string[]>();
  classes
    .filter((c) => c.cycle === "elementaire" && c.headTeacherId)
    .forEach((c) => titulars.set(c.headTeacherId as string, [...(titulars.get(c.headTeacherId as string) ?? []), c.name]));
  titulars.forEach((names, id) => {
    if (names.length > 1) out.push({ id: `multi-${id}`, severity: "error", teacherId: id, message: `${tName(id)} est titulaire de plusieurs classes (${names.join(", ")}).` });
  });

  const counts = new Map<string, number>();
  teachers
    .filter((t) => t.kind === "professeur")
    .forEach((t) => counts.set(t.id, assignments.filter((a) => a.teacherId === t.id).length));
  counts.forEach((n, id) => {
    if (n > MAX_ASSIGNMENTS_PER_TEACHER) {
      out.push({ id: `over-${id}`, severity: "warning", teacherId: id, message: `${tName(id)} est surchargé : ${n} affectations (maximum conseillé : ${MAX_ASSIGNMENTS_PER_TEACHER}).` });
    }
  });
  return out;
}
