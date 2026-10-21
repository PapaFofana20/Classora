/**
 * Rate limiting adossé à la table public.rate_limits via la RPC atomique
 * sys_rate_limit (migration 15) : l'ancienne lecture-contrôle-écriture
 * souffrait de deux défauts — un compteur non atomique (accès concurrents
 * perdus) et une clé d'origine client (X-Forwarded-For, réinscriptible par
 * l'attaquant, avec un seau global partagé en repli).
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Adresse client : le DERNIER maillon de X-Forwarded-For (celui ajouté par le
 * proxy de la plateforme, non falsifiable par le client) ; X-Real-IP en
 * repli ; null si aucun (appel direct en développement local).
 */
export function clientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((v) => v.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  const real = req.headers.get("x-real-ip")?.trim();
  return real || null;
}

/** Lève une erreur métier si la limite est atteinte pour (key) sur la fenêtre. */
export async function enforceRateLimit(
  svc: SupabaseClient,
  key: string,
  max: number,
  windowSeconds: number,
): Promise<void> {
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
