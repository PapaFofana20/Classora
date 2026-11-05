import { Link } from "react-router-dom";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Icon } from "@/components/ui/Icon";
import { DirectorSignupForm } from "@/features/auth/DirectorSignupForm";

/**
 * /inscription/premium — inscription Premium (dirigée par le bouton « Choisir
 * Premium » de la page tarifs). Même formulaire que le parcours directeur, mais
 * sans restriction : un ou plusieurs cycles, limite portée à 600 élèves et
 * abonnement Premium activé dès la création du compte (migration 00033).
 */
export default function PremiumRegisterPage() {
  return (
    <AuthLayout
      title="Créer votre école — Premium"
      subtitle="Le formulaire complet de votre établissement : tous les cycles, élèves illimités, toutes les fonctionnalités activées pendant un an."
      showVisual={false}
      backgroundImage
    >
      <div className="space-y-5">
        <DirectorSignupForm variant="premium" />
        <p className="flex items-start gap-2 pt-2 text-xs text-neutral-500">
          <Icon name="info" className="text-[16px]" />
          Les comptes du personnel (enseignants, secrétaires, économes et surveillants) sont créés uniquement par la direction de l'école.
        </p>
        <p className="text-center text-sm text-neutral-600">
          Déjà inscrit ?{" "}
          <Link to="/connexion" className="font-bold text-forest underline-offset-4 hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
