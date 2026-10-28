import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { PageHeader } from "@/components/ui/PageHeader";
import { AsyncView } from "@/components/ui/AsyncView";
import { Card, CardHeader } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Table } from "@/components/ui/Table";
import { Pagination } from "@/components/ui/Pagination";
import { Badge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Tabs } from "@/components/ui/Tabs";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAsync } from "@/hooks/useAsync";
import { useDebounce } from "@/hooks/useDebounce";
import { useAdminAuth } from "@/context/AdminAuthContext";
import {
  activateSubscription,
  cancelSubscriptionRequest,
  listAdminSubscriptions,
  type ListSubscriptionsParams,
} from "@/services/admin";
import type {
  AdminPlan,
  AdminSubscriptionRequest,
  AdminSubscriptionRow,
  AdminSubscriptionsData,
} from "@/types";
import { formatCurrency, formatDate } from "@/utils/format";
import { methodLabel } from "@/features/admin/labels";
import { cn } from "@/utils/cn";

type TabID = "abonnements" | "demandes" | "offres";
type StatusFilter = NonNullable<ListSubscriptionsParams["status"]>;

interface ActivationTarget {
  schoolId: string;
  schoolName: string;
  planId?: string;
  cycle?: "monthly" | "yearly";
  request?: AdminSubscriptionRequest;
}

const PLAN_OPTIONS = (plans: AdminPlan[], cycle: "monthly" | "yearly") =>
  plans.map((p) => ({
    value: p.id,
    label: `${p.name} — ${formatCurrency(cycle === "monthly" ? p.monthlyPrice : p.yearlyPrice)} / ${cycle === "monthly" ? "mois" : "an"}`,
  }));

