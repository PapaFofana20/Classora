import { AsyncView } from "@/components/ui/AsyncView";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { useCurrentUser } from "@/context/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { getClassReportCards } from "@/services/reportService";
import type { ReportCardData } from "@/types";
import { cn } from "@/utils/cn";
import { formatNumber } from "@/utils/format";
import { averageTone, councilAppreciation } from "@/utils/grades";

interface Props {
  classId: string;
  period: string;
  title?: string;
}

/** Synthèse de classe en lecture seule + aide au conseil de classe. */
export function ClassSummary({ classId, period, title = "Synthèse de la classe" }: Props) {
  const user = useCurrentUser();
  const state = useAsync(() => getClassReportCards(user, classId, period), [classId, period, user.id]);
  if (state.loading && !state.error) return <SkeletonTable rows={8} />;
  return <AsyncView state={state}>{(cards) => <Summary cards={cards} title={title} />}</AsyncView>;
}

const GROUPS: { id: string; label: string; icon: string; tone: "success" | "info" | "warning" | "danger"; test: (a: number) => boolean }[] = [
  { id: "f", label: "Félicitations (≥ 16)", icon: "military_tech", tone: "success", test: (a) => a >= 16 },
  { id: "h", label: "Tableau d'honneur (14 à 16)", icon: "workspace_premium", tone: "success", test: (a) => a >= 14 && a < 16 },
  { id: "e", label: "Encouragements (12 à 14)", icon: "thumb_up", tone: "info", test: (a) => a >= 12 && a < 14 },
  { id: "d", label: "En difficulté (< 10)", icon: "support", tone: "danger", test: (a) => a < 10 },
];

function Summary({ cards, title }: { cards: ReportCardData[]; title: string }) {
  if (cards.length === 0) return null;
  const subjects = cards[0].lines;
  const avgs = cards.map((c) => c.generalAverage).filter((x): x is number => x !== null);
  const best = avgs.length ? Math.max(...avgs) : null;
  const worst = avgs.length ? Math.min(...avgs) : null;
  const cycle = cards[0].classRoom.cycle;
  return (
    <div className="space-y-4">
      <div role="note" className="flex items-start gap-3 rounded-2xl bg-lime-soft p-4 text-sm font-medium text-forest">
        <Icon name="visibility" className="text-[20px]" />
        Lecture seule : vous consultez toutes les matières de {cards[0].classRoom.name}, mais vous ne pouvez modifier que les notes de vos propres matières.
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <Card><p className="text-xs font-semibold uppercase text-neutral-500">Moyenne de classe</p><p className="text-3xl font-extrabold">{cards[0].classAverage === null ? "—" : formatNumber(cards[0].classAverage)}</p></Card>
        <Card><p className="text-xs font-semibold uppercase text-neutral-500">Meilleure moyenne</p><p className="text-3xl font-extrabold text-leaf">{best === null ? "—" : formatNumber(best)}</p></Card>
        <Card><p className="text-xs font-semibold uppercase text-neutral-500">Plus faible</p><p className="text-3xl font-extrabold text-danger">{worst === null ? "—" : formatNumber(worst)}</p></Card>
        <Card><p className="text-xs font-semibold uppercase text-neutral-500">Sous la moyenne</p><p className="text-3xl font-extrabold">{avgs.filter((a) => a < 10).length}<span className="text-base text-neutral-400"> / {cards.length}</span></p></Card>
      </div>
      <Card padded={false} className="p-2">
        <div className="px-4 pt-4"><h2 className="text-lg font-bold">{title}</h2><p className="text-sm text-neutral-500">Moyennes par matière, moyenne générale{cycle !== "elementaire" ? " pondérée" : ""} et rang</p></div>
        <div className="overflow-x-auto">
          <table className="mt-2 w-full min-w-[720px] text-sm">
            <caption className="sr-only">Synthèse des moyennes par matière</caption>
            <thead>
              <tr className="text-xs uppercase tracking-wide text-neutral-500">
                <th scope="col" className="sticky left-0 bg-white px-4 py-3 text-left">Élève</th>
                {subjects.map((s) => (<th key={s.subjectId} scope="col" title={s.subjectName} className="px-2 py-3 text-center">{s.subjectName.split(/[\s-]/)[0].slice(0, 8)}{cycle !== "elementaire" ? ` (${s.coefficient})` : ""}</th>))}
                <th scope="col" className="px-2 py-3 text-center">Moy. gén.</th>
                <th scope="col" className="px-2 py-3 text-center">Rang</th>
              </tr>
            </thead>
            <tbody>
              {[...cards].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99)).map((c) => (
                <tr key={c.student.id} className="border-t border-neutral-100">
                  <th scope="row" className="sticky left-0 whitespace-nowrap bg-white px-4 py-2 text-left font-semibold">{c.student.firstName} {c.student.lastName}</th>
                  {c.lines.map((l) => (<td key={l.subjectId} className={cn("px-2 py-2 text-center font-medium", l.average !== null && l.average < 10 && "text-danger")}>{l.average === null ? "—" : formatNumber(l.average)}</td>))}
                  <td className="px-2 py-2 text-center"><Badge tone={averageTone(c.generalAverage)}>{c.generalAverage === null ? "—" : formatNumber(c.generalAverage)}</Badge></td>
                  <td className="px-2 py-2 text-center font-bold">{c.rank ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <div>
        <CardHeader title="Aide au conseil de classe" subtitle="Propositions automatiques à partir des moyennes générales" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {GROUPS.map((g) => {
            const list = cards.filter((c) => c.generalAverage !== null && g.test(c.generalAverage));
            return (
              <Card key={g.id}>
                <div className="mb-3 flex items-center gap-2"><Icon name={g.icon} fill className="text-forest" /><h3 className="text-sm font-bold">{g.label}</h3></div>
                {list.length === 0 ? <p className="text-sm text-neutral-400">Aucun élève</p> : (
                  <ul className="space-y-1.5 text-sm">
                    {list.map((c) => (<li key={c.student.id} className="flex items-center justify-between gap-2"><span>{c.student.firstName} {c.student.lastName}</span><Badge tone={g.tone}>{formatNumber(c.generalAverage ?? 0)}</Badge></li>))}
                  </ul>
                )}
                {list.length > 0 && <p className="mt-3 border-t border-neutral-100 pt-2 text-xs italic text-neutral-500">{councilAppreciation(list[0].generalAverage)}</p>}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
