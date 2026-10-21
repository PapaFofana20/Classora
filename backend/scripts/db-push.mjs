/**
 * Pousse les migrations vers une base Supabase distante.
 *   SCOLIA_DB_URL=postgresql://user:pass@db.<ref>.supabase.co:5432/postgres npm run db:push:remote
 */
import { spawnSync } from "node:child_process";

const dbUrl = process.env.SCOLIA_DB_URL;
if (!dbUrl) {
  console.error(
    "SCOLIA_DB_URL est requis (ex. postgresql://postgres:<mdp>@db.<ref>.supabase.co:5432/postgres)"
  );
  process.exit(2);
}

const args = [
  "supabase",
  "db",
  "push",
  "--db-url",
  dbUrl,
  "--skip-vault",
  "--include-seed",
  "--yes",
];

const res = spawnSync("npx", args, { stdio: "inherit", shell: true });
process.exit(res.status ?? 1);
