import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AsyncView } from "@/components/ui/AsyncView";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { PeriodSelect } from "@/components/ui/PeriodSelect";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs } from "@/components/ui/Tabs";
import { useCurrentUser } from "@/context/AuthContext";
import { useChild } from "@/context/ChildContext";
import { useTeaching } from "@/context/TeachingContext";
import { ClassSummary } from "@/features/grades/ClassSummary";
import { GradeEntry } from "@/features/grades/GradeEntry";
import { ParentGrades } from "@/features/grades/ParentGrades";
import { useAsync } from "@/hooks/useAsync";
import { usePeriods } from "@/hooks/usePeriods";
import { getSchoolOverview } from "@/services/schoolService";

/** Professeur : saisie limitée à ses affectations + onglet « Ma classe principale ». */
function ProfessorNotes({ period }: { period: string }) {
  const { active, headClasses, loading, contexts } = useTeaching();
  const [params, setParams] = useSearchParams();
  const tab = params.get("vue") === "principale" && headClasses.length > 0 ? "principale" : "saisie";
  const head = headClasses[0];

  if (loading) return <Skeleton className="h-96 w-full" />;
  if (contexts.length === 0 && headClasses.length === 0) return <EmptyState icon="assignment_late" title="Aucune affectation" text="La direction ne vous a pas encore affecté de classe." />;
  return (
    <div className="space-y-4">
      {head && (
        <Tabs
          label="Vue"
          value={tab}
          onChange={(v) => setParams(v === "principale" ? { vue: "principale" } : {})}
          items={[{ id: "saisie", label: "Saisie des notes", icon: "edit_note" }, { id: "principale", label: "Ma classe principale", icon: "workspace_premium", badge: head.name }]}
        />
      )}
      {tab === "principale" && head ? (
        <ClassSummary classId={head.id} period={period} title={`Ma classe principale · ${head.name}`} />
      ) : active ? (
        <GradeEntry classId={active.classId} subjectId={active.subjectId} period={period} />
      ) : (
        <EmptyState icon="assignment_late" title="Aucune matière à saisir" text="Vous êtes professeur principal mais n'avez pas de matière affectée." />
      )}
    </div>
  );
}

/** Instituteur : une seule classe, toutes les matières en onglets, sans sélecteur de classe. */
function InstituteurNotes({ period }: { period: string }) {
  const { contexts, headClasses, loading } = useTeaching();
  const [tab, setTab] = useState("");
  const cls = headClasses[0];
  const current = tab && (tab === "synthese" || contexts.some((c) => c.subjectId === tab)) ? tab : contexts[0]?.subjectId ?? "synthese";
  if (loading) return <Skeleton className="h-96 w-full" />;
  if (!cls) return <EmptyState icon="assignment_late" title="Aucune classe titulaire" text="La direction ne vous a pas encore nommé titulaire d'une classe." />;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2"><Badge tone="dark">Instituteur titulaire · {cls.name}</Badge><span className="text-sm text-neutral-600">Vous enseignez toutes les matières de la classe.</span></div>
      <Tabs label="Matières de la classe" value={current} onChange={setTab} items={[...contexts.map((c) => ({ id: c.subjectId, label: c.subjectName })), { id: "synthese", label: "Synthèse", icon: "insights" }]} />
      {current === "synthese" ? <ClassSummary classId={cls.id} period={period} /> : <GradeEntry classId={cls.id} subjectId={current} period={period} />}
    </div>
  );
}

/** Directeur : consultation de toutes les classes de son école, en lecture seule. */
function AdminNotes({ period }: { period: string }) {
  const user = useCurrentUser();
  const overview = useAsync(() => getSchoolOverview(user.schoolId), [user.schoolId]);
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [tab, setTab] = useState("matiere");
  return (
    <AsyncView state={overview} skeleton={<Skeleton className="h-96 w-full" />}>
      {(o) => <AdminBody o={o} classId={classId || o.classes[0]?.id || ""} setClassId={(v) => { setClassId(v); setSubjectId(""); }} subjectId={subjectId} setSubjectId={setSubjectId} tab={tab} setTab={setTab} period={period} />}
    </AsyncView>
  );
}

interface AdminBodyProps {
  o: Awaited<ReturnType<typeof getSchoolOverview>>;
  classId: string;
  setClassId: (v: string) => void;
  subjectId: string;
  setSubjectId: (v: string) => void;
  tab: string;
  setTab: (v: string) => void;
  period: string;
}

function AdminBody({ o, classId, setClassId, subjectId, setSubjectId, tab, setTab, period }: AdminBodyProps) {
  const subs = o.classSubjects.filter((x) => x.classId === classId).map((x) => ({ value: x.subjectId, label: o.subjects.find((s) => s.id === x.subjectId)?.name ?? x.subjectId }));
  const sid = subs.some((s) => s.value === subjectId) ? subjectId : subs[0]?.value ?? "";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Select compact aria-label="Classe" className="w-48" value={classId} onChange={(e) => setClassId(e.target.value)} options={o.classes.map((c) => ({ value: c.id, label: c.name }))} />
        {tab === "matiere" && <Select compact aria-label="Matière" className="w-64" value={sid} onChange={(e) => setSubjectId(e.target.value)} options={subs} />}
        <Tabs label="Vue" value={tab} onChange={setTab} items={[{ id: "matiere", label: "Par matière" }, { id: "synthese", label: "Synthèse" }]} />
      </div>
      {tab === "synthese" ? <ClassSummary classId={classId} period={period} /> : sid ? <GradeEntry classId={classId} subjectId={sid} period={period} /> : null}
    </div>
  );
}

export default function NotesPage() {
  const user = useCurrentUser();
  const { periods, period, setPeriod } = usePeriods();
  const { activeChild } = useChild();
  const subtitles: Record<typeof user.role, string> = {
    directeur: "Consultation de toutes les classes (lecture seule).",
    instituteur: "Toutes les matières de votre classe.",
    professeur: "Saisie limitée à vos classes et matières.",
    parent: activeChild ? `Résultats de ${activeChild.firstName} (${activeChild.className}).` : "Résultats de vos enfants.",
    eleve: "Vos notes du 1er semestre.",
    econome: "",
    surveillant: "",
  };
  return (
    <>
      <PageHeader title="Notes" subtitle={subtitles[user.role]} actions={<PeriodSelect periods={periods} value={period} onChange={setPeriod} />} />
      {user.role === "professeur" && <ProfessorNotes period={period} />}
      {user.role === "instituteur" && <InstituteurNotes period={period} />}
      {user.role === "directeur" && <AdminNotes period={period} />}
      {user.role === "parent" && <ParentGrades period={period} />}
      {user.role === "eleve" && <ParentGrades period={period} />}
    </>
  );
}
