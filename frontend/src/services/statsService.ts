import type { Cycle, Payment, Period } from "@/types";
import { supabase } from "@/lib/supabase";
import { hydrate, settingsOf } from "./db";
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

interface DashboardPayload {
  totalStudents: number;
  byCycle: { cycle: Cycle; count: number }[] | null;
  expected: number | null;
  collected: number | null;
  unpaidTotal: number | null;
  unpaidStudents: number;
  generalAverage: number | null;
  paymentsByMonth: { month: string; attendu: number | null; encaisse: number | null }[] | null;
  studentsByClass: { name: string; cycle: Cycle; effectif: number }[] | null;
  latestPayments: Record<string, unknown>[] | null;
  conflictCount: number;
  conflictErrorCount: number;
}

const n = (x: unknown): number => (typeof x === "number" ? x : 0);

/** Tableau de bord de la direction : calcul 100 % serveur (admin_dashboard). */
export function getAdminStats(schoolId: string, periodId: Period["id"]): Promise<AdminStats> {
  return (async () => {
    await hydrate("settings");
    const { data, error } = await supabase.rpc("admin_dashboard", { p_period_id: periodId });
    if (error) throw new Error(/indisponible/.test(error.message) ? "Tableau de bord indisponible." : error.message);
    const d = data as unknown as DashboardPayload | null;
    // Une RPC qui renvoie null (aucune donnée) ne doit pas faire crasher le
    // dashboard direction avec « Cannot read properties of null ».
    if (!d) throw new Error("Tableau de bord indisponible.");
    const expected = n(d.expected);
    const collected = n(d.collected);
    const alerts: AdminStats["alerts"] = [];
    if (n(d.unpaidStudents)) alerts.push({ id: "a1", tone: "danger", text: `${n(d.unpaidStudents)} élèves ont au moins une échéance en retard.`, to: "/app/paiements" });
    const conflicts = n(d.conflictCount);
    const conflictErrors = n(d.conflictErrorCount);
    if (conflicts) alerts.push({ id: "a2", tone: conflictErrors ? "danger" : "warning", text: `${conflicts} conflit(s) d'affectation à corriger (${conflictErrors} bloquant(s)).`, to: "/app/affectations" });
    return {
      schoolName: settingsOf(schoolId).name,
      totalStudents: n(d.totalStudents),
      byCycle: d.byCycle ?? [],
      expected,
      collected,
      recoveryRate: expected ? Math.round((collected / expected) * 100) : 0,
      unpaidTotal: expected - collected,
      unpaidStudents: n(d.unpaidStudents),
      generalAverage: d.generalAverage ?? null,
      paymentsByMonth: (d.paymentsByMonth ?? []).map((m) => ({ month: m.month, attendu: n(m.attendu), encaisse: n(m.encaisse) })),
      studentsByClass: d.studentsByClass ?? [],
      latestPayments: toPaymentRows((d.latestPayments ?? []) as unknown as Payment[]),
      alerts,
    };
  })();
}
