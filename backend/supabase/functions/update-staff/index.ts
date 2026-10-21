/**
 * Modification d'un accès du personnel par la direction : identité, téléphone,
 * e-mail, spécialités. Synchronise la ligne teachers du personnel enseignant.
 */

import { audit, requireDirecteur, serviceClient } from "../_shared/auth.ts";
import { badRequest, handleOptions, methodNotAllowed, notFound, ok, serverError } from "../_shared/http.ts";
import { expectObject, optionalString, requireString, ValidationError } from "../_shared/validate.ts";

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
    if (userId === caller.id) {
      return badRequest("Modifiez votre propre profil depuis votre page de profil.");
    }

    const { data: target, error: targetError } = await svc
      .from("profiles")
      .select("id, school_id, role, email, first_name, last_name, teacher_id")
      .eq("id", userId)
      .maybeSingle();
    if (targetError || !target || target.school_id !== caller.schoolId) {
      return notFound("Compte introuvable dans votre école.");
    }
    if (target.role === "directeur") {
      return badRequest("Le compte directeur ne peut être modifié qu'au niveau du support.");
    }

    const firstName = optionalString(body, "firstName", "Le prénom", 60);
    const lastName = optionalString(body, "lastName", "Le nom", 60);
    const email = optionalString(body, "email", "L'e-mail", 120)?.toLowerCase();
    const phone = optionalString(body, "phone", "Le téléphone", 20);
    const specialties = requireStringArrayOptional(body);

    if (email && email !== target.email.toLowerCase()) {
      const { count } = await svc
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .ilike("email", email);
      if (count && count > 0) {
        return badRequest("Un compte existe déjà avec cet e-mail.");
      }
      const { error: emailError } = await svc.auth.admin.updateUserById(userId, {
        email,
        email_confirm: true,
      });
      if (emailError) {
        return badRequest("Impossible de changer l'e-mail de ce compte. Vérifiez qu'il n'est pas déjà utilisé.");
      }
    }

    const patch: Record<string, unknown> = {};
    if (firstName !== undefined) patch.first_name = firstName;
    if (lastName !== undefined) patch.last_name = lastName;
    if (email !== undefined) patch.email = email;
    if (phone !== undefined) patch.phone = phone;
    if (Object.keys(patch).length) {
      const { error } = await svc.from("profiles").update(patch).eq("id", userId);
      if (error) return serverError();
    }

    if (target.teacher_id && (firstName !== undefined || lastName !== undefined || email !== undefined || phone !== undefined)) {
      const teacherPatch: Record<string, unknown> = {};
      if (firstName !== undefined) teacherPatch.first_name = firstName;
      if (lastName !== undefined) teacherPatch.last_name = lastName;
      if (email !== undefined) teacherPatch.email = email;
      if (phone !== undefined) teacherPatch.phone = phone;
      const { error } = await svc.from("teachers").update(teacherPatch).eq("id", target.teacher_id);
      if (error) return serverError();
    }

    if (target.teacher_id && specialties !== undefined) {
      const { error } = await svc.from("teachers").update({ specialties }).eq("id", target.teacher_id);
      if (error) return serverError();
    }

    await audit(svc, {
      schoolId: caller.schoolId,
      actorId: caller.id,
      actorRole: caller.role,
      action: "staff_updated",
      entity: "profiles",
      entityId: userId,
      payload: { fields: Object.keys({ ...patch, specialties }) },
    });

    return ok({ updated: true });
  } catch (e) {
    if (e instanceof ValidationError) return badRequest(e.message);
    return serverError();
  }
});

function requireStringArrayOptional(body: Record<string, unknown>): string[] | undefined {
  const raw = body["specialties"];
  if (raw === undefined || raw === null) return undefined;
  if (!Array.isArray(raw) || raw.some((v) => typeof v !== "string" || v.length > 80)) {
    throw new ValidationError("Les spécialités sont invalides.");
  }
  return raw.map((v) => (v as string).trim()).filter(Boolean);
}
