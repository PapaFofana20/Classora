/**
 * Validation des entrées à la frontière des Edge Functions (zod-like, sans
 * dépendance réseau). Chaque validateur lève une erreur avec le message
 * français attendu par le front.
 */

export class ValidationError extends Error {}

export function expectObject(body: unknown, message = "Requête invalide."): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ValidationError(message);
  }
  return body as Record<string, unknown>;
}

export function requireString(
  obj: Record<string, unknown>,
  field: string,
  label: string,
  { min = 0, max = 200, trim = true } = {},
): string {
  const raw = obj[field];
  if (typeof raw !== "string") throw new ValidationError(`${label} est obligatoire.`);
  const value = (trim ? raw.trim() : raw);
  if (value.length < min || value.length > max) {
    throw new ValidationError(`${label} contient entre ${min} et ${max} caractères.`);
  }
  return value;
}

export function optionalString(
  obj: Record<string, unknown>,
  field: string,
  label: string,
  max = 200,
): string | undefined {
  const raw = obj[field];
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "string") throw new ValidationError(`${label} est invalide.`);
  const value = raw.trim();
  if (value.length > max) throw new ValidationError(`${label} est trop long (max ${max} caractères).`);
  return value;
}

export function requireCycles(obj: Record<string, unknown>): string[] {
  const raw = obj["cycles"];
  const allowed = new Set(["elementaire", "moyen", "secondaire"]);
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new ValidationError("Sélectionnez au moins un cycle.");
  }
  const cycles = raw.filter((c): c is string => typeof c === "string" && allowed.has(c));
  if (cycles.length === 0 || cycles.length !== raw.length) {
    throw new ValidationError("Sélection de cycles invalide.");
  }
  return Array.from(new Set(cycles));
}

export function requireStringArray(
  obj: Record<string, unknown>,
  field: string,
  label: string,
  maxItems = 20,
): string[] {
  const raw = obj[field];
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw) || raw.some((v) => typeof v !== "string" || v.length > 80)) {
    throw new ValidationError(`${label} est invalide.`);
  }
  if (raw.length > maxItems) {
    throw new ValidationError(`${label} : ${maxItems} éléments maximum.`);
  }
  return raw.map((v) => (v as string).trim()).filter(Boolean);
}

/** E-mail : obligatoire, normalisé en minuscules. */
export function requireEmail(obj: Record<string, unknown>, field = "email"): string {
  const raw = requireString(obj, field, "L'e-mail", { max: 120, trim: true });
  const email = raw.toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw new ValidationError("L'e-mail est invalide.");
  }
  return email;
}

/** Tél. sénégalais : format 7X XXX XX XX (investigation identique au front). */
export function requireSnPhone(obj: Record<string, unknown>, field: string, label: string): string {
  const raw = requireString(obj, field, label, { max: 20, trim: true });
  if (!/^(\+221)?\s?7[0678]\s?\d{3}\s?\d{2}\s?\d{2}$/.test(raw)) {
    throw new ValidationError(`${label} est invalide.`);
  }
  return raw;
}

/** Date ISO (AAAA-MM-JJ) optionnelle (élève : naissance) — jour calendaire réel. */
export function optionalIsoDate(obj: Record<string, unknown>, field: string, label: string): string | undefined {
  const raw = optionalString(obj, field, label, 10);
  if (raw === undefined || raw === "") return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!m) throw new ValidationError(`${label} est invalide.`);
  // Contrôle strict du calendrier : `new Date("2026-02-31")` ne renvoie pas NaN.
  const [, y, mo, d] = m;
  const dt = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  if (dt.getUTCFullYear() !== Number(y) || dt.getUTCMonth() !== Number(mo) - 1 || dt.getUTCDate() !== Number(d)) {
    throw new ValidationError(`${label} est invalide.`);
  }
  return raw;
}

export function requireUuid(obj: Record<string, unknown>, field: string, label: string): string {
  const raw = requireString(obj, field, label, { max: 64, trim: true });
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) {
    throw new ValidationError(`${label} est invalide.`);
  }
  return raw;
}

export function optionalUuid(obj: Record<string, unknown>, field: string, label: string): string | undefined {
  const raw = optionalString(obj, field, label, 64);
  if (raw === undefined || raw === "") return undefined;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) {
    throw new ValidationError(`${label} est invalide.`);
  }
  return raw;
}

export function bool(obj: Record<string, unknown>, field: string, defaultValue: boolean): boolean {
  const raw = obj[field];
  if (raw === undefined || raw === null) return defaultValue;
  if (typeof raw !== "boolean") throw new ValidationError("Requête invalide.");
  return raw;
}
