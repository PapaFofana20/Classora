import { AsyncView } from "@/components/ui/AsyncView";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAsync } from "@/hooks/useAsync";
import { EnrollmentWizard } from "@/features/students/EnrollmentWizard";
import { getSchoolOverview } from "@/services/schoolService";
import { listParents, listStudentRows } from "@/services/studentService";
import { useCurrentUser } from "@/context/AuthContext";

export default function StudentEnrollmentPage() {
  const user = useCurrentUser();
  const state = useAsync(async () => {
    const [overview, parents, students] = await Promise.all([getSchoolOverview(user.schoolId), listParents(user), listStudentRows(user)]);
    const childrenByParent = students.reduce<Record<string, number>>((acc, s) => ({ ...acc, [s.parentId]: (acc[s.parentId] ?? 0) + 1 }), {});
    return { overview, parents, childrenByParent };
  }, [user.schoolId]);
  return (
    <>
      <PageHeader title="Inscription d'un élève" subtitle="3 étapes : élève, parents, classe et frais." />
      <AsyncView state={state} skeleton={<Skeleton className="mx-auto h-96 max-w-3xl" />}>
        {(d) => <EnrollmentWizard overview={d.overview} parents={d.parents} childrenByParent={d.childrenByParent} />}
      </AsyncView>
    </>
  );
}
