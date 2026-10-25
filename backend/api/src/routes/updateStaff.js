/**
 * Modification d'un accès du personnel par la direction : identité, téléphone,
 * e-mail, spécialités. Synchronise la ligne teachers du personnel enseignant.
 * Limité en débit par compte appelant.
 */

import { audit, EMAIL_RE, isStaffRole, requireDirecteur, schoolIsWritable, serviceClient } from "../lib/auth.js";
import { badRequest, forbidden, ok, route, serverError, RATE_LIMIT_RE } from "../lib/http.js";
import { enforceRateLimit } from "../lib/rateLimit.js";
import { expectObject, optionalString, requireString, requireUuid, ValidationError } from "../lib/validate.js";

export default route(async (req, res) => {
  if (req.method !== "POST") return ok(res, { error: "Méthode non autorisée." }, 405);
  const svc = serviceClient();
  try {
    const dir = await requireDirecteur(svc, req, res);
    if (!dir) return;
    const { caller } = dir;

    await enforceRateLimit(svc, `staff-mgmt:${caller.id}`, 30, 300);
    if (!(await schoolIsWritable(svc, caller.schoolId))) {
      return forbidden(res, "Mode lecture seule : l'abonnement de votre école est expiré. Les modifications sont désactivées.");
    }

    const body = expectObject(req.body);
    const userId = requireUuid(body, "userId", "Le compte");
    if (userId === caller.id) {
      return badRequest(res, "Modifiez votre propre profil depuis votre page de profil.");
    }

    const { data: target, error: targetError } = await svc
      .from("profiles")
      .select("id, school_id, role, email, first_name, last_name, teacher_id")
      .eq("id", userId)
      .maybeSingle();
    if (targetError || !target || target.school_id !== caller.schoolId) {
      return ok(res, { error: "Compte introuvable dans votre école." }, 404);
    }
    if (target.role === "directeur") {
      return badRequest(res, "Le compte directeur ne peut être modifié qu'au niveau du support.");
    }
    if (!isStaffRole(target.role)) {
      return badRequest(res, "Seuls les comptes du personnel peuvent être modifiés ici.");
    }

    const firstName = optionalString(body, "firstName", "Le prénom", 60);
    const lastName = optionalString(body, "lastName", "Le nom", 60);
    const email = optionalString(body, "email", "L'e-mail", 120)?.toLowerCase();
    const phone = optionalString(body, "phone", "Le téléphone", 20);
    const specialties = requireStringArrayOptional(body);

    if (email && !EMAIL_RE.test(email)) {
      return badRequest(res, "Adresse e-mail invalide.");
    }

    if (email && email !== (target.email ?? "").toLowerCase()) {
      const { count } = await svc
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("email", email);
      if (count && count > 0) {
        return badRequest(res, "Un compte existe déjà avec cet e-mail.");
      }
      const { error: emailError } = await svc.auth.admin.updateUserById(userId, {
        email,
        email_confirm: true,
      });
      if (emailError) {
        return badRequest(res, "Impossible de changer l'e-mail de ce compte. Vérifiez qu'il n'est pas déjà utilisé.");
      }
    }

    const patch = {};
    if (firstName !== undefined) patch.first_name = firstName;
    if (lastName !== undefined) patch.last_name = lastName;
    if (email !== undefined) patch.email = email;
    if (phone !== undefined) patch.phone = phone;
    if (Object.keys(patch).length) {
      const { error } = await svc.from("profiles").update(patch).eq("id", userId);
      if (error) {
        console.error("[update-staff] profiles", error);
        return serverError(res);
      }
    }

    if (target.teacher_id && (firstName !== undefined || lastName !== undefined || email !== undefined || phone !== undefined)) {
      const teacherPatch = {};
      if (firstName !== undefined) teacherPatch.first_name = firstName;
      if (lastName !== undefined) teacherPatch.last_name = lastName;
      if (email !== undefined) teacherPatch.email = email;
      if (phone !== undefined) teacherPatch.phone = phone;
      const { error } = await svc.from("teachers").update(teacherPatch).eq("id", target.teacher_id);
      if (error) {
        console.error("[update-staff] teachers", error);
        return serverError(res);
      }
    }

    if (target.teacher_id && specialties !== undefined) {
      const { error } = await svc.from("teachers").update({ specialties }).eq("id", target.teacher_id);
      if (error) {
        console.error("[update-staff] specialties", error);
        return serverError(res);
      }
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

    return ok(res, { updated: true });
  } catch (e) {
    if (e?.name === "ValidationError") return badRequest(res, e.message);
    if (e instanceof Error && RATE_LIMIT_RE.test(e.message)) return badRequest(res, e.message);
    console.error("[update-staff]", e);
    return serverError(res);
  }
});

function requireStringArrayOptional(body) {
  const raw = body["specialties"];
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw) || raw.some((v) => typeof v !== "string" || v.length > 80)) {
    throw new ValidationError("Les spécialités sont invalides.");
  }
  return raw.map((v) => v.trim()).filter(Boolean);
}
