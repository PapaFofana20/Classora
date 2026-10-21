/**
 * Paiements mobile money (Wave / Orange Money / Free Money) — Sénégal, FCFA.
 * Sandboxed providers, référence unique, confirmation signée HMAC (webhook)
 * de paiement et neutralité vis-à-vis du client (prix et école jamais pris
 * en entrée).
 */

import crypto from "node:crypto";
import { WEBHOOK_SECRET } from "../config.js";

export const PAY_METHODS = ["wave", "orange_money", "free_money"];

const PROVIDER_PREFIX = { wave: "WV", orange_money: "OM", free_money: "FM" };

export function isPayMethod(v) {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(PROVIDER_PREFIX, v);
}

/** Référence prestataire du même format que le front : WV-1234-5678. */
export function generateProviderRef(method) {
  const buf = crypto.randomBytes(2);
  const n = (v) => String(1000 + (v % 9000));
  return `${PROVIDER_PREFIX[method]}-${n(buf[0])}-${n(buf[1])}`;
}

/* ------------------------------------------------------------------ */
/* Signature HMAC des webhooks (x-scolia-signature, hex SHA-256 du brut) */
/* ------------------------------------------------------------------ */

/**
 * Secret HMAC du webhook. AUCUNE valeur par défaut : un secret non configuré
 * doit faire échouer la route bruyamment, jamais ouvrir le webhook (un secret
 * deviné, type « scolia-dev-secret », suffirait à confirmer des paiements).
 */
function webhookSecret() {
  const secret = WEBHOOK_SECRET;
  // La valeur historique « scolia-dev-secret » a été lue dans des bundles
  // navigateur : elle est refusée explicitement.
  if (!secret || secret.trim().length < 16 || secret.trim() === "scolia-dev-secret") {
    throw new Error("SCOLIA_WEBHOOK_SECRET n'est pas configuré (16 caractères minimum, et jamais la valeur par défaut).");
  }
  return secret;
}

function timingSafeEqualHex(a, b) {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

/**
 * Vérifie la signature du webhook. L'empreinte est calculée sur le corps BRUT
 * de la requête (buffer conservé par le parser JSON), pas sur l'objet JSON
 * relu. Lève une erreur métier en cas d'échec (400 côté endpoint).
 */
export function verifyWebhookSignature(rawBody, signatureHeader) {
  if (!signatureHeader) {
    throw new Error("Signature de webhook absente.");
  }
  const expected = crypto.createHmac("sha256", webhookSecret()).update(rawBody).digest("hex");
  const provided = signatureHeader.trim().toLowerCase();
  if (!timingSafeEqualHex(provided, expected)) {
    throw new Error("Signature de webhook invalide.");
  }
}
