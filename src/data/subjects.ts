import type { Cycle, Subject } from "@/types";
import { schoolSeeds } from "./schools";

/** Catalogue national : chaque école ne conserve que les matières de ses cycles. */
const CATALOGUE: { id: string; name: string; cycles: Cycle[] }[] = [
  { id: "fr", name: "Français", cycles: ["elementaire", "moyen", "secondaire"] },
  { id: "math", name: "Mathématiques", cycles: ["elementaire", "moyen", "secondaire"] },
  { id: "sci", name: "Éveil scientifique", cycles: ["elementaire"] },
  { id: "hg", name: "Histoire-Géographie", cycles: ["elementaire", "moyen", "secondaire"] },
  { id: "civ", name: "Instruction civique et morale", cycles: ["elementaire"] },
  { id: "arts", name: "Arts plastiques", cycles: ["elementaire"] },
  { id: "ang", name: "Anglais", cycles: ["moyen", "secondaire"] },
  { id: "svt", name: "Sciences de la vie et de la Terre", cycles: ["moyen", "secondaire"] },
  { id: "pc", name: "Physique-Chimie", cycles: ["moyen", "secondaire"] },
  { id: "philo", name: "Philosophie", cycles: ["secondaire"] },
  { id: "eps", name: "Éducation physique et sportive", cycles: ["elementaire", "moyen", "secondaire"] },
];

export const subjects: Subject[] = schoolSeeds.flatMap((school) =>
  CATALOGUE.filter((s) => s.cycles.some((c) => school.cycles.includes(c))).map((s) => ({ schoolId: school.id, id: s.id, name: s.name, cycles: s.cycles })),
);

export const SUBJECT_NAMES: Record<string, string> = Object.fromEntries(CATALOGUE.map((s) => [s.id, s.name]));