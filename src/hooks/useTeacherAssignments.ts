import { useCallback, useMemo } from "react";
import type { ClassRoom, Teacher, TeachingAssignment } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { getTeacherAssignments } from "@/services/assignmentService";
import { getSchoolOverview } from "@/services/schoolService";
import { listTeacherRows } from "@/services/teacherService";
import { canEditGrades } from "@/utils/permissions";
import { useAsync } from "./useAsync";

export interface TeacherContextItem {
  key: string;
  classId: string;
  subjectId: string;
  className: string;
  subjectName: string;
  label: string;
}

export const contextKey = (classId: string, subjectId: string) => `${classId}|${subjectId}`;

interface Loaded {
  teacher: Teacher | null;
  assignments: TeachingAssignment[];
  contexts: TeacherContextItem[];
  /** Classes dont l'enseignant est titulaire (élémentaire) ou professeur principal. */
  headClasses: ClassRoom[];
  /** Toutes les classes dans lesquelles l'enseignant intervient. */
  classes: ClassRoom[];
}

const EMPTY: Loaded = { teacher: null, assignments: [], contexts: [], headClasses: [], classes: [] };

/** Charge les affectations de l'enseignant connecté et expose la règle canEditGrades. */
export function useTeacherAssignments() {
  const { user } = useAuth();
  const teacherId = user?.teacherId;
  const schoolId = user?.schoolId ?? "";
  const state = useAsync<Loaded>(async () => {
    if (!teacherId || !schoolId) return EMPTY;
    const [assignments, overview, rows] = await Promise.all([getTeacherAssignments(schoolId, teacherId), getSchoolOverview(schoolId), listTeacherRows(schoolId)]);
    const contexts = assignments
      .map((a) => {
        const c = overview.classes.find((x) => x.id === a.classId);
        const s = overview.subjects.find((x) => x.id === a.subjectId);
        return { key: contextKey(a.classId, a.subjectId), classId: a.classId, subjectId: a.subjectId, className: c?.name ?? "", subjectName: s?.name ?? "", label: `${c?.name ?? ""} · ${s?.name ?? ""}` };
      })
      .sort((a, b) => a.className.localeCompare(b.className, "fr") || a.subjectName.localeCompare(b.subjectName, "fr"));
    const classIds = new Set([...assignments.map((a) => a.classId), ...overview.classes.filter((c) => c.headTeacherId === teacherId).map((c) => c.id)]);
    const teacher = rows.find((r) => r.id === teacherId) ?? null;
    return {
      teacher: teacher ? { ...teacher } : null,
      assignments,
      contexts,
      headClasses: overview.classes.filter((c) => c.headTeacherId === teacherId),
      classes: overview.classes.filter((c) => classIds.has(c.id)),
    };
  }, [teacherId, schoolId]);

  const loaded = state.data ?? EMPTY;
  const canEdit = useCallback((classId: string, subjectId: string) => canEditGrades(loaded.teacher, classId, subjectId, loaded.assignments), [loaded]);
  return useMemo(() => ({ ...loaded, canEdit, loading: state.loading, error: state.error, reload: state.reload }), [loaded, canEdit, state.loading, state.error, state.reload]);
}
