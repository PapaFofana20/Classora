import { PageHeader } from "@/components/ui/PageHeader";
import { AsyncView } from "@/components/ui/AsyncView";
import { Card, CardHeader } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { Link } from "react-router-dom";
import { LinkButton } from "@/components/ui/Button";
import { useAsync } from "@/hooks/useAsync";
import { getAdminOverviewStats } from "@/services/admin";
import type { AdminOverviewStats } from "@/types";
import { formatDate } from "@/utils/format";
import { Table } from "@/components/ui/Table";

export default function AdminDashboardPage() {
  const state = useAsync(() => getAdminOverviewStats(), []);
  return (
    <>
      <PageHeader
        title="Tableau de bord administratif"
        subtitle="Supervision de la plateforme Classora"
        actions={
          <LinkButton to="/admin/ecoles" icon="school">
            Voir les établissements
          </LinkButton>
        }
      />
      <AsyncView state={state}>{(s) => <Content s={s} />}</AsyncView>
    </>
  );
}

function Content({ s }: { s: AdminOverviewStats }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard dark icon="school" label="Écoles totales" value={String(s.schools.total)} badge={{ text: `${s.schools.active} actives`, tone: "up" }} note={`${s.schools.suspended} suspendue${s.schools.suspended > 1 ? "es" : ""}`} />
        <StatCard icon="groups" label="Élèves" value={String(s.people.totalStudents)} note="toutes écoles confondues" />
        <StatCard icon="meeting_room" label="Classes" value={String(s.people.totalClasses)} note="établissements actifs" />
        <StatCard icon="badge" label="Enseignants" value={String(s.people.totalTeachers)} note="professeurs et instituteurs" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Répartition par établissement" action={<Link to="/admin/ecoles" className="text-sm font-medium">Détail</Link>} />
          <div className="overflow-x-auto">
            <Table
              columns={[
                { key: "name", header: "Établissement", render: (r: { schoolName: string }) => <div className="font-medium">{r.schoolName}</div> },
                { key: "matricule", header: "Matricule", render: (r: { matricule: string }) => <span className="text-xs text-neutral-500 tabular-nums">{r.matricule}</span> },
                { key: "students", header: "Élèves", align: "right", render: (r: { studentCount: number }) => <span className="tabular-nums">{r.studentCount}</span> },
                { key: "classes", header: "Classes", align: "right", render: (r: { classCount: number }) => <span className="tabular-nums">{r.classCount}</span> },
                { key: "teachers", header: "Enseignants", align: "right", render: (r: { teacherCount: number }) => <span className="tabular-nums">{r.teacherCount}</span> },
                {
                  key: "status",
                  header: "Statut",
                  align: "center",
                  render: (r: { status: string }) => {
                    const tone = r.status === "ACTIF" ? "success" : r.status === "EXPIRE" ? "danger" : "neutral";
                    return <Badge tone={tone}>{r.status === "ACTIF" ? "Actif" : r.status === "EXPIRE" ? "Expiré" : "Aucun"}</Badge>;
                  },
                },
              ]}
              rows={s.bySchool as unknown as { schoolName: string; matricule: string; studentCount: number; classCount: number; teacherCount: number; status: string }[]}
              rowKey={(r: { schoolName: string; matricule: string; studentCount: number; classCount: number; teacherCount: number; status: string }) => r.schoolName}
              caption="Statistiques par établissement scolaire"
            />
          </div>
        </Card>

        <Card>
          <CardHeader title="Activité administrative récente" />
          <div className="space-y-3">
            {s.recentActivity.length === 0 ? (
              <div className="text-center py-6 text-neutral-500 text-sm">Aucune activité récente.</div>
            ) : (
              <div className="space-y-2">
                {s.recentActivity.map((a, i) => (
                  <div key={`${a.createdAt}-${i}`} className="flex items-start gap-3 text-sm">
                    <span className="shrink-0 text-neutral-400">{formatDate(a.createdAt)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-ink font-medium">{a.action?.replace(/_/g, " ") ?? "—"}</p>
                      <p className="text-xs text-neutral-500">{a.entity} · {a.actorRole || "—"}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Alertes" />
          <div className="space-y-3">
            {s.schools.suspended > 0 && (
              <div className="flex items-start gap-3 rounded-xl p-3 bg-red-50">
                <Icon name="warning" fill className="text-[20px] text-danger shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-danger">{s.schools.suspended} établissement(s) suspendu(s)</p>
                  <p className="text-xs text-neutral-500">Vérifiez les abonnements expirés.</p>
                </div>
              </div>
            )}
            {s.people.totalStudents === 0 && (
              <div className="flex items-start gap-3 rounded-xl p-3 bg-amber-50">
                <Icon name="info" fill className="text-[20px] text-amber-800 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800">Aucun élève recensé</p>
                  <p className="text-xs text-neutral-500">Aucun élève actif sur la plateforme.</p>
                </div>
              </div>
            )}
            {s.schools.suspended === 0 && s.people.totalStudents > 0 && (
              <div className="flex items-start gap-3 rounded-xl p-3 bg-emerald-50">
                <Icon name="check_circle" fill className="text-[20px] text-emerald-800 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-emerald-800">Tout va bien</p>
                  <p className="text-xs text-neutral-500">Aucune alerte critique.</p>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}