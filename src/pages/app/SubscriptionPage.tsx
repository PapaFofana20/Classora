import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { AsyncView } from "@/components/ui/AsyncView";
import { CheckoutFlow } from "@/features/subscription/CheckoutFlow";
import { MatriculeCard } from "@/features/subscription/MatriculeCard";
import { PaymentReceipt } from "@/features/subscription/PaymentReceipt";
import { PlanCard } from "@/features/subscription/PlanCard";
import { useAuth } from "@/context/AuthContext";
import { useSchool } from "@/context/SchoolContext";
import { useToast } from "@/context/ToastContext";
import { useAsync } from "@/hooks/useAsync";
import { getPlans } from "@/services/subscriptionService";
import { renew, type PurchaseResult } from "@/services/subscriptionService";
import { getSchoolOverview } from "@/services/schoolService";
import type { Plan } from "@/types";
import { cn } from "@/utils/cn";
import { formatDate } from "@/utils/format";
import { STATUS_LABELS, STATUS_TONES } from "@/utils/subscription";

const STEPS = ["Compte", "Formule", "Paiement", "Matricule"];

/** /app/abonnement — visible par le directeur uniquement. */
export default function SubscriptionPage() {
  const { schoolId } = useAuth();
  const school = useSchool();
  const { toast } = useToast();
  const navigate = useNavigate();
  const plans = useAsync(getPlans, []);
  const overview = useAsync(() => getSchoolOverview(schoolId), [schoolId]);

  const [cycle, setCycle] = useState<"monthly" | "yearly">("yearly");
  const [selected, setSelected] = useState<Plan["id"] | null>(null);
  const [checkout, setCheckout] = useState(false);
  const [receipt, setReceipt] = useState<PurchaseResult | null>(null);
  const [renewing, setRenewing] = useState(false);

  const info = school.status;
  const currentPlanId = school.plan?.id;

  useEffect(() => {
    if (receipt) setSelected(null);
  }, [receipt]);

  const paid = Boolean(receipt) || info === "ACTIF" || info === "EXPIRE_BIENTOT";
  const activeStep = receipt ? 4 : paid ? 4 : checkout ? 3 : selected ? 2 : 1;

  const onPaid = (result: PurchaseResult) => {
    setReceipt(result);
    school.reload();
    toast("Abonnement actif. Votre matricule d'école est disponible.");
  };

  const doRenew = async () => {
    setRenewing(true);
    try {
      const result = await renew(schoolId, "yearly");
      setReceipt(result);
      school.reload();
      toast("Abonnement renouvelé pour un an.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Renouvellement impossible.", "error");
    } finally {
      setRenewing(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Abonnement Classora"
        subtitle="Visible et achetable uniquement par le directeur de l'école."
        actions={
          receipt ? (
            <LinkButton to="/app" icon="dashboard" variant="dark">
              Accéder à mon tableau de bord
            </LinkButton>
          ) : paid ? (
            <Button icon="refresh" variant="dark" loading={renewing} onClick={() => void doRenew()}>
              Renouveler pour 1 an
            </Button>
          ) : undefined
        }
      />

      {/* Barre de progression : Compte, Formule, Paiement, Matricule */}
      <ol className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Étapes de l'abonnement">
        {STEPS.map((s, i) => {
          const index = i + 1;
          const state = activeStep > index ? "done" : activeStep === index ? "current" : "todo";
          return (
            <li key={s} aria-current={state === "current" ? "step" : undefined} className={cn("flex items-center gap-2 rounded-full px-3 py-2.5 text-xs font-bold", state === "done" ? "bg-lime text-forest" : state === "current" ? "bg-forest text-white" : "bg-white text-neutral-500")}>
              <span className={cn("grid size-6 shrink-0 place-items-center rounded-full text-[11px]", state === "current" ? "bg-lime text-forest" : "bg-white text-forest")}>{state === "done" ? <Icon name="check" className="text-[14px]" /> : index}</span>
              <span className="truncate">{s}</span>
            </li>
          );
        })}
      </ol>

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
              {info === "AUCUN" ? "Aucun abonnement : choisissez une formule ci-dessous pour activer votre école et obtenir votre matricule." : `Échéance le ${formatDate(school.endsAt ?? undefined)}`}
            </p>
          )}
          {school.studentLimit !== null && info !== "AUCUN" && (
            <p className="mt-1 text-sm text-neutral-600">
              Élèves actifs : <strong>{school.activeStudents}</strong> / {school.studentLimit}
              {school.limitReached && <Badge tone="danger" className="ml-2">Limite atteinte</Badge>}
            </p>
          )}
        </Card>

        {receipt && (
          <div className="space-y-4">
            <Card className="text-center">
              <span className="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-leaf text-white">
                <Icon name="check_circle" fill className="text-[36px]" />
              </span>
              <h2 className="text-2xl font-extrabold text-forest">Votre matricule d'école</h2>
              <p className="mt-2 text-sm text-neutral-600">Communiquez-le à vos élèves et parents : il leur permet de créer leur compte.</p>
              <p className="mt-5 inline-block rounded-2xl bg-forest px-6 py-4 text-4xl font-extrabold tracking-[0.4em] text-lime sm:text-5xl">{receipt.matricule}</p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <Button
                  icon="content_copy"
                  onClick={() => {
                    void navigator.clipboard.writeText(receipt.matricule);
                    toast("Matricule copié.");
                  }}
                >
                  Copier le matricule
                </Button>
                <Button variant="dark" icon="dashboard" onClick={() => navigate("/app")}>
                  Accéder à mon tableau de bord
                </Button>
              </div>
            </Card>
            <div className="grid gap-4 lg:grid-cols-2">
              {overview.data?.school && <MatriculeCard school={overview.data.school} canManage onChanged={school.reload} />}
              <PaymentReceipt result={receipt} />
            </div>
          </div>
        )}

        {!receipt && (
          <>
            <div className="flex justify-center">
              <div className="inline-flex rounded-full bg-white p-1 shadow-card" role="group" aria-label="Période de facturation">
                <button type="button" onClick={() => setCycle("monthly")} aria-pressed={cycle === "monthly"} className={cn("min-h-11 rounded-full px-5 text-sm font-semibold transition", cycle === "monthly" ? "bg-forest text-white" : "text-forest")}>
                  Mensuel
                </button>
                <button type="button" onClick={() => setCycle("yearly")} aria-pressed={cycle === "yearly"} className={cn("min-h-11 rounded-full px-5 text-sm font-semibold transition", cycle === "yearly" ? "bg-forest text-white" : "text-forest")}>
                  Annuel <Badge tone="lime" className="ml-2">-2 mois</Badge>
                </button>
              </div>
            </div>
            <AsyncView state={plans} skeleton={<div className="grid gap-4 lg:grid-cols-4"><Skeleton className="h-96 w-full" /><Skeleton className="h-96 w-full" /><Skeleton className="h-96 w-full" /><Skeleton className="h-96 w-full" /></div>}>
              {(list) => (
                <div className="grid gap-4 lg:grid-cols-4">
                  {list.map((p) => (
                    <PlanCard key={p.id} plan={p} cycle={cycle} selected={selected === p.id} current={p.id === currentPlanId} onSelect={() => setSelected(p.id)} />
                  ))}
                </div>
              )}
            </AsyncView>
            {selected && !paid && (
              <div className="sticky bottom-24 z-20 flex justify-center lg:bottom-6">
                <Button size="lg" variant="dark" icon="lock" onClick={() => setCheckout(true)}>
                  Payer et générer mon matricule
                </Button>
              </div>
            )}
            {paid && overview.data?.school && <MatriculeCard school={overview.data.school} canManage onChanged={school.reload} />}
          </>
        )}
      </div>

      {selected && plans.data && (
        <CheckoutFlow open={checkout} schoolId={schoolId} schoolName={school.schoolName} plan={plans.data.find((p) => p.id === selected)!} cycle={cycle} onClose={() => setCheckout(false)} onPaid={onPaid} />
      )}
    </>
  );
}

