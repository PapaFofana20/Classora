import { PageHeader } from "@/components/ui/PageHeader";
import { AsyncView } from "@/components/ui/AsyncView";
import { Card, CardHeader } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useAsync } from "@/hooks/useAsync";
import { getAdminAnalytics } from "@/services/admin";
import type { AdminAnalyticsData } from "@/types";
import { CycleShareChart, GrowthChart } from "@/features/admin/charts";
import { formatCurrency, formatNumber } from "@/utils/format";
import { cn } from "@/utils/cn";

export default function AdminAnalyticsPage() {
  const state = useAsync(() => getAdminAnalytics(), []);

  return (
    <>
      <PageHeader
        title="Analyses"
        subtitle="Croissance du réseau, adoption des formules et répartition des effectifs"
        actions={
          <div className="flex flex-wrap gap-2">
            <LinkButton to="/admin/ecoles" variant="outline" icon="school">
              Établissements
            </LinkButton>
            <LinkButton to="/admin/finances" icon="insights">
              Finances
            </LinkButton>
          </div>
        }
      />
      <AsyncView state={state}>{(s) => <Content data={s} />}</AsyncView>
    </>
  );
}

function Content({ data }: { data: AdminAnalyticsData }) {
  const s = data.summary;
  const totalCitySchools = data.byCity.reduce((sum, c) => sum + c.schools, 0) || 1;
  const totalStudents = data.byCity.reduce((sum, c) => sum + c.students, 0) || 1;
  const payingShare = s.totalSchools > 0 ? Math.round((s.payingSchools / s.totalSchools) * 100) : 0;

  return (
    <div className="space-y-4">
      {s.totalSchools === 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm text-sky-900">
          <Icon name="info" fill className="mt-0.5 text-[22px] text-sky-700" />
          <div>
            <p className="font-bold">Aucun établissement enregistré pour le moment.</p>
            <p className="mt-1 leading-relaxed">
              Les indicateurs de croissance, de conversion et de répartition se rempliront dès les premières inscriptions. Les formules
              et leurs tarifs sont déjà disponibles ci-dessous.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          dark
          icon="school"
          label="Établissements"
          value={String(s.totalSchools)}
          badge={
            s.schoolsGrowthPct === 0
              ? { text: "stable", tone: "neutral" }
              : { text: `${s.schoolsGrowthPct > 0 ? "+" : ""}${s.schoolsGrowthPct} %`, tone: s.schoolsGrowthPct > 0 ? "up" : "down" }
          }
          note={`${s.activeSchools} actif(s) · ${s.newSchoolsThisMonth} nouveau(x) ce mois`}
        />
        <StatCard icon="groups" label="Élèves inscrits" value={s.totalStudents.toLocaleString("fr-FR")} note={`${formatNumber(s.averageStudentsPerSchool, 0)} élèves en moyenne par école`} />
        <StatCard icon="workspace_premium" label="Taux de conversion" value={`${s.conversionRate} %`} note={`${s.payingSchools} école(s) sur ${s.totalSchools} ont une formule`} />
        <StatCard icon="payments" label="MRR" value={formatCurrency(s.mrr)} note="Abonnements valides aujourd'hui" />
        <StatCard icon="person_remove" label="Taux d'attrition" value={`${s.churnRate} %`} note="Abonnements expirés sur le total enregistré" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Croissance sur 12 mois"
            subtitle="Nouvelles écoles et nouveaux élèves par mois, parc cumulé en courbe."
            action={<Badge tone="lime">{s.newSchoolsLastMonth} → {s.newSchoolsThisMonth} écoles</Badge>}
          />
          <GrowthChart data={data.growth} />
        </Card>

        <Card>
          <CardHeader title="Ce mois-ci" subtitle="Comparaison avec le mois précédent." />
          <div className="space-y-3">
            <MetricRow icon="add_business" label="Nouvelles écoles" value={String(s.newSchoolsThisMonth)} delta={s.newSchoolsThisMonth - s.newSchoolsLastMonth} />
            <MetricRow icon="person_add" label="Nouveaux élèves" value={s.studentsThisMonth.toLocaleString("fr-FR")} delta={s.studentsThisMonth - s.studentsLastMonth} />
            <MetricRow icon="meeting_room" label="Classes" value={String(s.totalClasses)} />
            <MetricRow icon="badge" label="Enseignants" value={String(s.totalTeachers)} />
            <MetricRow icon="family_restroom" label="Parents" value={String(s.totalParents)} />
          </div>
          <div className="mt-4 rounded-2xl bg-mist p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">Part d'écoles payantes</p>
            <div className="mt-2 flex items-center gap-3">
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white">
                <div className="h-full rounded-full bg-forest" style={{ width: `${payingShare}%` }} />
              </div>
              <span className="text-sm font-extrabold tabular-nums text-forest">{payingShare} %</span>
            </div>
            <p className="mt-2 text-xs text-neutral-500">
              {s.payingSchools} école(s) avec abonnement valide sur {s.totalSchools}.
            </p>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="Répartition géographique" subtitle="Top 10 des villes par nombre d'établissements." />
          {data.byCity.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-500">Aucune ville renseignée.</p>
          ) : (
            <Table
              caption="Répartition des établissements par ville"
              rows={data.byCity}
              rowKey={(c) => c.city}
              columns={[
                {
                  key: "city",
                  header: "Ville",
                  render: (c) => (
                    <div className="flex items-center gap-2">
                      <Icon name="location_on" className="text-[18px] text-forest/60" />
                      <span className="font-semibold text-ink">{c.city}</span>
                    </div>
                  ),
                },
                { key: "schools", header: "Écoles", align: "right", render: (c) => <span className="tabular-nums">{c.schools}</span> },
                { key: "students", header: "Élèves", align: "right", render: (c) => <span className="tabular-nums">{c.students.toLocaleString("fr-FR")}</span> },
                {
                  key: "share",
                  header: "Poids",
                  align: "right",
                  render: (c) => (
                    <div className="flex min-w-28 items-center justify-end gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-mist">
                        <div className="h-full rounded-full bg-leaf" style={{ width: `${(c.schools / totalCitySchools) * 100}%` }} />
                      </div>
                      <span className="w-10 text-right text-xs font-semibold text-neutral-600">
                        {Math.round((c.schools / totalCitySchools) * 100)} %
                      </span>
                    </div>
                  ),
                },
              ]}
            />
          )}
          <p className="mt-3 text-xs text-neutral-500">
            {totalStudents.toLocaleString("fr-FR")} élèves rattachés aux villes affichées.
          </p>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Répartition par cycle" subtitle="Écoles proposant chaque niveau." />
          <CycleShareChart data={data.byCycle} />
          <div className="mt-3 grid grid-cols-3 gap-2">
            {data.byCycle.map((c) => (
              <div key={c.cycle} className="rounded-xl bg-mist p-3 text-center">
                <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">{c.label}</p>
                <p className="text-lg font-extrabold text-ink">{c.schools}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Adoption des formules" subtitle="Part des écoles payantes par formule." />
          {data.byPlan.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-500">Aucune formule configurée.</p>
          ) : (
            <div className="space-y-4">
              {data.byPlan.map((plan) => (
                <div key={plan.planId}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-ink">{plan.name}</p>
                      <p className="text-xs text-neutral-500">{formatCurrency(plan.monthlyPrice)} / mois</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-extrabold tabular-nums text-forest">{plan.schools} école(s)</p>
                      <p className="text-xs text-neutral-500">{plan.share} % des payantes</p>
                    </div>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-mist">
                    <div className="h-full rounded-full bg-forest" style={{ width: `${Math.max(plan.share, plan.schools > 0 ? 2 : 0)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-5 rounded-2xl bg-lime-soft p-4 text-xs leading-relaxed text-forest">
            <strong>Levier de croissance :</strong> {s.totalSchools - s.payingSchools} établissement(s) n'ont pas encore de formule valide.
            L'onglet Abonnements permet d'activer ou relancer une école en quelques clics.
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Établissements les plus importants"
            subtitle="Classement par effectif d'élèves."
            action={<LinkButton to="/admin/ecoles" variant="ghost" size="sm" icon="arrow_forward">Tout voir</LinkButton>}
          />
          {data.topSchools.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-500">Aucun établissement enregistré.</p>
          ) : (
            <Table
              caption="Principaux établissements par effectif"
              rows={data.topSchools}
              rowKey={(school) => school.schoolId}
              columns={[
                {
                  key: "school",
                  header: "Établissement",
                  render: (school) => (
                    <div className="min-w-0">
                      <LinkButton to={`/admin/ecoles/${school.schoolId}`} variant="ghost" size="sm" icon="school" className="px-0">
                        {school.schoolName}
                      </LinkButton>
                      <p className="text-xs text-neutral-500">{school.matricule || "Sans matricule"}</p>
                    </div>
                  ),
                },
                { key: "students", header: "Élèves", align: "right", render: (school) => <span className="tabular-nums">{school.students}</span> },
                { key: "classes", header: "Classes", align: "right", render: (school) => <span className="tabular-nums">{school.classes}</span> },
                {
                  key: "status",
                  header: "Abonnement",
                  align: "center",
                  render: (school) => (
                    <Badge tone={school.subscriptionStatus === "ACTIF" ? "success" : "neutral"}>
                      {school.subscriptionStatus === "ACTIF" ? "Actif" : "Inactif"}
                    </Badge>
                  ),
                },
              ]}
            />
          )}
        </Card>
      </div>
    </div>
  );
}

function MetricRow({ icon, label, value, delta }: { icon: string; label: string; value: string; delta?: number }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-mist px-3 py-2.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-forest">
        <Icon name={icon} className="text-[18px]" />
      </span>
      <span className="flex-1 text-sm font-medium text-neutral-700">{label}</span>
      {typeof delta === "number" && delta !== 0 && (
        <span className={cn("text-xs font-bold", delta > 0 ? "text-emerald-700" : "text-danger")}>
          {delta > 0 ? "+" : ""}
          {delta}
        </span>
      )}
      <span className="text-sm font-extrabold tabular-nums text-ink">{value}</span>
    </div>
  );
}
