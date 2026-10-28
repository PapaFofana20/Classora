/**
 * État public de la plateforme, consommé par les écrans (bandeau maintenance,
 * ouverture des inscriptions, délai de déconnexion admin).
 * Aucune donnée sensible : uniquement les réglages destinés à l'affichage.
 */
import { serviceClient } from "../lib/authAdmin.js";
import { ok, route } from "../lib/http.js";
import { DEFAULT_PLATFORM_SETTINGS, publicPlatformStatus, readPlatformSettings } from "../lib/platformSettings.js";

export default route(async (req, res) => {
  if (req.method !== "GET") return ok(res, { error: "Méthode non autorisée." }, 405);

  try {
    const svc = serviceClient();
    const { settings, migrationApplied } = await readPlatformSettings(svc);
    res.setHeader("Cache-Control", "public, max-age=30");
    return ok(res, { ...publicPlatformStatus(settings), migrationApplied });
  } catch (e) {
    // La page publique ne doit jamais tomber à cause de la configuration.
    console.warn("[platform-status] repli sur les valeurs par défaut :", e?.message ?? e);
    res.setHeader("Cache-Control", "public, max-age=30");
    return ok(res, { ...publicPlatformStatus(DEFAULT_PLATFORM_SETTINGS), migrationApplied: false });
  }
});
