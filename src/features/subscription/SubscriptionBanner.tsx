import { Link } from "react-router-dom";
import { Icon } from "@/components/ui/Icon";
import { useSchool } from "@/context/SchoolContext";
import { cn } from "@/utils/cn";

/**
 * Bandeau d'état de l'abonnement affiché en haut du tableau de bord :
 * alerte 7 jours avant l'échéance, puis mode lecture seule.
 */
export function SubscriptionBanner() {
  const school = useSchool();
  if (school.missing || school.blocked) return null;

  const readOnly = school.readOnly;
  const warn = school.status === "EXPIRE_BIENTOT";
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