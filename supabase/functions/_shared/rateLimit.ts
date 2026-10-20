/**
 * Rate limiting par IP, appuyé sur la table public.rate_limits.
 * Fenêtre fixe : le compteur repart à zéro à l'expiration de la fenêtre.
 * Le service_role seul écrit ; les clients anon/authenticated n'y ont pas accès.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip")?.trim() ??
    "0.0.0.0"
  );
}

/** Lève une erreur métier si la limite est atteinte pour (key) sur la fenêtre. */
export async function enforceRateLimit(
  svc: SupabaseClient,
  key: string,
  max: number,
  windowSeconds: number,
): Promise<void> {
  const nowIso = new Date().toISOString();
  const { data } = await svc
    .from("rate_limits")
    .select("key, count, window_start")
    .eq("key", key)
    .maybeSingle();

  if (!data) {
    await svc.from("rate_limits").insert({ key, count: 1, window_start: nowIso });
    return;
  }

  const started = new Date(data.window_start);
  const elapsed = (Date.now() - started.getTime()) / 1000;
  if (elapsed >= windowSeconds) {
    await svc
      .from("rate_limits")
      .update({ count: 1, window_start: nowIso, updated_at: nowIso })
      .eq("key", key);
    return;
  }

  if (data.count >= max) {
    throw new Error("Trop de tentatives. Réessayez dans quelques minutes.");
  }

  await svc
    .from("rate_limits")
    .update({ count: data.count + 1, updated_at: nowIso })
    .eq("key", key);
}
