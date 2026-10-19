/**
 * Empreinte de mot de passe SIMULÉE pour la démonstration front.
 *
 * ⚠️ Ce code n'est pas une sécurité : il s'exécute dans le navigateur.
 * En production, le hachage se fait exclusivement côté serveur
 * (Supabase Auth / argon2id / bcrypt) et aucun mot de passe ne transite
 * par le client. Voir SUPABASE_NOTES.md.
 */

/** Sel fixe de la démo (le vrai serait aléatoire, stocké avec l'empreinte). */
const DEMO_SALT = "classora::demo::2026";

const fnv1a = (input: string, seed: number): number => {
  let h = seed >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
};

const scramble = (input: string, salt: string): string => {
  let h = fnv1a(input, 2166136261);
  for (let round = 0; round < 2048; round++) h = fnv1a(`${salt}#${round}#${h.toString(16)}`, h);
  return h.toString(16).padStart(8, "0");
};

/** Empreinte stockée en base : `demo$<sel>$<empreinte>` (jamais renvoyée au client). */
export function hashPassword(plain: string, salt: string = DEMO_SALT): string {
  return `demo$${salt}$${scramble(plain, salt)}`;
}

/** Comparaison à temps constant de l'empreinte stockée. */
export function verifyPassword(plain: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "demo") return false;
  const expected = hashPassword(plain, parts[1]);
  if (expected.length !== stored.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ stored.charCodeAt(i);
  return diff === 0;
}