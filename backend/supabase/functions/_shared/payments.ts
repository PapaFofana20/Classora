/**
 * Paiements mobile money (Wave / Orange Money / Free Money) — Sénégal, FCFA.
 * Cette phase livre le mode « sandbox » : fournisseurs abstraits, référence
 * unique par prestataire, confirmation signée HMAC (webhook) et neutralité
 * vis-à-vis du client (prix et école jamais pris en entrée).
 */

export type PayMethod = "wave" | "orange_money" | "free_money";

const PROVIDER_PREFIX: Record<PayMethod, string> = {
  wave: "WV",
  orange_money: "OM",
  free_money: "FM",
};

export function isPayMethod(v: unknown): v is PayMethod {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(PROVIDER_PREFIX, v);
}

/** Référence prestataire du même format que le front : WV-1234-5678. */
export function generateProviderRef(method: PayMethod): string {
  const bytes = new Uint32Array(2);
  crypto.getRandomValues(bytes);
  const n = (v: number) => String(1000 + (v % 9000));
  return `${PROVIDER_PREFIX[method]}-${n(bytes[0])}-${n(bytes[1])}`;
}

/* ------------------------------------------------------------------ */
/* Signature HMAC des webhooks (x-scolia-signature, hex SHA-256 du brut) */
/* ------------------------------------------------------------------ */

/**
 * Secret HMAC du webhook. AUCUNE valeur par défaut : un secret non configuré
 * doit faire échouer la fonction bruyamment, jamais ouvrir le webhook (un
 * secret deviné, type « scolia-dev-secret », suffirait à confirmer des
 * paiements).
 */
function webhookSecret(): string {
  const secret = Deno.env.get("SCOLIA_WEBHOOK_SECRET");
  // La valeur historique « scolia-dev-secret » a été lue dans des bundles
  // navigateur : elle est refusée explicitement.
  if (!secret || secret.trim().length < 16 || secret.trim() === "scolia-dev-secret") {
    throw new Error("SCOLIA_WEBHOOK_SECRET n'est pas configuré (16 caractères minimum, et jamais la valeur par défaut).");
  }
  return secret;
}

async function hmacHex(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(mac), (b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Vérifie la signature du webhook. L'empreinte est calculée sur le corps BRUT
 * de la requête (message m.services.arrayBuffer), pas sur l'objet JSON relu.
 * Lève une erreur métier en cas d'échec (400 côté endpoint).
 */
export async function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): Promise<void> {
  if (!signatureHeader) {
    throw new Error("Signature de webhook absente.");
  }
  const expected = await hmacHex(rawBody, webhookSecret());
  if (!timingSafeEqualHex(signatureHeader.toLowerCase(), expected)) {
    throw new Error("Signature de webhook invalide.");
  }
}
