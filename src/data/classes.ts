import type { ClassRoom } from "@/types";
import { SCHOOL_IDS, schoolSeeds } from "./schools";
import { levels } from "./school";

/** Classes du Collège Sainte Marie (écrites à la main : identifiants historiques). */
const sainteMarie: ClassRoom[] = [
  { schoolId: SCHOOL_IDS.sainteMarie, id: "c-ci-a", name: "CI A", levelId: "ci", cycle: "elementaire", headTeacherId: "ti-ci", capacity: 30 },
  { schoolId: SCHOOL_IDS.sainteMarie, id: "c-cp-a", name: "CP A", levelId: "cp", cycle: "elementaire", headTeacherId: "ti-cp", capacity: 30 },
  { schoolId: SCHOOL_IDS.sainteMarie, id: "c-ce1-a", name: "CE1 A", levelId: "ce1", cycle: "elementaire", headTeacherId: "ti-ce1", capacity: 32 },
  { schoolId: SCHOOL_IDS.sainteMarie, id: "c-ce2-a", name: "CE2 A", levelId: "ce2", cycle: "elementaire", headTeacherId: "ti-ce2", capacity: 32 },
  { schoolId: SCHOOL_IDS.sainteMarie, id: "c-cm1-a", name: "CM1 A", levelId: "cm1", cycle: "elementaire", headTeacherId: "ti-cm1", capacity: 35 },
  { schoolId: SCHOOL_IDS.sainteMarie, id: "c-cm2-a", name: "CM2 A", levelId: "cm2", cycle: "elementaire", headTeacherId: "ti-cm2a", capacity: 35 },
  { schoolId: SCHOOL_IDS.sainteMarie, id: "c-cm2-b", name: "CM2 B", levelId: "cm2", cycle: "elementaire", headTeacherId: "ti-cm2b", capacity: 35 },
  { schoolId: SCHOOL_IDS.sainteMarie, id: "c-6a", name: "6ème A", levelId: "6e", cycle: "moyen", headTeacherId: "t-fr2", capacity: 40 },
  { schoolId: SCHOOL_IDS.sainteMarie, id: "c-6b", name: "6ème B", levelId: "6e", cycle: "moyen", headTeacherId: "t-ang1", capacity: 40 },
  { schoolId: SCHOOL_IDS.sainteMarie, id: "c-5a", name: "5ème A", levelId: "5e", cycle: "moyen", headTeacherId: "t-hg1", capacity: 40 },
  { schoolId: SCHOOL_IDS.sainteMarie, id: "c-5b", name: "5ème B", levelId: "5e", cycle: "moyen", headTeacherId: "t-math1", capacity: 40 },
  { schoolId: SCHOOL_IDS.sainteMarie, id: "c-4a", name: "4ème A", levelId: "4e", cycle: "moyen", headTeacherId: "t-math2", capacity: 40 },
  { schoolId: SCHOOL_IDS.sainteMarie, id: "c-3a", name: "3ème A", levelId: "3e", cycle: "moyen", headTeacherId: "t-ang1", capacity: 40 },
  { schoolId: SCHOOL_IDS.sainteMarie, id: "c-2l", name: "2nde L", levelId: "2nde", cycle: "secondaire", series: "L", headTeacherId: "t-hg2", capacity: 40 },
  { schoolId: SCHOOL_IDS.sainteMarie, id: "c-2s", name: "2nde S", levelId: "2nde", cycle: "secondaire", series: "S", headTeacherId: "t-pc", capacity: 40 },
  { schoolId: SCHOOL_IDS.sainteMarie, id: "c-1l", name: "1ère L", levelId: "1ere", cycle: "secondaire", series: "L", headTeacherId: "t-ang2", capacity: 40 },
  { schoolId: SCHOOL_IDS.sainteMarie, id: "c-tl", name: "Tle L", levelId: "tle", cycle: "secondaire", series: "L", headTeacherId: "t-phil", capacity: 40 },
  { schoolId: SCHOOL_IDS.sainteMarie, id: "c-ts2", name: "Tle S2", levelId: "tle", cycle: "secondaire", series: "S2", headTeacherId: "t-math3", capacity: 40 },
];

const shortLevel = (levelId: string): string => (levelId === "tle" ? "Tle" : (levels.find((l) => l.id === levelId)?.label ?? levelId));

/** Classes générées pour les autres écoles de démonstration. */
const generated: ClassRoom[] = schoolSeeds.flatMap((seed) =>
  seed.levels.flatMap(({ levelId, sections, series }) => {
    const level = levels.find((l) => l.id === levelId);
    if (!level) return [];
    const seriesList = series?.length ? series : [undefined];
    return seriesList.flatMap((s) =>
      sections.map((section) => ({
        schoolId: seed.id,
        id: `c-${seed.prefix}-${levelId}${(s ?? section).toLowerCase()}`,
        name: `${shortLevel(levelId)} ${s ?? section}`,
        levelId,
        cycle: level.cycle,
        ...(s ? { series: s } : {}),
        headTeacherId: null,
        capacity: level.cycle === "elementaire" ? 35 : 40,
      })),
    );
  }),
);

export const classes: ClassRoom[] = [...sainteMarie, ...generated];