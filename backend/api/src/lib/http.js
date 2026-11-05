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
 * les origines locales habituelles du développement (Vite 5173/4173), et
 * UNIQUEMENT hors production : en production, ces origines ne passent jamais.
 */
const DEV_ORIGINS = new Set([
  "http://localhost:5173", "http://127.0.0.1:5173",
  "http://localhost:4173", "http://127.0.0.1:4173",
  "http://localhost:3000", "http://127.0.0.1:3000",
]);
const IS_PRODUCTION = process.env.NODE_ENV === "production";

function allowedOrigin(origin) {
  if (!origin) return false;
  if (FRONTEND_ORIGIN) {
    return FRONTEND_ORIGIN.split(",").map((o) => o.trim().replace(/\/$/, "")).includes(origin.replace(/\/$/, ""));
  }
  // Fail-closed : en production, seule FRONTEND_ORIGIN passe ; les origines
  // de développement ne sont acceptées que hors production.
  if (IS_PRODUCTION) return false;
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

/** Log sanitisé d'une erreur : ne consigne jamais l'objet complet (évite de
 * fuiter des fragments de requête, du schéma ou des stack traces dans les
 * logs d'infrastructure). N'affiche que le message et, optionnellement, un
 * préfixe de contexte. */
export function logError(context, e) {
  const msg = e instanceof Error ? e.message : String(e);
  console.error(`[${context}]`, msg);
}

/** enveloppe un handler async et traduit ValidationError / crash. */
export function route(handler) {
  return (req, res) => {
    Promise.resolve()
      .then(() => handler(req, res))
      .catch((e) => {
        if (e?.name === "ValidationError") return badRequest(res, e.message);
        logError("api", new Error(`Non géré sur ${req.method} ${req.originalUrl}: ${e?.message ?? String(e)}`));
        return serverError(res);
      });
  };
}

/** Exécute une promesse avec un timeout. Rejette avec une erreur TimeoutError
 * si la promesse ne se résout pas dans le délai imparti (ms). Utilisé pour
 * éviter qu'un appel Supabase bloquant n'épuise les workers Render. */
export function withTimeout(promise, ms, context = "appel Supabase") {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Timeout : ${context} (${ms} ms)`));
    }, ms);
  });
  return Promise.race([promise, timeoutPromise]).then((result) => {
    clearTimeout(timeoutId);
    return result;
  });
}
