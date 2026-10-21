/**
 * Configuration serveur (variables d'environnement — Render > Environment).
 * AUCUNE clé secrète côté navigateur : SUPABASE_SERVICE_ROLE_KEY ne vit
 * que sur Render.
 */

export const PORT = Number(process.env.PORT ?? 3000);

/** URL publique du projet Supabase, ex. https://xxxx.supabase.co */
export const SUPABASE_URL = process.env.SUPABASE_URL ?? "";

/** Clé service_role — JAMAIS exposée au navigateur. */
export const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/**
 *_origine du front autorisée en CORS, ex. https://classora.onrender.com.
 * Plusieurs origines : séparées par des virgules.
 */
export const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? "";
