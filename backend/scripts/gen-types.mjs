/**
 * Génère les types TypeScript de la base Supabase distante.
 *   SCOLIA_DB_URL=postgresql://user:pass@db.<ref>.supabase.co:5432/postgres npm run types:db:remote
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dbUrl = process.env.SCOLIA_DB_URL;
if (!dbUrl) {
  console.error(
    "SCOLIA_DB_URL est requis (ex. postgresql://postgres:<mdp>@db.<ref>.supabase.co:5432/postgres)"
  );
  process.exit(2);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outFile = path.join(root, "..", "frontend", "src", "types", "database.generated.ts");

const res = spawnSync(
  "npx",
  ["supabase", "gen", "types", "typescript", "--db-url", dbUrl, "--schema", "public"],
  { encoding: "utf8", shell: true }
);

if (res.status !== 0) {
  console.error(res.stderr || res.stdout || "échec de la génération des types");
  process.exit(res.status ?? 1);
}

// La CLI écrit les types sur stdout ; les messages de progression vont sur stderr.
fs.writeFileSync(outFile, res.stdout, "utf8");
console.log(`types écrits dans ${path.relative(root, outFile)}`);
