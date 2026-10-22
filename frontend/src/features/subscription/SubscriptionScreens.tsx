import type { ReactNode } from "react";
import { Button, LinkButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import type { SubscriptionStatus } from "@/types";

/** Aperçu flouté : montre ce qui sera accessible après abonnement. */
function BlurredPreview() {
  return (
    <div aria-hidden="true" className="pointer-events-none space-y-3 select-none">
      <div className="grid gap-3 sm:grid-cols-3">
        {["Effectif total", "Taux de recouvrement", "Moyenne générale"].map((l) => (
          <div key={l} className="rounded-2xl bg-white p-5 shadow-card">
            <div className="skeleton mb-4 size-10 rounded-xl" />
            <div className="skeleton mb-2 h-3 w-24 rounded" />
            <div className="skeleton h-7 w-32 rounded" />
            <p className="mt-3 text-xs text-neutral-400">{l}</p>
          </div>
        ))}
      </div>
      <div className="rounded-2xl bg-white p-5 shadow-card">
        <div className="skeleton mb-3 h-4 w-40 rounded" />
        <div className="skeleton h-32 w-full rounded-xl" />
      </div>
    </div>
  );
}

function Frame({ icon, title, children, action }: { icon: string; title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl py-6">
      <Card className="text-center">
        <span className="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-lime-soft text-forest">
          <Icon name={icon} fill className="text-[32px]" />
        </span>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">{title}</h1>
        {children}
        {action}
      </Card>
    </div>
  );
}

/** Directeur sans abonnement : aperçu flouté + accès à la page Abonnement. */
export function SubscriptionRequiredScreen({ schoolName }: { schoolName: string }) {
  return (
    <div className="space-y-6">
      <Frame
        icon="workspace_premium"
        title="Choisissez une formule pour ouvrir votre école"
        action={
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <LinkButton to="/inscription/abonnement" size="lg" icon="workspace_premium">
              Choisir une formule
            </LinkButton>
            <LinkButton to="/app/parametres" size="lg" variant="outline" icon="settings">
              Mon profil
            </LinkButton>
          </div>
        }
      >
        <p className="mx-auto mt-3 max-w-xl text-sm text-neutral-600">
          {schoolName ? `${schoolName} est presque prêt. ` : ""}Un abonnement active les classes, les notes, les bulletins, les paiements et le matricule d'école.
        </p>
      </Frame>
      <div className="relative">
        <div className="pointer-events-none select-none blur-[6px]">
          <BlurredPreview />
        </div>
        <p className="mt-4 text-center text-sm font-medium text-neutral-500">Le tableau de bord complet s'ouvre dès le paiement confirmé.</p>
      </div>
    </div>
  );
}

/** École expirée depuis plus de 7 jours : accès fermé. */
export function RenewScreen({ schoolName, isDirector }: { schoolName: string; status: SubscriptionStatus; isDirector: boolean }) {
  return (
    <Frame
      icon={isDirector ? "workspace_premium" : "support_agent"}
      title={isDirector ? "Renouvelez votre abonnement" : "Contactez votre école"}
      action={
        isDirector ? (
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <LinkButton to="/inscription/abonnement" size="lg" icon="workspace_premium">
              Renouveler maintenant
            </LinkButton>
            <LinkButton to="/app/parametres" size="lg" variant="outline" icon="settings">
              Mon profil
            </LinkButton>
          </div>
        ) : (
          <p className="mt-4 text-sm font-medium text-forest">L'accès à Espace École est temporairement fermé. Merci de contacter votre école.</p>
        )
      }
    >
      <p className="mx-auto mt-3 max-w-xl text-sm text-neutral-600">
        {schoolName ? `L'abonnement de ${schoolName} ` : "L'abonnement de votre école "}a expiré. {isDirector ? "Vos données sont conservées : le renouvellement les rend accessibles immédiatement." : "Vos données sont conservées et réapparaîtront après le renouvellement de l'école."}
      </p>
    </Frame>
  );
}

/** Message générique pour les rôles non-directeurs dont l'école est bloquée. */
export function ContactSchoolScreen({ schoolName }: { schoolName: string }) {
  return (
    <Frame icon="support_agent" title="Contactez votre école">
      <p className="mx-auto mt-3 max-w-xl text-sm text-neutral-600">
        {schoolName} n'accepte plus les accès pour le moment. L'espace École est réactivé dès que l'abonnement de l'école est renouvelé.
      </p>
      <div className="mt-6">
        <Button variant="outline" icon="logout" onClick={() => window.location.assign("/connexion")}>
          Se déconnecter
        </Button>
      </div>
    </Frame>
  );
}