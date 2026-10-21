import type { Plan, Subscription, SubscriptionStatus } from "@/types";
import { plans } from "@/data/plans";
import { TODAY_ISO } from "@/data/school";
import { computeSubscriptionInfo, type SubscriptionInfo } from "@/utils/subscription";
import { db, respond, schoolOf, studentsOf } from "./db";

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

/**
 * L'achat en ligne (mobile money) est retiré pour l'instant : l'activation
 * d'un abonnement se fait manuellement, côté support (insertion SQL dans
 * `subscriptions`). Cette page reste en lecture seule pour le directeur.
 */