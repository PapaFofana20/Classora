/**
 * Helpers de réponses HTTP (contrat identique aux Edge Functions Deno) et
 * CORS : le front peut vivre sur une origine différente de celle de l'API.
 *
 * L'enveloppe des réponses reste { ...payload } en succès et { error: "…" }
 * en échec : callFunction() côté front lit payload.error — aucun changement
 * contractuel côté client.
 */

import { FRONTEND_ORIGIN } from "../config.js";

const ALLOWED_HEADERS = "authorization, apikey, content-type, x-client-info";

/**
 * Origines admises : FRONTEND_ORIGIN (déploiement) ; en développement, tout
 * est ouvert si la variable est absente (repli documenté, à NE PAS activer
 * en production).
 */
function allowedOrigin(origin) {
  if (!origin) return true;
  if (!FRONTEND_ORIGIN) return true;
  return FRONTEND_ORIGIN.split(",").map((o) => o.trim().replace(/\/$/, "")).includes(origin.replace(/\/$/, ""));
}

export function corsMiddleware(req, res, next) {
  const origin = req.headers.origin;
  if (allowedOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin ?? "*");
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", ALLOWED_HEADERS);
    // PATCH (agents/écoles) et DELETE (suppression d'école) sont utilisés par
    // le front : sans eux dans Allow-Methods, le préflight du navigateur
    // bloque la requête (invisible en test curl, qui ne préflite pas).
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
    res.setHeader("Access-Control-Max-Age", "600");
  }
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  if (origin && !allowedOrigin(origin)) {
    return res.status(403).json({ error: "Origine non autorisée." });
  }
  return next();
}

export const methodNotAllowed = (res) => res.status(405).json({ error: "Méthode non autorisée." });

export function ok(res, body, status = 200) {
  res.status(status).json(body);
}

export const badRequest = (res, message) => ok(res, { error: message }, 400);

export const unauthorized = (res, message = "Session expirée. Reconnectez-vous.") => ok(res, { error: message }, 401);

export const forbidden = (res, message = "Accès refusé.") => ok(res, { error: message }, 403);

export const notFound = (res, message = "Ressource introuvable.") => ok(res, { error: message }, 404);

export const serverError = (res, message = "Une erreur inattendue est survenue. Réessayez dans un instant.") => ok(res, { error: message }, 500);

/**
 * La limite de débit renvoie un message reconnaissable ; chaque route décide
 * du code (429 = tentatives de connexion/paiement, 400 = opérations métier).
 */
export const RATE_LIMIT_RE = /trop de tentatives/i;

/** enveloppe un handler async et traduit ValidationError / crash. */
export function route(handler) {
  return (req, res) => {
    Promise.resolve()
      .then(() => handler(req, res))
      .catch((e) => {
        if (e?.name === "ValidationError") return badRequest(res, e.message);
        console.error("[api] erreur non gérée sur", req.method, req.originalUrl, e);
        return serverError(res);
      });
  };
}
