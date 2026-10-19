import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { AsyncView } from "@/components/ui/AsyncView";
import { Avatar, ProgressBar } from "@/components/ui/Brand";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { useCurrentUser } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { useAsync } from "@/hooks/useAsync";
import { getGradeSheet, saveGrade, type GradeSheet } from "@/services/gradeService";
import type { Grade } from "@/types";
import { cn } from "@/utils/cn";
import { formatNumber } from "@/utils/format";
import { appreciation, averageTone, computeRanks, gradeCompletion, parseGradeInput, round2, subjectAverage } from "@/utils/grades";

type Field = "devoir1" | "devoir2" | "composition";
const FIELD_LABELS: Record<Field, string> = { devoir1: "Devoir 1", devoir2: "Devoir 2", composition: "Composition" };
type Status = "idle" | "saving" | "saved" | "error";

interface Props {
  classId: string;
  subjectId: string;
  period: string;
}

export function GradeEntry({ classId, subjectId, period }: Props) {
  const user = useCurrentUser();
  const state = useAsync(() => getGradeSheet(user, classId, subjectId, period), [classId, subjectId, period, user.id]);
  if (state.loading && !state.error) return <SkeletonTable rows={8} />;
  return <AsyncView state={state}>{(sheet) => <Sheet key={`${classId}|${subjectId}|${period}`} sheet={sheet} period={period} />}</AsyncView>;
}

