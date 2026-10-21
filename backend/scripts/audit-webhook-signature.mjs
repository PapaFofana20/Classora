// ============================================================================
// AUDIT — Test exécutable de la vérification de signature du webhook.
// Reproduit la logique de supabase/functions/_shared/payments.ts (bundlée
// avec esbuild, Deno simulé) et vérifie qu'aucune signature invalide ne
// passe, et qu'un secret non configuré ne retombe pas sur une valeur par
// défaut.
//
// Lancement : node scripts/audit-webhook-signature.mjs
// ============================================================================
import { build } from "esbuild";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHmac } from "node:crypto";

const ROOT = resolve(process.cwd());
const TMP = mkdtempSync(join(tmpdir(), "scolia-webhook-"));
const OUT = join(TMP, "payments.mjs");

// Deno simulé : les variables d'environnement sont lues à l'appel.
globalThis.Deno = {
  env: { get: (k) => (globalThis.__DENO_ENV__ ?? {})[k] },
};

await build({
  stdin: {
    contents: `export { verifyWebhookSignature } from "@/supabase/functions/_shared/payments.ts";`,
    resolveDir: ROOT,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node20",
  outfile: OUT,
  alias: { "@": ROOT },
  logLevel: "silent",
});

const mod = await import(pathToFileURL(OUT).href);
const verify = mod.verifyWebhookSignature;

let failures = 0;
let checks = 0;
async function ok(label, fn, expected) {
  checks++;
  let result;
  try {
    await fn();
    result = "ok";
  } catch (e) {
    result = `erreur: ${e.message}`;
  }
  if (result === expected) {
    console.log(`  ok ${label}`);
  } else {
    failures++;
    console.log(`  x ${label}\n      obtenu  = ${result}\n      attendu = ${expected}`);
  }
}

const BODY = JSON.stringify({ provider: "wave", reference: "WV-1234-5678", status: "succeeded" });
const SECRET = "un-secret-de-test-suffisamment-long";

globalThis.__DENO_ENV__ = { SCOLIA_WEBHOOK_SECRET: SECRET };

const sign = (body, secret = SECRET) => createHmac("sha256", secret).update(body, "utf8").digest("hex");

console.log("\n[1] Signature webhook");
await ok("une signature valide est acceptée", () => verify(BODY, sign(BODY)), "ok");
await ok("une signature invalide est refusée", () => verify(BODY, sign(BODY, "autre-secret")), "erreur: Signature de webhook invalide.");
await ok("une signature vide est refusée", () => verify(BODY, ""), "erreur: Signature de webhook absente.");
await ok("une signature absente est refusée", () => verify(BODY, null), "erreur: Signature de webhook absente.");
await ok("le corps modifié invalide la signature", () => verify(BODY + " ", sign(BODY)), "erreur: Signature de webhook invalide.");

console.log("\n[2] Secret non configuré");
globalThis.__DENO_ENV__ = {};
await ok(
  "un secret absent fait échouer la vérification (aucune valeur par défaut)",
  () => verify(BODY, sign(BODY)),
  "erreur: SCOLIA_WEBHOOK_SECRET n'est pas configuré (16 caractères minimum, et jamais la valeur par défaut).",
);
globalThis.__DENO_ENV__ = { SCOLIA_WEBHOOK_SECRET: "scolia-dev-secret" };
await ok(
  "la valeur par défaut historique est refusée",
  () => verify(BODY, sign(BODY, "scolia-dev-secret")),
  "erreur: SCOLIA_WEBHOOK_SECRET n'est pas configuré (16 caractères minimum, et jamais la valeur par défaut).",
);

console.log(`\n--- ${checks} vérifications, ${failures} échec(s) ---`);
process.exit(failures === 0 ? 0 : 1);
