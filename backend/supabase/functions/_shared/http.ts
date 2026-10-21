/**
 * En-têtes CORS et helpers de réponses HTTP pour les Edge Functions SCOLIA.
 */

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
} as const;

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
    return new Response("ok", { headers: CORS_HEADERS });
  }
  return undefined;
}

/** Réponse 405 pour une méthode HTTP non supportée par la fonction. */
export function methodNotAllowed(): Response {
  return new Response("Méthode non autorisée.", { status: 405, headers: CORS_HEADERS });
}

export function ok(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

export function badRequest(message: string): Response {
  return ok({ error: message }, 400);
}

export function unauthorized(message = "Session expirée. Reconnectez-vous."): Response {
  return ok({ error: message }, 401);
}

export function forbidden(message = "Accès refusé."): Response {
  return ok({ error: message }, 403);
}

export function notFound(message = "Ressource introuvable."): Response {
  return ok({ error: message }, 404);
}

export function serverError(
  message = "Une erreur inattendue est survenue. Réessayez dans un instant.",
): Response {
  return ok({ error: message }, 500);
}
