import type { PayMethod, Payment } from "@/types";
import { classes } from "./classes";
import { SCHOOL_MONTHS, TODAY_ISO, DEFAULT_ANNEX_FEES, DEFAULT_SIBLING_DISCOUNT } from "./school";
import { schoolSettings } from "./schools";
import { hashString, mulberry32, pick } from "./seed";
import { students } from "./students";

const METHODS: PayMethod[] = ["wave", "orange_money", "free_money", "wave", "orange_money", "especes"];
const pad = (n: number) => String(n).padStart(2, "0");

type Profile = "ok" | "late2" | "partial" | "late1";

function status(amount: number, paid: number, due: string): Payment["status"] {
  if (paid >= amount) return "paye";
  if (paid > 0) return "partiel";
  return due <= TODAY_ISO ? "en_retard" : "a_venir";
}

export const payments: Payment[] = [];

for (const s of students) {
  const r = mulberry32(hashString("pay" + s.id));
  const cls = classes.find((c) => c.id === s.classId);
  const settings = schoolSettings.find((x) => x.schoolId === s.schoolId);
  const fees = cls && settings ? settings.fees[cls.levelId] : undefined;
  if (!fees || !settings) continue;
  const annex = settings.annexFees ?? DEFAULT_ANNEX_FEES;
  const discount = students.filter((x) => x.parentId === s.parentId).findIndex((x) => x.id === s.id) > 0 ? settings.siblingDiscount ?? DEFAULT_SIBLING_DISCOUNT : 0;
  const mens = Math.round((fees.mensualite * (1 - discount / 100)) / 500) * 500;
  const extra = (s.options.cantine ? annex.cantine : 0) + (s.options.transport ? annex.transport : 0);
  const p = r();
  let profile: Profile = p < 0.62 ? "ok" : p < 0.76 ? "late2" : p < 0.88 ? "partial" : "late1";
  if (s.id === "s-aida") profile = "ok";
  if (s.id === "s-mamadou") profile = "late1";

  const push = (id: string, kind: Payment["kind"], label: string, dueDate: string, amount: number, paid: number) => {
    const method = pick(METHODS, r());
    payments.push({
      schoolId: s.schoolId,
      id: `${s.id}-${id}`,
      studentId: s.id,
      kind,
      label,
      dueDate,
      amount,
      paidAmount: paid,
      status: status(amount, paid, dueDate),
      ...(paid > 0
        ? { method, paidAt: `${dueDate.slice(0, 8)}${pad(1 + Math.floor(r() * 12))}`, reference: `EC-${(hashString(s.id + id) % 900000) + 100000}` }
        : {}),
    });
  };

  push("ins", "inscription", `Frais d'inscription ${settings.schoolYear}`, "2026-09-15", fees.inscription, fees.inscription);
  if (s.options.tenue) {
    const paid = profile === "ok" || r() < 0.7;
    push("tenue", "tenue", "Tenue scolaire", "2026-10-01", annex.tenue, paid ? annex.tenue : 0);
  }
  const amount = mens + extra;
  SCHOOL_MONTHS.forEach((m, i) => {
    const due = `${m.year}-${pad(m.month)}-05`;
    let paid = 0;
    if (i <= 2) {
      if (profile === "ok") paid = amount;
      else if (profile === "late2") paid = i === 0 ? amount : 0;
      else if (profile === "partial") paid = i < 2 ? amount : Math.round(amount / 2 / 500) * 500;
      else paid = i < 2 ? amount : 0;
    }
    push(`m${i + 1}`, "mensualite", `Mensualité de ${m.label} ${m.year}`, due, amount, paid);
  });
}