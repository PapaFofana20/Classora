import type { AssignmentBoard } from "@/services/assignmentService";
import type { Cycle, Subject, Teacher } from "@/types";
import { cn } from "@/utils/cn";
import { Icon } from "@/components/ui/Icon";

interface SelectProps {
  label: string;
  value: string;
  onChange: (teacherId: string) => void;
  teachers: Teacher[];
  subjectId?: string;
  tone?: "ok" | "error" | "warning";
  emptyLabel?: string;
}

/** Menu déroulant d'enseignant : spécialistes de la matière d'abord. */
export function TeacherSelect({ label, value, onChange, teachers, subjectId, tone = "ok", emptyLabel = "— Non affecté —" }: SelectProps) {
  const specialists = subjectId ? teachers.filter((t) => t.specialties.includes(subjectId)) : [];
  const others = teachers.filter((t) => !specialists.includes(t));
  const opt = (t: Teacher) => (
    <option key={t.id} value={t.id}>
      {t.firstName} {t.lastName}
    </option>
  );
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "min-h-10 w-full rounded-xl border px-2 text-xs font-semibold focus:outline-none focus:ring-4 focus:ring-lime/60",
        tone === "error" ? "border-danger bg-red-50 text-danger" : tone === "warning" ? "border-amber-500 bg-amber-50" : "border-neutral-200 bg-white",
      )}
    >
      <option value="">{emptyLabel}</option>
      {specialists.length > 0 && <optgroup label="Spécialistes">{specialists.map(opt)}</optgroup>}
      <optgroup label={specialists.length ? "Autres" : "Enseignants"}>{others.map(opt)}</optgroup>
    </select>
  );
}

interface MatrixProps {
  board: AssignmentBoard;
  cycle: Cycle;
  onReplace: (classId: string, subjectId: string, oldId: string, newId: string | null) => void;
  onAdd: (classId: string, subjectId: string, teacherId?: string) => void;
  onSetHead: (classId: string, teacherId: string | null) => void;
  onSetTitular: (classId: string, teacherId: string | null) => void;
}

export function AssignmentMatrix({ board, cycle, onReplace, onAdd, onSetHead, onSetTitular }: MatrixProps) {
  const classes = board.classes.filter((c) => c.cycle === cycle);
  const professors = board.teachers.filter((t) => t.kind === "professeur");
  const instituteurs = board.teachers.filter((t) => t.kind === "instituteur");

  if (classes.length === 0) return <p className="rounded-2xl bg-white p-6 text-sm text-neutral-500 shadow-card">Aucune classe dans ce cycle.</p>;

  /* ----------------------------- Élémentaire ----------------------------- */
  if (cycle === "elementaire") {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {classes.map((c) => {
          const subs = board.classSubjects.filter((x) => x.classId === c.id).map((x) => board.subjects.find((s) => s.id === x.subjectId)?.name ?? "");
          const hasError = board.conflicts.some((x) => x.classId === c.id && x.severity === "error");
          return (
            <div key={c.id} className="rounded-2xl bg-white p-5 shadow-card">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xl font-extrabold text-forest">{c.name}</p>
                {hasError && <Icon name="error" className="text-danger" />}
              </div>
              <label className="mb-1.5 mt-4 block text-xs font-bold uppercase tracking-wide text-neutral-500">Instituteur titulaire</label>
              <TeacherSelect label={`Instituteur titulaire de ${c.name}`} value={c.headTeacherId ?? ""} onChange={(v) => onSetTitular(c.id, v || null)} teachers={instituteurs} tone={hasError ? "error" : "ok"} />
              <p className="mt-4 text-xs font-semibold text-neutral-500">Matières attribuées automatiquement ({subs.length}) :</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {subs.map((s) => (
                  <span key={s} className="rounded-full bg-lime-soft px-2.5 py-1 text-[11px] font-semibold text-forest">{s}</span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  /* ----------------------------- Moyen / Secondaire ----------------------------- */
  return (
    <div className="space-y-4">
      {classes.map((c) => {
        const subjects = board.classSubjects
          .filter((x) => x.classId === c.id)
          .map((x) => board.subjects.find((s) => s.id === x.subjectId))
          .filter((s): s is Subject => !!s);
        const hasClassError = board.conflicts.some((x) => x.classId === c.id && x.severity === "error");
        return (
          <div key={c.id} className="rounded-2xl bg-white p-5 shadow-card">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <p className="text-lg font-extrabold text-forest">{c.name}</p>
                {hasClassError && <Icon name="error" className="text-danger" />}
              </div>
              <div className="min-w-[14rem]">
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-neutral-500">Professeur principal</label>
                <TeacherSelect label={`Professeur principal de ${c.name}`} value={c.headTeacherId ?? ""} onChange={(v) => onSetHead(c.id, v || null)} teachers={professors} tone={c.headTeacherId ? "ok" : "warning"} emptyLabel="— Non désigné —" />
              </div>
            </div>

            {subjects.length === 0 ? (
              <p className="text-sm text-neutral-500">Aucune matière rattachée à cette classe.</p>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {subjects.map((s) => {
                  const list = board.assignments.filter((a) => a.classId === c.id && a.subjectId === s.id);
                  const tone = list.length === 0 ? "error" : list.length > 1 ? "warning" : "ok";
                  return (
                    <li key={s.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start">
                      <div className="sm:w-44">
                        <p className="text-sm font-bold text-ink">{s.name}</p>
                        {list.length === 0 && <p className="text-xs font-semibold text-danger">Sans enseignant</p>}
                        {list.length > 1 && <p className="text-xs font-semibold text-amber-600">Plusieurs enseignants</p>}
                      </div>
                      <div className="flex flex-1 flex-col gap-2">
                        {list.map((a) => (
                          <div key={a.teacherId} className="flex items-center gap-2">
                            <div className="flex-1">
                              <TeacherSelect
                                label={`${c.name}, ${s.name} : enseignant`}
                                value={a.teacherId}
                                subjectId={s.id}
                                teachers={professors}
                                tone={tone}
                                onChange={(v) => (v ? onReplace(c.id, s.id, a.teacherId, v) : onReplace(c.id, s.id, a.teacherId, null))}
                              />
                            </div>
                            <button type="button" aria-label={`Retirer cet enseignant de ${c.name}, ${s.name}`} title="Retirer" onClick={() => onReplace(c.id, s.id, a.teacherId, null)} className="grid size-9 shrink-0 place-items-center rounded-full text-neutral-400 hover:bg-red-50 hover:text-danger">
                              <Icon name="close" className="text-[16px]" />
                            </button>
                          </div>
                        ))}
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <TeacherSelect
                              label={`${c.name}, ${s.name} : ajouter un enseignant`}
                              value=""
                              subjectId={s.id}
                              teachers={professors}
                              tone="ok"
                              emptyLabel="+ Ajouter un enseignant"
                              onChange={(v) => { if (v) onAdd(c.id, s.id, v); }}
                            />
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
