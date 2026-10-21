import type { Plan, School, Subscription, SubscriptionStatus } from "@/types";
import { planById } from "@/data/plans";
import { daysUntil } from "./dates";

/** Nombre de jours pendant lesquels l'école reste en lecture seule après l'échéance. */
export const READ_ONLY_DAYS = 7;

/** Nombre de jours d'alerte avant l'échéance. */
export const EXPIRY_WARNING_DAYS = 7;

export interface SubscriptionInfo {
  status: SubscriptionStatus;
  subscription: Subscription | null;
  plan: Plan | null;
  /** Jours restants avant l'échéance (négatif si l'abonnement est expiré). */
  daysLeft: number;
  /** École expirée depuis moins de 7 jours : consultation possible, écriture bloquée. */
  readOnly: boolean;
  /** École expirée depuis plus de 7 jours : accès bloqué. */
  blocked: boolean;
  studentLimit: number | null;
  activeStudents: number;
  /** La limite d'élèves de la formule est atteinte. */
  limitReached: boolean;
}

/**
 * Statut d'abonnement calculé à partir de la date d'échéance.
 * Fonction pure : elle ne lit pas la base, elle reçoit tout en paramètre.
 */
export function computeSubscriptionInfo(
  subscription: Subscription | null,
  _school: School | undefined,
  activeStudents: number,
  todayIso: string,
): SubscriptionInfo {
  if (!subscription) {
    return { status: "AUCUN", subscription: null, plan: null, daysLeft: 0, readOnly: false, blocked: false, studentLimit: null, activeStudents, limitReached: false };
  }
  const plan = planById(subscription.plan);
  const studentLimit = subscription.studentLimit ?? plan.studentLimit;
  const daysLeft = daysUntil(subscription.endsAt, todayIso);
  const status: SubscriptionStatus = daysLeft < 0 ? "EXPIRE" : "ACTIF";
  return {
    status,
    subscription,
    plan,
    daysLeft,
    readOnly: daysLeft < 0 && -daysLeft <= READ_ONLY_DAYS,
    blocked: daysLeft < 0 && -daysLeft > READ_ONLY_DAYS,
    studentLimit,
    activeStudents,
    limitReached: studentLimit !== null && activeStudents >= studentLimit,
  };
}

export const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  AUCUN: "Aucun abonnement",
  ACTIF: "Abonnement actif",
  EXPIRE_BIENTOT: "Abonnement bientôt expiré",
  EXPIRE: "Abonnement expiré",
};

export const STATUS_TONES: Record<SubscriptionStatus, "success" | "warning" | "danger" | "neutral"> = {
  AUCUN: "neutral",
  ACTIF: "success",
  EXPIRE_BIENTOT: "warning",
  EXPIRE: "danger",
};