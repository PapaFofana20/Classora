// ============================================================================
// Confirmation LOCALE d'un paiement (bac à sable / développement).
//
// Le secret de signature du webhook n'est JAMAIS connu du navigateur : il vit
// dans l'environnement du poste de développement. Ce script joue le rôle du
// prestataire de paiement : il signe la confirmation (HMAC-SHA256) et l'envoie
// au webhook.
//
// Usage (PowerShell) :
//   $env:SCOLIA_WEBHOOK_SECRET = "scolia-dev-secret"
//   node scripts/confirm-sandbox-payment.mjs wave WV-1234-5678 succeeded
//
// En production, c'est le prestataire (Wave / Orange Money / Free Money) qui
// appelle le webhook avec la même signature. Cible : l'API Render
// (VITE_API_URL) ; le repli historique 127.0.0.1:54321 correspond aux Edge
// Functions Supabase locales.
// ============================================================================
import { createHmac } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";

const [, , provider = "wave", reference, status = "succeeded"] = process.argv;

if (!reference) {
  console.error("Usage : node scripts/confirm-sandbox-payment.mjs <provider> <reference> [succeeded|failed]");
  process.exit(1);
}

function readSecret() {
  if (process.env.SCOLIA_WEBHOOK_SECRET) return process.env.SCOLIA_WEBHOOK_SECRET;
  for (const file of ["../frontend/.env.local", "../frontend/.env", ".env.local", ".env", "supabase/.env"]) {
    if (!existsSync(file)) continue;
    const m = readFileSync(file, "utf8").match(/^SCOLIA_WEBHOOK_SECRET=(.*)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  console.error("SCOLIA_WEBHOOK_SECRET introuvable (variable d'environnement ou .env.local).");
  process.exit(1);
}

const secret = readSecret();
const apiBase = (process.env.VITE_API_URL || "").replace(/\/+$/, "");
const url = apiBase || (process.env.VITE_SUPABASE_URL || "http://127.0.0.1:54321").replace(/\/+$/, "");
if (!process.env.VITE_API_URL) {
  console.error("VITE_API_URL non définie : le webhook local des Edge Functions est utilisé en repli.");
}

// Le corps est construit UNE SEULE FOIS : la signature porte sur les octets
// exacts envoyés.
const body = JSON.stringify({ provider, reference, status, payload: { confirmed_by: "sandbox-cli" } });
const signature = createHmac("sha256", secret).update(body, "utf8").digest("hex");

const res = await fetch(`${url}/payment-webhook`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-scolia-signature": signature,
  },
  body,
});

const text = await res.text();
console.log(`${res.status} ${text}`);
if (!res.ok) process.exit(1);
