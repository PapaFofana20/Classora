// Bandeau d'information sur l'essai ou l'etat de l'abonnement.

import { Link } from "react-router-dom";
import { Icon } from "@/components/ui/Icon";
import { useSchool } from "@/context/SchoolContext";
import { cn } from "@/utils/cn";

/**
 * Bandeau d'état de l'abonnement / essai affiché en haut du tableau de bord :
 * essai gratuit 14 jours, alerte 7 jours avant l'échéance, puis lecture seule.
 * L'essai est informatif (non bloquant) tant que le paiement n'est pas branché.
 */
export function SubscriptionBanner() {
  const school = useSchool();
  if (school.blocked) return null;

  // --- Essai gratuit ---
  if (school.missing && school.inTrial) {
    const urgent = school.trialDaysLeft <= 3;
    return (
      <div className={cn("no-print mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm font-medium shadow-card", urgent ? "bg-amber-50 text-amber-900" : "bg-lime-pale text-forest")}>
        <span className="flex items-center gap-3">
          <Icon name={urgent ? "schedule" : "science"} fill className="text-[22px]" />
          <span>
            <strong>Essai gratuit Classora</strong> — il reste {school.trialDaysLeft} jour(s).
            Profitez-en pour tester avec vos élèves : importez vos effectifs, créez vos classes.
          </span>
        </span>
        <span className="flex flex-wrap gap-2">
          <Link to="/app/inscription-eleve" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-forest px-4 text-sm font-semibold text-white hover:bg-forest-600">
            <Icon name="upload_file" className="text-[18px]" />
            Importer des élèves
          </Link>
          <Link to="/app/abonnement" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-forest ring-1 ring-forest/20">
            Voir les formules
          </Link>
        </span>
      </div>
    );
  }
  if (school.missing) return null;

  const readOnly = school.readOnly;
  const warn = school.status === "ACTIF" && school.daysLeft >= 0 && school.daysLeft <= 7;
  if (!warn && !readOnly) return null;

  return (
    <div
      role="status"
      className={cn(
        "no-print mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm font-medium shadow-card",
        readOnly ? "bg-red-50 text-red-900" : "bg-amber-50 text-amber-900",
      )}
    >
      <span className="flex items-center gap-3">
        <Icon name={readOnly ? "lock_clock" : "warning"} fill className="text-[22px]" />
        <span>
          {readOnly ? (
            <>
              <strong>Abonnement expiré.</strong> L'école est en lecture seule : les modifications sont désactivées pendant {Math.max(0, 7 + school.daysLeft)} jour(s).
            </>
          ) : (
            <>
              <strong>Abonnement bientôt expiré</strong> — il reste {school.daysLeft} jour(s). Le matricule reste valable, mais pensez à renouveler.
            </>
          )}
        </span>
      </span>
      <Link to="/app/abonnement" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-forest px-4 text-sm font-semibold text-white hover:bg-forest-600">
        <Icon name="workspace_premium" className="text-[18px]" />
        {readOnly ? "Renouveler maintenant" : "Renouveler"}
      </Link>
    </div>
  );
}