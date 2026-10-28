/**
 * Helpers de périodes (UTC) partagés par les routes analytiques.
 * Les dates de la base sont stockées en UTC ; on agrège donc toujours en UTC
 * pour que le découpage mensuel soit identique côté serveur et côté navigateur.
 */

/** Date du jour au format AAAA-MM-JJ (UTC). */
export function todayIso(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

/** Clé du mois courant AAAA-MM (UTC). */
export function monthKey(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

/**
 * Les `count` derniers mois, du plus ancien au plus récent.
 * Chaque entrée contient de quoi filtrer en base (startsAt / endsBefore).
 */
export function lastMonths(count, now = new Date()) {
  const out = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 1));
    const key = start.toISOString().slice(0, 7);
    const label = start
      .toLocaleDateString("fr-FR", { month: "short", timeZone: "UTC" })
      .replace(/\.$/, "");
    out.push({
      key,
      label,
      startsAt: `${key}-01`,
      endsBefore: next.toISOString().slice(0, 10),
    });
  }
  return out;
}

/** Début du mois courant (ISO date). */
export function monthStartIso(date = new Date()) {
  return `${monthKey(date)}-01`;
}

/** Nombre de jours entre deux dates AAAA-MM-JJ (b - a). */
export function daysBetween(a, b) {
  const start = Date.parse(`${a}T00:00:00Z`);
  const end = Date.parse(`${b}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return Math.round((end - start) / 86_400_000);
}

/** Libellé court et lisible d'une date AAAA-MM-JJ. */
export function shortDay(iso) {
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : "—";
}
