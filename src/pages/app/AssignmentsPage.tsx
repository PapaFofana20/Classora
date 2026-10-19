import { useState } from "react";
import { AsyncView } from "@/components/ui/AsyncView";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/Brand";
import { Card, CardHeader } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/context/ToastContext";
import { CYCLES, CYCLE_LABELS } from "@/data/school";
import { AssignmentMatrix } from "@/features/assignments/AssignmentMatrix";
import { useAsync } from "@/hooks/useAsync";
import { addCellTeacher, getAssignmentBoard, removeCellTeacher, setCellTeacher, setHeadTeacher, setTitular, type AssignmentBoard } from "@/services/assignmentService";
import { useCurrentUser } from "@/context/AuthContext";
import type { Cycle } from "@/types";
import { MAX_ASSIGNMENTS_PER_TEACHER } from "@/utils/permissions";

export default function AssignmentsPage() {
  const user = useCurrentUser();
  const state = useAsync(() => getAssignmentBoard(user.schoolId), [user.schoolId]);
  const { toast } = useToast();
  const [cycle, setCycle] = useState<Cycle>("moyen");

  const run = async (op: () => Promise<AssignmentBoard>, success: string) => {
    try {
      state.setData(await op());
      toast(success);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Modification impossible.", "error");
    }
  };

  return (
    <>
      <PageHeader title="Affectations" subtitle="Qui enseigne quoi, dans quelle classe. Les enseignants ne voient que leurs affectations." />
      <AsyncView state={state} skeleton={<Skeleton className="h-96 w-full" />}>
        {(board) => {
          const errors = board.conflicts.filter((c) => c.severity === "error");
          const warnings = board.conflicts.filter((c) => c.severity === "warning");
          const profs = board.teachers.filter((t) => t.kind === "professeur");
          return (
            <div className="space-y-4">
              <Card className={board.conflicts.length ? "" : "!bg-lime-soft"}>
                <CardHeader title="Contrôle des conflits" subtitle="Matière sans professeur, professeur surchargé, doublon sur une même classe et matière" action={<div className="flex gap-2"><Badge tone={errors.length ? "danger" : "success"}>{errors.length} erreur(s)</Badge><Badge tone={warnings.length ? "warning" : "success"}>{warnings.length} alerte(s)</Badge></div>} />
                {board.conflicts.length === 0 ? (
                  <p className="flex items-center gap-2 text-sm font-semibold text-forest"><Icon name="check_circle" fill /> Aucune anomalie : toutes les matières ont un enseignant.</p>
                ) : (
                  <ul className="grid gap-2 md:grid-cols-2" aria-live="polite">
                    {board.conflicts.map((c) => (
                      <li key={c.id} className={`flex items-start gap-2 rounded-xl p-3 text-sm ${c.severity === "error" ? "bg-red-50 text-red-900" : "bg-amber-50 text-amber-900"}`}>
                        <Icon name={c.severity === "error" ? "error" : "warning"} fill className="text-[20px]" />
                        {c.message}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Tabs label="Cycle" value={cycle} onChange={(v) => setCycle(v as Cycle)} items={CYCLES.map((c) => ({ id: c, label: CYCLE_LABELS[c], badge: board.classes.filter((x) => x.cycle === c).length }))} />
              <AssignmentMatrix
                board={board}
                cycle={cycle}
                onSetCell={(c, s, t) => void run(() => setCellTeacher(user, c, s, t), "Affectation mise à jour.")}
                onReplace={(c, s, oldId, newId) => void run(async () => { await removeCellTeacher(user, c, s, oldId); return newId ? addCellTeacher(user, c, s, newId) : getAssignmentBoard(user.schoolId); }, "Affectation mise à jour.")}
                onAdd={(c, s) => {
                  const taken = board.assignments.filter((a) => a.classId === c && a.subjectId === s).map((a) => a.teacherId);
                  const candidate = profs.find((t) => t.specialties.includes(s) && !taken.includes(t.id)) ?? profs.find((t) => !taken.includes(t.id));
                  if (candidate) void run(() => addCellTeacher(user, c, s, candidate.id), "Second enseignant ajouté : conflit à résoudre.");
                }}
                onSetHead={(c, t) => void run(() => setHeadTeacher(user, c, t), "Professeur principal mis à jour.")}
                onSetTitular={(c, t) => {
                  const cls = board.classes.find((x) => x.id === c);
                  const n = board.classSubjects.filter((x) => x.classId === c).length;
                  void run(() => setTitular(user, c, t), t ? `Titulaire nommé : il reçoit automatiquement les ${n} matières de ${cls?.name ?? "la classe"}.` : "Titulaire retiré.");
                }}
              />
              {cycle !== "elementaire" && (
                <Card>
                  <CardHeader title="Charge des professeurs" subtitle={`Maximum conseillé : ${MAX_ASSIGNMENTS_PER_TEACHER} affectations (classe · matière)`} />
                  <ul className="grid gap-x-8 gap-y-3 md:grid-cols-2">
                    {profs.map((t) => {
                      const n = board.assignments.filter((a) => a.teacherId === t.id).length;
                      return (
                        <li key={t.id} className="flex items-center gap-3 text-sm">
                          <span className="w-40 truncate font-semibold">{t.firstName} {t.lastName}</span>
                          <ProgressBar className="flex-1" value={(n / MAX_ASSIGNMENTS_PER_TEACHER) * 100} tone={n > MAX_ASSIGNMENTS_PER_TEACHER ? "danger" : n > 7 ? "warning" : "leaf"} />
                          <span className={`w-10 text-right font-bold ${n > MAX_ASSIGNMENTS_PER_TEACHER ? "text-danger" : ""}`}>{n}</span>
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              )}
            </div>
          );
        }}
      </AsyncView>
    </>
  );
}
