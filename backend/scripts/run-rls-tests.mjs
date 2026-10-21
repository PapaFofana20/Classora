/**
 * Exécute les suites pgTAP (`supabase/tests/*.test.sql`) contre une base
 * Supabase distante, sans Docker ni stack locale.
 *
 *   SCOLIA_DB_URL=postgresql://user:pass@db.<ref>.supabase.co:5432/postgres \
 *     node scripts/run-rls-tests.mjs
 *
 * Prérequis côté base : l'extension pgTAP doit être installée dans un schéma
 * `pgtap` (les tests font `set_config('search_path', 'pgtap, public, extensions')`) :
 *
 *   create schema if not exists pgtap;
 *   create extension if not exists pgtap with schema pgtap;
 *   alter extension pgtap set schema pgtap;
 *   grant usage on schema pgtap to anon, authenticated, service_role;
 *   grant execute on all functions in schema pgtap to anon, authenticated, service_role;
 *
 * Chaque fichier est encadré par `begin;` / `rollback;` : aucune donnée de test
 * ne subsiste en base.
 */
import pg from "pg";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const testsDir = path.join(root, "supabase", "tests");

const dbUrl = process.env.SCOLIA_DB_URL;
if (!dbUrl) {
  console.error(
    "SCOLIA_DB_URL est requis (ex. postgresql://postgres:<mdp>@db.<ref>.supabase.co:5432/postgres)"
  );
  process.exit(2);
}

const client = new pg.Client({ connectionString: dbUrl });
await client.connect();
await client.query("set search_path = pgtap, public, extensions");

const files = fs
  .readdirSync(testsDir)
  .filter((f) => f.endsWith(".test.sql"))
  .sort();

let failedFiles = 0;
let failedAsserts = 0;

for (const file of files) {
  const sql = fs.readFileSync(path.join(testsDir, file), "utf8");
  let result;
  try {
    result = await client.query(sql);
  } catch (err) {
    console.log(`\n### ${file}\n  ERREUR SQL : ${err.message}`);
    failedFiles++;
    try {
      await client.query("rollback");
    } catch {
      /* la transaction était déjà annulée */
    }
    continue;
  }

  const results = Array.isArray(result) ? result : [result];
  const failures = [];
  let passed = 0;
  let planned = null;

  // pgTAP renvoie une ligne par assertion : { "<nom du test>": "ok 12 - ..." }
  // ou { "<nom du test>": "not ok 12 - ..." }. La ligne { plan: "1..39" } donne
  // le nombre d'assertions attendues.
  for (const res of results) {
    for (const row of res.rows ?? []) {
      for (const value of Object.values(row)) {
        if (typeof value !== "string") continue;
        if (/^not ok \d+ - /i.test(value)) {
          failures.push(value);
        } else if (/^ok \d+ - /i.test(value)) {
          passed++;
        } else if (/^\d+\.\.\d+$/.test(value)) {
          planned = Number(value.split("..")[1]);
        }
      }
    }
  }

  failedAsserts += failures.length;
  console.log(`\n### ${file}`);
  console.log(`  ${passed} assertion(s) réussie(s)${planned ? ` / ${planned} attendue(s)` : ""}`);
  for (const f of failures) console.log(`  ECHEC : ${f}`);
}

console.log(
  `\n=== ${failedFiles} fichier(s) en erreur, ${failedAsserts} assertion(s) en échec`
);

await client.end();
process.exit(failedFiles || failedAsserts ? 1 : 0);
