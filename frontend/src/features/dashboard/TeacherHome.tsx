import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { AsyncView } from "@/components/ui/AsyncView";
import { ProgressBar } from "@/components/ui/Brand";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonCards } from "@/components/ui/Skeleton";
import { useCurrentUser } from "@/context/AuthContext";
import { useTeaching } from "@/context/TeachingContext";
import { contextKey } from "@/hooks/useTeacherAssignments";
import { useAsync } from "@/hooks/useAsync";
import { getTeacherOverview, type ContextOverview } from "@/services/gradeService";
import { periodInfo } from "@/services/reportService";
import { formatNumber } from "@/utils/format";
import { averageTone } from "@/utils/grades";

/** « Mes classes » (professeur) ou « Ma classe » (instituteur : toutes les matières, sans sélecteur de classe). */
export function TeacherHome() {
  const user = useCurrentUser();
  const { headClasses, setActiveKey, loading } = useTeaching();
  const navigate = useNavigate();
  const period = periodInfo(user.schoolId).current;
  const state = useAsync(() => getTeacherOverview(user.schoolId, user.teacherId ?? "", period), [user.schoolId, user.teacherId]);
  const isInstit = user.role === "instituteur";
  const myClass = headClasses[0];

  const open = (c: ContextOverview, to = "/app/notes") => {
    setActiveKey(contextKey(c.classId, c.subjectId));
    navigate(to);
  };

  return (
    <>
      <PageHeader
        title={isInstit ? `Ma classe${myClass ? ` · ${myClass.name}` : ""}` : "Mes classes"}
        subtitle={isInstit ? "Instituteur titulaire : vous enseignez toutes les matières de votre classe." : "Vos affectations (classe · matière) du 1er semestre 2026-2027."}
      />
      <AsyncView state={state} skeleton={<SkeletonCards count={3} className="lg:grid-cols-3" />}>
        {(items) =>
          items.length === 0 && !loading ? (
            <EmptyState icon="assignment_late" title="Aucune affectation pour le moment" text="La direction ne vous a pas encore affecté de classe. Contactez le directeur." />
          ) : (
            <div className="space-y-6">
              {!isInstit && headClasses.length > 0 && (
                <Card dark className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <span className="grid size-12 place-items-center rounded-full bg-lime text-forest">
                      <Icon name="workspace_premium" fill />
                    </span>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-lime">Professeur principal</p>
                      <p className="text-lg font-bold">{headClasses.map((c) => c.name).join(", ")}</p>
                      <p className="text-sm text-white/70">Synthèse en lecture seule et aide au conseil de classe.</p>
                    </div>
                  </div>
                  <Button variant="primary" onClick={() => navigate("/app/notes?vue=principale")}>
                    Ma classe principale
                  </Button>
                </Card>
              )}
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((c) => (
                  <Card key={`${c.classId}-${c.subjectId}`} hover className="flex flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-2xl font-extrabold text-forest">{c.className}</p>
                        <p className="text-sm font-semibold text-neutral-600">{c.subjectName}</p>
                      </div>
                      <Badge tone={averageTone(c.average)}>{c.average === null ? "Pas de note" : `Moy. ${formatNumber(c.average)}`}</Badge>
                    </div>
                    <div className="mt-5 flex items-center gap-2 text-sm text-neutral-600">
                      <Icon name="groups" className="text-[18px]" />
                      {c.studentCount} élèves
                    </div>
                    <div className="mt-4">
                      <div className="mb-1.5 flex justify-between text-xs font-semibold">
                        <span>Notes saisies</span>
                        <span>{c.completion} %</span>
                      </div>
                      <ProgressBar value={c.completion} tone={c.completion < 50 ? "warning" : "leaf"} />
                    </div>
                    <Button className="mt-5" variant="dark" icon="edit_note" onClick={() => open(c)}>
                      Saisir les notes
                    </Button>
                  </Card>
                ))}
              </div>
            </div>
          )
        }
      </AsyncView>
    </>
  );
}
