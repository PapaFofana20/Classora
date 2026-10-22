import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Logo } from "@/components/ui/Brand";
import { Badge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs } from "@/components/ui/Tabs";
import { useAuth } from "@/context/AuthContext";
import { useSchool } from "@/context/SchoolContext";
import { useToast } from "@/context/ToastContext";
import { CYCLE_LABELS } from "@/data/school";
import { planLimitLabel, plans, priceFor } from "@/data/plans";
import { MatriculeCard } from "@/features/subscription/MatriculeCard";
import { PlanCard } from "@/features/subscription/PlanCard";
import { useAsync } from "@/hooks/useAsync";
import {
  latestSubscriptionRequest,
  refreshSchoolSubscription,
  type BillingCycle,
  type SubscriptionRequest,
} from "@/services/subscriptionService";
import type { Plan, PlanId } from "@/types";
import { cn } from "@/utils/cn";
import { formatCurrency, formatDate } from "@/utils/format";
import { generateMatricule } from "@/utils/matricule";

const SUPPORT_EMAIL = "support@classora.com";
const MIN_STUDENTS = 50;
const MAX_STUDENTS = 1500;
const STEPS = ["Inscription", "Vérification", "Abonnement", "Matricule"];

function recommendPlan(count: number): Plan {
  return plans.find((plan) => plan.studentLimit === null || count <= plan.studentLimit) ?? plans[plans.length - 1];
}

function OnboardingSteps({ current }: { current: number }) {
  return (
    <ol className="flex gap-2" aria-label="Étapes de l'inscription">
      {STEPS.map((step, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li
            key={step}
            aria-current={active ? "step" : undefined}
            className={cn(
              "flex min-w-0 flex-1 items-center gap-2 rounded-full px-3 py-2 text-xs font-bold",
              active ? "bg-forest text-white" : done ? "bg-lime text-forest" : "bg-white text-neutral-500",
            )}
          >
            <span className={cn("grid size-6 shrink-0 place-items-center rounded-full text-[11px]", active ? "bg-lime text-forest" : done ? "bg-white" : "bg-mist")}>
              {done ? <Icon name="check" className="text-[14px]" /> : index + 1}
            </span>
            <span className="truncate">{step}</span>
          </li>
        );
      })}
    </ol>
  );
}

function PriceChoice({ label, price, hint, selected, onClick }: { label: string; price: string; hint: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "rounded-2xl border-2 p-4 text-left transition-colors",
        selected ? "border-forest bg-lime-soft" : "border-neutral-200 bg-white hover:border-forest/40",
      )}
    >
      <span className="block text-xs font-bold uppercase tracking-wide text-neutral-500">{label}</span>
      <span className="mt-1 block text-xl font-extrabold text-ink">{price}</span>
      <span className="mt-1 block text-xs text-neutral-500">{hint}</span>
    </button>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-mist p-4">
      <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</dt>
      <dd className="mt-1 text-sm font-bold text-ink">{value}</dd>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.6fr)]">
      <Skeleton className="h-96 w-full rounded-2xl" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-80 w-full rounded-3xl" />
        <Skeleton className="h-80 w-full rounded-3xl" />
        <Skeleton className="h-80 w-full rounded-3xl" />
        <Skeleton className="h-80 w-full rounded-3xl" />
      </div>
    </div>
  );
}

