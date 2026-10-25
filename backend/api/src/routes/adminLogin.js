/**
 * Connexion administrative par matricule ou e-mail : résout l'identifiant en
 * e-mail APRÈS vérification du mot de passe auprès de Supabase Auth. Sans
 * secret valide, aucune information n'est révélée — les matricules étant
 * séquentielles (CLA-ADM-000002…), une simple table de correspondance
 * publierait les e-mails de toute l'équipe.
 *
 * Le client termine ensuite par signInWithPassword(email, password) : les
 * jetons de session restent gérés par Supabase côté navigateur, rien ne
 * change pour /admin/auth.
 */
import { SERVICE_KEY, SUPABASE_URL } from "../config.js";
import { auditAdmin, serviceClient } from "../lib/authAdmin.js";
import { ok, route, serverError, RATE_LIMIT_RE } from "../lib/http.js";
import { clientIp, enforceRateLimit } from "../lib/rateLimit.js";
import { expectObject, requireString } from "../lib/validate.js";

const MATRICULE_RE = /^CLA-ADM-\d{6}$/;
const GENERIC_ERROR = "Matricule/e-mail ou mot de passe incorrect.";

/** Vérifie (email, password) directement auprès de Supabase Auth. */
async function passwordIsValid(email, password) {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: SERVICE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export default route(async (req, res) => {
  if (req.method !== "POST") return ok(res, { error: "Méthode non autorisée." }, 405);
  const svc = serviceClient();
  try {
    const body = expectObject(req.body);
    const identifier = requireString(body, "identifier", "L'identifiant", { min: 3, max: 120 });
    const password = requireString(body, "password", "Le mot de passe", { min: 1, max: 72, trim: false });

    const isMatricule = MATRICULE_RE.test(identifier.toUpperCase());
    const value = isMatricule ? identifier.toUpperCase() : identifier.toLowerCase();

    // Débit limité par adresse IP ET par identifiant, avant tout indice.
    await enforceRateLimit(svc, `admin-login:ip:${clientIp(req) ?? "sans-adresse"}`, 20, 300);
    await enforceRateLimit(svc, `admin-login:id:${value}`, 10, 300);

    // L'identifiant doit correspondre à un agent administratif connu.
    let query = svc.from("admin_agents").select("id, matricule, role, status, email, auth_user_id");
    query = isMatricule ? query.eq("matricule", value) : query.eq("email", value);
    const { data: agent, error } = await query.maybeSingle();
    if (error || !agent) {
      return ok(res, { error: GENERIC_ERROR }, 401);
    }

    if (!(await passwordIsValid(agent.email, password))) {
      await auditAdmin(svc, {
        actorId: agent.auth_user_id,
        actorRole: agent.role,
        action: "admin_login_failed",
        entity: "admin_agents",
        entityId: agent.id,
        payload: { matricule: agent.matricule },
      });
      return ok(res, { error: GENERIC_ERROR }, 401);
    }

    if (agent.status !== "ACTIF") {
      await auditAdmin(svc, {
        actorId: agent.auth_user_id,
        actorRole: agent.role,
        action: "admin_login_blocked",
        entity: "admin_agents",
        entityId: agent.id,
        payload: { status: agent.status, matricule: agent.matricule },
      });
      return ok(res, {
        error: `Ce compte administratif est ${agent.status === "DESACTIVE" ? "désactivé" : "en attente de validation"}. Contactez le superadministrateur.`,
      }, 403);
    }

    await auditAdmin(svc, {
      actorId: agent.auth_user_id,
      actorRole: agent.role,
      action: "admin_login_matricule",
      entity: "admin_agents",
      entityId: agent.id,
      payload: { matricule: agent.matricule },
    });

    return ok(res, { email: agent.email });
  } catch (e) {
    if (e instanceof Error && RATE_LIMIT_RE.test(e.message)) return ok(res, { error: e.message }, 429);
    console.error("[admin-login]", e);
    return serverError(res);
  }
});
