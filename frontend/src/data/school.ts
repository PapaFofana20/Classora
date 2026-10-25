import type { Cycle, Level, LevelFees, Period, PeriodType } from "@/types";

/**
 * Date du jour (ISO aaaa-mm-jj), évaluée À CHAQUE APPEL : une constante figée
 * au chargement du module dérivait après minuit UTC (échéances « échues »,
 * jours restants d'abonnement, date affichée dans la barre supérieure).
 */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
export const SCHOOL_YEAR = "2026-2027";

export const CYCLES: Cycle[] = ["elementaire", "moyen", "secondaire"];

export const CYCLE_LABELS: Record<Cycle, string> = {
  elementaire: "Élémentaire",
  moyen: "Moyen",
  secondaire: "Secondaire",
};

export const CYCLE_EXAMS: Record<Cycle, string> = {
  elementaire: "CFEE",
  moyen: "BFEM",
  secondaire: "BAC",
};

export const levels: Level[] = [
  { id: "ci", label: "CI", cycle: "elementaire", order: 0 },
  { id: "cp", label: "CP", cycle: "elementaire", order: 1 },
  { id: "ce1", label: "CE1", cycle: "elementaire", order: 2 },
  { id: "ce2", label: "CE2", cycle: "elementaire", order: 3 },
  { id: "cm1", label: "CM1", cycle: "elementaire", order: 4 },
  { id: "cm2", label: "CM2", cycle: "elementaire", order: 5, exam: "CFEE" },
  { id: "6e", label: "6ème", cycle: "moyen", order: 6 },
  { id: "5e", label: "5ème", cycle: "moyen", order: 7 },
  { id: "4e", label: "4ème", cycle: "moyen", order: 8 },
  { id: "3e", label: "3ème", cycle: "moyen", order: 9, exam: "BFEM" },
  { id: "2nde", label: "2nde", cycle: "secondaire", order: 10 },
  { id: "1ere", label: "1ère", cycle: "secondaire", order: 11 },
  { id: "tle", label: "Terminale", cycle: "secondaire", order: 12, exam: "BAC" },
];

export const SERIES_OPTIONS = ["L", "L1", "L2", "S1", "S2", "S3"];

export const SCHOOL_MONTHS: { label: string; year: number; month: number }[] = [
  { label: "Octobre", year: 2026, month: 10 },
  { label: "Novembre", year: 2026, month: 11 },
  { label: "Décembre", year: 2026, month: 12 },
  { label: "Janvier", year: 2027, month: 1 },
  { label: "Février", year: 2027, month: 2 },
  { label: "Mars", year: 2027, month: 3 },
  { label: "Avril", year: 2027, month: 4 },
  { label: "Mai", year: 2027, month: 5 },
  { label: "Juin", year: 2027, month: 6 },
  { label: "Juillet", year: 2027, month: 7 },
];

export const CONDUCT_OPTIONS = ["Excellente", "Très bonne", "Bonne", "Passable", "À surveiller"];

/** Frais de référence — multipliés par `feesFactor` selon l'école (data/schools). */
export const DEFAULT_FEES: Record<string, LevelFees> = {
  ci: { inscription: 30000, mensualite: 20000 },
  cp: { inscription: 30000, mensualite: 20000 },
  ce1: { inscription: 30000, mensualite: 22500 },
  ce2: { inscription: 30000, mensualite: 25000 },
  cm1: { inscription: 35000, mensualite: 25000 },
  cm2: { inscription: 35000, mensualite: 27500 },
  "6e": { inscription: 40000, mensualite: 30000 },
  "5e": { inscription: 40000, mensualite: 30000 },
  "4e": { inscription: 40000, mensualite: 32500 },
  "3e": { inscription: 45000, mensualite: 35000 },
  "2nde": { inscription: 50000, mensualite: 40000 },
  "1ere": { inscription: 50000, mensualite: 42500 },
  tle: { inscription: 55000, mensualite: 45000 },
};

export const DEFAULT_ANNEX_FEES = { cantine: 10000, transport: 15000, tenue: 12000 };

export const DEFAULT_SIBLING_DISCOUNT = 10;

/** Arrondi à 500 FCFA (usage interne aux données de démonstration). */
export const roundFee = (value: number): number => Math.round(value / 500) * 500;

export function scaleFees(factor: number): Record<string, LevelFees> {
  return Object.fromEntries(
    Object.entries(DEFAULT_FEES).map(([id, f]) => [id, { inscription: roundFee(f.inscription * factor), mensualite: roundFee(f.mensualite * factor) }]),
  );
}

export function getPeriods(type: PeriodType): Period[] {
  return type === "semestre"
    ? [
        { id: "S1", label: "1er semestre" },
        { id: "S2", label: "2e semestre" },
      ]
    : [
        { id: "T1", label: "1er trimestre" },
        { id: "T2", label: "2e trimestre" },
        { id: "T3", label: "3e trimestre" },
      ];
}