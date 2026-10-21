import type { AssignmentBoard } from "@/services/assignmentService";
import type { ClassRoom, Cycle, Subject, Teacher } from "@/types";
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
        "min-h-11 w-full min-w-[9.5rem] rounded-xl border px-2 text-xs font-semibold focus:outline-none focus:ring-4 focus:ring-lime/60",
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
  onSetCell: (classId: string, subjectId: string, teacherId: string | null) => void;
  onReplace: (classId: string, subjectId: string, oldId: string, newId: string | null) => void;
  onAdd: (classId: string, subjectId: string) => void;
  onSetHead: (classId: string, teacherId: string | null) => void;
  onSetTitular: (classId: string, teacherId: string | null) => void;
}

export function AssignmentMatrix({ board, cycle, onSetCell, onReplace, onAdd, onSetHead, onSetTitular }: MatrixProps) {
  const classes = board.classes.filter((c) => c.cycle === cycle);
  const professors = board.teachers.filter((t) => t.kind === "professeur");
  const instituteurs = board.teachers.filter((t) => t.kind === "instituteur");

  if (classes.length === 0) return <p className="rounded-2xl bg-white p-6 text-sm text-neutral-500 shadow-card">Aucune classe dans ce cycle.</p>;

  if (cycle === "elementaire") {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {classes.map((c) => {
          const subs = board.classSubjects.filter((x) => x.classId === c.id).map((x) => board.subjects.find((s) => s.id === x.subjectId)?.name ?? "");
          const hasError = board.conflicts.some((x) => x.classId === c.id && x.severity === "error") || board.conflicts.some((x) => x.teacherId === c.headTeacherId && x.id.startsWith("multi"));
          return (
            <div key={c.id} className="rounded-2xl bg-white p-5 shadow-card">
              <p className="text-xl font-extrabold text-forest">{c.name}</p>
              <label className="mb-1.5 mt-4 block text-xs font-bold uppercase tracking-wide text-neutral-500">Instituteur titulaire</label>
              <TeacherSelect label={`Instituteur titulaire de ${c.name}`} value={c.headTeacherId ?? ""} onChange={(v) => onSetTitular(c.id, v || null)} teachers={instituteurs} tone={hasError ? "error" : "ok"} />
              <p className="mt-4 text-xs font-semibold text-neutral-500">Matières attribuées automatiquement ({subs.length}) :</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {subs.map((s) => (
                  <span key={s} className="rounded-full bg-lime-soft px-2.5 py-1 text-[11px] font-semibold text-forest">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  const subjectIds = Array.from(new Set(board.classSubjects.filter((x) => classes.some((c) => c.id === x.classId)).map((x) => x.subjectId)));
  const subjects = subjectIds.map((id) => board.subjects.find((s) => s.id === id)).filter((s): s is Subject => !!s);

  const cell = (c: ClassRoom, s: Subject) => {
    const has = board.classSubjects.some((x) => x.classId === c.id && x.subjectId === s.id);
    if (!has) return <span className="block text-center text-neutral-300" aria-label="Matière non enseignée">—</span>;
    const list = board.assignments.filter((a) => a.classId === c.id && a.subjectId === s.id);
    const tone = list.length === 0 ? "error" : list.length > 1 ? "warning" : "ok";
    return (
      <div className="flex flex-col gap-1">
        {(list.length ? list : [null]).map((a, i) => (
          <div key={a ? a.teacherId : `none-${i}`} className="flex items-center gap-1">
            <TeacherSelect
              label={`${c.name}, ${s.name} : enseignant`}
              value={a?.teacherId ?? ""}
              subjectId={s.id}
              teachers={professors}
              tone={tone}
              onChange={(v) => (a ? (list.length === 1 ? onSetCell(c.id, s.id, v || null) : onReplace(c.id, s.id, a.teacherId, v || null)) : onSetCell(c.id, s.id, v || null))}
            />
            {a && i === list.length - 1 && list.length < 2 && (
              <button type="button" aria-label={`Ajouter un second enseignant pour ${c.name}, ${s.name}`} title="Ajouter un second enseignant" onClick={() => onAdd(c.id, s.id)} className="grid size-9 shrink-0 place-items-center rounded-full text-neutral-400 hover:bg-lime-soft hover:text-forest">
                <Icon name="add" className="text-[18px]" />
              </button>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="overflow-x-auto rounded-2xl bg-white shadow-card">
      <table className="w-full min-w-[900px] border-separate border-spacing-0 text-sm">
        <caption className="sr-only">Matrice des affectations : classes en lignes, matières en colonnes</caption>
        <thead>
          <tr>
            <th scope="col" className="sticky left-0 z-10 border-b border-neutral-200 bg-white px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-neutral-500">Classe</th>
            <th scope="col" className="border-b border-neutral-200 px-2 py-3 text-left text-xs font-bold uppercase tracking-wide text-neutral-500">Professeur principal</th>
            {subjects.map((s) => (
              <th key={s.id} scope="col" className="border-b border-neutral-200 px-2 py-3 text-left text-xs font-bold uppercase tracking-wide text-neutral-500">
                {s.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {classes.map((c) => (
            <tr key={c.id}>
              <th scope="row" className="sticky left-0 z-10 whitespace-nowrap border-b border-neutral-100 bg-white px-4 py-3 text-left text-base font-extrabold text-forest">{c.name}</th>
              <td className="border-b border-neutral-100 px-2 py-2">
                <TeacherSelect label={`Professeur principal de ${c.name}`} value={c.headTeacherId ?? ""} onChange={(v) => onSetHead(c.id, v || null)} teachers={professors} tone={c.headTeacherId ? "ok" : "warning"} emptyLabel="— Non désigné —" />
              </td>
              {subjects.map((s) => (
                <td key={s.id} className="border-b border-neutral-100 px-2 py-2 align-top">
                  {cell(c, s)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
