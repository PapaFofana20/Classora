import type { TeachingAssignment } from "@/types";
import { classes } from "./classes";
import { classSubjects } from "./classSubjects";
import { SCHOOL_IDS, schoolSeeds } from "./schools";
import { teachers } from "./teachers";

const MOYEN = ["c-6a", "c-6b", "c-5a", "c-5b", "c-4a", "c-3a"];
const SEC = ["c-2l", "c-2s", "c-1l", "c-tl", "c-ts2"];

/** [enseignant, matière, classes] — Moyen et Secondaire du Collège Sainte Marie. */
const PLAN: [string, string, string[]][] = [
  ["t-math1", "math", ["c-6a", "c-5b", "c-3a"]],
  ["t-math2", "math", ["c-6b", "c-5a", "c-4a", "c-2l", "c-2s"]],
  ["t-math3", "math", ["c-1l", "c-tl", "c-ts2"]],
  ["t-fr1", "fr", ["c-2l", "c-tl"]],
  ["t-fr2", "fr", MOYEN],
  ["t-phil", "fr", ["c-2s", "c-1l", "c-ts2"]],
  ["t-phil", "philo", ["c-1l", "c-tl", "c-ts2"]],
  ["t-ang1", "ang", MOYEN],
  ["t-ang2", "ang", SEC],
  ["t-hg1", "hg", MOYEN],
  ["t-hg2", "hg", SEC],
  ["t-sc", "svt", [...MOYEN, "c-2s", "c-ts2"]],
  ["t-pc", "pc", ["c-6a", "c-6b", "c-5a", "c-5b", "c-4a", "c-2s", "c-ts2"]],
  ["t-eps", "eps", [...MOYEN, ...SEC]],
];

const sainteMarie: TeachingAssignment[] = [
  ...PLAN.flatMap(([teacherId, subjectId, classIds]) => classIds.map((classId) => ({ schoolId: SCHOOL_IDS.sainteMarie, teacherId, classId, subjectId }))),
  // Élémentaire : l'instituteur titulaire reçoit automatiquement toutes les matières de la classe
  ...classes
    .filter((c) => c.schoolId === SCHOOL_IDS.sainteMarie && c.cycle === "elementaire")
    .flatMap((c) =>
      classSubjects
        .filter((cs) => cs.classId === c.id)
        .map((cs) => ({ schoolId: c.schoolId, teacherId: c.headTeacherId ?? "", classId: c.id, subjectId: cs.subjectId })),
    ),
];

/** Affectations générées pour les autres écoles : chaque matière est confiée à un enseignant de l'école. */
const generated: TeachingAssignment[] = schoolSeeds
  .filter((seed) => seed.teachers > 0)
  .flatMap((seed) => {
    const staff = teachers.filter((x) => x.schoolId === seed.id);
    const titulaire = staff.find((x) => x.kind === "instituteur");
    const profs = staff.filter((x) => x.kind === "professeur");
    return classes
      .filter((c) => c.schoolId === seed.id)
      .flatMap((c) =>
        classSubjects
          .filter((cs) => cs.classId === c.id)
          .map((cs, i) => {
            const teacher = c.cycle === "elementaire" && titulaire ? titulaire : (profs.find((p) => p.specialties.includes(cs.subjectId)) ?? profs[i % Math.max(1, profs.length)]);
            return { schoolId: c.schoolId, teacherId: teacher?.id ?? "", classId: c.id, subjectId: cs.subjectId };
          }),
      );
  });

export const assignments: TeachingAssignment[] = [...sainteMarie, ...generated];