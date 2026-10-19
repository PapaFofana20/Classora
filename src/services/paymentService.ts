import type { PayMethod, Payment, SessionUser, Student } from "@/types";
import { SCHOOL_MONTHS, TODAY_ISO } from "@/data/school";
import { computeStatus, remaining } from "@/utils/payments";
import { ensure, ensureWritable } from "./access";
import { db, paymentsOf, persist, respond, settingsOf, studentsOf, uid } from "./db";
import { toPaymentRow, type PaymentRow } from "./paymentRows";

export type { PaymentRow };
const toRow = toPaymentRow;

/** Paiements de l'école de l'acteur (jamais ceux d'une autre école). */
export const listPaymentRows = (actor: SessionUser): Promise<PaymentRow[]> => respond(() => paymentsOf(actor.schoolId).map(toRow));

export function listParentPayments(actor: SessionUser): Promise<PaymentRow[]> {
  return respond(() => {
    const ids = studentsOf(actor.schoolId).filter((s) => (actor.role === "eleve" ? s.id === actor.studentId : s.parentId === actor.parentId)).map((s) => s.id);
    return paymentsOf(actor.schoolId)
      .filter((p) => ids.includes(p.studentId))
      .map(toRow);
  });
}

export function listStudentPayments(schoolId: string, studentId: string): Promise<Payment[]> {
  return respond(() => paymentsOf(schoolId).filter((p) => p.studentId === studentId));
}

/** Échéancier : inscription + 10 mensualités (octobre à juillet) + frais annexes, réduction fratrie incluse. */
export function buildPaymentPlan(student: Student): Payment[] {
  const settings = settingsOf(student.schoolId);
  const cls = db.classes.find((c) => c.id === student.classId && c.schoolId === student.schoolId);
  const fees = cls ? settings.fees[cls.levelId] : undefined;
  if (!fees) return [];
  const hasSibling = studentsOf(student.schoolId).some((x) => x.parentId === student.parentId && x.id !== student.id);
  const discount = hasSibling ? settings.siblingDiscount : 0;
  const mens = Math.round((fees.mensualite * (1 - discount / 100)) / 500) * 500;
  const extra = (student.options.cantine ? settings.annexFees.cantine : 0) + (student.options.transport ? settings.annexFees.transport : 0);
  const mk = (suffix: string, kind: Payment["kind"], label: string, dueDate: string, amount: number): Payment => ({
    schoolId: student.schoolId,
    id: `${student.id}-${suffix}`,
    studentId: student.id,
    kind,
    label,
    dueDate,
    amount,
    paidAmount: 0,
    status: computeStatus(amount, 0, dueDate),
  });
  const plan: Payment[] = [mk("ins", "inscription", `Frais d'inscription ${settings.schoolYear}`, "2026-09-15", fees.inscription)];
  if (student.options.tenue) plan.push(mk("tenue", "tenue", "Tenue scolaire", "2026-10-01", settings.annexFees.tenue));
  SCHOOL_MONTHS.forEach((m, i) => plan.push(mk(`m${i + 1}`, "mensualite", `Mensualité de ${m.label} ${m.year}`, `${m.year}-${String(m.month).padStart(2, "0")}-05`, mens + extra)));
  return plan;
}

function settle(p: Payment, amount: number, method: PayMethod): void {
  p.paidAmount = Math.min(p.amount, p.paidAmount + amount);
  p.status = computeStatus(p.amount, p.paidAmount, p.dueDate);
  p.method = method;
  p.paidAt = `${TODAY_ISO}T${String(8 + Math.floor(Math.random() * 10)).padStart(2, "0")}:${String(Math.floor(Math.random() * 60)).padStart(2, "0")}`;
  p.reference = `EC-${Math.floor(100000 + Math.random() * 899999)}`;
}

/** Paiement mobile money simulé par un parent ou un élève (espace de l'élève). */
export function payInstallments(actor: SessionUser, paymentIds: string[], method: PayMethod, phone: string): Promise<PaymentRow[]> {
  return respond(
    () => {
      ensure(method !== "especes", "Moyen de paiement invalide.");
      ensure(/^7[0678]\s?\d{3}\s?\d{2}\s?\d{2}$/.test(phone.trim()), "Numéro de téléphone invalide.");
      ensureWritable(actor);
      const mine = studentsOf(actor.schoolId).filter((s) => (actor.role === "parent" ? s.parentId === actor.parentId : s.id === actor.studentId)).map((s) => s.id);
      const targets = paymentsOf(actor.schoolId).filter((p) => paymentIds.includes(p.id));
      ensure(targets.length > 0 && targets.every((p) => mine.includes(p.studentId)), "Ces échéances ne vous concernent pas.");
      targets.forEach((p) => settle(p, remaining(p), method));
      persist();
      return targets.map(toRow);
    },
    900,
    1500,
  );
}

export function recordCashPayment(actor: SessionUser, paymentId: string, amount: number): Promise<PaymentRow> {
  return respond(() => {
    ensureWritable(actor);
    const p = paymentsOf(actor.schoolId).find((x) => x.id === paymentId);
    ensure(!!p, "Échéance introuvable.");
    if (!p) throw new Error("Échéance introuvable.");
    ensure(amount > 0 && amount <= remaining(p), "Montant invalide.");
    settle(p, amount, "especes");
    persist();
    return toRow(p);
  });
}

export function sendReminders(actor: SessionUser, studentIds: string[]): Promise<number> {
  return respond(() => {
    ensureWritable(actor);
    const n = studentIds.length;
    db.announcements.unshift({
      schoolId: actor.schoolId,
      id: uid("an"),
      title: "Relance de paiement",
      body: `Une relance a été envoyée à ${n} famille${n > 1 ? "s" : ""}.`,
      at: `${TODAY_ISO}T09:00`,
      author: "Économat",
      audience: ["econome", "directeur"],
    });
    persist();
    return n;
  });
}