import { Link } from "react-router-dom";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { useAuth } from "@/context/AuthContext";
import { useSchool } from "@/context/SchoolContext";
import { CYCLE_LABELS } from "@/data/school";
import { cn } from "@/utils/cn";

const STEPS = ["Situation", "Vérification", "Informations"];

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-lime-soft text-forest">
        <Icon name={icon} className="text-[18px]" />
      </span>
      <div className="min-w-0">
        <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</dt>
        <dd className="mt-0.5 break-words text-sm font-semibold text-ink">{value}</dd>
      </div>
    </div>
  );
}

/** Écran post-inscription du directeur : vérification du compte et des informations de l'école. */
export default function VerificationInformationsPage() {
  const { user } = useAuth();
  const school = useSchool();

  if (!user) return null;

  const cycles = school.school?.cycles ?? school.settings?.cycles ?? [];
  const schoolName = school.school?.name ?? school.settings?.name ?? school.schoolName;
  const city = school.school?.city ?? "";
  const cyclesLabel = cycles.map((c) => CYCLE_LABELS[c]).join(", ");
  const loadingValue = "Chargement…";

  return (
    <AuthLayout
      title="Vérification et Informations"
      subtitle="Relisez les informations de votre compte et de votre école avant de choisir votre formule."
      visualTitle={
        <>
          Votre école, <span className="font-serif font-semibold italic text-lime">prête à démarrer</span>.
        </>
      }
      visualText="Vérifiez vos informations, puis activez votre abonnement pour générer le matricule de votre école."
    >
      <div className="space-y-5">
        <ol className="flex gap-2" aria-label="Étapes de l'inscription">
          {STEPS.map((step, i) => {
            const done = i === 0;
            const active = i === 1;
            return (
              <li
                key={step}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "flex flex-1 items-center gap-2 rounded-full px-3 py-2 text-xs font-bold",
                  active ? "bg-forest text-white" : done ? "bg-lime text-forest" : "bg-mist text-neutral-500",
                )}
              >
                <span className={cn("grid size-6 shrink-0 place-items-center rounded-full text-[11px]", active ? "bg-lime text-forest" : "bg-white")}>
                  {done ? <Icon name="check" className="text-[14px]" /> : i + 1}
                </span>
                <span className="truncate">{step}</span>
              </li>
            );
          })}
        </ol>

        <div className="flex items-start gap-3 rounded-2xl bg-lime-soft p-4 text-forest">
          <Icon name="verified_user" fill className="text-[24px]" />
          <div>
            <p className="font-bold">Compte directeur créé</p>
            <p className="mt-1 text-sm">Votre école et votre compte sont enregistrés. Vérifiez les informations ci-dessous.</p>
          </div>
        </div>

        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-ink">Vérification</h2>
              <p className="mt-1 text-sm text-neutral-600">Les éléments indispensables à la création de votre espace.</p>
            </div>
            <Badge tone="success">Compte actif</Badge>
          </div>
          <ul className="mt-5 space-y-3 text-sm">
            {[
              "Compte directeur créé",
              "École enregistrée",
              cycles.length > 0 ? `${cycles.length} cycle${cycles.length > 1 ? "s" : ""} sélectionné${cycles.length > 1 ? "s" : ""}` : "Cycles à compléter",
            ].map((label) => (
              <li key={label} className="flex items-center gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-lime text-forest">
                  <Icon name="check" className="text-[16px]" />
                </span>
                <span className="font-medium text-neutral-700">{label}</span>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex items-start gap-2 rounded-2xl bg-mist p-4 text-sm text-neutral-600">
            <Icon name="key" className="text-[20px] text-forest" />
            <p>
              Matricule de l'école : <strong className="text-forest">en attente d'activation</strong>. Il sera généré après l'activation de votre
              abonnement.
            </p>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-bold text-ink">Informations</h2>
          <p className="mt-1 text-sm text-neutral-600">Ces informations ont été enregistrées lors de la création de votre compte.</p>
          <dl className="mt-5 grid gap-5 sm:grid-cols-2">
            <InfoRow icon="badge" label="Directeur" value={`${user.firstName} ${user.lastName}`} />
            <InfoRow icon="mail" label="Adresse e-mail" value={user.email} />
            <InfoRow icon="phone" label="Téléphone" value={user.phone || "—"} />
            <InfoRow icon="school" label="École" value={school.loading ? loadingValue : schoolName || "—"} />
            <InfoRow icon="location_on" label="Ville" value={school.loading ? loadingValue : city || "—"} />
            <InfoRow icon="stairs" label="Cycles" value={school.loading ? loadingValue : cyclesLabel || "—"} />
          </dl>
          <div className="mt-5 flex items-start gap-2 border-t border-neutral-100 pt-4 text-xs text-neutral-500">
            <Icon name="edit" className="text-[16px]" />
            <p>
              Une information à corriger ?{" "}
              <Link to="/app/parametres" className="font-semibold text-forest underline-offset-4 hover:underline">
                Modifiez-la dans vos paramètres
              </Link>
              .
            </p>
          </div>
        </Card>

        <div className="flex flex-col gap-3 sm:flex-row">
          <LinkButton to="/app/abonnement" variant="dark" icon="workspace_premium" className="flex-1">
            Tout est correct, continuer
          </LinkButton>
          <LinkButton to="/app/parametres" variant="outline" icon="edit" className="flex-1">
            Modifier mes informations
          </LinkButton>
        </div>
      </div>
    </AuthLayout>
  );
}
