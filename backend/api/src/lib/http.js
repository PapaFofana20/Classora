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
 * Origines admises : FRONTEND_ORIGIN (déploiement, liste séparée par des
 * virgules). Sans cette variable, le CORS est FERMÉ par défaut — sauf pour
 * les origines locales habituelles du développement (Vite 5173/4173), qui
 * restent utiles en atelier mais ne servent jamais en production.
 * (Correction C3 de l'audit : avant, l'absence de FRONTEND_ORIGIN + un
 * NODE_ENV non défini à l'exécution laissait le CORS ouvert à toutes les
 * origines sur le déploiement de production.)
 */
const DEV_ORIGINS = new Set([
  "http://localhost:5173", "http://127.0.0.1:5173",
  "http://localhost:4173", "http://127.0.0.1:4173",
  "http://localhost:3000", "http://127.0.0.1:3000",
]);

/** Inévitable : productionhéberge Render sans FRONTEND_ORIGIN → promoteur d'avertissement au démarrage (fail-closed garanti). */
if (process.env.NODE_ENV === "production" && !process.env.FRONTEND_ORIGIN) {
  console.warn("[scolia-api] FRONTEND_ORIGIN absent en production : le CORS est fermé à toutes les origines. Renseignez l'environnement Render.");
}

function allowedOrigin(origin) {
  if (!origin) return false;
  if (FRONTEND_ORIGIN) {
    return FRONTEND_ORIGIN.split(",").map((o) => o.trim().replace(/\/$/, "")).includes(origin.replace(/\/$/, ""));
  }
  // Fail-closed : seule la configuration locale de développement passe.
  return process.env.NODE_ENV === "development" || DEV_ORIGINS.has(origin.replace(/\/$/, ""));
}

export function corsMiddleware(req, res, next) {
  const origin = req.headers.origin;
  const originAllowed = allowedOrigin(origin);
  if (originAllowed) {
    res.setHeader("Access-Control-Allow-Origin", origin);
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
  if (origin && !originAllowed) {
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
