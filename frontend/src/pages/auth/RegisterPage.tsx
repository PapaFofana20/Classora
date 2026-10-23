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
import { cn } from "@/utils/cn";

/**
 * /inscription — trois parcours : directeur (direct), élève et parent (matricule d'abord).
 * Le lien partagé par l'école (?matricule=X7K9Q) pré-remplit le champ.
 */
export default function RegisterPage() {
  const [params] = useSearchParams();
  const [role, setRole] = useState<Role | null>(null);
  const [school, setSchool] = useState<School | null>(null);

  const prefill = formatMatriculeInput(params.get("matricule") ?? "");
  const isParent = role === "parent";

  return (
    <AuthLayout
      title={role ? (role === "directeur" ? "Créer votre école" : isParent ? "Espace parent" : "Espace élève") : "Créer votre compte"}
      subtitle="Directeur, élève ou parent : choisissez votre situation, l'inscription prend moins de 3 minutes."
      showVisual={false}
    >
      <div className="space-y-5">
        <ol className="flex gap-2" aria-label="Étapes de l'inscription">
          {["Situation", "Vérification", "Informations"].map((s, i) => {
            const done = role === "directeur" ? i === 0 : !!role && (!school || !!school);
            const active = role === "directeur" ? false : role ? !!school : true;
            const index = i === 0 ? 0 : !role ? 0 : !school ? 1 : 2;
            return (
              <li
                key={s}
                aria-current={active && i === index ? "step" : undefined}
                className={cn("flex flex-1 items-center gap-2 rounded-full px-3 py-2 text-xs font-bold", i === index && active ? "bg-forest text-white" : done ? "bg-lime text-forest" : "bg-mist text-neutral-500")}
              >
                <span className={cn("grid size-6 shrink-0 place-items-center rounded-full text-[11px]", i === index && active ? "bg-lime text-forest" : "bg-white")}>{i + 1}</span>
                <span className="truncate">{s}</span>
              </li>
            );
          })}
        </ol>

        {!role && <RoleChoice value={role} onChange={setRole} />}

        {role === "directeur" && <DirectorSignupForm />}

        {(role === "eleve" || role === "parent") && !school && <MatriculeStep initial={prefill} onFound={setSchool} onBack={() => setRole(null)} />}

        {role === "eleve" && school && <StudentSignupForm school={school} onBack={() => setSchool(null)} />}
        {role === "parent" && school && <ParentSignupForm school={school} onBack={() => setSchool(null)} />}

        <p className="flex items-start gap-2 pt-2 text-xs text-neutral-500">
          <Icon name="info" className="text-[16px]" />
          Les comptes enseignants, économe et surveillant sont créés uniquement par la direction de l'école.
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