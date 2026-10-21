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

export const getPlans = (): Promise<Plan[]> => respond(() => plans);

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

async function startSubscriptionTx(input: PurchaseInput): Promise<StartTx> {
  return (await callFunction("start-subscription", {
    planId: input.planId,
    cycle: input.cycle,
    method: input.method,
    phone: input.phone.trim(),
  })) as StartTx;
}

/**
 * Attend la confirmation du prestataire. La ligne `subscriptions` n'existe
 * qu'après un paiement confirmé (c'est le webhook signé qui l'écrit) : sa
 * présence est donc le signal « le paiement est passé ».
 * Le secret de signature du webhook n'est JAMAIS connu du navigateur.
 */
async function waitForPaidSubscription(schoolId: string, timeoutMs = 90_000): Promise<Subscription | null> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    await Promise.all([hydrate("subscriptions"), hydrate("schools")]);
    const sub = lastSubscription(schoolId);
    if (sub) return sub;
    if (Date.now() >= deadline) return null;
    await new Promise((r) => setTimeout(r, 1500));
  }
}

/**
 * Achat via Edge Functions : start-subscription (transaction PENDING, prix
 * serveur) puis confirmation par le prestataire (webhook signé côté serveur).
 * Seul le directeur peut acheter : `schoolId` doit être celui de sa session.
 * Le matricule n'est généré qu'au premier paiement réussi, jamais après.
 */
export const purchase = (actorSchoolId: string, input: PurchaseInput): Promise<PurchaseResult> =>
  (async () => {
    if (schoolOf(input.schoolId)?.id !== actorSchoolId) throw new Error("Vous ne pouvez acheter un abonnement que pour votre propre école.");
    if (!isValidSnPhone(input.phone)) throw new Error("Numéro invalide. Format attendu : 77 123 45 67.");
    const matriculeBefore = schoolOf(actorSchoolId)?.matricule ?? "";
    const tx = await startSubscriptionTx(input);
    const subscription = await waitForPaidSubscription(actorSchoolId);
    if (!subscription) {
      // La transaction reste PENDING côté serveur : l'école peut retenter.
      throw new Error("Le paiement n'est pas encore confirmé par le prestataire. Réessayez dans quelques instants.");
    }
    const school = schoolOf(actorSchoolId);
    if (!school) throw new Error("École introuvable.");
    const paidAt = subscription.paidAt;
    return {
      subscription,
      plan: planById(subscription.plan),
      amount: tx.amount,
      matricule: school.matricule ?? "",
      matriculeCreated: !matriculeBefore && Boolean(school.matricule),
      schoolName: school.name,
      paidAt,
      paidAtIso: paidAt,
    };
  })();