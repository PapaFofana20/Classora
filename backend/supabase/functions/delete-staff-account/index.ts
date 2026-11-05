/**
 * Suppression définitive d'un accès du personnel (direction).
 * Supprime le compte Auth : le profil est supprimé en cascade
 * (profiles.id references auth.users on delete cascade). La fiche
 * enseignant éventuellement liée n'est PAS supprimée : l'enseignant
 * reste dans la liste, simplement « Sans accès ». Pour retirer aussi
 * l'enseignant, utiliser la suppression d'enseignant (teachers).
 * Impossible sur son propre compte ni sur un compte directeur.
 * Limité en débit par compte appelant.
 */

import { audit, requireDirecteur, serviceClient } from "../_shared/auth.ts";
import { badRequest, handleOptions, methodNotAllowed, notFound, ok, serverError } from "../_shared/http.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { expectObject, requireString, ValidationError } from "../_shared/validate.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  const origin = req.headers.get("Origin");
  if (req.method !== "POST") return methodNotAllowed(origin);
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
      .select("id, school_id, role")
      .eq("id", userId)
      .maybeSingle();
    if (error || !target || target.school_id !== caller.schoolId) {
      return notFound(origin, "Compte introuvable dans votre école.");
    }
    if (target.role === "directeur") {
      return badRequest(origin, "Le compte directeur ne peut pas être supprimé depuis l'application.");
    }
    if (userId === caller.id) {
      return badRequest(origin, "Vous ne pouvez pas supprimer votre propre compte.");
    }

    const { error: deleteError } = await svc.auth.admin.deleteUser(userId);
    if (deleteError) return serverError(origin);

    await audit(svc, {
      schoolId: caller.schoolId,
      actorId: caller.id,
      actorRole: caller.role,
      action: "staff_account_deleted",
      entity: "profiles",
      entityId: userId,
      payload: { role: target.role },
    });

    return ok(origin, { userId, deleted: true });
  } catch (e) {
    if (e instanceof ValidationError) return badRequest(origin, e.message);
    if (e instanceof Error && /trop de tentatives/i.test(e.message)) return badRequest(origin, e.message);
    return serverError(origin);
  }
});
