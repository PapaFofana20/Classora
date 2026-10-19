import type { ClassSubject, Cycle } from "@/types";
import { classes } from "./classes";

/** Coefficients par cycle (base de toutes les écoles). */
const BY_CYCLE: Record<Cycle, Record<string, number>> = {
  elementaire: { fr: 1, math: 1, sci: 1, hg: 1, civ: 1, arts: 1, eps: 1 },
  moyen: { math: 3, fr: 3, ang: 2, hg: 2, svt: 2, pc: 2, eps: 1 },
  secondaire: { fr: 3, math: 4, ang: 2, hg: 2, svt: 2, pc: 2, philo: 2, eps: 1 },
};

/** Coefficients spécifiques du secondaire du Collège Sainte Marie (selon la série). */
const SAINTE_MARIE_SECONDAIRE: Record<string, Record<string, number>> = {
  "c-2l": { fr: 4, ang: 3, hg: 3, math: 2, eps: 1 },
  "c-1l": { fr: 4, philo: 3, hg: 3, ang: 3, math: 2, eps: 1 },
  "c-tl": { philo: 5, fr: 4, hg: 3, ang: 3, math: 2, eps: 1 },
  "c-2s": { math: 5, pc: 5, svt: 3, fr: 3, ang: 2, hg: 2, eps: 1 },
  "c-ts2": { math: 5, pc: 5, svt: 5, philo: 2, fr: 2, ang: 2, hg: 2, eps: 1 },
};

export const classSubjects: ClassSubject[] = classes.flatMap((c) => {
  const table = SAINTE_MARIE_SECONDAIRE[c.id] ?? BY_CYCLE[c.cycle];
  return Object.entries(table).map(([subjectId, coefficient]) => ({ schoolId: c.schoolId, classId: c.id, subjectId, coefficient }));
});