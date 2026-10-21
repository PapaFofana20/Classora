/**
 * Réinitialisation du mot de passe d'un accès du personnel (direction) :
 * nouveau mot de passe temporaire, affiché UNE SEULE FOIS, le compte repasse
 * en « changement de mot de passe obligatoire » à sa prochaine connexion.
 * Limité en débit par compte appelant.
 */

import { audit, generateTempPassword, requireDirecteur, serviceClient } from "../lib/auth.js";
import { badRequest, ok, route, serverError, RATE_LIMIT_RE } from "../lib/http.js";
import { enforceRateLimit } from "../lib/rateLimit.js";
import { expectObject, requireString } from "../lib/validate.js";

export default route(async (req, res) => {
  if (req.method !== "POST") return ok(res, { error: "Méthode non autorisée." }, 405);
  const svc = serviceClient();
  try {
    const dir = await requireDirecteur(svc, req, res);
    if (!dir) return;
    const { caller } = dir;

    await enforceRateLimit(svc, `staff-mgmt:${caller.id}`, 30, 300);

    const body = expectObject(req.body);
    const userId = requireString(body, "userId", "Le compte", { max: 64 });

    const { data: target, error } = await svc
      .from("profiles")
      .select("id, school_id, role, first_name, last_name, email, status")
      .eq("id", userId)
      .maybeSingle();
    if (error || !target || target.school_id !== caller.schoolId) {
      return ok(res, { error: "Compte introuvable dans votre école." }, 404);
    }
    if (target.role === "directeur") {
      return badRequest(res, "Le compte directeur sera réinitialisé via le service support.");
    }

    const tempPassword = generateTempPassword();
    const { error: pwError } = await svc.auth.admin.updateUserById(userId, {
      password: tempPassword,
    });
    if (pwError) {
      console.error("[reset-staff-password] auth", pwError);
      return serverError(res);
    }

    const { error: flagError } = await svc
      .from("profiles")
      .update({ must_change_password: true })
      .eq("id", userId);
    if (flagError) {
      console.error("[reset-staff-password] flag", flagError);
      return serverError(res);
    }

    await audit(svc, {
      schoolId: caller.schoolId,
      actorId: caller.id,
      actorRole: caller.role,
      action: "staff_password_reset",
      entity: "profiles",
      entityId: userId,
    });

    return ok(res, {
      userId,
      email: target.email,
      tempPassword,
      firstName: target.first_name,
      lastName: target.last_name,
      role: target.role,
    });
  } catch (e) {
    if (e?.name === "ValidationError") return badRequest(res, e.message);
    if (e instanceof Error && RATE_LIMIT_RE.test(e.message)) return badRequest(res, e.message);
    console.error("[reset-staff-password]", e);
    return serverError(res);
  }
});
