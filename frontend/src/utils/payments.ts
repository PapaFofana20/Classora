import type { Payment, PaymentStatus, PayMethod, StudentPayStatus } from "@/types";
import { TODAY_ISO } from "@/data/school";

export function computeStatus(amount: number, paid: number, dueDate: string, today: string = TODAY_ISO): PaymentStatus {
  if (paid >= amount) return "paye";
  if (paid > 0) return "partiel";
  return dueDate <= today ? "en_retard" : "a_venir";
}

export const PAY_METHOD_LABELS: Record<PayMethod, string> = {
  wave: "Wave",
  orange_money: "Orange Money",
  free_money: "Free Money",
  especes: "Espèces",
};

export const PAY_STATUS_LABELS: Record<PaymentStatus, string> = {
  paye: "Payé",
  partiel: "Partiel",
  en_retard: "En retard",
  a_venir: "À venir",
};

export const STUDENT_STATUS_LABELS: Record<StudentPayStatus, string> = {
  a_jour: "À jour",
  partiel: "Partiel",
  impaye: "Impayé",
};

export function remaining(p: Payment): number {
  return Math.max(0, p.amount - p.paidAmount);
}

export function studentPayStatus(payments: Payment[]): StudentPayStatus {
  const due = payments.filter((p) => p.dueDate <= TODAY_ISO);
  if (due.some((p) => p.status === "en_retard")) return "impaye";
  if (due.some((p) => p.status === "partiel")) return "partiel";
  return "a_jour";
}

export function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

/** Mensualité après réduction fratrie, arrondie à 500 FCFA. */
export function discountedMonthly(base: number, discountPercent: number): number {
  return Math.round((base * (1 - discountPercent / 100)) / 500) * 500;
}
