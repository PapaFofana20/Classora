/**
 * Création du compte d'un élève DÉJÀ INSCRIT par la direction, à partir de
 * son matricule d'élève unique (ex. EC260001, généré par enroll_student).
 * Le compte est rattaché à la fiche inscrite (ACTIF immédiatement) : le
 * matricule ne sert qu'à cette identification à la création. La connexion
 * reste matricule d'école + e-mail + mot de passe.
 * school_id peut être transmis en uuid ou via le matricule public de l'école.
 */

import { serviceClient } from "../_shared/auth.ts";
import { handleOptions, methodNotAllowed, badRequest, ok, serverError } from "../_shared/http.ts";
import { clientIp, enforceRateLimit } from "../_shared/rateLimit.ts";
import {
  expectObject,
  optionalString,
  optionalUuid,
  requireEmail,
  requireSnPhone,
  requireString,
  ValidationError,
} from "../_shared/validate.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== "POST") return methodNotAllowed(origin);
  const svc = serviceClient();
  try {
    await enforceRateLimit(svc, `register-enrolled-student:${clientIp(req) ?? "sans-adresse"}`, 10, 300);

    const body = expectObject(await req.json());
    const schoolId = optionalUuid(body, "schoolId", "L'école");
    const matricule = optionalString(body, "matricule", "Le matricule de l'école", 10)?.toUpperCase();
    const studentMatricule = requireString(body, "studentMatricule", "Le matricule de l'élève", { min: 4, max: 20 });
    const email = requireEmail(body);
    const phone = requireSnPhone(body, "phone", "Le téléphone");
    const password = requireString(body, "password", "Le mot de passe", { min: 8, max: 128, trim: false });

    // Résolution de l'école : uuid fourni OU matricule public.
    let resolvedSchool: string | null = null;
    if (schoolId) {
      const { data } = await svc.from("schools").select("id").eq("id", schoolId).maybeSingle();
      resolvedSchool = data?.id ?? null;
    } else if (matricule) {
      const { data } = await svc.from("schools").select("id").eq("matricule", matricule).maybeSingle();
      resolvedSchool = data?.id ?? null;
    }
    if (!resolvedSchool) return badRequest(origin, "École introuvable.");

    const { data: created, error: createError } = await svc.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role: "eleve", school_id: resolvedSchool },
    });
    if (createError || !created?.user) {
      const duplicate = /already|duplicate|registered/i.test(createError?.message ?? "");
      return badRequest(origin,
        duplicate ? "Un compte existe déjà avec cet e-mail." : "Impossible de créer le compte. Réessayez.",
      );
    }

    try {
      const { data, error } = await svc.rpc("finish_enrolled_student_registration", {
        p_user_id: created.user.id,
        p_school_id: resolvedSchool,
        p_student_matricule: studentMatricule.trim().toUpperCase(),
        p_email: email,
        p_phone: phone,
      });
      if (error || !data) throw new Error(error?.message ?? "Création incomplète.");
      const result = data as { student_id: string; first_name: string; last_name: string; student_matricule: string };
      return ok(origin, {
        user: { id: created.user.id, email, firstName: result.first_name, lastName: result.last_name, role: "eleve", status: "ACTIF" },
        studentId: result.student_id,
        studentMatricule: result.student_matricule,
      });
    } catch (sqlError) {
      await svc.auth.admin.deleteUser(created.user.id);
      const message = sqlError instanceof Error ? sqlError.message : undefined;
      if (message && /matricule|compte|école/i.test(message)) {
        return badRequest(origin, message);
      }
      return serverError(origin);
    }
  } catch (e) {
    if (e instanceof ValidationError) return badRequest(origin, e.message);
    if (e instanceof Error && /trop de tentatives/i.test(e.message)) return badRequest(origin, e.message);
    return serverError(origin);
  }
});
