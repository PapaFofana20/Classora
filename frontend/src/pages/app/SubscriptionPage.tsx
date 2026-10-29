import { AsyncView } from "@/components/ui/AsyncView";
import { Badge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { MatriculeCard } from "@/features/subscription/MatriculeCard";
import { PlanCard } from "@/features/subscription/PlanCard";
import { useAuth } from "@/context/AuthContext";
import { useSchool } from "@/context/SchoolContext";
import { useToast } from "@/context/ToastContext";
import { useAsync } from "@/hooks/useAsync";
import { getPlans } from "@/services/subscriptionService";
import { getSchoolOverview } from "@/services/schoolService";
import type { Plan } from "@/types";
import { formatDate } from "@/utils/format";
import { STATUS_LABELS, STATUS_TONES } from "@/utils/subscription";

// Contact unique du site public (legal.ts / landing.ts) — l'ancienne adresse
// support@classora.com n'existait nulle part ailleurs.
const EMAIL_SUPPORT = "contact@classora.sn";

/** /app/abonnement — lecture seule : l'activation se fait côté support (l'achat en ligne mobile money est retiré pour l'instant). */
export default function SubscriptionPage() {
  const { schoolId } = useAuth();
  const school = useSchool();
  const { toast } = useToast();
  const plans = useAsync(getPlans, []);
  const overview = useAsync(() => getSchoolOverview(schoolId), [schoolId]);

  const info = school.status;
  const currentPlanId = school.plan?.id;
  const active = info === "ACTIF" || info === "EXPIRE_BIENTOT";

  return (
    <>
      <PageHeader
        title="Abonnement Classora"
        subtitle="Visible uniquement par le directeur de l'école."
        actions={
          !active ? (
            <LinkButton to="/app/abonnement" icon="workspace_premium" variant="dark">
              Choisir une formule
            </LinkButton>
          ) : undefined
        }
      />

      <div className="space-y-4">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-neutral-600">{school.schoolName}</p>
              <p className="text-2xl font-extrabold">{school.settings?.name ?? "Votre école"}</p>
            </div>
            <Badge tone={STATUS_TONES[info]}>{STATUS_LABELS[info]}</Badge>
          </div>
          {school.settings && (
            <p className="mt-3 text-sm text-neutral-600">
              {info === "AUCUN" ? "Aucun abonnement actif pour le moment." : `Échéance le ${formatDate(school.endsAt ?? undefined)}`}
            </p>
          )}
          {school.studentLimit !== null && info !== "AUCUN" && (
            <p className="mt-1 text-sm text-neutral-600">
              Élèves actifs : <strong>{school.activeStudents}</strong> / {school.studentLimit}
              {school.limitReached && <Badge tone="danger" className="ml-2">Limite atteinte</Badge>}
            </p>
          )}
          {info === "AUCUN" && (
            <p className="mt-3 flex items-center gap-2 rounded-2xl bg-lime-soft p-4 text-sm font-medium text-forest">
              <Icon name="info" className="text-[20px]" />
              Le paiement en ligne (mobile money) est momentanément désactivé. Pour activer votre abonnement, contactez le support Classora : l'activation est effectuée manuellement.
            </p>
          )}
        </Card>

        <AsyncView state={plans} skeleton={<div className="grid gap-4 lg:grid-cols-4"><Skeleton className="h-96 w-full" /><Skeleton className="h-96 w-full" /><Skeleton className="h-96 w-full" /><Skeleton className="h-96 w-full" /></div>}>
          {(list) => (
            <div className="grid gap-4 lg:grid-cols-4">
              {list.map((p: Plan) => (
                <PlanCard key={p.id} plan={p} cycle="yearly" current={p.id === currentPlanId} />
              ))}
            </div>
          )}
        </AsyncView>

        {!active && (
          <div className="flex justify-center">
            <Button
              icon="support_agent"
              onClick={() => {
                void navigator.clipboard.writeText(EMAIL_SUPPORT);
                toast("Adresse du support copiée.");
              }}
            >
              Copier l'adresse du support
            </Button>
          </div>
        )}

        {active && overview.data?.school && <MatriculeCard school={overview.data.school} canManage={false} onChanged={school.reload} />}
        {!active && overview.data?.school && (
          <div className="rounded-3xl border-2 border-dashed border-forest/30 bg-white p-6 text-center">
            <h2 className="text-xl font-extrabold text-forest">Votre matricule d'école</h2>
            <p className="mt-2 text-sm text-neutral-600">Il sera affiché ici après l'activation de votre abonnement, et servira aux élèves et parents pour créer leur compte.</p>
          </div>
        )}
      </div>
    </>
  );
}
