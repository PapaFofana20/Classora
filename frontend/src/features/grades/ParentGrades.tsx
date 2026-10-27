import { AsyncView } from "@/components/ui/AsyncView";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { Table, type Column } from "@/components/ui/Table";
import { useCurrentUser } from "@/context/AuthContext";
import { useChild } from "@/context/ChildContext";
import { useAsync } from "@/hooks/useAsync";
import { getClassReportCards } from "@/services/reportService";
import type { ReportLine } from "@/types";
import { formatNumber } from "@/utils/format";
import { averageTone } from "@/utils/grades";

/** Notes du compte : parent (élève sélectionné) ou élève (son propre relevé). */
export function ParentGrades({ period }: { period: string }) {
  const user = useCurrentUser();
  const { activeChild, loading, children } = useChild();
  const isStudent = user.role === "eleve";
  const studentId = isStudent ? user.studentId : activeChild?.id;

  const self = useAsync(async () => {
    if (!isStudent || !user.studentId) return null;
    const { getStudentDetail } = await import("@/services/studentService");
    const detail = await getStudentDetail(user, user.studentId);
    return detail.report;
  }, [isStudent, user.studentId]);

  const state = useAsync(async () => {
    if (!studentId) return null;
    if (isStudent) return self.data ?? null;
    const cards = await getClassReportCards(user, activeChild?.classId ?? "", period);
    return cards.find((c) => c.student.id === studentId) ?? null;
  }, [studentId, period, self.data]);

  if (!loading && !isStudent && children.length === 0) return <EmptyState icon="child_care" title="Aucun élève rattaché" />;
  if (state.loading && !state.error) return <SkeletonTable rows={7} />;

  return (
    <AsyncView state={state}>
      {(card) => {
        if (!card) return <EmptyState icon="grading" title="Pas encore de notes" text="Les notes apparaîtront ici dès leur saisie par les enseignants." />;
        const elem = card.classRoom.cycle === "elementaire";
        const title = isStudent ? `Mes notes · ${card.classRoom.name}` : `Notes de ${card.student.firstName} · ${card.classRoom.name}`;
        const cols: Column<ReportLine>[] = [
          { key: "s", header: "Matière", render: (l) => <span className="font-semibold">{l.subjectName}</span> },
          ...(elem
            ? []
            : ([
                { key: "coef", header: "Coef.", align: "center", render: (l) => l.coefficient },
                { key: "d1", header: "Devoir 1", align: "center", render: (l) => l.devoir1 ?? "—" },
                { key: "d2", header: "Devoir 2", align: "center", render: (l) => l.devoir2 ?? "—" },
              ] as Column<ReportLine>[])),
          { key: "c", header: "Composition", align: "center", render: (l) => l.composition ?? "—" },
          { key: "m", header: "Moyenne", align: "center", render: (l) => <Badge tone={averageTone(l.average)}>{l.average === null ? "—" : formatNumber(l.average)}</Badge> },
          ...(elem ? [] : ([{ key: "r", header: "Rang matière", align: "center", render: (l) => l.rank ?? "—" }] as Column<ReportLine>[])),
          { key: "a", header: "Appréciation", render: (l) => l.appreciation },
        ];
        return (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Card dark>
                <p className="text-xs font-semibold uppercase text-white/70">Moyenne générale</p>
                <p className="text-3xl font-extrabold text-lime">
                  {card.generalAverage === null ? "—" : formatNumber(card.generalAverage)} <span className="text-base text-white/60">/ 20</span>
                </p>
              </Card>
              <Card>
                <p className="text-xs font-semibold uppercase text-neutral-500">Rang</p>
                <p className="text-3xl font-extrabold">
                  {card.rank ?? "—"}
                  <span className="text-base text-neutral-400"> / {card.classSize}</span>
                </p>
              </Card>
              <Card>
                <p className="text-xs font-semibold uppercase text-neutral-500">Moyenne de la classe</p>
                <p className="text-3xl font-extrabold">{card.classAverage === null ? "—" : formatNumber(card.classAverage)}</p>
              </Card>
            </div>
            <Card padded={false} className="p-2">
              <div className="px-4 pt-4">
                <h2 className="text-lg font-bold">{title}</h2>
                <p className="text-sm text-neutral-500">{elem ? "Cycle élémentaire : notes de composition par matière." : "Moyenne de matière = (moyenne des devoirs + composition) / 2."}</p>
              </div>
              <Table caption="Notes par matière" columns={cols} rows={card.lines} rowKey={(l) => l.subjectId} />
            </Card>
          </div>
        );
      }}
    </AsyncView>
  );
}

