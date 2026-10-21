/**
 * Pousse les migrations vers une base Supabase distante (production).
 *   SCOLIA_DB_URL=postgresql://user:pass@db.<ref>.supabase.co:5432/postgres npm run db:push:remote
 *
 * NOTE : le seed (supabase/seed.sql — école et comptes de démonstration,
 * mot de passe connu) n'est JAMAIS poussé ici : il servirait de porte
 * d'entrée en production.
 */
import { spawnSync } from "node:child_process";

const dbUrl = process.env.SCOLIA_DB_URL;
if (!dbUrl) {
  console.error(
    "SCOLIA_DB_URL est requis (ex. postgresql://postgres:<mdp>@db.<ref>.supabase.co:5432/postgres)"
  );
  console.error(
    "Postgres complet : Supabase Dashboard > Project Settings > Database > Connection string > Direct connection (mot de passe inclus), exposé derrière db.<ref>.supabase.co:5432."
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
  "--yes",
];

const res = spawnSync("npx", args, { stdio: "inherit", shell: true });
process.exit(res.status ?? 1);
