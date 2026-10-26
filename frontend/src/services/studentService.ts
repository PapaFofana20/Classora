import type { ClassRoom, Parent, Payment, ReportCardData, SessionUser, Student, StudentOptions, StudentPayStatus } from "@/types";
import { todayIso, levels } from "@/data/school";
import { studentPayStatus } from "@/utils/payments";
import { ensure, visibleStudents } from "./access";
import { classesOf, db, hydrate, parentsOf, paymentsOf, respond, studentsOf } from "./db";
import { cardsForClass } from "./reportService";
import { supabase } from "@/lib/supabase";

export interface StudentRow extends Student {
  className: string;
  levelLabel: string;
  cycle: ClassRoom["cycle"];
  parentName: string;
  parentPhone: string;
  payStatus: StudentPayStatus;
  balance: number;
}

function toRow(s: Student): StudentRow {
  const cls = db.classes.find((c) => c.id === s.classId && c.schoolId === s.schoolId);
  const parent = db.parents.find((p) => p.id === s.parentId && p.schoolId === s.schoolId);
  const pays = paymentsOf(s.schoolId).filter((p) => p.studentId === s.id);
  return {
    ...s,
    className: cls?.name ?? "—",
    levelLabel: levels.find((l) => l.id === cls?.levelId)?.label ?? "",
    cycle: cls?.cycle ?? "elementaire",
    parentName: parent ? `${parent.firstName} ${parent.lastName}` : "—",
    parentPhone: parent?.phone ?? "",
    payStatus: studentPayStatus(pays),
    balance: pays.filter((p) => p.dueDate <= todayIso()).reduce((a, p) => a + Math.max(0, p.amount - p.paidAmount), 0),
  };
}

export const listStudentRows = (actor: SessionUser): Promise<StudentRow[]> => respond(() => visibleStudents(actor).map(toRow));

export interface StudentDetail {
  row: StudentRow;
  classRoom: ClassRoom;
  parent: Parent | null;
  siblings: StudentRow[];
  payments: Payment[];
  report: ReportCardData | null;
}

export function getStudentDetail(actor: SessionUser, id: string): Promise<StudentDetail> {
  return respond(() => {
    const s = visibleStudents(actor).find((x) => x.id === id);
    ensure(!!s, "Élève introuvable ou accès non autorisé.");
    if (!s) throw new Error("Élève introuvable.");
    const classRoom = classesOf(s.schoolId).find((c) => c.id === s.classId);
    const parent = db.parents.find((p) => p.id === s.parentId && p.schoolId === s.schoolId) ?? null;
    if (!classRoom) throw new Error("Dossier incomplet.");
    const showMoney = actor.role !== "professeur" && actor.role !== "instituteur" && actor.role !== "surveillant" && actor.role !== "secretaire";
    const card = cardsForClass(classRoom.id, db.settings.find((x) => x.schoolId === s.schoolId)?.currentPeriod ?? "S1").find((c) => c.student.id === id) ?? null;
    return {
      row: toRow(s),
      classRoom,
      parent,
      siblings: studentsOf(s.schoolId).filter((x) => x.parentId === s.parentId && x.id !== s.id).map(toRow),
      payments: showMoney ? paymentsOf(s.schoolId).filter((p) => p.studentId === id) : [],
      report: actor.role === "surveillant" ? null : card,
    };
  });
}

export type ParentInput =
  | { mode: "existing"; parentId: string }
  | { mode: "new"; firstName: string; lastName: string; phone: string; email: string; address: string };

export interface EnrollInput {
  firstName: string;
  lastName: string;
  gender: "F" | "M";
  birthDate: string;
  classId: string;
  options: StudentOptions;
  parent: ParentInput;
}

/** Inscription faite par la direction depuis /app/inscription-eleve (RPC serveur). */
export function enrollStudent(actor: SessionUser, input: EnrollInput): Promise<StudentRow> {
  return (async () => {
    const cls = classesOf(actor.schoolId).find((c) => c.id === input.classId);
    if (!cls) throw new Error("Classe introuvable.");
    const { error } = await supabase.rpc("enroll_student", {
      p_class_id: input.classId,
      p_first_name: input.firstName.trim(),
      p_last_name: input.lastName.trim(),
      p_gender: input.gender,
      p_birth_date: input.birthDate || null,
      p_options: input.options,
      p_parent_id: input.parent.mode === "existing" ? input.parent.parentId : null,
      p_parent_first: input.parent.mode === "new" ? input.parent.firstName.trim() : null,
      p_parent_last: input.parent.mode === "new" ? input.parent.lastName.trim() : null,
      p_parent_phone: input.parent.mode === "new" ? input.parent.phone.trim() : null,
      p_parent_email: input.parent.mode === "new" ? input.parent.email.trim() : null,
      p_parent_address: input.parent.mode === "new" ? input.parent.address.trim() : "",
    });
    if (error) {
      if (/complète/.test(error.message)) throw new Error(error.message);
      if (/limite/.test(error.message)) throw new Error(error.message);
      throw new Error(error.message);
    }
    await Promise.all([hydrate("students"), hydrate("parents"), hydrate("payments")]);
    const created = studentsOf(actor.schoolId)
      .filter((s) => s.classId === cls.id)
      .sort((a, b) => b.enrolledAt.localeCompare(a.enrolledAt))[0];
    if (!created) throw new Error("Inscription impossible. Vérifiez la classe et réessayez.");
    return toRow(created);
  })();
}

export const listParents = (actor: SessionUser): Promise<Parent[]> => respond(() => parentsOf(actor.schoolId));

/** Code élève d'un inscrit : communiqué aux familles par la direction. */
export const childCodeOf = (actor: SessionUser, studentId: string): Promise<string | null> =>
  respond(() => studentsOf(actor.schoolId).find((s) => s.id === studentId)?.childCode ?? null);