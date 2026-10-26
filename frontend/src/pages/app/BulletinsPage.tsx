import { useEffect, useState } from "react";
import { AsyncView } from "@/components/ui/AsyncView";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input, Textarea } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { PeriodSelect } from "@/components/ui/PeriodSelect";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { useCurrentUser } from "@/context/AuthContext";
import { useChild } from "@/context/ChildContext";
import { useToast } from "@/context/ToastContext";
import { CONDUCT_OPTIONS, levels } from "@/data/school";
import { ElementaryReport, SecondaryReport } from "@/features/reportCards/ReportCards";
import { useAsync } from "@/hooks/useAsync";
import { usePeriods } from "@/hooks/usePeriods";
import { bulletinClasses, getClassReportCards, updateReportMeta } from "@/services/reportService";
import { getSchoolOverview } from "@/services/schoolService";
import type { ReportCardData } from "@/types";

function MetaEditor({ card, onSaved }: { card: ReportCardData; onSaved: () => void }) {
  const user = useCurrentUser();
  const { toast } = useToast();
  const [conduct, setConduct] = useState(card.meta?.conduct ?? "");
  const [absences, setAbsences] = useState(card.meta ? String(card.meta.absences) : "");
  const [comment, setComment] = useState(card.meta?.comment ?? "");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setConduct(card.meta?.conduct ?? "");
    setAbsences(card.meta ? String(card.meta.absences) : "");
    setComment(card.meta?.comment ?? "");
  }, [card.student.id, card.meta?.conduct, card.meta?.absences, card.meta?.comment]);
  const abs = Number(absences);
  const absErr = !Number.isInteger(abs) || abs < 0 || abs > 200 ? "Nombre entier entre 0 et 200." : null;
  const elem = card.classRoom.cycle === "elementaire";

  const save = async () => {
    setBusy(true);
    try {
      await updateReportMeta(user, card.student.id, card.period.id, { conduct, absences: abs, comment: comment.trim() });
      toast("Appréciation enregistrée.");
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Enregistrement impossible.", "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="no-print">
      <h2 className="mb-4 text-lg font-bold">{elem ? "Appréciation de l'instituteur" : "Conseil de classe"}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Conduite" value={conduct} onChange={(e) => setConduct(e.target.value)} options={CONDUCT_OPTIONS.map((c) => ({ value: c, label: c }))} />
        <Input label="Absences (heures)" type="number" min={0} value={absences} onChange={(e) => setAbsences(e.target.value)} error={absErr} />
        <Textarea className="sm:col-span-2" label={elem ? "Appréciation (laisser vide pour la suggestion automatique)" : "Appréciation du conseil de classe (vide = suggestion automatique)"} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={300} />
      </div>
      <Button className="mt-4" variant="dark" icon="save" loading={busy} disabled={!!absErr} onClick={() => void save()}>Enregistrer</Button>
    </Card>
  );
}

export default function BulletinsPage() {
  const user = useCurrentUser();
  const { periods, period, setPeriod } = usePeriods();
  const { activeChild } = useChild();
  const isParent = user.role === "parent";
  const isStudent = user.role === "eleve";
  const classes = useAsync(async () => ({ list: await bulletinClasses(user), overview: await getSchoolOverview(user.schoolId) }), [user.id]);
  const [classId, setClassId] = useState("");
  const [idx, setIdx] = useState(0);

  const list = classes.data?.list ?? [];
  const effectiveClass = isParent ? activeChild?.classId ?? "" : list.some((c) => c.id === classId) ? classId : list[0]?.id ?? "";
  const cards = useAsync(() => (effectiveClass ? getClassReportCards(user, effectiveClass, period) : Promise.resolve([] as ReportCardData[])), [effectiveClass, period, user.id]);
  useEffect(() => setIdx(0), [effectiveClass]);

  const data = cards.data ?? [];
  const current = isParent || isStudent ? data.find((c) => c.student.id === (isStudent ? user.studentId : activeChild?.id)) : data[Math.min(idx, data.length - 1)];

  return (
    <>
      <PageHeader
        title="Bulletins"
        subtitle={isStudent ? "Votre bulletin du semestre, imprimable en PDF." : isParent ? "Bulletin de votre enfant, imprimable en PDF." : "Aperçu imprimable des bulletins. Le modèle dépend du cycle de la classe."}
        actions={<><PeriodSelect periods={periods} value={period} onChange={setPeriod} />{current && <Button icon="print" variant="dark" onClick={() => window.print()}>Imprimer / PDF</Button>}</>}
      />
      <AsyncView state={classes} skeleton={<Skeleton className="h-96 w-full" />}>
        {({ list: allowed, overview }) =>
          allowed.length === 0 ? (
            <EmptyState icon="description" title="Aucun bulletin disponible" text={user.role === "professeur" ? "Les bulletins sont réservés au professeur principal de la classe." : "Aucune classe n'est disponible pour votre compte."} />
          ) : (
            <div className="space-y-4">
              {!isParent && !isStudent && (
                <Card className="no-print">
                  <div className="grid gap-3 md:grid-cols-[1fr_2fr_auto] md:items-end">
                    {allowed.length > 1 ? <Select label="Classe" value={effectiveClass} onChange={(e) => setClassId(e.target.value)} options={allowed.map((c) => ({ value: c.id, label: c.name }))} /> : <div><p className="mb-1.5 text-sm font-semibold">Classe</p><p className="min-h-12 rounded-2xl bg-mist px-4 py-3 text-sm font-bold">{allowed[0].name}</p></div>}
                    <Select label="Élève" value={String(Math.min(idx, Math.max(0, data.length - 1)))} onChange={(e) => setIdx(Number(e.target.value))} options={data.map((c, i) => ({ value: String(i), label: `${c.student.firstName} ${c.student.lastName}` }))} />
                    <div className="flex gap-2">
                      <Button variant="outline" aria-label="Élève précédent" icon="chevron_left" disabled={idx <= 0} onClick={() => setIdx(idx - 1)} />
                      <Button variant="outline" aria-label="Élève suivant" icon="chevron_right" disabled={idx >= data.length - 1} onClick={() => setIdx(idx + 1)} />
                    </div>
                  </div>
                </Card>
              )}
              {cards.loading && !cards.error ? (
                <Skeleton className="h-[600px] w-full" />
              ) : cards.error ? (
                <EmptyState icon="cloud_off" title="Chargement impossible" text={cards.error} action={<Button onClick={cards.reload} icon="refresh">Réessayer</Button>} />
              ) : !current ? (
                <EmptyState icon="description" title="Pas de bulletin" text="Aucun élève dans cette classe pour cette période." />
              ) : (
                <>
                  {current.classRoom.cycle === "elementaire" ? (
                    <ElementaryReport card={current} schoolName={overview.settings.name} exam={levels.find((l) => l.id === current.classRoom.levelId)?.exam} />
                  ) : (
                    <SecondaryReport card={current} schoolName={overview.settings.name} exam={levels.find((l) => l.id === current.classRoom.levelId)?.exam} />
                  )}
                  {!isParent && !isStudent && <MetaEditor card={current} onSaved={cards.reload} />}
                </>
              )}
            </div>
          )
        }
      </AsyncView>
    </>
  );
}
