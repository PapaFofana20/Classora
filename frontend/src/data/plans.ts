import type { Plan } from "@/types";

/**
 * Formules d'abonnement Classora — prix en FCFA, par mois ou par an.
 * La limite `studentLimit` borne le nombre d'élèves approuvés : au-delà,
 * la direction doit changer de formule (voir services/registrationService).
 */
export const plans: Plan[] = [
  {
    id: "essentiel",
    name: "Plan découverte",
    tagline: "Pour démarrer une école",
    studentLimit: 100,
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: ["Jusqu'à 100 élèves", "Classes, notes et bulletins", "Espace parents", "Support par WhatsApp"],
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "La formule la plus choisie",
    studentLimit: 300,
    monthlyPrice: 30000,
    yearlyPrice: 300000,
    highlight: true,
    features: [
      "Jusqu'à 300 élèves",
      "Affectations et emplois du temps",
      "Paiements Wave / Orange Money / Free Money",
      "Rappels automatiques des impayés",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    tagline: "Grands établissements",
    studentLimit: null,
    monthlyPrice: 50000,
    yearlyPrice: 500000,
    features: [
      "Élèves illimités",
      "Tous les modules Pro",
      "Comptes économe, secrétaire et surveillant inclus",
      "Export des données et rapports",
      "Accompagnement dédié",
    ],
  },
  {
    id: "illimite",
    name: "Illimité",
    tagline: "Réseau scolaire",
    studentLimit: null,
    monthlyPrice: 90000,
    yearlyPrice: 900000,
    features: [
      "Élèves illimités",
      "Tous les modules Premium",
      "Multi-sièges / multi-campus",
      "Contrat annuel Engagement",
      "Responsable dédié",
    ],
  },
];

// Retrouve une formule par son id, avec repli sur la formule découverte.
export const planById = (id: Plan["id"]): Plan => plans.find((p) => p.id === id) ?? plans[0];

// Prix de la formule selon la facturation mensuelle ou annuelle.
export const priceFor = (plan: Plan, cycle: "monthly" | "yearly"): number => (cycle === "yearly" ? plan.yearlyPrice : plan.monthlyPrice);

// Libellé du plafond d'élèves d'une formule, pour les cartes tarifaires.
export const planLimitLabel = (plan: Plan): string => (plan.studentLimit === null ? "Élèves illimités" : `Jusqu'à ${plan.studentLimit} élèves`);