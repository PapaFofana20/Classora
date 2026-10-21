/**
 * Matricule d'école : 5 caractères alphanumériques sans caractères ambigus
 * (aucun 0, O, 1, I) pour être lu sans erreur au téléphone et dicté au standard.
 *
 * Format : X7K9Q
 */

export const MATRICULE_LENGTH = 5;

/** Alphabet sans 0 / O / 1 / I (lettres et chiffres uniquement). */
export const MATRICULE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

const AMBIGUOUS = /[01OI]/gi;

/** Un code élève comporte un caractère de plus (6) : il est transmis par l'école aux familles. */
export const CHILD_CODE_LENGTH = 6;

/**
 * Génère un code non devinable à partir de crypto.getRandomValues.
 * @param taken codes déjà attribués (unicité garantie)
 * @param length longueur du code
 */
export function generateCode(taken: readonly string[] = [], length: number = MATRICULE_LENGTH): string {
  const used = new Set(taken.map((c) => c.toUpperCase()));
  const alphabet = MATRICULE_ALPHABET;
  const limit = alphabet.length;
  for (let attempt = 0; attempt < 200; attempt++) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    let out = "";
    for (let i = 0; i < length; i++) out += alphabet[bytes[i] % limit];
    if (!used.has(out)) return out;
  }
  /* Repli (cas extrême) : on force un suffixe numérique unique. */
  let n = used.size + 2;
  let candidate = "";
  do {
    candidate = String(n++).padStart(length, "2").slice(0, length).replace(AMBIGUOUS, "2");
  } while (used.has(candidate));
  return candidate;
}

export const generateMatricule = (taken: readonly string[] = []) => generateCode(taken, MATRICULE_LENGTH);
export const generateChildCode = (taken: readonly string[] = []) => generateCode(taken, CHILD_CODE_LENGTH);

/**
 * Nettoie une saisie collée depuis WhatsApp : majuscules automatiques,
 * espaces, tirets et points tolérés, caractères ambigus retirés.
 * « x7 k-9q » → « X7K9Q »
 */
export function formatMatriculeInput(raw: string, length: number = MATRICULE_LENGTH): string {
  const cleaned = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(AMBIGUOUS, "");
  return cleaned.slice(0, length);
}

export function isValidMatricule(raw: string, length: number = MATRICULE_LENGTH): boolean {
  const v = formatMatriculeInput(raw, length);
  if (v.length !== length) return false;
  return Array.from(v).every((c) => MATRICULE_ALPHABET.includes(c));
}

/** Affichage par groupes pour la lecture à voix haute : X7K9Q reste X7K9Q (5 car.). */
export function displayCode(raw: string): string {
  return raw.trim().toUpperCase();
}

/** Message d'erreur affiché sous le champ, selon ce qui a été saisi. */
export function matriculeError(raw: string): string | null {
  const v = formatMatriculeInput(raw);
  if (!v) return null;
  if (v.length < MATRICULE_LENGTH) return `Il manque ${MATRICULE_LENGTH - v.length} caractère(s). Le matricule comporte ${MATRICULE_LENGTH} caractères.`;
  return null;
}