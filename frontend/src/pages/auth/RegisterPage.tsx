import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Icon } from "@/components/ui/Icon";
import { DirectorSignupForm } from "@/features/auth/DirectorSignupForm";
import { MatriculeStep } from "@/features/auth/MatriculeStep";
import { ParentSignupForm } from "@/features/auth/ParentSignupForm";
import { RoleChoice } from "@/features/auth/RoleChoice";
import { StudentSignupForm } from "@/features/auth/StudentSignupForm";
import { formatMatriculeInput } from "@/utils/matricule";
import type { Role, School } from "@/types";

/**
 * /inscription — trois parcours : directeur (direct), élève et parent (matricule d'abord).
 * Le lien partagé par l'école (?matricule=X7K9Q) pré-remplit le champ.
 * Le paramètre ?plan=essentiel|premium détermine la formule activée à
 * l'inscription (découverte par défaut, Premium depuis la page Tarifs).
 */
export default function RegisterPage() {
  const [params] = useSearchParams();
  const [role, setRole] = useState<Role | null>(null);
  const [school, setSchool] = useState<School | null>(null);

  const prefill = formatMatriculeInput(params.get("matricule") ?? "");
  const plan = params.get("plan") === "premium" ? "premium" : "essentiel";
  const isParent = role === "parent";

  return (
    <AuthLayout
      title={role ? (role === "directeur" ? "Créer votre école" : isParent ? "Espace parent" : "Espace élève") : "Créer votre compte"}
      subtitle="Directeur, élève ou parent : choisissez votre situation, l'inscription prend moins de 3 minutes."
      showVisual={false}
      backgroundImage
    >
      <div className="space-y-5">
        {!role && <RoleChoice value={role} onChange={setRole} />}

        {role === "directeur" && <DirectorSignupForm plan={plan} />}

        {(role === "eleve" || role === "parent") && !school && <MatriculeStep initial={prefill} onFound={setSchool} onBack={() => setRole(null)} />}

        {role === "eleve" && school && <StudentSignupForm school={school} onBack={() => setSchool(null)} />}
        {role === "parent" && school && <ParentSignupForm school={school} onBack={() => setSchool(null)} />}

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