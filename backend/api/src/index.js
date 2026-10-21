/**
 * API SCOLIA — point d'entrée.
 *
 * Rôle : remplacer les Edge Functions Deno lorsque le backend est hébergé
 *   sur Render. Supabase reste les données (PostgreSQL + RLS) et l'Auth
 *   (mots de passe de connexion) : cette API n'accède aux données qu'avec
 *   le service_role, pour la logique privilégiée (inscriptions, gestion du
 *   personnel) ;
 *
 *   - routes publiques : verify-matricule, register-* (rate limité par IP) ;
 *   - routes authentifiées : login-guard, staff-* (JWT vérifié auprès de
 *     Supabase Auth).
 *
 *   NB : les routes de paiement mobile money (start-subscription,
 *   pay-installment, payment-webhook) sont retirées pour l'instant —
 *   elles seront réintroduites plus tard.
 */

import express from "express";

import { PORT, SERVICE_KEY, SUPABASE_URL } from "./config.js";
import { corsMiddleware } from "./lib/http.js";
import loginGuard from "./routes/loginGuard.js";
import verifyMatricule from "./routes/verifyMatricule.js";
import registerDirector from "./routes/registerDirector.js";
import registerStudent from "./routes/registerStudent.js";
import registerParent from "./routes/registerParent.js";
import createStaffAccount from "./routes/createStaffAccount.js";
import updateStaff from "./routes/updateStaff.js";
import resetStaffPassword from "./routes/resetStaffPassword.js";
import setStaffActive from "./routes/setStaffActive.js";

const app = express();

// Rejets déguisés en réponses 400 { error } (jamais d'HTML d'erreur Express).
app.disable("x-powered-by");
app.set("trust proxy", true); // passerelle Render : X-Forwarded-For fiable

// Corps JSON limité.
app.use(express.json({ limit: "64kb" }));

// Parseur JSON défaillant ou corps absent → même enveloppe 400 que le front.
app.use((err, _req, res, next) => {
  if (err?.type === "entity.parse.failed" || err?.type === "entity.too.large") {
    return res.status(400).json({ error: "Requête invalide." });
  }
  return next(err);
});

// CORS strict : la liste des origines vient de FRONTEND_ORIGIN.
app.use(corsMiddleware);

// Sonde Render (keep-alive / déploiement) et état de configuration.
app.get("/healthz", (_req, res) => {
  res.json({ ok: true, service: "scolia-api", supabaseConfigured: Boolean(SUPABASE_URL && SERVICE_KEY) });
});

// Routes 1-à-1 avec les anciennes Edge Functions (contrat inchangé). Les
// méthodes non admises sont rejetées PAR LE HANDLER (405 { error }), comme
// dans les Deno : app.all garantit ce comportement pour toute méthode.
app.all("/login-guard", loginGuard);
app.all("/verify-matricule", verifyMatricule);
app.all("/register-director", registerDirector);
app.all("/register-student", registerStudent);
app.all("/register-parent", registerParent);
app.all("/create-staff-account", createStaffAccount);
app.all("/update-staff", updateStaff);
app.all("/reset-staff-password", resetStaffPassword);
app.all("/set-staff-active", setStaffActive);

// Dernière barrière : enveloppe { error } même sur une exception imprévue.
app.use((err, _req, res, _next) => {
  console.error("[api] erreur non gérée :", err);
  res.status(500).json({ error: "Une erreur inattendue est survenue. Réessayez dans un instant." });
});

app.listen(PORT, () => {
  console.log(`[scolia-api] en écoute sur :${PORT}`);
});
