/**
 * Chargement minimal des fichiers d'environnement locaux.
 *
 * Sans cela, `npm run dev` (node src/index.js) ignorait `.env.local` : la clé
 * `service_role` restait absente, et la connexion admin échouait en local avec
 * un message trompeur. Aucune dépendance : lecture de `.env.local` puis
 * `.env`, sans jamais écraser une variable déjà fournie par la plateforme
 * (Render reste prioritaire).
 *
 * Ce module doit être importé AVANT `config.js`.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Racine de l'application (backend/api), quel que soit le répertoire courant. */
const APP_ROOT = fileURLToPath(new URL("../", import.meta.url));

function unquote(value) {
  const trimmed = value.trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
}

for (const file of [".env.local", ".env"]) {
  const path = resolve(APP_ROOT, file);
  if (!existsSync(path)) continue;
  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const [, key, raw] = match;
    // Commentaire en fin de ligne (dièse précédé d'un blanc) : syntaxe dotenv
    // usuelle. Un « # » collé à la valeur (ex. mot de passe) est conservé.
    const value = unquote(raw.replace(/\s+#.*$/, ""));
    if (process.env[key] === undefined) process.env[key] = value;
  }
  console.log(`[scolia-api] variables chargées depuis ${file}`);
}
