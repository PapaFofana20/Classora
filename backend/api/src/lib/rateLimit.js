/**
 * Rate limiting adossé à la table public.rate_limits via la RPC atomique
 * sys_rate_limit (migration 15) : incrément atomique en base, compatible
 * avec plusieurs instances Render. L'ancienne lecture-contrôle-écriture
 * souffrait de deux défauts — compteur non atomique et clé falsifiable par
 * le client (premier élément de X-Forwarded-For).
 */

import { RATE_LIMIT_RE } from "./http.js";
export { RATE_LIMIT_RE };

/**
 * Adresse client : le DERNIER maillon de X-Forwarded-For (celui ajouté par
 * le proxy de la plateforme, non falsifiable par le client) ; X-Real-IP en
 * repli ; null si aucun (appel direct en développement local).
 */
export function clientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string") {
    const parts = xff.split(",").map((v) => v.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  const real = typeof req.headers["x-real-ip"] === "string" ? req.headers["x-real-ip"].trim() : null;
  return real || null;
}

/** Lève une erreur métier si la limite est atteinte pour (key) sur la fenêtre. */
export async function enforceRateLimit(svc, key, max, windowSeconds) {
  const { data, error } = await svc.rpc("sys_rate_limit", {
    p_key: key,
    p_max: max,
    p_window_secs: windowSeconds,
  });
  if (error) {
    // Ne JAMAIS laisser un dysfonctionnement du limiter ouvrir le service.
    throw new Error("Service momentanément indisponible. Réessayez dans un instant.");
  }
  if (data === false) {
    throw new Error("Trop de tentatives. Réessayez dans quelques minutes.");
  }
}