export default function AdminSubscriptionsPage() {
  const { pathname } = useLocation();
  const { agent } = useAdminAuth();
  const canActivate = agent?.role === "admin" || agent?.role === "superadmin";

  const [tab, setTab] = useState<TabID>(pathname.endsWith("/offres") ? "offres" : "abonnements");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [plan, setPlan] = useState("");
  const [page, setPage] = useState(1);
  const [activation, setActivation] = useState<ActivationTarget | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const state = useAsync(
    () => listAdminSubscriptions({ page, pageSize: 20, search: debouncedSearch || undefined, status, plan: plan || undefined }),
    [page, debouncedSearch, status, plan],
  );

  return (
    <>
      <PageHeader
        title="Abonnements"
        subtitle="Formules, échéances et demandes d'activation des établissements"
        actions={<LinkButton to="/admin/finances" icon="account_balance_wallet">Voir les finances</LinkButton>}
      />

      {notice && (
        <div className="mb-4 flex items-start gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900" role="status">
          <Icon name="check_circle" fill className="text-[20px] text-emerald-600" />
          <span className="flex-1">{notice}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Fermer le message" className="text-emerald-700">
            <Icon name="close" className="text-[20px]" />
          </button>
        </div>
      )}

      <AsyncView state={state}>
        {(s) => (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <StatCard dark icon="autorenew" label="MRR (abonnements actifs)" value={formatCurrency(s.summary.mrr)} note={`ARR estimé : ${formatCurrency(s.summary.arr)}`} />
              <StatCard icon="verified" label="Abonnements actifs" value={String(s.summary.active)} note={`sur ${s.summary.totalSchools} établissement(s)`} />
              <StatCard icon="schedule" label="Renouvellements sous 30 j" value={String(s.summary.expiringSoon)} note="Échéances proches" />
              <StatCard icon="event_busy" label="Abonnements expirés" value={String(s.summary.expired)} note={`${s.summary.none} sans abonnement`} />
              <StatCard icon="assignment" label="Demandes en attente" value={String(s.summary.pendingRequests)} note={formatCurrency(s.summary.pendingRequestsAmount)} />
            </div>

            <Tabs
              label="Sections des abonnements"
              value={tab}
              onChange={(id) => setTab(id as TabID)}
              items={[
                { id: "abonnements", label: "Abonnements", icon: "workspace_premium", badge: s.summary.active },
                { id: "demandes", label: "Demandes", icon: "assignment", badge: s.summary.pendingRequests },
                { id: "offres", label: "Formules", icon: "sell", badge: s.plans.length },
              ]}
            />

            {tab === "abonnements" && (
              <SubscriptionsTab
                data={s}
                search={search}
                status={status}
                plan={plan}
                canActivate={canActivate}
                onSearch={(value) => {
                  setSearch(value);
                  setPage(1);
                }}
                onStatus={(value) => {
                  setStatus(value);
                  setPage(1);
                }}
                onPlan={(value) => {
                  setPlan(value);
                  setPage(1);
                }}
                onPage={setPage}
                onActivate={(row) => setActivation({ schoolId: row.schoolId, schoolName: row.schoolName })}
              />
            )}

            {tab === "demandes" && (
              <RequestsTab
                data={s}
                canActivate={canActivate}
                onApprove={(request) =>
                  setActivation({
                    schoolId: request.schoolId,
                    schoolName: request.schoolName,
                    planId: request.planId,
                    cycle: request.cycle,
                    request,
                  })
                }
                onNotice={setNotice}
              />
            )}

            {tab === "offres" && <PlansTab data={s} />}
          </div>
        )}
      </AsyncView>

      <ActivationModal
        target={activation}
        plans={state.data?.plans ?? []}
        onClose={() => setActivation(null)}
        onDone={(message) => {
          setActivation(null);
          if (message) setNotice(message);
          state.reload();
        }}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Liste des abonnements                                              */
/* ------------------------------------------------------------------ */

function SubscriptionsTab({
  data,
  search,
  status,
  plan,
  canActivate,
  onSearch,
  onStatus,
  onPlan,
  onPage,
  onActivate,
}: {
  data: AdminSubscriptionsData;
  search: string;
  status: StatusFilter;
  plan: string;
  canActivate: boolean;
  onSearch: (value: string) => void;
  onStatus: (value: StatusFilter) => void;
  onPlan: (value: string) => void;
  onPage: (page: number) => void;
  onActivate: (row: AdminSubscriptionRow) => void;
}) {
  return (
    <Card>
      <CardHeader
        title="Suivi des abonnements"
        subtitle="Chaque ligne reflète l'abonnement réel enregistré pour l'établissement."
      />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Input
          label="Rechercher"
          placeholder="École, matricule ou ville…"
          icon="search"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="w-full sm:w-64"
        />
        <Select
          label="Statut"
          value={status}
          onChange={(e) => onStatus(e.target.value as StatusFilter)}
          options={[
            { value: "all", label: "Tous" },
            { value: "ACTIF", label: "Actifs" },
            { value: "BIENTOT", label: "Échéance < 30 jours" },
            { value: "EXPIRE", label: "Expirés" },
            { value: "AUCUN", label: "Sans abonnement" },
            { value: "SUSPENDUE", label: "École suspendue" },
          ]}
          compact
          className="w-full sm:w-56"
        />
        <Select
          label="Formule"
          value={plan}
          onChange={(e) => onPlan(e.target.value)}
          options={[{ value: "", label: "Toutes les formules" }, ...data.plans.map((p) => ({ value: p.id, label: p.name }))]}
          compact
          className="w-full sm:w-44"
        />
      </div>

      {data.subscriptions.rows.length === 0 ? (
        <EmptyState icon="search_off" title="Aucun abonnement trouvé" text="Modifiez la recherche ou les filtres pour retrouver un établissement." />
      ) : (
        <>
          <Table
            caption="Abonnements des établissements"
            rows={data.subscriptions.rows}
            rowKey={(r) => r.schoolId}
            columns={[
              {
                key: "school",
                header: "Établissement",
                render: (r) => (
                  <div className="min-w-0">
                    <LinkButton to={`/admin/ecoles/${r.schoolId}`} variant="ghost" size="sm" icon="school">
                      {r.schoolName}
                    </LinkButton>
                    <p className="text-xs text-neutral-500">
                      {r.matricule ? <span className="font-mono">{r.matricule}</span> : "Sans matricule"} · {r.city || "Ville non renseignée"}
                    </p>
                  </div>
                ),
              },
              {
                key: "plan",
                header: "Formule",
                render: (r) =>
                  r.planName ? (
                    <div>
                      <p className="text-sm font-semibold text-ink">{r.planName}</p>
                      <p className="text-xs text-neutral-500">{formatCurrency(r.planMonthlyPrice)} / mois</p>
                    </div>
                  ) : (
                    <span className="text-sm text-neutral-400">Aucune</span>
                  ),
              },
              {
                key: "period",
                header: "Période",
                render: (r) =>
                  r.endsAt ? (
                    <div>
                      <p className="text-sm text-ink">{formatDate(r.startsAt)} → {formatDate(r.endsAt)}</p>
                      <p className={cn("text-xs", r.status === "EXPIRE" ? "text-danger" : r.expiringSoon ? "text-amber-700" : "text-neutral-500")}>
                        {r.status === "EXPIRE" ? "Échéance dépassée" : r.daysLeft === 0 ? "Expire aujourd'hui" : `${r.daysLeft} jour(s) restant(s)`}
                      </p>
                    </div>
                  ) : (
                    <span className="text-sm text-neutral-400">Non activé</span>
                  ),
              },
              {
                key: "amount",
                header: "Dernier montant",
                align: "right",
                render: (r) => (
                  <div>
                    <p className="text-sm font-semibold tabular-nums">{r.amountPaid > 0 ? formatCurrency(r.amountPaid) : "—"}</p>
                    <p className="text-xs text-neutral-500">{r.method ? methodLabel(r.method) : "—"}</p>
                  </div>
                ),
              },
              {
                key: "status",
                header: "Statut",
                align: "center",
                render: (r) => (
                  <div className="flex flex-col items-center gap-1">
                    <Badge tone={r.status === "ACTIF" ? (r.expiringSoon ? "warning" : "success") : r.status === "EXPIRE" ? "danger" : "neutral"}>
                      {r.status === "ACTIF" ? (r.expiringSoon ? "Échéance proche" : "Actif") : r.status === "EXPIRE" ? "Expiré" : "Aucun"}
                    </Badge>
                    {!r.registrationOpen && <Badge tone="danger">École suspendue</Badge>}
                  </div>
                ),
              },
              ...(canActivate
                ? [
                    {
                      key: "actions",
                      header: "Action",
                      align: "center" as const,
                      render: (r: AdminSubscriptionRow) => (
                        <Button
                          size="sm"
                          variant={r.status === "ACTIF" ? "outline" : "primary"}
                          icon={r.status === "ACTIF" ? "autorenew" : "play_arrow"}
                          onClick={() => onActivate(r)}
                        >
                          {r.status === "ACTIF" ? "Prolonger" : "Activer"}
                        </Button>
                      ),
                    },
                  ]
                : []),
            ]}
          />
          <Pagination page={data.subscriptions.page} pageSize={data.subscriptions.pageSize} total={data.subscriptions.total} onChange={onPage} />
        </>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Demandes d'activation                                              */
/* ------------------------------------------------------------------ */

function RequestsTab({
  data,
  canActivate,
  onApprove,
  onNotice,
}: {
  data: AdminSubscriptionsData;
  canActivate: boolean;
  onApprove: (request: AdminSubscriptionRequest) => void;
  onNotice: (message: string) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const pending = data.requests.filter((r) => r.status === "EN_ATTENTE");
  const history = data.requests.filter((r) => r.status !== "EN_ATTENTE");

  const cancel = async (request: AdminSubscriptionRequest) => {
    setError("");
    setBusy(request.id);
    try {
      const res = await cancelSubscriptionRequest({ requestId: request.id, reason: "Annulée depuis la console" });
      onNotice(`${res.message} (${request.schoolName})`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de l'annulation.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}
      <Card>
        <CardHeader
          title="Demandes en attente"
          subtitle="Le directeur choisit une formule ; le support encaisse puis active l'abonnement."
          action={<Badge tone={pending.length ? "warning" : "success"}>{pending.length} en attente</Badge>}
        />
        {pending.length === 0 ? (
          <EmptyState icon="task_alt" title="Aucune demande en attente" text="Les demandes déposées par les directions apparaîtront ici automatiquement." />
        ) : (
          <div className="space-y-3">
            {pending.map((request) => (
              <div key={request.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-neutral-100 bg-mist/60 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">{request.schoolName}</p>
                  <p className="text-xs text-neutral-500">
                    {request.matricule ? <span className="font-mono">{request.matricule}</span> : "Sans matricule"} · demandé le {formatDate(request.createdAt)}
                  </p>
                  <p className="mt-1 text-sm text-neutral-700">
                    {request.planName} · {request.cycle === "yearly" ? "annuel" : "mensuel"} · {request.studentCount} élève(s)
                  </p>
                </div>
                <p className="text-lg font-extrabold tabular-nums text-forest">{formatCurrency(request.amount)}</p>
                {canActivate && (
                  <div className="flex gap-2">
                    <Button size="sm" icon="check" onClick={() => onApprove(request)}>
                      Activer
                    </Button>
                    <Button size="sm" variant="outline" icon="close" loading={busy === request.id} onClick={() => cancel(request)}>
                      Annuler
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Historique des demandes" subtitle="30 dernières demandes traitées ou annulées." />
        {history.length === 0 ? (
          <p className="text-sm text-neutral-500">Aucune demande traitée pour le moment.</p>
        ) : (
          <Table
            caption="Historique des demandes d'abonnement"
            rows={history}
            rowKey={(r) => r.id}
            columns={[
              { key: "school", header: "Établissement", render: (r) => <span className="font-medium">{r.schoolName}</span> },
              { key: "plan", header: "Formule", render: (r) => `${r.planName} · ${r.cycle === "yearly" ? "annuel" : "mensuel"}` },
              { key: "amount", header: "Montant", align: "right", render: (r) => <span className="tabular-nums">{formatCurrency(r.amount)}</span> },
              {
                key: "status",
                header: "Statut",
                align: "center",
                render: (r) => <Badge tone={r.status === "ACTIVEE" ? "success" : "neutral"}>{r.status === "ACTIVEE" ? "Activée" : "Annulée"}</Badge>,
              },
              { key: "date", header: "Traitée le", render: (r) => <span className="text-xs text-neutral-500">{formatDate(r.decidedAt)}</span> },
            ]}
          />
        )}
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Formules                                                           */
/* ------------------------------------------------------------------ */

function PlansTab({ data }: { data: AdminSubscriptionsData }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-4">
        {data.plans.map((plan) => (
          <Card key={plan.id} className={cn("flex flex-col", plan.highlight && "ring-2 ring-lime")}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-lg font-extrabold text-ink">{plan.name}</h3>
                <p className="text-xs text-neutral-500">{plan.tagline}</p>
              </div>
              {plan.highlight && <Badge tone="lime">Populaire</Badge>}
            </div>
            <p className="mt-3 text-2xl font-extrabold text-forest">{formatCurrency(plan.monthlyPrice)}</p>
            <p className="text-xs text-neutral-500">par mois · {formatCurrency(plan.yearlyPrice)} par an</p>
            <p className="mt-1 text-xs font-semibold text-neutral-600">{plan.studentLimit ? `Jusqu'à ${plan.studentLimit} élèves` : "Élèves illimités"}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-mist p-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">Écoles actives</p>
                <p className="text-xl font-extrabold text-ink">{plan.activeSchools}</p>
              </div>
              <div className="rounded-xl bg-lime-soft p-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-forest/70">MRR</p>
                <p className="text-sm font-extrabold text-forest">{formatCurrency(plan.mrr)}</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-neutral-500">Encaissé au total : {formatCurrency(plan.totalRevenue)}</p>
            <ul className="mt-4 space-y-1.5 text-sm text-neutral-700">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2">
                  <Icon name="check" className="mt-0.5 text-[16px] text-forest" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader title="Lecture des indicateurs" />
        <p className="text-sm leading-relaxed text-neutral-600">
          Le MRR correspond à la somme des formules mensuelles des abonnements encore valides aujourd'hui. L'ARR en est la projection sur
          12 mois. Les montants encaissés proviennent du journal des activations (<code>subscription_events</code>) : un renouvellement
          cumule la durée achetée sur l'échéance en cours.
        </p>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Modal d'activation / prolongation                                  */
/* ------------------------------------------------------------------ */

function ActivationModal({
  target,
  plans,
  onClose,
  onDone,
}: {
  target: ActivationTarget | null;
  plans: AdminPlan[];
  onClose: () => void;
  onDone: (message?: string) => void;
}) {
  const [planId, setPlanId] = useState("");
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const [method, setMethod] = useState<"wave" | "orange_money" | "free_money" | "especes">("especes");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!target) return;
    setPlanId(target.planId ?? plans[0]?.id ?? "essentiel");
    setCycle(target.cycle ?? "monthly");
    setMethod("especes");
    setAmount("");
    setReference("");
    setError("");
  }, [target, plans]);

  const selectedPlan = plans.find((p) => p.id === planId) ?? null;
  const price = selectedPlan ? (cycle === "yearly" ? selectedPlan.yearlyPrice : selectedPlan.monthlyPrice) : 0;

  const submit = async () => {
    if (!target) return;
    setError("");
    setBusy(true);
    try {
      const res = await activateSubscription({
        schoolId: target.schoolId,
        planId,
        cycle,
        method,
        reference: reference.trim() || undefined,
        amount: amount.trim() ? Number(amount) : undefined,
      });
      onDone(res.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de l'activation.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={!!target}
      onClose={onClose}
      title={target?.request ? "Traiter la demande d'abonnement" : "Activer ou prolonger un abonnement"}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Annuler
          </Button>
          <Button icon="check_circle" loading={busy} onClick={submit} disabled={!planId}>
            Confirmer l'activation
          </Button>
        </>
      }
    >
      {target && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-mist p-4">
            <p className="text-sm font-semibold text-ink">{target.schoolName}</p>
            {target.request && (
              <p className="mt-1 text-xs text-neutral-600">
                Demande du {formatDate(target.request.createdAt)} · {target.request.studentCount} élève(s) · {formatCurrency(target.request.amount)}
              </p>
            )}
            <p className="mt-2 text-xs text-neutral-500">
              L'activation crée l'abonnement, attribue le matricule au premier achat et prolonge l'échéance si un abonnement est encore actif.
            </p>
          </div>

          <Select
            label="Formule"
            required
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
            options={PLAN_OPTIONS(plans, cycle)}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Cycle de facturation"
              required
              value={cycle}
              onChange={(e) => setCycle(e.target.value as "monthly" | "yearly")}
              options={[
                { value: "monthly", label: "Mensuel (30 jours)" },
                { value: "yearly", label: "Annuel (365 jours)" },
              ]}
            />
            <Select
              label="Moyen de paiement"
              required
              value={method}
              onChange={(e) => setMethod(e.target.value as typeof method)}
              options={[
                { value: "especes", label: "Espèces" },
                { value: "wave", label: "Wave" },
                { value: "orange_money", label: "Orange Money" },
                { value: "free_money", label: "Free Money" },
              ]}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Montant encaissé (FCFA)"
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={String(price)}
              hint={selectedPlan ? `Tarif de la formule : ${formatCurrency(price)}. Laissez vide pour l'appliquer.` : undefined}
            />
            <Input
              label="Référence de paiement"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Ex. WAVE-2026-001"
              hint="Facultative : une référence MANUAL-… est générée sinon."
            />
          </div>
          {error && (
            <p role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-danger">
              <Icon name="error" className="text-[20px]" />
              {error}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
