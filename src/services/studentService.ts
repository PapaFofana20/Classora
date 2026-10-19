import type { ClassRoom, Parent, Payment, ReportCardData, SessionUser, Student, StudentOptions, StudentPayStatus } from "@/types";
import { TODAY_ISO, levels } from "@/data/school";
import { studentPayStatus } from "@/utils/payments";
import { generateChildCode } from "@/utils/matricule";
import { ensure, ensureWritable, visibleStudents } from "./access";
import { classesOf, db, parentsOf, paymentsOf, persist, respond, studentsOf, uid } from "./db";
import { buildPaymentPlan } from "./paymentService";
import { cardsForClass } from "./reportService";

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
    balance: pays.filter((p) => p.dueDate <= TODAY_ISO).reduce((a, p) => a + Math.max(0, p.amount - p.paidAmount), 0),
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
    const showMoney = actor.role !== "professeur" && actor.role !== "instituteur" && actor.role !== "surveillant";
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

/** Inscription faite par la direction depuis /app/inscription-eleve. */
export function enrollStudent(actor: SessionUser, input: EnrollInput): Promise<StudentRow> {
  return respond(() => {
    ensureWritable(actor);
    const cls = classesOf(actor.schoolId).find((c) => c.id === input.classId);
    if (!cls) throw new Error("Classe introuvable.");
    if (studentsOf(actor.schoolId).filter((s) => s.classId === cls.id).length >= cls.capacity) throw new Error(`La classe ${cls.name} est complète (${cls.capacity} places).`);
    let parentId: string;
    if (input.parent.mode === "existing") {
      parentId = input.parent.parentId;
      ensure(parentsOf(actor.schoolId).some((p) => p.id === parentId), "Parent introuvable dans votre école.");
    } else {
      parentId = uid("p");
      db.parents.push({ schoolId: actor.schoolId, id: parentId, firstName: input.parent.firstName, lastName: input.parent.lastName, phone: input.parent.phone, email: input.parent.email, address: input.parent.address });
    }
    const n = studentsOf(actor.schoolId).length + 1;
    const student: Student = {
      schoolId: actor.schoolId,
      id: uid("s"),
      matricule: `EC26${String(n).padStart(4, "0")}`,
      childCode: generateChildCode(db.students.map((s) => s.childCode)),
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      gender: input.gender,
      birthDate: input.birthDate,
      classId: cls.id,
      parentId,
      options: input.options,
      enrolledAt: TODAY_ISO,
    };
    db.students.push(student);
    db.payments.push(...buildPaymentPlan(student));
    persist();
    return toRow(student);
  });
}

export const listParents = (actor: SessionUser): Promise<Parent[]> => respond(() => parentsOf(actor.schoolId));

/** Code élève d'un inscrit : communiqué aux familles par la direction. */
export const childCodeOf = (actor: SessionUser, studentId: string): Promise<string | null> =>
  respond(() => studentsOf(actor.schoolId).find((s) => s.id === studentId)?.childCode ?? null, 100, 200);