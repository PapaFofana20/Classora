import { Link, useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";

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
          <strong className="text-ink">Et ensuite ?</strong>
          <br />
          La direction de votre école examine la demande. Dès qu'elle est acceptée, vous
          recevez un e-mail avec votre accès personnel.
          <br />
          Vous avez utilisé l'adresse e-mail&nbsp;? Conservez-la : elle sert à vous
          identifier auprès de l'école.
        </p>
      </Card>
    </div>
  );
}
