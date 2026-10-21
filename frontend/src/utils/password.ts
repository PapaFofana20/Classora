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

export function passwordStrength(value: string): StrengthResult {
  const satisfied = PASSWORD_RULES.filter((r) => r.test(value)).map((r) => r.id);
  const score = satisfied.length;
  const strength: PasswordStrength = score <= 2 ? "faible" : score === 3 ? "moyen" : "fort";
  return { strength, score, label: `Mot de passe ${strength}`, satisfied };
}

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
  const bytes = new Uint32Array(12);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (b) => READABLE[b % READABLE.length]);
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  chars[0] = lower[bytes[0] % lower.length];
  chars[1] = upper[bytes[1] % upper.length];
  chars[2] = digits[bytes[2] % digits.length];
  chars[3] = lower[bytes[3] % lower.length];
  return chars.join("");
}