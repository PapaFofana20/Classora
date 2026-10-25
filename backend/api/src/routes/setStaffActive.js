/**
 * Activation / désactivation d'un accès du personnel (direction).
 * Impossible sur son propre compte. À la désactivation : statut = DESACTIVE,
 * les politiques RLS fondées sur is_active_user() ferment tout accès aux
 * données immédiatement. Aucune révocation de session n'est invoquée :
 * l'API admin n'offre pas cette opération par utilisateur ; le JWT émis
 * reste techniquement valable, mais currentSession() côté application
 * (statut DESACTIVE) et les politiques RLS ferment l'accès réel.
 * Limité en débit par compte appelant.
 */

import { audit, isStaffRole, requireDirecteur, schoolIsWritable, serviceClient } from "../lib/auth.js";
import { badRequest, forbidden, ok, route, serverError, RATE_LIMIT_RE } from "../lib/http.js";
import { enforceRateLimit } from "../lib/rateLimit.js";
import { expectObject, requireUuid } from "../lib/validate.js";

export default route(async (req, res) => {
  if (req.method !== "POST") return ok(res, { error: "Méthode non autorisée." }, 405);
  const svc = serviceClient();
  try {
    const dir = await requireDirecteur(svc, req, res);
    if (!dir) return;
    const { caller } = dir;

    await enforceRateLimit(svc, `staff-mgmt:${caller.id}`, 30, 300);

    const body = expectObject(req.body);
    const userId = requireUuid(body, "userId", "Le compte");
    const rawActive = body["active"];
    if (typeof rawActive !== "boolean") {
      return badRequest(res, "Requête invalide : active doit être un booléen.");
    }
    const active = rawActive;
    if (!(await schoolIsWritable(svc, caller.schoolId))) {
      return forbidden(res, "Mode lecture seule : l'abonnement de votre école est expiré. Les modifications sont désactivées.");
    }

    const { data: target, error } = await svc
      .from("profiles")
      .select("id, school_id, role, status, first_name, last_name, must_change_password, email")
      .eq("id", userId)
      .maybeSingle();
    if (error || !target || target.school_id !== caller.schoolId) {
      return ok(res, { error: "Compte introuvable dans votre école." }, 404);
    }
    if (target.role === "directeur") {
      return badRequest(res, "Le compte directeur ne peut pas être désactivé depuis l'application.");
    }
    if (!isStaffRole(target.role)) {
      return badRequest(res, "Seuls les comptes du personnel peuvent être activés ou désactivés ici.");
    }
    if (userId === caller.id) {
      return badRequest(res, "Vous ne pouvez pas désactiver votre propre compte.");
    }
    if (target.status === (active ? "ACTIF" : "DESACTIVE")) {
      return ok(res, { alreadyActive: true, userId, status: target.status });
    }

    const { error: statusError } = await svc
      .from("profiles")
      .update({ status: active ? "ACTIF" : "DESACTIVE" })
      .eq("id", userId);
    if (statusError) {
      console.error("[set-staff-active] update", statusError);
      return serverError(res);
    }

    await audit(svc, {
      schoolId: caller.schoolId,
      actorId: caller.id,
      actorRole: caller.role,
      action: active ? "staff_reactivated" : "staff_deactivated",
      entity: "profiles",
      entityId: userId,
    });

    return ok(res, { userId, status: active ? "ACTIF" : "DESACTIVE" });
  } catch (e) {
    if (e?.name === "ValidationError") return badRequest(res, e.message);
    if (e instanceof Error && RATE_LIMIT_RE.test(e.message)) return badRequest(res, e.message);
    console.error("[set-staff-active]", e);
    return serverError(res);
  }
});
