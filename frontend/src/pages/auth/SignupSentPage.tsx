import { Link, useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";

/** /inscription-envoyee : confirmation après une inscription élève ou parent. */
export default function SignupSentPage() {
  const [params] = useSearchParams();
  const role = params.get("role");
  const child = params.get("enfant");
  const childCode = params.get("code");
  const isParent = role === "parent";
  const isStudent = role === "eleve";

  const copyCode = async () => {
    if (childCode) {
      try {
        await navigator.clipboard.writeText(childCode);
      } catch {
        /* presse-papiers indisponible */
      }
    }
  };

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
        {isStudent && childCode && (
          <div className="mt-6 rounded-2xl bg-lime-soft p-4 text-left border border-lime">
            <p className="text-sm font-semibold text-forest mb-2">Code élève de votre enfant :</p>
            <div className="flex items-center gap-2">
              <span className="flex-1 font-mono text-2xl font-bold tracking-widest text-ink bg-white px-4 py-3 rounded-xl border border-neutral-200 text-center select-all">
                {childCode}
              </span>
              <Button variant="outline" icon="content_copy" onClick={copyCode} aria-label="Copier le code">
                Copier
              </Button>
            </div>
            <p className="mt-3 text-xs text-forest/80">
              Communiquez ce code à vos parents pour qu'ils puissent créer leur compte et suivre vos notes, devoirs, etc.
            </p>
          </div>
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
