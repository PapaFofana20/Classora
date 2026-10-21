import type { Payment } from "@/types";
import { db } from "./db";

export interface PaymentRow extends Payment {
  studentName: string;
  className: string;
  parentName: string;
  parentPhone: string;
}

export function toPaymentRow(p: Payment): PaymentRow {
  const s = db.students.find((x) => x.id === p.studentId);
  const c = s ? db.classes.find((x) => x.id === s.classId) : undefined;
  const parent = s ? db.parents.find((x) => x.id === s.parentId) : undefined;
  return {
    ...p,
    studentName: s ? `${s.firstName} ${s.lastName}` : "—",
    className: c?.name ?? "—",
    parentName: parent ? `${parent.firstName} ${parent.lastName}` : "—",
    parentPhone: parent?.phone ?? "",
  };
}

export const toPaymentRows = (list: Payment[]): PaymentRow[] => list.map(toPaymentRow);
