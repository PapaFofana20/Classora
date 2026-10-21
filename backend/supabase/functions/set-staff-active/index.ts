/**
 * Activation / désactivation d'un accès du personnel (direction).
 * Impossible sur son propre compte. À la désactivation :
 *   - statut = DESACTIVE (les politiques RLS fondées sur is_active_user()
 *     ferment tout accès aux données immédiatement) ;
 *   - les sessions Auth du compte sont révoquées.
 */

import { audit, requireDirecteur, serviceClient } from "../_shared/auth.ts";
import { badRequest, handleOptions, methodNotAllowed, notFound, ok, serverError } from "../_shared/http.ts";
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

    const body = expectObject(await req.json());
    const userId = requireString(body, "userId", "Le compte", { max: 64 });
    const rawActive = body["active"];
    if (typeof rawActive !== "boolean") {
      return badRequest("Requête invalide : active doit être un booléen.");
    }
    const active: boolean = rawActive;

    const { data: target, error } = await svc
      .from("profiles")
      .select("id, school_id, role, status, first_name, last_name, must_change_password, email")
      .eq("id", userId)
      .maybeSingle();
    if (error || !target || target.school_id !== caller.schoolId) {
      return notFound("Compte introuvable dans votre école.");
    }
    if (target.role === "directeur") {
      return badRequest("Le compte directeur ne peut pas être désactivé depuis l'application.");
    }
    if (userId === caller.id) {
      return badRequest("Vous ne pouvez pas désactiver votre propre compte.");
    }
    if (target.status === (active ? "ACTIF" : "DESACTIVE")) {
      return ok({ alreadyActive: true, userId, status: target.status });
    }

    const { error: statusError } = await svc
      .from("profiles")
      .update({ status: active ? "ACTIF" : "DESACTIVE" })
      .eq("id", userId);
    if (statusError) return serverError();

    if (!active) {
      const { error: signOutError } = await svc.auth.admin.signOut(userId);
      if (signOutError) {
        // Non bloquant : la RLS ferme déjà l'accès aux données.
      }
    }

    await audit(svc, {
      schoolId: caller.schoolId,
      actorId: caller.id,
      actorRole: caller.role,
      action: active ? "staff_reactivated" : "staff_deactivated",
      entity: "profiles",
      entityId: userId,
    });

    return ok({ userId, status: active ? "ACTIF" : "DESACTIVE" });
  } catch (e) {
    if (e instanceof ValidationError) return badRequest(e.message);
    return serverError();
  }
});
