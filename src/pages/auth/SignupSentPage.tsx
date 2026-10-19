import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { DEMO_ACCOUNTS, DEMO_PARENT_CODES } from "@/data/users";
import { SCHOOLS } from "@/data/schools";

/** /inscription-envoyee : confirmation après une inscription élève ou parent. */
export default function SignupSentPage() {
  const [params] = useSearchParams();
  const role = params.get("role");
  const child = params.get("enfant");
  const isParent = role === "parent";

  return (
    <div className="flex min-h-screen items-center justify-center bg-mist px-4 py-10">
      <Card className="w-full max-w-2xl text-center">
        <span className="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-lime text-forest">
          <Icon name="mark_email_read" fill className="text-[32px]" />
        </span>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Demande envoyée</h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-neutral-600">
          {isParent ? "Votre école doit valider votre inscription." : "Votre école doit valider votre inscription."} Vous recevrez un accès à votre espace dès validation par la direction.
        </p>
        {child && (
          <p className="mx-auto mt-4 w-fit rounded-full bg-lime-soft px-4 py-2 text-sm font-semibold text-forest">Enfant rattaché : {child}</p>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to="/connexion" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-forest px-6 text-sm font-semibold text-white hover:bg-forest-600">
            Retour à la connexion
          </Link>
          <Link to="/" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-forest/20 bg-white px-6 text-sm font-semibold text-forest hover:bg-lime-soft">
            Voir le site
          </Link>
        </div>
        <p className="mt-8 border-t border-neutral-100 pt-6 text-left text-xs text-neutral-500">
          <strong className="text-ink">Aide à la démonstration</strong>
          <br />
          Matricules d'écoles : {SCHOOLS.filter((s) => s.matricule).map((s) => `${s.name} → ${s.matricule}`).join(" · ")}
          <br />
          Codes enfants du parent de démonstration : {DEMO_PARENT_CODES.join(" · ") || "—"}
          <br />
          Comptes de démonstration : {DEMO_ACCOUNTS.length} (mot de passe {DEMO_ACCOUNTS.length > 0 ? "demo1234" : ""}).
        </p>
        <Button variant="ghost" className="mt-4" onClick={() => window.scrollTo({ top: 0 })}>
          <Icon name="keyboard" className="text-[18px]" />
          Astuce : utilisez le matricule affiché ci-dessus pour créer un compte élève.
        </Button>
      </Card>
    </div>
  );
}