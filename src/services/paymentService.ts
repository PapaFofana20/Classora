import type { PayMethod, Payment, SessionUser } from "@/types";
import { ensure } from "./access";
import { hydrate, paymentsOf, respond, studentsOf } from "./db";
import { supabase } from "@/lib/supabase";
import { callFunction } from "@/lib/functions";
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

/** Résultat d'une demande de paiement mobile money. */
export interface InstallmentPaymentResult {
  /** Échéances concernées, relues depuis le serveur. */
  rows: PaymentRow[];
  /** `succeeded` (bac à sable) ou `pending` : la confirmation vient du prestataire. */
  status: "succeeded" | "pending" | "rien_a_payer";
  /** Références des transactions ouvertes chez le prestataire. */
  references: string[];
  /** Message à afficher à la famille. */
  message: string;
}

/** Paiement mobile money par un parent ou un élève (via Edge Function). */
export function payInstallments(
  actor: SessionUser,
  paymentIds: string[],
  method: PayMethod,
  phone: string,
): Promise<InstallmentPaymentResult> {
  return (async () => {
    ensure(method !== "especes", "Moyen de paiement invalide.");
    const res = await callFunction<{ status?: string; references?: string[]; message?: string }>("pay-installment", {
      paymentIds,
      method,
      phone,
    });
    await hydrate("payments");
    return {
      rows: paymentsOf(actor.schoolId).filter((p) => paymentIds.includes(p.id)).map(toRow),
      status: (res?.status as InstallmentPaymentResult["status"]) ?? "pending",
      references: res?.references ?? [],
      message: res?.message ?? "",
    };
  })();
}

/** Encaissement espèces (économe / direction) via RPC serveur. */
export function recordCashPayment(actor: SessionUser, paymentId: string, amount: number): Promise<PaymentRow> {
  return (async () => {
    const { error } = await supabase.rpc("record_cash_payment", {
      p_payment_id: paymentId,
      p_amount: amount,
    });
    if (error) {
      if (error.message.includes("Montant invalide.")) throw new Error("Montant invalide.");
      if (error.message.includes("Échéance introuvable.")) throw new Error("Échéance introuvable.");
      if (error.message.includes("lecture seule")) throw new Error(error.message);
      throw new Error(error.message);
    }
    await hydrate("payments");
    const p = paymentsOf(actor.schoolId).find((x) => x.id === paymentId);
    ensure(!!p, "Échéance introuvable.");
    return toRow(p as Payment);
  })();
}

/** Relances impayés (direction / économe) : RPC + annonce Économat. */
export function sendReminders(studentIds: string[]): Promise<number> {
  return (async () => {
    const { data, error } = await supabase.rpc("send_reminders", {
      p_student_ids: studentIds,
    });
    if (error) throw new Error(/Seuls l/i.test(error.message) ? "Seuls l'économe et la direction envoient les relances." : error.message);
    await hydrate("announcements");
    return Number(data ?? studentIds.length);
  })();
}