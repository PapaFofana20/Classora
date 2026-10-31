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

// Doit rester le premier import : charge .env.local / .env avant config.js.
import "./env.js";
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
import timetables from "./routes/timetables.js";
import adminAuth from "./routes/adminAuth.js";
import adminLogin from "./routes/adminLogin.js";
import adminAgents from "./routes/adminAgents.js";
import adminSchools from "./routes/adminSchools.js";
import adminStats from "./routes/adminStats.js";
import adminSubscriptions from "./routes/adminSubscriptions.js";
import adminFinances from "./routes/adminFinances.js";
import adminAnalytics from "./routes/adminAnalytics.js";
import adminAudit from "./routes/adminAudit.js";
import adminSecurity from "./routes/adminSecurity.js";
import adminSettings from "./routes/adminSettings.js";
import platformStatus from "./routes/platformStatus.js";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.warn(
    "[scolia-api] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY absents : " +
      "les routes admin et privilégiées répondront 503. Renseignez .env.local (local) " +
      "ou les variables du Web Service (Render).",
  );
}

// Fail-open CORS : sans FRONTEND_ORIGIN, toutes les origines sont admises —
// acceptable en développement, à corriger absolument en production.
if (process.env.NODE_ENV === "production" && !process.env.FRONTEND_ORIGIN) {
  console.warn(
    "[scolia-api] FRONTEND_ORIGIN absente en production : le CORS est actuellement OUVERT à toute origine.",
  );
}

const app = express();

// Rejets déguisés en réponses 400 { error } (jamais d'HTML d'erreur Express).
app.disable("x-powered-by");
app.set("trust proxy", true); // passerelle Render : X-Forwarded-For fiable

// CORS AVANT le parseur JSON : un corps invalide doit aussi renvoyer les
// en-têtes CORS, sinon le front sur une autre origine ne peut pas lire le
// message d'erreur.
app.use(corsMiddleware);

// Corps JSON limité.
app.use(express.json({ limit: "64kb" }));

// Parseur JSON défaillant ou corps absent → même enveloppe 400 que le front.
app.use((err, _req, res, next) => {
  if (err?.type === "entity.parse.failed" || err?.type === "entity.too.large") {
    return res.status(400).json({ error: "Requête invalide." });
  }
  return next(err);
});

// Durcissement minimal des réponses (l'API ne sert que du JSON).
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});

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

// Routes de gestion d'emploi du temps
app.all("/api/timetables", timetables);
app.all("/api/timetables/:id(\\d+)", timetables);
app.all("/api/timetables/:id(\\d+)/slots", timetables);
app.all("/api/timetables/:id(\\d+)/export-pdf", timetables);

// Routes administratives Classora (protégées, service_role côté serveur).
// Une configuration absente provoquerait un 500 opaque : on répond un 503
// explicite, affiché tel quel par la page de connexion admin.
const adminConfigGuard = (_req, res, next) => {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(503).json({
      error:
        "Service d'administration non configuré : SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont absents côté serveur.",
    });
  }
  return next();
};

app.all("/admin/auth", adminConfigGuard, adminAuth);
app.all("/admin/login", adminConfigGuard, adminLogin);
app.all("/admin/agents", adminConfigGuard, adminAgents);
app.all("/admin/schools", adminConfigGuard, adminSchools);
app.all("/admin/stats", adminConfigGuard, adminStats);
app.all("/admin/subscriptions", adminConfigGuard, adminSubscriptions);
app.all("/admin/finances", adminConfigGuard, adminFinances);
app.all("/admin/analytics", adminConfigGuard, adminAnalytics);
app.all("/admin/audit", adminConfigGuard, adminAudit);
app.all("/admin/security", adminConfigGuard, adminSecurity);
app.all("/admin/settings", adminConfigGuard, adminSettings);

// État public (bandeau maintenance, inscription ouverte), sans authentification.
app.all("/platform-status", platformStatus);

// Chemins inconnus : JSON 404 cohérent avec l'enveloppe { error } (l'HTML
// par défaut d'Express fuirait la stack).
app.use((_req, res) => {
  res.status(404).json({ error: "Ressource introuvable." });
});

// Dernière barrière : enveloppe { error } même sur une exception imprévue.
app.use((err, _req, res, _next) => {
  console.error("[api] erreur non gérée :", err);
  if (res.headersSent) return; // réponse déjà partielle : ne pas relancer ERR_HTTP_HEADERS_SENT
  res.status(500).json({ error: "Une erreur inattendue est survenue. Réessayez dans un instant." });
});

app.listen(PORT, () => {
  console.log(`[scolia-api] en écoute sur :${PORT}`);
});