function PaymentSimulationModal({
  isOpen,
  onClose,
  onConfirm,
  planName,
  cycle,
  amount,
  studentCount,
  busy,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  planName: string;
  cycle: BillingCycle;
  amount: number;
  studentCount: number;
  busy: boolean;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-labelledby="payment-modal-title">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between">
          <h2 id="payment-modal-title" className="text-xl font-extrabold text-ink">
            Simulation de paiement
          </h2>
          <button onClick={onClose} className="rounded-full p-1 text-neutral-400 hover:text-ink hover:bg-neutral-100" aria-label="Fermer">
            <Icon name="close" className="text-[20px]" />
          </button>
        </div>

        <div className="mt-6 space-y-4">
          <div className="rounded-2xl bg-lime-soft p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-forest-500">Récapitulatif de la simulation</p>
            <dl className="mt-3 grid gap-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-neutral-600">Formule</dt>
                <dd className="font-bold text-forest">{planName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-600">Facturation</dt>
                <dd className="font-bold text-ink">{cycle === "yearly" ? "Annuelle" : "Mensuelle"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-600">Effectif déclaré</dt>
                <dd className="font-bold text-ink">{studentCount} élèves</dd>
              </div>
              <div className="flex justify-between border-t border-forest/20 pt-2">
                <dt className="text-neutral-600">Montant à régler</dt>
                <dd className="font-extrabold text-forest text-lg">{formatCurrency(amount)}</dd>
              </div>
            </dl>
          </div>

          <p className="text-sm text-neutral-600">
            Ceci est une <strong>simulation</strong> : aucun prélèvement réel ne sera effectué. Votre abonnement sera activé immédiatement et votre matricule généré.
          </p>

          <div className="pt-2 flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={busy}>
              Annuler
            </Button>
            <Button variant="dark" className="flex-1" loading={busy} onClick={onConfirm}>
              Confirmer et activer
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SuccessModal({
  isOpen,
  onClose,
  matricule,
  schoolName,
}: {
  isOpen: boolean;
  onClose: () => void;
  matricule: string;
  schoolName: string;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-labelledby="success-modal-title">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 text-center">
        <div className="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-lime text-forest">
          <Icon name="verified_user" fill className="text-[32px]" />
        </div>
        <h2 id="success-modal-title" className="text-2xl font-extrabold text-ink">
          École activée avec succès !
        </h2>
        <p className="mt-2 text-sm text-neutral-600">
          Votre abonnement est actif. Le matricule de <strong>{schoolName}</strong> est prêt.
        </p>

        <div className="mt-6 rounded-2xl bg-forest px-5 py-4 text-3xl font-extrabold tracking-[0.35em] text-lime sm:text-4xl" aria-label={`Matricule ${matricule.split("").join(" ")}`}>
          {matricule}
        </div>

        <p className="mt-4 text-xs text-neutral-500">
          Communiquez ce matricule à vos enseignants, élèves et parents pour qu'ils puissent créer leur compte.
        </p>

        <Button variant="dark" size="lg" className="mt-6 w-full" onClick={onClose}>
          Continuer vers le tableau de bord
        </Button>
      </div>
    </div>
  );
}

/** Écran de simulation de paiement pour le directeur : choix de la formule, simulation puis matricule immédiat. */
export default function DirectorSubscriptionSimulationPage() {
  const { user } = useAuth();
  const school = useSchool();
  const { toast } = useToast();
  const [studentCount, setStudentCount] = useState(300);
  const [planId, setPlanId] = useState<PlanId>("pro");
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [submitting, setSubmitting] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [generatedMatricule, setGeneratedMatricule] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const requestState = useAsync(async () => {
    if (!school.schoolId) return { request: null as SubscriptionRequest | null };
    return { request: await latestSubscriptionRequest(school.schoolId) };
  }, [school.schoolId]);

  const active = school.status === "ACTIF" || school.status === "EXPIRE_BIENTOT";
  const request = requestState.data?.request ?? null;
  const pending = !active && request?.status === "EN_ATTENTE";
  const recommended = recommendPlan(studentCount);
  const selectedPlan = plans.find((plan) => plan.id === planId) ?? recommended;
  const fits = selectedPlan.studentLimit === null || studentCount <= selectedPlan.studentLimit;
  const monthlyPrice = priceFor(selectedPlan, "monthly");
  const yearlyPrice = priceFor(selectedPlan, "yearly");
  const due = priceFor(selectedPlan, cycle);
  const cycles = school.school?.cycles ?? school.settings?.cycles ?? [];
  const schoolName = school.school?.name ?? school.settings?.name ?? school.schoolName ?? "Votre école";
  const city = school.school?.city ?? "";
  const cyclesLabel = cycles.map((c) => CYCLE_LABELS[c]).join(", ");
  const currentStep = active || generatedMatricule ? 3 : 2;
  const reload = school.reload;

  const checkActivation = useCallback(async () => {
    if (!school.schoolId) return;
    try {
      await refreshSchoolSubscription();
      reload();
      const latest = await latestSubscriptionRequest(school.schoolId);
      requestState.setData({ request: latest });
    } catch {
      /* ignore */
    }
  }, [school.schoolId, reload, requestState]);

  useEffect(() => {
    if (!pending || active || !school.schoolId) return;
    const timer = window.setInterval(() => {
      void refreshSchoolSubscription().then(reload).catch(() => undefined);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [pending, active, school.schoolId, reload]);

  if (!user) return null;

  const changeCount = (value: number) => {
    const next = Math.min(MAX_STUDENTS, Math.max(MIN_STUDENTS, value));
    setStudentCount(next);
    if (selectedPlan.studentLimit !== null && next > selectedPlan.studentLimit) {
      setPlanId(recommendPlan(next).id);
    }
  };

  const choosePlan = (plan: Plan) => {
    if (plan.studentLimit !== null && studentCount > plan.studentLimit) return;
    setPlanId(plan.id);
  };

  const openPaymentModal = () => {
    if (!fits) return;
    setActionError(null);
    setShowPaymentModal(true);
  };

  const confirmPayment = async () => {
    setSubmitting(true);
    setShowPaymentModal(false);
    try {
      // Simulate payment processing
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Generate matricule locally for simulation
      const existingMatricules = school.school?.matricule ? [school.school.matricule] : [];
      const newMatricule = generateMatricule(existingMatricules);
      setGeneratedMatricule(newMatricule);

      // In a real app, this would call the backend to activate subscription
      // For simulation, we just show success
      toast("Paiement simulé avec succès. Votre école est activée !");
      setShowSuccessModal(true);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Simulation impossible.");
      toast("Erreur lors de la simulation.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccessModal(false);
    // Navigate to dashboard after success
    window.location.href = "/app";
  };

  if (school.loading) return <LoadingState />;

  // If already active (real activation), show the existing active state
  if (active) {
    return (
      <div className="min-h-screen bg-mist">
        <header className="border-b border-forest/10 bg-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
            <Logo />
            <Link to="/" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-forest hover:underline">
              <Icon name="arrow_back" className="text-[18px]" />
              Retour au site
            </Link>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <OnboardingSteps current={3} />

          <div className="mt-7">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-forest-500">Bonjour {user.firstName}</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
              Votre école est activée
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-neutral-600">
              Votre matricule est prêt. Partagez-le aux élèves et aux parents pour ouvrir les inscriptions.
            </p>
          </div>

          <div className="mt-8 space-y-5">
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-lime text-forest">
                    <Icon name="verified_user" fill className="text-[30px]" />
                  </span>
                  <div>
                    <Badge tone="success">Abonnement actif</Badge>
                    <h2 className="mt-2 text-2xl font-extrabold text-ink">Votre école est prête</h2>
                    <p className="mt-1 max-w-full sm:max-w-xl text-sm text-neutral-600">
                      Votre matricule est disponible ci-dessous. Il permet aux familles de retrouver votre école et de créer leur compte.
                    </p>
                  </div>
                </div>
                <div className="rounded-2xl bg-mist px-4 py-3 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Formule</p>
                  <p className="font-bold text-forest">{school.plan?.name ?? selectedPlan.name}</p>
                  {school.endsAt && <p className="text-xs text-neutral-500">Jusqu'au {formatDate(school.endsAt)}</p>}
                </div>
              </div>
            </Card>

            {school.school?.matricule ? (
              <MatriculeCard school={school.school} canManage={false} onChanged={reload} />
            ) : (
              <Card className="text-center">
                <Icon name="key" className="text-[32px] text-forest" />
                <p className="mt-2 text-sm text-neutral-600">Le matricule sera généré automatiquement. Cliquez sur actualiser pour recharger.</p>
              </Card>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <LinkButton to="/app" variant="dark" size="lg" icon="dashboard">
                Accéder au tableau de bord
              </LinkButton>
              <Button variant="outline" size="lg" icon="refresh" loading={false} onClick={() => void checkActivation()}>
                Actualiser
              </Button>
            </div>
          </div>
        </main>

        <PaymentSimulationModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          onConfirm={confirmPayment}
          planName={selectedPlan.name}
          cycle={cycle}
          amount={due}
          studentCount={studentCount}
          busy={submitting}
        />
        <SuccessModal
          isOpen={showSuccessModal}
          onClose={handleSuccessClose}
          matricule={generatedMatricule ?? ""}
          schoolName={schoolName}
        />
      </div>
    );
  }

  // If there's a pending request from support flow, show it
  if (requestState.loading) return <LoadingState />;
  if (requestState.error) {
    return (
      <div className="min-h-screen bg-mist">
        <header className="border-b border-forest/10 bg-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
            <Logo />
            <Link to="/" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-forest hover:underline">
              <Icon name="arrow_back" className="text-[18px]" />
              Retour au site
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <OnboardingSteps current={currentStep} />
          <Card className="mt-8 text-center">
            <Icon name="error" className="text-[32px] text-danger" />
            <h2 className="mt-2 text-lg font-bold text-ink">Impossible de charger votre demande</h2>
            <p className="mt-1 text-sm text-neutral-600">{requestState.error}</p>
            <Button className="mt-4" variant="outline" icon="refresh" onClick={requestState.reload}>
              Réessayer
            </Button>
          </Card>
        </main>
      </div>
    );
  }

  if (pending && request) {
    return (
      <div className="min-h-screen bg-mist">
        <header className="border-b border-forest/10 bg-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
            <Logo />
            <Link to="/" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-forest hover:underline">
              <Icon name="arrow_back" className="text-[18px]" />
              Retour au site
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <OnboardingSteps current={currentStep} />

          <div className="mt-7">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-forest-500">Bonjour {user.firstName}</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
              Votre demande est en cours
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-neutral-600">
              Le support Classora traite votre demande. Cette page se met à jour automatiquement dès que l'abonnement est activé.
            </p>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <Card className="text-center">
              <span className="mx-auto grid size-16 place-items-center rounded-full bg-amber-100 text-amber-900">
                <Icon name="schedule" fill className="text-[32px]" />
              </span>
              <Badge tone="warning" className="mt-4">En attente d'activation</Badge>
              <h2 className="mt-3 text-2xl font-extrabold text-ink">Votre demande a bien été envoyée</h2>
              <p className="mx-auto mt-2 max-w-full sm:max-w-xl text-sm text-neutral-600">
                Le support Classora confirme le paiement puis active votre abonnement. Vous n'avez rien d'autre à faire : cette page se met à jour automatiquement.
              </p>

              <dl className="mx-auto mt-6 grid max-w-full sm:max-w-xl gap-3 text-left sm:grid-cols-2">
                <SummaryRow label="Formule" value={plans.find((plan) => plan.id === request.planId)?.name ?? request.planId} />
                <SummaryRow label="Facturation" value={request.cycle === "yearly" ? "Annuelle" : "Mensuelle"} />
                <SummaryRow label="Effectif déclaré" value={`${request.studentCount} élèves`} />
                <SummaryRow label="Montant à régler" value={formatCurrency(request.amount)} />
              </dl>

              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Button variant="dark" icon="refresh" onClick={() => void checkActivation()}>
                  Vérifier maintenant
                </Button>
              </div>

              <p className="mt-4 text-xs text-neutral-500">
                Une question ?{" "}
                <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-forest underline-offset-4 hover:underline">
                  {SUPPORT_EMAIL}
                </a>
              </p>
            </Card>

            <Card dark>
              <h3 className="text-lg font-bold">Ce qui se passe ensuite</h3>
              <ol className="mt-5 space-y-4 text-sm">
                {[
                  ["support_agent", "Le support vérifie votre demande et vous contacte pour le paiement."],
                  ["payments", "Vous réglez le montant de la formule choisie."],
                  ["verified_user", "Votre abonnement est activé et votre matricule apparaît ici."],
                ].map(([icon, text], index) => (
                  <li key={text} className="flex items-start gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/10 text-lime">
                      <Icon name={icon} className="text-[20px]" />
                    </span>
                    <span className="text-white/85">
                      <span className="block text-xs font-bold uppercase tracking-wide text-lime">Étape {index + 1}</span>
                      {text}
                    </span>
                  </li>
                ))}
              </ol>
              <p className="mt-5 rounded-2xl bg-white/10 p-4 text-xs text-white/75">
                Votre école et votre compte restent enregistrés. La demande ne déclenche aucun prélèvement automatique.
              </p>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  // Main simulation flow: choose plan, simulate payment, get matricule
  return (
    <div className="min-h-screen bg-mist">
      <header className="border-b border-forest/10 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Logo />
          <Link to="/" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-forest hover:underline">
            <Icon name="arrow_back" className="text-[18px]" />
            Retour au site
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <OnboardingSteps current={currentStep} />

        <div className="mt-7">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-forest-500">Bonjour {user.firstName}</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            Choisissez l'abonnement de votre école
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-neutral-600">
            Votre compte est créé. Indiquez votre effectif, choisissez une formule puis simulez le paiement pour activer immédiatement votre école et obtenir votre matricule.
          </p>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.6fr)]">
          <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <Card dark>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-lime">Votre école</p>
              <h2 className="mt-1 text-xl font-extrabold">{schoolName}</h2>
              <p className="mt-1 text-sm text-white/70">
                {[city, cyclesLabel].filter(Boolean).join(" · ") || "Informations vérifiées"}
              </p>
              <p className="mt-4 flex items-center gap-2 text-xs font-semibold text-lime">
                <Icon name="verified_user" fill className="text-[18px]" />
                Compte directeur et école vérifiés
              </p>
            </Card>

            <Card>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-ink">Votre effectif</h2>
                  <p className="mt-1 text-sm text-neutral-500">La formule recommandée s'adapte automatiquement.</p>
                </div>
                <p className="text-2xl font-extrabold text-forest">{studentCount}</p>
              </div>

              <label htmlFor="student-count" className="sr-only">
                Nombre d'élèves
              </label>
              <input
                id="student-count"
                type="range"
                min={MIN_STUDENTS}
                max={MAX_STUDENTS}
                step={10}
                value={studentCount}
                onChange={(event) => changeCount(Number(event.target.value))}
                className="mt-4 h-2 w-full cursor-pointer appearance-none rounded-full bg-neutral-200 accent-forest"
              />
              <div className="mt-1 flex justify-between text-xs text-neutral-500">
                <span>{MIN_STUDENTS} élèves</span>
                <span>{MAX_STUDENTS} élèves</span>
              </div>

              <div className="mt-4 rounded-2xl bg-lime-soft p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-forest-500">Formule recommandée</p>
                <p className="mt-1 text-lg font-extrabold text-forest">{recommended.name}</p>
                <p className="text-sm text-forest-500">{planLimitLabel(recommended)}</p>
              </div>

              <div className="mt-5">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-500">Facturation</p>
                <Tabs
                  items={[
                    { id: "monthly", label: "Mensuel" },
                    { id: "yearly", label: "Annuel", badge: "-2 mois" },
                  ]}
                  value={cycle}
                  onChange={(id) => setCycle(id as BillingCycle)}
                  label="Cycle de facturation"
                />
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <PriceChoice
                  label="Par mois"
                  price={formatCurrency(monthlyPrice)}
                  hint={`Soit ${formatCurrency(monthlyPrice * 12)} par an`}
                  selected={cycle === "monthly"}
                  onClick={() => setCycle("monthly")}
                />
                <PriceChoice
                  label="Par an"
                  price={formatCurrency(yearlyPrice)}
                  hint={`Soit ${formatCurrency(Math.round(yearlyPrice / 12))} par mois`}
                  selected={cycle === "yearly"}
                  onClick={() => setCycle("yearly")}
                />
              </div>

              <div className="mt-4 flex items-start gap-2 rounded-2xl bg-mist p-4 text-sm text-neutral-600">
                <Icon name="payments" className="text-[20px] text-forest" />
                <p>
                  Montant de la simulation : <strong className="text-forest">{formatCurrency(due)}</strong>. Aucun prélèvement réel : l'activation est immédiate.
                </p>
              </div>

              {actionError && (
                <div role="alert" className="mt-4 flex items-start gap-2 rounded-2xl bg-red-50 p-4 text-sm font-medium text-danger">
                  <Icon name="error" className="text-[20px]" />
                  {actionError}
                </div>
              )}

              <Button
                variant="dark"
                size="lg"
                icon="credit_card"
                className="mt-4 w-full"
                loading={submitting}
                disabled={!fits || submitting}
                onClick={() => void openPaymentModal()}
              >
                Simuler le paiement
              </Button>
              <p className="mt-3 text-center text-xs text-neutral-500">Simulation sans prélèvement : activation immédiate et génération du matricule.</p>
            </Card>
          </div>

          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-ink">Les formules</h2>
              <span className="text-sm text-neutral-500">
                {studentCount} élèves · {cycle === "yearly" ? "annuel" : "mensuel"}
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {plans.map((plan) => {
                const compatible = plan.studentLimit === null || studentCount <= plan.studentLimit;
                const selected = plan.id === selectedPlan.id;
                return (
                  <div
                    key={plan.id}
                    className={cn(
                      "relative h-full rounded-3xl transition-transform",
                      compatible ? "hover:-translate-y-0.5" : "opacity-60",
                      selected && "ring-4 ring-lime ring-offset-2",
                    )}
                  >
                    <PlanCard plan={plan} cycle={cycle} />
                    <button
                      type="button"
                      aria-label={`Choisir la formule ${plan.name}`}
                      aria-pressed={selected}
                      disabled={!compatible}
                      onClick={() => choosePlan(plan)}
                      className="absolute inset-0 z-10 rounded-3xl focus-visible:outline-offset-4"
                    />
                    {selected && (
                      <span className="pointer-events-none absolute right-4 top-4 z-20 grid size-8 place-items-center rounded-full bg-lime text-forest shadow-card">
                        <Icon name="check" className="text-[18px]" />
                      </span>
                    )}
                    {!compatible && (
                      <span className="pointer-events-none absolute inset-x-4 bottom-4 z-20 rounded-xl bg-white/95 px-3 py-2 text-center text-xs font-bold text-danger shadow-card">
                        Effectif supérieur à la limite
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <p className="mt-3 text-xs text-neutral-500">
              La formule sélectionnée est celle utilisée pour votre simulation. L'activation est immédiate après confirmation.
            </p>
          </div>
        </div>
      </main>

      <PaymentSimulationModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onConfirm={confirmPayment}
        planName={selectedPlan.name}
        cycle={cycle}
        amount={due}
        studentCount={studentCount}
        busy={submitting}
      />
      <SuccessModal
        isOpen={showSuccessModal}
        onClose={handleSuccessClose}
        matricule={generatedMatricule ?? ""}
        schoolName={schoolName}
      />
    </div>
  );
}