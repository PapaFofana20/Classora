/**
 * En-têtes CORS et helpers de réponses HTTP pour les Edge Functions SCOLIA.
 */

/**
 * Allowlist CORS : l'origine n'est reflétée QUE si elle figure dans
 * FRONTEND_ORIGIN (séparées par des virgules). Sans variable définie,
 * aucune origine n'est reflétée (« null ») en dehors du développement
 * local (Deno.env "DEV" = "true"). L'ancien code reflétait l'Origin
 * arbitraire du demandeur : n'importe quel site pouvait piloter les
 * inscriptions depuis le navigateur d'un visiteur.
 */
export function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowlist = (Deno.env.get("FRONTEND_ORIGIN") ?? "")
    .split(",")
    .map((o) => o.trim().replace(/\/$/, ""))
    .filter(Boolean);
  const normalized = origin?.replace(/\/$/, "") ?? null;
  const dev = Deno.env.get("DEV") === "true";
  const allowedOrigin =
    allowlist.length === 0
      ? dev ? "*" : "null"
      : allowlist.includes(normalized ?? "")
        ? normalized
        : "null";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  } as const;
}

/**
 * Traitement du préflight CORS.
 *
 * Renvoie la réponse à renvoyer pour une requête OPTIONS, et `undefined`
 * pour toute autre méthode : l'appelant fait
 * `const options = handleOptions(req); if (options) return options;`
 * et doit pouvoir poursuivre son traitement sur un POST (ou un GET pour
 * `verify-matricule`). Retourner une réponse 405 ici faisait échouer
 * systématiquement toutes les fonctions qui l'utilisent.
 */
export function handleOptions(req: Request): Response | undefined {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req.headers.get("Origin")) });
  }
  return undefined;
}

function withCors(origin: string | null, init: ResponseInit = {}): ResponseInit {
  return { ...init, headers: { ...getCorsHeaders(origin), ...init.headers } };
}

/** Réponse 405 pour une méthode HTTP non supportée par la fonction. */
export function methodNotAllowed(origin: string | null): Response {
  return new Response("Méthode non autorisée.", withCors(origin, { status: 405 }));
}

export function ok(origin: string | null, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), withCors(origin, { status, headers: { "Content-Type": "application/json" } }));
}

export function badRequest(origin: string | null, message: string): Response {
  return ok(origin, { error: message }, 400);
}

export function unauthorized(origin: string | null, message = "Session expirée. Reconnectez-vous."): Response {
  return ok(origin, { error: message }, 401);
}

export function forbidden(origin: string | null, message = "Accès refusé."): Response {
  return ok(origin, { error: message }, 403);
}

export function notFound(origin: string | null, message = "Ressource introuvable."): Response {
  return ok(origin, { error: message }, 404);
}

export function serverError(
  origin: string | null,
  message = "Une erreur inattendue est survenue. Réessayez dans un instant.",
): Response {
  return ok(origin, { error: message }, 500);
}
