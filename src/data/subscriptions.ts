import type { Subscription } from "@/types";
import { SCHOOL_IDS } from "./schools";

/**
 * Abonnements de démonstration (référence : 15/12/2026).
 * Le statut affiché est recalculé par services/subscriptionService à partir
 * de `endsAt` — les valeurs ci-dessous ne servent qu'à l'état initial :
 *   • Sainte Marie  → actif jusqu'au 31/08/2027
 *   • Cheikh Anta   → se termine dans 5 jours (bandeau d'alerte)
 *   • Horizon       → expiré depuis 6 jours (lecture seule pendant 7 jours)
 *   • Teranga       → expiré depuis 25 jours (accès bloqué)
 */
export const subscriptions: Subscription[] = [
  {
    id: "sub-sm-2027",
    schoolId: SCHOOL_IDS.sainteMarie,
    plan: "pro",
    status: "ACTIF",
    startsAt: "2026-09-01",
    endsAt: "2027-08-31",
    studentLimit: 300,
    amountPaid: 300000,
    paymentRef: "WV-4471-8820",
    method: "wave",
    paidAt: "2026-09-01T10:12",
  },
  {
    id: "sub-ca-2026",
    schoolId: SCHOOL_IDS.cheikhAnta,
    plan: "essentiel",
    status: "EXPIRE_BIENTOT",
    startsAt: "2026-01-10",
    endsAt: "2026-12-20",
    studentLimit: 100,
    amountPaid: 150000,
    paymentRef: "OM-2093-5517",
    method: "orange_money",
    paidAt: "2026-01-10T16:41",
  },
  {
    id: "sub-ho-2026",
    schoolId: SCHOOL_IDS.horizon,
    plan: "essentiel",
    status: "EXPIRE",
    startsAt: "2025-12-09",
    endsAt: "2026-12-09",
    studentLimit: 100,
    amountPaid: 150000,
    paymentRef: "FM-7712-3390",
    method: "free_money",
    paidAt: "2025-12-09T09:05",
  },
  {
    id: "sub-te-2026",
    schoolId: SCHOOL_IDS.teranga,
    plan: "pro",
    status: "EXPIRE",
    startsAt: "2025-11-20",
    endsAt: "2026-11-20",
    studentLimit: 300,
    amountPaid: 300000,
    paymentRef: "WV-1180-4402",
    method: "wave",
    paidAt: "2025-11-20T11:27",
  },
];