function Sheet({ sheet, period }: { sheet: GradeSheet; period: string }) {
  const user = useCurrentUser();
  const { toast } = useToast();
  const cycle = sheet.classRoom.cycle;
  const fields: Field[] = cycle === "elementaire" ? ["composition"] : ["devoir1", "devoir2", "composition"];
  const [grades, setGrades] = useState<Grade[]>(sheet.grades);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>("idle");
  const [savedAt, setSavedAt] = useState("");
  const timers = useRef(new Map<string, number>());
  const inFlight = useRef(0);

  useEffect(() => {
    const t = timers.current;
    return () => t.forEach((id) => window.clearTimeout(id));
  }, []);

  const keyOf = (id: string, f: Field) => `${id}|${f}`;
  const gradeOf = (id: string) => grades.find((g) => g.studentId === id);
  const display = (id: string, f: Field): string => {
    const k = keyOf(id, f);
    if (k in draft) return draft[k];
    const v = gradeOf(id)?.[f];
    return v === null || v === undefined ? "" : String(v).replace(".", ",");
  };

  const persist = async (studentId: string, field: Field, value: number | null, k: string) => {
    inFlight.current += 1;
    try {
      await saveGrade(user, { studentId, classId: sheet.classRoom.id, subjectId: sheet.subject.id, period, field, value });
      setDraft((d) => {
        const n = { ...d };
        delete n[k];
        return n;
      });
      inFlight.current -= 1;
      if (inFlight.current === 0 && timers.current.size === 0) {
        setStatus("saved");
        setSavedAt(new Date().toTimeString().slice(0, 5));
      }
    } catch (e) {
      inFlight.current -= 1;
      setStatus("error");
      toast(e instanceof Error ? e.message : "Enregistrement impossible.", "error");
    }
  };

  const onChange = (studentId: string, field: Field, text: string) => {
    const k = keyOf(studentId, field);
    setDraft((d) => ({ ...d, [k]: text }));
    const r = parseGradeInput(text);
    if (!r.ok) {
      setErrors((e) => ({ ...e, [k]: r.error }));
      return;
    }
    setErrors((e) => {
      const n = { ...e };
      delete n[k];
      return n;
    });
    setGrades((prev) => {
      const base = prev.some((g) => g.studentId === studentId) ? prev : [...prev, { schoolId: sheet.classRoom.schoolId, studentId, classId: sheet.classRoom.id, subjectId: sheet.subject.id, period, devoir1: null, devoir2: null, composition: null }];
      return base.map((g) => (g.studentId === studentId ? { ...g, [field]: r.value } : g));
    });
    const existing = timers.current.get(k);
    if (existing) window.clearTimeout(existing);
    setStatus("saving");
    timers.current.set(
      k,
      window.setTimeout(() => {
        timers.current.delete(k);
        void persist(studentId, field, r.value, k);
      }, 450),
    );
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>, row: number, field: Field) => {
    const delta = e.key === "Enter" || e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    document.querySelector<HTMLInputElement>(`[data-cell="${row + delta}:${field}"]`)?.focus();
  };

  const averages = sheet.students.map((s) => ({ id: s.id, value: subjectAverage(gradeOf(s.id), cycle) }));
  const ranks = useMemo(() => computeRanks(averages), [averages]); // eslint-disable-line react-hooks/exhaustive-deps
  const valid = averages.map((a) => a.value).filter((v): v is number => v !== null);
  const classAvg = valid.length ? round2(valid.reduce((a, b) => a + b, 0) / valid.length) : null;
  const completion = gradeCompletion(grades, sheet.students.length, cycle);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="md:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-2xl font-extrabold text-forest">{sheet.classRoom.name} · {sheet.subject.name}</p>
              <p className="text-sm text-neutral-500">
                Coefficient {sheet.coefficient} · {sheet.students.length} élèves
                {cycle !== "elementaire" && " · Moyenne = (moyenne des devoirs + composition) / 2"}
              </p>
            </div>
            <div aria-live="polite" className="flex min-h-11 items-center gap-2 rounded-full bg-mist px-4 text-sm font-semibold">
              {status === "saving" && (<><span className="size-4 animate-spin rounded-full border-2 border-forest border-t-transparent" /> Enregistrement…</>)}
              {status === "saved" && (<><Icon name="check_circle" fill className="text-[20px] text-leaf" /> Enregistré à {savedAt}</>)}
              {status === "error" && (<><Icon name="error" fill className="text-[20px] text-danger" /> Échec de l'enregistrement</>)}
              {status === "idle" && (<><Icon name="cloud_done" className="text-[20px] text-neutral-400" /> {sheet.editable ? "Enregistrement automatique" : "Lecture seule"}</>)}
            </div>
          </div>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase text-neutral-500">Moyenne de classe</p>
          <p className="text-3xl font-extrabold">{classAvg === null ? "—" : formatNumber(classAvg)}<span className="text-base text-neutral-400"> /20</span></p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase text-neutral-500">Notes saisies</p>
          <p className="text-3xl font-extrabold">{completion} %</p>
          <ProgressBar className="mt-2" value={completion} tone={completion < 50 ? "warning" : "leaf"} />
        </Card>
      </div>

      {!sheet.editable && (
        <div role="note" className="flex items-start gap-3 rounded-2xl bg-amber-50 p-4 text-sm font-medium text-amber-900">
          <Icon name="lock" className="text-[20px]" />
          Lecture seule : vous ne pouvez modifier que les notes des classes et matières qui vous sont affectées.
        </div>
      )}

      <Card padded={false} className="p-2">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <caption className="sr-only">Saisie des notes de {sheet.classRoom.name}, {sheet.subject.name}</caption>
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-neutral-500">
                <th scope="col" className="px-4 py-3">Élève</th>
                {fields.map((f) => (<th key={f} scope="col" className="px-2 py-3 text-center">{FIELD_LABELS[f]} /20</th>))}
                <th scope="col" className="px-2 py-3 text-center">Moyenne</th>
                <th scope="col" className="px-2 py-3 text-center">Rang</th>
                <th scope="col" className="px-2 py-3">Appréciation</th>
              </tr>
            </thead>
            <tbody>
              {sheet.students.map((s, row) => {
                const avg = averages[row].value;
                return (
                  <tr key={s.id} className="border-t border-neutral-100">
                    <th scope="row" className="px-4 py-2 text-left font-normal">
                      <div className="flex items-center gap-3">
                        <Avatar name={`${s.firstName} ${s.lastName}`} size={34} />
                        <span className="font-semibold">{s.firstName} {s.lastName}</span>
                      </div>
                    </th>
                    {fields.map((f) => {
                      const k = keyOf(s.id, f);
                      const err = errors[k];
                      return (
                        <td key={f} className="px-2 py-2 text-center">
                          {sheet.editable ? (
                            <>
                              <input
                                type="text"
                                inputMode="decimal"
                                data-cell={`${row}:${f}`}
                                value={display(s.id, f)}
                                onChange={(e) => onChange(s.id, f, e.target.value)}
                                onKeyDown={(e) => onKey(e, row, f)}
                                onFocus={(e) => e.target.select()}
                                aria-label={`${FIELD_LABELS[f]} de ${s.firstName} ${s.lastName}`}
                                aria-invalid={!!err}
                                aria-describedby={err ? `err-${k}` : undefined}
                                className={cn("min-h-11 w-20 rounded-xl border px-2 text-center font-semibold focus:outline-none focus:ring-4", err ? "border-danger bg-red-50 text-danger focus:ring-red-200" : "border-neutral-300 bg-white focus:border-forest focus:ring-lime/60")}
                              />
                              {err && <p id={`err-${k}`} role="alert" className="mx-auto mt-1 max-w-[9rem] text-[11px] font-medium text-danger">{err}</p>}
                            </>
                          ) : (
                            <span className="font-semibold">{display(s.id, f) || "—"}</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-2 py-2 text-center"><Badge tone={averageTone(avg)}>{avg === null ? "—" : formatNumber(avg)}</Badge></td>
                    <td className="px-2 py-2 text-center font-semibold">{ranks.get(s.id) ?? "—"}</td>
                    <td className="px-2 py-2 text-neutral-600">{appreciation(avg)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="px-4 py-3 text-xs text-neutral-500">Astuce : Tab pour passer à la colonne suivante, Entrée ou ↓ pour descendre à l'élève suivant. Les notes sont enregistrées automatiquement (0 à 20).</p>
      </Card>
    </div>
  );
}
