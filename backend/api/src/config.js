/**
 * Configuration serveur (variables d'environnement — Render > Environment).
 * AUCUNE clé secrète côté navigateur : SUPABASE_SERVICE_ROLE_KEY et
 * SCOLIA_WEBHOOK_SECRET ne vivent que sur Render.
 */

export const PORT = Number(process.env.PORT ?? 3000);

/** URL publique du projet Supabase, ex. https://xxxx.supabase.co */
export const SUPABASE_URL = process.env.SUPABASE_URL ?? "";

/** Clé service_role — JAMAIS exposée au navigateur. */
export const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/** « sandbox » : autorise l'auto-confirmation des paiements (dev/tests). */
export const APP_ENV = (process.env.APP_ENV ?? "").toLowerCase();

/**
 *_origine du front autorisée en CORS, ex. https://classora.onrender.com.
 * Plusieurs origines : séparées par des virgules.
 */
export const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? "";

/** Secret HMAC des webhooks de paiement (16 caractères minimum). */
export const WEBHOOK_SECRET = process.env.SCOLIA_WEBHOOK_SECRET ?? "";
