import type { Cycle, Grade } from "@/types";

type Triple = Pick<Grade, "devoir1" | "devoir2" | "composition">;

export const round2 = (n: number): number => Math.round(n * 100) / 100;

export function devoirsAverage(g?: Triple): number | null {
  if (!g) return null;
  const v = [g.devoir1, g.devoir2].filter((x): x is number => x !== null);
  return v.length ? round2(v.reduce((a, b) => a + b, 0) / v.length) : null;
}

/**
 * Élémentaire : note de composition de la matière.
 * Moyen / secondaire : (moyenne des devoirs + composition) / 2.
 */
export function subjectAverage(g: Triple | undefined, cycle: Cycle): number | null {
  if (!g) return null;
  if (cycle === "elementaire") return g.composition;
  const d = devoirsAverage(g);
  if (d === null) return g.composition;
  if (g.composition === null) return d;
  return round2((d + g.composition) / 2);
}

export function weightedAverage(items: { average: number | null; coefficient: number }[]): number | null {
  const valid = items.filter((i): i is { average: number; coefficient: number } => i.average !== null);
  const total = valid.reduce((a, i) => a + i.coefficient, 0);
  if (!total) return null;
  return round2(valid.reduce((a, i) => a + i.average * i.coefficient, 0) / total);
}

/** Rang décroissant, ex æquo partagent le même rang. */
export function computeRanks(entries: { id: string; value: number | null }[]): Map<string, number> {
  const ranks = new Map<string, number>();
  const valid = entries.filter((e): e is { id: string; value: number } => e.value !== null).sort((a, b) => b.value - a.value);
  valid.forEach((e, i) => {
    const prev = valid[i - 1];
    ranks.set(e.id, prev && prev.value === e.value ? (ranks.get(prev.id) as number) : i + 1);
  });
  return ranks;
}

export function appreciation(avg: number | null): string {
  if (avg === null) return "—";
  if (avg >= 16) return "Excellent";
  if (avg >= 14) return "Très bien";
  if (avg >= 12) return "Bien";
  if (avg >= 10) return "Assez bien";
  if (avg >= 8) return "Passable";
  if (avg >= 5) return "Insuffisant";
  return "Très faible";
}

export function councilAppreciation(avg: number | null): string {
  if (avg === null) return "Résultats non disponibles.";
  if (avg >= 16) return "Félicitations du conseil de classe. Excellent semestre, continuez ainsi.";
  if (avg >= 14) return "Tableau d'honneur avec encouragements. Très bon travail.";
  if (avg >= 12) return "Bon travail dans l'ensemble. Encouragements du conseil de classe.";
  if (avg >= 10) return "Résultats satisfaisants mais irréguliers. Peut mieux faire.";
  if (avg >= 8) return "Résultats fragiles. Un effort soutenu est attendu dès la prochaine période.";
  return "Avertissement travail. Un suivi renforcé avec la famille est nécessaire.";
}

export function primaryAppreciation(avg: number | null, firstName: string): string {
  if (avg === null) return "Résultats non disponibles.";
  if (avg >= 14) return `${firstName} fournit un travail remarquable et participe activement en classe. Bravo !`;
  if (avg >= 12) return `${firstName} est un(e) élève sérieux(se). Les résultats sont encourageants.`;
  if (avg >= 10) return `Résultats corrects. ${firstName} doit gagner en régularité dans le travail à la maison.`;
  return `${firstName} rencontre des difficultés. Un accompagnement à la maison est recommandé.`;
}

export type Tone = "success" | "info" | "warning" | "danger" | "neutral";

export function averageTone(avg: number | null): Tone {
  if (avg === null) return "neutral";
  if (avg >= 14) return "success";
  if (avg >= 10) return "info";
  if (avg >= 8) return "warning";
  return "danger";
}

export type ParseResult = { ok: true; value: number | null } | { ok: false; error: string };

/** Valide une saisie de note (0 à 20, virgule acceptée). Vide = pas de note. */
export function parseGradeInput(raw: string): ParseResult {
  const text = raw.trim().replace(",", ".");
  if (text === "") return { ok: true, value: null };
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(text)) return { ok: false, error: "Saisissez un nombre entre 0 et 20." };
  const n = Number(text);
  if (n < 0 || n > 20) return { ok: false, error: "La note doit être comprise entre 0 et 20." };
  return { ok: true, value: n };
}

export function gradeCompletion(grades: Grade[], studentCount: number, cycle: Cycle): number {
  const perStudent = cycle === "elementaire" ? 1 : 3;
  const expected = studentCount * perStudent;
  if (!expected) return 0;
  const filled = grades.reduce(
    (a, g) => a + (cycle === "elementaire" ? (g.composition !== null ? 1 : 0) : [g.devoir1, g.devoir2, g.composition].filter((x) => x !== null).length),
    0,
  );
  return Math.min(100, Math.round((filled / expected) * 100));
}
