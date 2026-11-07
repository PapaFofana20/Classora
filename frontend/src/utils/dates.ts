/** Petits calculs de dates ISO (AAAA-MM-JJ), sans dépendance. */
// Convertit une date ISO en instant UTC pour éviter les décalages d'heure.
export function toUtc(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Date.UTC(y, (m || 1) - 1, d || 1);
}

// Ajoute un nombre de jours à une date ISO et renvoie la date au même format.
export function addDaysIso(iso: string, days: number): string {
  const d = new Date(toUtc(iso) + days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

/** Nombre de jours entiers entre deux dates ISO (b - a). Négatif si b est dans le passé. */
export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((toUtc(toIso) - toUtc(fromIso)) / 86_400_000);
}

/** Jours restants avant `iso`, positif si la date est future. */
export function daysUntil(iso: string, todayIso: string): number {
  return daysBetween(todayIso, iso);
}

/** « dans 5 jours » / « il y a 3 jours » / « aujourd'hui ». */
export function relativeDays(iso: string, todayIso: string): string {
  const n = daysUntil(iso, todayIso);
  if (n === 0) return "aujourd'hui";
  if (n === 1) return "demain";
  if (n === -1) return "hier";
  return n > 0 ? `dans ${n} jours` : `il y a ${-n} jours`;
}