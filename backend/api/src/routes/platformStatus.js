/**
 * État public de la plateforme, consommé par les écrans (bandeau maintenance,
 * ouverture des inscriptions, délai de déconnexion admin).
 * Aucune donnée sensible : uniquement les réglages destinés à l'affichage.
 */
import { serviceClient } from "../lib/authAdmin.js";
import { ok, route } from "../lib/http.js";
import { DEFAULT_PLATFORM_SETTINGS, publicPlatformStatus, readPlatformSettings } from "../lib/platformSettings.js";
import { clientIp, enforceRateLimit } from "../lib/rateLimit.js";

// Cache mémoire partagé par les requêtes de ce processus (TTL 30 s).
const CACHE_TTL_MS = 30_000;
let cache = null;

// Handler principal : GET /platform-status — état public de la plateforme (maintenance, inscriptions).
export default route(async (req, res) => {
  if (req.method !== "GET") return ok(res, { error: "Méthode non autorisée." }, 405);

  // Cache mémoire (TTL 30 s) : /platform-status est public et non borné — sans
  // cache, chaque requête scriptee coûte 1 lecture SQL (amplification DoS).
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) {
    res.setHeader("Cache-Control", "public, max-age=30");
    res.setHeader("X-Cache", "HIT");
    return ok(res, cache.body);
  }
  const respond = (body) => {
    cache = { at: now, body };
    res.setHeader("Cache-Control", "public, max-age=30");
    return ok(res, body);
  };

  try {
    const svc = serviceClient();
    // Rate limiting léger par IP sur l'endpoint public (M-01 de l'audit).
    await enforceRateLimit(svc, `platform-status:${clientIp(req) ?? "sans-adresse"}`, 60, 300);
    const { settings, migrationApplied } = await readPlatformSettings(svc);
    return respond({ ...publicPlatformStatus(settings), migrationApplied });
  } catch (e) {
    // La page publique ne doit jamais tomber à cause de la configuration.
    console.warn("[platform-status] repli sur les valeurs par défaut :", e?.message ?? e);
    return respond({ ...publicPlatformStatus(DEFAULT_PLATFORM_SETTINGS), migrationApplied: false });
  }
});
