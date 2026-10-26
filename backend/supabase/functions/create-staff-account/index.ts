/**
 * Création d'un accès du personnel (professeur, instituteur, econome,
 * secretaire, surveillant) : réservée au DIRECTEUR de l'école de l'appelant. Le
 * school_id vient du token (profils), jamais du corps de la requête.
 * Le mot de passe temporaire est renvoyé UNE SEULE FOIS et jamais stocké.
 * Limité en débit par compte appelant, sans garder la requête.
 */

import { audit, generateTempPassword, passwordError, requireDirecteur, serviceClient } from "../_shared/auth.ts";
import { badRequest, forbidden, handleOptions, methodNotAllowed, ok, serverError } from "../_shared/http.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { expectObject, requireEmail, requireSnPhone, requireString, requireStringArray, ValidationError } from "../_shared/validate.ts";

type StaffRole = "professeur" | "instituteur" | "econome" | "secretaire" | "surveillant";

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
    const schoolId = caller.schoolId as string;
    await enforceRateLimit(svc, `staff-mgmt:${caller.id}`, 30, 300);

    const body = expectObject(await req.json());
    const role = requireString(body, "role", "Le rôle", { max: 20 }) as StaffRole;
    if (!["professeur", "instituteur", "econome", "secretaire", "surveillant"].includes(role)) {
      return badRequest(origin, "Rôle invalide.");
    }
    const firstName = requireString(body, "firstName", "Le prénom", { min: 1, max: 60 });
    const lastName = requireString(body, "lastName", "Le nom", { min: 1, max: 60 });
    const email = requireEmail(body);
    const phone = requireSnPhone(body, "phone", "Le téléphone");
    const specialties = requireStringArray(body, "specialties", "Les spécialités");
    const providedTemp = optionalPassword(body);

    const tempPassword = providedTemp ?? generateTempPassword();
    const pwError = passwordError(tempPassword);
    if (pwError) return badRequest(origin, pwError);

    // L'école doit être en écriture (abonnement valide / non expiré).
    const { data: writable } = await svc.rpc("school_is_writable", { p_school_id: schoolId });
    if (writable !== true) {
      return forbidden(origin, "Mode lecture seule : l'abonnement de votre école est expiré. Les modifications sont désactivées.");
    }

    const { data: created, error: createError } = await svc.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      app_metadata: { role, school_id: schoolId },
    });
    if (createError || !created?.user) {
      const duplicate = /already|duplicate|registered/i.test(createError?.message ?? "");
      return badRequest(origin, 
        duplicate ? "Un compte existe déjà avec cet e-mail." : "Impossible de créer l'accès. Réessayez.",
      );
    }

    try {
      const { error } = await svc.rpc("finish_staff_registration", {
        p_user_id: created.user.id,
        p_school_id: schoolId,
        p_role: role,
        p_first_name: firstName,
        p_last_name: lastName,
        p_phone: phone,
        p_email: email,
        p_specialties: role === "professeur" ? specialties : [],
      });
      if (error) throw new Error(error.message);

      await audit(svc, {
        schoolId,
        actorId: caller.id,
        actorRole: caller.role,
        action: "staff_account_created",
        entity: "profiles",
        entityId: created.user.id,
        payload: { role },
      });
      return ok(origin, {
        userId: created.user.id,
        email,
        tempPassword,
        firstName,
        lastName,
        role,
      });
    } catch (sqlError) {
      await svc.auth.admin.deleteUser(created.user.id);
      const message = sqlError instanceof Error ? sqlError.message : undefined;
      if (message && /un compte existe déjà|rôle invalide/i.test(message)) return badRequest(origin, message);
      return serverError(origin);
    }
  } catch (e) {
    if (e instanceof ValidationError) return badRequest(origin, e.message);
    if (e instanceof Error && /trop de tentatives/i.test(e.message)) return badRequest(origin, e.message);
    return serverError(origin);
  }
});

function optionalPassword(body: Record<string, unknown>): string | undefined {
  const raw = body["tempPassword"];
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "string") throw new ValidationError("Le mot de passe temporaire est invalide.");
  return raw.trim();
}
