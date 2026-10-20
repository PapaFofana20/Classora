/**
 * En-têtes CORS et helpers de réponses HTTP pour les Edge Functions SCOLIA.
 */

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
} as const;

export function handleOptions(req: Request): Response {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });
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
