/**
 * Mots de passe : règles lisibles, indicateur de force et génération d'un mot de
 * passe temporaire lisible (12 caractères, sans 0/O/1/I pour qu'il soit dicté
 * au téléphone sans erreur).
 */

export const PASSWORD_MIN = 8;

export const PASSWORD_RULES = [
  { id: "len", label: "Au moins 8 caractères", test: (v: string) => v.length >= PASSWORD_MIN },
  { id: "lower", label: "Une lettre minuscule", test: (v: string) => /[a-z]/.test(v) },
  { id: "upper", label: "Une lettre majuscule", test: (v: string) => /[A-Z]/.test(v) },
  { id: "digit", label: "Un chiffre", test: (v: string) => /\d/.test(v) },
] as const;

export type PasswordStrength = "faible" | "moyen" | "fort";

export interface StrengthResult {
  strength: PasswordStrength;
  /** 0 à 4 pour la barre de progression. */
  score: number;
  label: string;
  satisfied: (typeof PASSWORD_RULES)[number]["id"][];
}

const READABLE = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const LOWER = "abcdefghijkmnopqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";

/** Tirage uniforme sans biais modulo (échantillonnage avec rejet). */
function randomBelow(limit: number): number {
  const limit32 = 0x100000000;
  const range = Math.floor(limit32 / limit) * limit;
  const buf = new Uint32Array(1);
  let b: number;
  do {
    crypto.getRandomValues(buf);
    b = buf[0];
  } while (b >= range);
  return b % limit;
}

// Calcule la force d'un mot de passe et indique les règles déjà satisfaites.
export function passwordStrength(value: string): StrengthResult {
  const satisfied = PASSWORD_RULES.filter((r) => r.test(value)).map((r) => r.id);
  const score = satisfied.length;
  const strength: PasswordStrength = score <= 2 ? "faible" : score === 3 ? "moyen" : "fort";
  return { strength, score, label: `Mot de passe ${strength}`, satisfied };
}

// Renvoie le premier problème de mot de passe, en français, ou null si tout va bien.
export function passwordError(value: string, confirm?: string): string | null {
  if (!value) return "Le mot de passe est obligatoire.";
  if (value.length < PASSWORD_MIN) return `Au moins ${PASSWORD_MIN} caractères.`;
  const missing = PASSWORD_RULES.filter((r) => !r.test(value)).map((r) => r.label);
  if (missing.length) return `Il manque : ${missing.join(", ").toLowerCase()}.`;
  if (confirm !== undefined && value !== confirm) return "Les mots de passe ne correspondent pas.";
  return null;
}

/**
 * Mot de passe temporaire de 12 caractères, lisible et prononçable par téléphone.
 * Garantit au moins une minuscule, une majuscule et un chiffre.
 */
export function generateTempPassword(): string {
  const chars = Array.from({ length: 12 }, () => READABLE[randomBelow(READABLE.length)]);
  chars[0] = LOWER[randomBelow(LOWER.length)];
  chars[1] = UPPER[randomBelow(UPPER.length)];
  chars[2] = DIGITS[randomBelow(DIGITS.length)];
  chars[3] = LOWER[randomBelow(LOWER.length)];
  return chars.join("");
}