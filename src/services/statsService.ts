import type { Cycle, Period } from "@/types";
import { SCHOOL_MONTHS, TODAY_ISO } from "@/data/school";
import { round2 } from "@/utils/grades";
import { detectConflicts } from "@/utils/assignments";
import { sum } from "@/utils/payments";
import { assignmentsOf, classSubjectsOf, classesOf, paymentsOf, respond, studentsOf, subjectsOf, teachersOf, settingsOf } from "./db";
import { cardsForClass } from "./reportService";
import { toPaymentRows, type PaymentRow } from "./paymentRows";

export interface AdminStats {
  schoolName: string;
  totalStudents: number;
  byCycle: { cycle: Cycle; count: number }[];
  expected: number;
  collected: number;
  recoveryRate: number;
  unpaidTotal: number;
  unpaidStudents: number;
  generalAverage: number | null;
  paymentsByMonth: { month: string; attendu: number; encaisse: number }[];
  studentsByClass: { name: string; cycle: Cycle; effectif: number }[];
  latestPayments: PaymentRow[];
  alerts: { id: string; tone: "danger" | "warning" | "info"; text: string; to: string }[];
}

/** Tableau de bord de la direction : uniquement les données de SON école. */
export function getAdminStats(schoolId: string, periodId: Period["id"]): Promise<AdminStats> {
  return respond(() => {
    const students = studentsOf(schoolId);
    const payments = paymentsOf(schoolId);
    const classes = classesOf(schoolId);
    const due = payments.filter((p) => p.dueDate <= TODAY_ISO);
    const expected = sum(due.map((p) => p.amount));
    const collected = sum(due.map((p) => p.paidAmount));
    const unpaidIds = new Set(due.filter((p) => p.paidAmount < p.amount).map((p) => p.studentId));
    const cycles: Cycle[] = ["elementaire", "moyen", "secondaire"];
    const avgs = classes.flatMap((c) => cardsForClass(c.id, periodId).map((x) => x.generalAverage)).filter((x): x is number => x !== null);
    const conflicts = detectConflicts(classes, classSubjectsOf(schoolId), assignmentsOf(schoolId), teachersOf(schoolId), subjectsOf(schoolId));
    const errors = conflicts.filter((c) => c.severity === "error").length;
    const alerts: AdminStats["alerts"] = [];
    if (unpaidIds.size) alerts.push({ id: "a1", tone: "danger", text: `${unpaidIds.size} élèves ont au moins une échéance en retard.`, to: "/app/paiements" });
    if (conflicts.length) alerts.push({ id: "a2", tone: errors ? "danger" : "warning", text: `${conflicts.length} conflit(s) d'affectation à corriger (${errors} bloquant(s)).`, to: "/app/affectations" });
    alerts.push({ id: "a3", tone: "info", text: "Compositions du 1er semestre : du 11/01/2027 au 22/01/2027.", to: "/app/messages" });
    return {
      schoolName: settingsOf(schoolId).name,
      totalStudents: students.length,
      byCycle: cycles.map((cycle) => ({ cycle, count: students.filter((s) => classes.find((c) => c.id === s.classId)?.cycle === cycle).length })),
      expected,
      collected,
      recoveryRate: expected ? Math.round((collected / expected) * 100) : 0,
      unpaidTotal: expected - collected,
      unpaidStudents: unpaidIds.size,
      generalAverage: avgs.length ? round2(sum(avgs) / avgs.length) : null,
      paymentsByMonth: SCHOOL_MONTHS.map((m) => {
        const key = `${m.year}-${String(m.month).padStart(2, "0")}`;
        const items = payments.filter((p) => p.kind === "mensualite" && p.dueDate.startsWith(key));
        return { month: m.label.slice(0, 4) + ".", attendu: sum(items.map((p) => p.amount)), encaisse: sum(items.map((p) => p.paidAmount)) };
      }),
      studentsByClass: classes.map((c) => ({ name: c.name, cycle: c.cycle, effectif: students.filter((s) => s.classId === c.id).length })),
      latestPayments: toPaymentRows(
        payments
          .filter((p) => p.paidAmount > 0 && p.paidAt && p.kind !== "inscription")
          .sort((a, b) => (b.paidAt ?? "").localeCompare(a.paidAt ?? ""))
          .slice(0, 6),
      ),
      alerts,
    };
  });
}