import type { Grade, ReportMeta } from "@/types";
import { classes } from "./classes";
import { classSubjects } from "./classSubjects";
import { SCHOOL_IDS } from "./schools";
import { CONDUCT_OPTIONS } from "./school";
import { hashString, mulberry32, pick } from "./seed";
import { students } from "./students";

/** Classes dont toutes les notes du 1er semestre sont saisies. */
const COMPLETE = new Set(["c-ce2-a", "c-4a", "c-cm2-a", "c-6a", "c-2l", "c-tl"]);

type Fill = "full" | "d2" | "d1";

function fillFor(classId: string, subjectId: string): Fill {
  if (COMPLETE.has(classId)) return "full";
  if (classId === "c-5b" && subjectId === "math") return "d2";
  if (classId === "c-3a" && subjectId === "math") return "d1";
  const h = hashString(classId + subjectId) % 6;
  return h === 0 ? "d1" : h === 1 ? "d2" : "full";
}

const clamp = (n: number) => Math.min(20, Math.max(1, Math.round(n * 2) / 2));

export const grades: Grade[] = [];
export const reportMetas: ReportMeta[] = [];

for (const s of students) {
  const cls = classes.find((c) => c.id === s.classId);
  if (!cls) continue;
  const ability = 7 + mulberry32(hashString(s.id))() * 8;
  const r = mulberry32(hashString("g" + s.id));
  for (const cs of classSubjects.filter((x) => x.classId === s.classId)) {
    const fill = fillFor(cs.classId, cs.subjectId);
    const noise = () => clamp(ability + (r() - 0.5) * 6);
    if (cls.cycle === "elementaire") {
      grades.push({ schoolId: cls.schoolId, studentId: s.id, classId: cls.id, subjectId: cs.subjectId, period: "S1", devoir1: null, devoir2: null, composition: fill === "full" ? noise() : null });
    } else {
      grades.push({
        schoolId: cls.schoolId,
        studentId: s.id,
        classId: cls.id,
        subjectId: cs.subjectId,
        period: "S1",
        devoir1: noise(),
        devoir2: fill === "d1" ? null : noise(),
        composition: fill === "full" ? noise() : null,
      });
    }
  }
  reportMetas.push({
    schoolId: cls.schoolId,
    studentId: s.id,
    period: "S1",
    conduct: pick(CONDUCT_OPTIONS.slice(0, 4), r()),
    absences: Math.floor(r() * 7),
    comment: "",
  });
}

/** Effectif total de l'école de démonstration (pour les limites de forfait). */
export const DEMO_SCHOOL = SCHOOL_IDS.sainteMarie;