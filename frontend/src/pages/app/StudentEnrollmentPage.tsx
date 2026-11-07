// Inscription d'un élève, à l'unité ou par import CSV.
import { useState } from "react";
import { AsyncView } from "@/components/ui/AsyncView";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAsync } from "@/hooks/useAsync";
import { EnrollmentWizard } from "@/features/students/EnrollmentWizard";
import { StudentCsvImport } from "@/features/students/StudentCsvImport";
import { getSchoolOverview } from "@/services/schoolService";
import { listParents, listStudentRows } from "@/services/studentService";
import { useCurrentUser } from "@/context/AuthContext";
import { cn } from "@/utils/cn";

// Composant principal de la page.
export default function StudentEnrollmentPage() {
  const user = useCurrentUser();
  const [mode, setMode] = useState<"unique" | "import">("unique");
  // On regroupe les données nécessaires à l'inscription en une seule requête.
  const state = useAsync(async () => {
    const [overview, parents, students] = await Promise.all([getSchoolOverview(user.schoolId), listParents(user), listStudentRows(user)]);
    const childrenByParent = students.reduce<Record<string, number>>((acc, s) => ({ ...acc, [s.parentId]: (acc[s.parentId] ?? 0) + 1 }), {});
    return { overview, parents, childrenByParent };
  }, [user.schoolId]);
  return (
    <>
      <PageHeader title="Inscription d'un élève" subtitle="Un élève à la fois, ou importez toute une liste en CSV." />
      <div className="mx-auto mb-6 max-w-3xl" role="radiogroup" aria-label="Mode d'inscription">
        <div className="flex gap-2">
          {([["unique", "Élève par élève"], ["import", "Import CSV"]] as const).map(([m, label]) => (
            <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className={cn("min-h-11 flex-1 rounded-full px-4 text-sm font-semibold", mode === m ? "bg-forest text-white" : "bg-white ring-1 ring-neutral-200")}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <AsyncView state={state} skeleton={<Skeleton className="mx-auto h-96 max-w-3xl" />}>
        {(d) => mode === "unique"
          ? <EnrollmentWizard overview={d.overview} parents={d.parents} childrenByParent={d.childrenByParent} />
          : <StudentCsvImport overview={d.overview} onImported={() => state.reload()} />}
      </AsyncView>
    </>
  );
}
