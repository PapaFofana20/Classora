import { subscriptionInfoOf } from "@/services/subscriptionService";
import type { PlanId } from "@/types";

/**
 * Fonctionnalités premium gatees par plan d'abonnement.
 * Basé sur les features listées dans data/plans.ts
 */
export type FeatureKey =
  /** Plans Pro+ */
  | "messaging"                 // Messagerie parents-enseignants
  | "mobile_payments"           // Paiements Wave / Orange Money / Free Money
  | "auto_reminders"            // Rappels automatiques des impayés
  | "scheduling"                // Affectations et emplois du temps
  /** Plans Premium+ */
  | "staff_accounts"            // Comptes économe, secrétaire, surveillant
  | "data_export"               // Export des données et rapports
  /** Plans Illimité */
  | "multi_campus";             // Multi-sièges / multi-campus

/** Ordre des plans pour la comparaison */
const PLAN_ORDER: PlanId[] = ["essentiel", "pro", "premium", "illimite"];

/** Niveau minimum requis pour chaque fonctionnalité */
const FEATURE_REQUIREMENTS: Record<FeatureKey, PlanId> = {
  messaging: "pro",
  mobile_payments: "pro",
  auto_reminders: "pro",
  scheduling: "pro",
  staff_accounts: "premium",
  data_export: "premium",
  multi_campus: "illimite",
};

/**
 * Vérifie si une fonctionnalité est disponible pour l'école actuelle.
 * À utiliser côté client pour masquer/désactiver des UI.
 */
export function hasFeature(feature: FeatureKey): boolean {
  const info = subscriptionInfoOf("");
  if (!info.plan) return false; // Aucun abonnement = plan essentiel par défaut ?
  
  const currentPlanIndex = PLAN_ORDER.indexOf(info.plan.id as PlanId);
  const requiredPlanIndex = PLAN_ORDER.indexOf(FEATURE_REQUIREMENTS[feature]);
  
  // Si le plan actuel n'est pas dans la liste (ex: plan custom), on autorise par sécurité
  if (currentPlanIndex === -1) return true;
  
  return currentPlanIndex >= requiredPlanIndex;
}

/**
 * Vérifie si une fonctionnalité est disponible pour une école donnée.
 * Pour usage dans les services (côté serveur ou client avec schoolId).
 */
export function hasFeatureForSchool(schoolId: string, feature: FeatureKey): boolean {
  const info = subscriptionInfoOf(schoolId);
  if (!info.plan) return false;
  
  const currentPlanIndex = PLAN_ORDER.indexOf(info.plan.id as PlanId);
  const requiredPlanIndex = PLAN_ORDER.indexOf(FEATURE_REQUIREMENTS[feature]);
  
  if (currentPlanIndex === -1) return true;
  
  return currentPlanIndex >= requiredPlanIndex;
}

/**
 * Retourne le label du plan requis pour une fonctionnalité.
 * Utile pour les messages d'erreur.
 */
export function getRequiredPlanLabel(feature: FeatureKey): string {
  const planId = FEATURE_REQUIREMENTS[feature];
  const plan = PLAN_ORDER.find(p => p === planId);
  if (!plan) return "Premium";
  
  const labels: Record<PlanId, string> = {
    essentiel: "Plan découverte",
    pro: "Pro",
    premium: "Premium",
    illimite: "Illimité",
  };
  return labels[planId] ?? "Premium";
}

/**
 * Vérifie et lève une erreur si la fonctionnalité n'est pas disponible.
 * À utiliser dans les actions critiques (création de compte staff, etc.)
 */
export function requireFeature(feature: FeatureKey, schoolId?: string): void {
  const has = schoolId ? hasFeatureForSchool(schoolId, feature) : hasFeature(feature);
  if (!has) {
    const planLabel = getRequiredPlanLabel(feature);
    throw new Error(`Cette fonctionnalité nécessite le plan ${planLabel} ou supérieur.`);
  }
}

/**
 * Hook React pour vérifier une fonctionnalité dans un composant.
 */
export function useFeature(feature: FeatureKey): boolean {
  // Note: dans un vrai hook, on utiliserait le contexte d'abonnement
  // Pour l'instant, on appelle la fonction synchrone
  return hasFeature(feature);
}