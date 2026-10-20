import type { PayMethod, Plan, Subscription, SubscriptionStatus } from "@/types";
import { plans, planById } from "@/data/plans";
import { TODAY_ISO } from "@/data/school";
import { computeSubscriptionInfo, type SubscriptionInfo } from "@/utils/subscription";
import { isValidSnPhone } from "@/utils/format";
import { db, hydrate, respond, schoolOf, studentsOf } from "./db";
import { callFunction } from "@/lib/functions";

/** Dernière subscription connue d'une école (la plus récente). */
export function lastSubscription(schoolId: string): Subscription | null {
  const list = db.subscriptions.filter((s) => s.schoolId === schoolId).sort((a, b) => b.endsAt.localeCompare(a.endsAt));
  return list[0] ?? null;
}

/** Information d'abonnement d'une école (calcul synchrone, utilisé par les gardes). */
export function subscriptionInfoOf(schoolId: string, todayIso: string = TODAY_ISO): SubscriptionInfo {
  return computeSubscriptionInfo(lastSubscription(schoolId), schoolOf(schoolId), studentsOf(schoolId).length, todayIso);
}

export function statusOf(schoolId: string): SubscriptionStatus {
  return subscriptionInfoOf(schoolId).status;
}

export const getPlans = (): Promise<Plan[]> => respond(() => plans, 200, 400);

export const getStatus = (schoolId: string, todayIso: string = TODAY_ISO): Promise<SubscriptionInfo> => respond(() => subscriptionInfoOf(schoolId, todayIso));

export const listSubscriptions = (schoolId: string): Promise<Subscription[]> =>
  respond(() => db.subscriptions.filter((s) => s.schoolId === schoolId).sort((a, b) => b.paidAt.localeCompare(a.paidAt)));

export interface PurchaseInput {
  schoolId: string;
  planId: Plan["id"];
  /** Mensuel ou annuel. */
  cycle: "monthly" | "yearly";
  method: Exclude<PayMethod, "especes">;
  phone: string;
}

export interface PurchaseResult {
  subscription: Subscription;
  plan: Plan;
  amount: number;
  /** Matricule de l'école — généré au premier paiement réussi, puis conservé. */
  matricule: string;
  /** Vrai si le matricule vient d'être créé par ce paiement. */
  matriculeCreated: boolean;
  schoolName: string;
  paidAt: string;
  /** Même valeur que `paidAt`, nommée pour le reçu. */
  paidAtIso: string;
}

interface StartTx {
  reference: string;
  amount: number;
  method: Exclude<PayMethod, "especes">;
  status: string;
}

interface ConfirmTx {
  matricule?: string | null;
  matriculeCreated?: boolean;
  amount?: number;
}

/** Sandbox : confirmation directe du paiement créé par start-subscription. */
const WEBHOOK_SECRET = (import.meta.env.VITE_WEBHOOK_SECRET as string | undefined) ?? "scolia-dev-secret";

async function startSubscriptionTx(input: PurchaseInput): Promise<StartTx> {
  return (await callFunction("start-subscription", {
    planId: input.planId,
    cycle: input.cycle,
    method: input.method,
    phone: input.phone.trim(),
  })) as StartTx;
}

async function confirmSubscription(reference: string, method: string): Promise<ConfirmTx> {
  return (await callFunction("payment-webhook", {
    provider: method,
    reference,
    status: "succeeded",
    secret: WEBHOOK_SECRET,
  })) as ConfirmTx;
}

/**
 * Achat via Edge Functions : start-subscription (transaction PENDING, prix
 * serveur) puis paiement Wave / Orange / Free confirmé par le webhook.
 * Seul le directeur peut acheter : `schoolId` doit être celui de sa session.
 * Le matricule n'est généré qu'au premier paiement réussi, jamais après.
 */
export const purchase = (actorSchoolId: string, input: PurchaseInput): Promise<PurchaseResult> =>
  (async () => {
    if (schoolOf(input.schoolId)?.id !== actorSchoolId) throw new Error("Vous ne pouvez acheter un abonnement que pour votre propre école.");
    if (!isValidSnPhone(input.phone)) throw new Error("Numéro invalide. Format attendu : 77 123 45 67.");
    const tx = await startSubscriptionTx(input);
    let confirm: ConfirmTx = {};
    try {
      confirm = await confirmSubscription(tx.reference, tx.method);
    } catch (e) {
      // Transaction créée mais confirmation échouée : l'inscription reste
      // en attente côté serveur ; l'école peut retenter depuis la page.
      throw e;
    }
    await Promise.all([hydrate("subscriptions"), hydrate("schools")]);
    const school = schoolOf(actorSchoolId);
    if (!school) throw new Error("École introuvable.");
    const subscription = lastSubscription(actorSchoolId);
    if (!subscription) throw new Error("Abonnement introuvable après paiement.");
    const paidAt = subscription.paidAt;
    return {
      subscription,
      plan: planById(subscription.plan),
      amount: typeof confirm.amount === "number" ? confirm.amount : tx.amount,
      matricule: confirm.matricule ?? school.matricule ?? "",
      matriculeCreated: confirm.matriculeCreated ?? !school.matricule,
      schoolName: school.name,
      paidAt,
      paidAtIso: paidAt,
    };
  })();