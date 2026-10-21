/**
 * Réinitialisation du mot de passe d'un accès du personnel (direction) :
 * nouveau mot de passe temporaire, affiché UNE SEULE FOIS, le compte repasse
 * en « changement de mot de passe obligatoire » à sa prochaine connexion.
 * Limité en débit par compte appelant.
 */

import { audit, generateTempPassword, requireDirecteur, serviceClient } from "../_shared/auth.ts";
import { badRequest, handleOptions, methodNotAllowed, notFound, ok, serverError } from "../_shared/http.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { expectObject, requireString, ValidationError } from "../_shared/validate.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== "POST") return methodNotAllowed();
  const svc = serviceClient();
  try {
    const authResult = await requireDirecteur(svc, req);
    if (authResult instanceof Response) return authResult;
    const { caller } = authResult;
    await enforceRateLimit(svc, `staff-mgmt:${caller.id}`, 30, 300);

    const body = expectObject(await req.json());
    const userId = requireString(body, "userId", "Le compte", { max: 64 });

    const { data: target, error } = await svc
      .from("profiles")
      .select("id, school_id, role, first_name, last_name, email, status")
      .eq("id", userId)
      .maybeSingle();
    if (error || !target || target.school_id !== caller.schoolId) {
      return notFound("Compte introuvable dans votre école.");
    }
    if (target.role === "directeur") {
      return badRequest("Le compte directeur sera réinitialisé via le service support.");
    }

    const tempPassword = generateTempPassword();
    const { error: pwError } = await svc.auth.admin.updateUserById(userId, {
      password: tempPassword,
    });
    if (pwError) return serverError();

    const { error: flagError } = await svc
      .from("profiles")
      .update({ must_change_password: true })
      .eq("id", userId);
    if (flagError) return serverError();

    await audit(svc, {
      schoolId: caller.schoolId,
      actorId: caller.id,
      actorRole: caller.role,
      action: "staff_password_reset",
      entity: "profiles",
      entityId: userId,
    });

    return ok({
      userId,
      email: target.email,
      tempPassword,
      firstName: target.first_name,
      lastName: target.last_name,
      role: target.role,
    });
  } catch (e) {
    if (e instanceof ValidationError) return badRequest(e.message);
    if (e instanceof Error && /trop de tentatives/i.test(e.message)) return badRequest(e.message);
    return serverError();
  }
});
