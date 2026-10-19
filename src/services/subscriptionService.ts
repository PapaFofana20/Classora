import type { PayMethod, Plan, Subscription, SubscriptionStatus } from "@/types";
import { plans, planById, priceFor } from "@/data/plans";
import { TODAY_ISO } from "@/data/school";
import { addDaysIso } from "@/utils/dates";
import { generateMatricule } from "@/utils/matricule";
import { computeSubscriptionInfo, type SubscriptionInfo } from "@/utils/subscription";
import { isValidSnPhone } from "@/utils/format";
import { db, persist, respond, schoolOf, studentsOf, uid } from "./db";

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

const paymentRef = (method: PayMethod): string => {
  const prefix = method === "wave" ? "WV" : method === "orange_money" ? "OM" : "FM";
  const n = () => String(Math.floor(1000 + Math.random() * 8999));
  return `${prefix}-${n()}-${n()}`;
};

/**
 * Paiement simulé (Wave / Orange Money / Free Money).
 * Seul le directeur peut acheter : `schoolId` doit être celui de sa session.
 * Le matricule n'est généré qu'ici, après un paiement réussi.
 */
export const purchase = (actorSchoolId: string, input: PurchaseInput): Promise<PurchaseResult> =>
  respond(
    () => {
      if (schoolOf(input.schoolId)?.id !== actorSchoolId) throw new Error("Vous ne pouvez acheter un abonnement que pour votre propre école.");
      if (!isValidSnPhone(input.phone)) throw new Error("Numéro invalide. Format attendu : 77 123 45 67.");
      return applySubscription(input.schoolId, input.planId, input.cycle, input.method);
    },
    1200,
    1800,
  );

/** Renouvellement par le directeur : conserve le matricule, repart de la date du jour. */
export const renew = (actorSchoolId: string, cycle: "monthly" | "yearly" = "yearly"): Promise<PurchaseResult> =>
  respond(() => {
    const current = lastSubscription(actorSchoolId);
    if (!current) throw new Error("Aucun abonnement à renouveler. Choisissez une formule.");
    return applySubscription(actorSchoolId, current.plan, cycle, current.method);
  }, 900, 1400);

function applySubscription(schoolId: string, planId: Plan["id"], cycle: "monthly" | "yearly", method: PayMethod | undefined): PurchaseResult {
  const school = schoolOf(schoolId);
  if (!school) throw new Error("École introuvable.");
  const plan = planById(planId);
  const amount = priceFor(plan, cycle);
  const paidAt = `${TODAY_ISO}T${new Date().toTimeString().slice(0, 5)}`;
  const startsAt = TODAY_ISO;
  const endsAt = addDaysIso(TODAY_ISO, cycle === "yearly" ? 365 : 30);
  const previous = lastSubscription(schoolId);
  const subscription: Subscription = previous
    ? { ...previous, plan: plan.id, status: "ACTIF", startsAt, endsAt, studentLimit: plan.studentLimit, amountPaid: amount, paymentRef: paymentRef(method ?? "wave"), paidAt }
    : { id: uid("sub"), schoolId, plan: plan.id, status: "ACTIF", startsAt, endsAt, studentLimit: plan.studentLimit, amountPaid: amount, paymentRef: paymentRef(method ?? "wave"), paidAt };
  if (previous) db.subscriptions = db.subscriptions.map((s) => (s.id === subscription.id ? subscription : s));
  else db.subscriptions.push(subscription);

  // Le matricule n'existe qu'après un paiement réussi et ne change jamais ensuite.
  const matriculeCreated = !school.matricule;
  if (matriculeCreated) school.matricule = generateMatricule(db.schools.map((s) => s.matricule).filter(Boolean));
  persist();
  return { subscription, plan, amount, matricule: school.matricule, matriculeCreated, schoolName: school.name, paidAt, paidAtIso: paidAt };
}