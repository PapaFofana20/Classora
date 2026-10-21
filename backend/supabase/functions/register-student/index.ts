/**
 * Inscription publique d'un ÉLÈVE : compte EN_ATTENTE + demande d'inscription.
 * Approbation automatique si l'option de l'école est activée (limite de la
 * formule incluse). La classe DOIT appartenir à l'école ; school_id peut
 * également être transmis sous la forme du matricule public de l'école
 * (5 caractères).
 */

import { serviceClient } from "../_shared/auth.ts";
import { badRequest, CORS_HEADERS, ok, serverError } from "../_shared/http.ts";
import { clientIp, enforceRateLimit } from "../_shared/rateLimit.ts";
import {
  expectObject,
  optionalIsoDate,
  optionalString,
  optionalUuid,
  requireEmail,
  requireSnPhone,
  requireString,
  ValidationError,
} from "../_shared/validate.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  const svc = serviceClient();
  try {
    await enforceRateLimit(svc, `register-student:${clientIp(req)}`, 10, 300);

    const body = expectObject(await req.json());
    const schoolId = optionalUuid(body, "schoolId", "L'école");
    const matricule = optionalString(body, "matricule", "Le matricule de l'école", 10)?.toUpperCase();
    const firstName = requireString(body, "firstName", "Le prénom", { min: 1, max: 60 });
    const lastName = requireString(body, "lastName", "Le nom", { min: 1, max: 60 });
    const email = requireEmail(body);
    const phone = requireSnPhone(body, "phone", "Le téléphone");
    const gender = body["gender"] === "M" ? "M" : body["gender"] === "F" ? "F" : undefined;
    const birthDate = optionalIsoDate(body, "birthDate", "La date de naissance");
    const classId = optionalUuid(body, "classId", "La classe");
    const password = requireString(body, "password", "Le mot de passe", { min: 8, max: 128, trim: false });

    if (gender === undefined && body["gender"] !== undefined && body["gender"] !== "") {
      return badRequest("Le sexe est invalide.");
    }

    // Résolution de l'école : uuid fourni OU matricule public.
    let resolvedSchool: string | null = null;
    if (schoolId) {
      const { data } = await svc.from("schools").select("id").eq("id", schoolId).maybeSingle();
      resolvedSchool = data?.id ?? null;
    } else if (matricule) {
      const { data } = await svc.from("schools").select("id").ilike("matricule", matricule).maybeSingle();
      resolvedSchool = data?.id ?? null;
    }
    if (!resolvedSchool) return badRequest("École introuvable.");
    if (!classId) return badRequest("Sélectionnez une classe.");

    const { data: created, error: createError } = await svc.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role: "eleve", school_id: resolvedSchool },
    });
    if (createError || !created?.user) {
      const duplicate = /already|duplicate|registered/i.test(createError?.message ?? "");
      return badRequest(
        duplicate ? "Un compte existe déjà avec cet e-mail." : "Impossible de créer le compte. Réessayez.",
      );
    }

    try {
      const { data, error } = await svc.rpc("finish_student_registration", {
        p_user_id: created.user.id,
        p_school_id: resolvedSchool,
        p_first_name: firstName,
        p_last_name: lastName,
        p_phone: phone,
        p_email: email,
        p_gender: gender ?? null,
        p_birth_date: birthDate ?? null,
        p_class_id: classId,
      });
      if (error || !data) throw new Error(error?.message ?? "Inscription incomplète.");
      const result = data as { request_id: string; approved: boolean; student_id: string | null };
      return ok({
        user: { id: created.user.id, email, firstName, lastName, role: "eleve", status: result.approved ? "ACTIF" : "EN_ATTENTE" },
        requestId: result.request_id,
        approved: result.approved,
      });
    } catch (sqlError) {
      await svc.auth.admin.deleteUser(created.user.id);
      const message = sqlError instanceof Error ? sqlError.message : undefined;
      if (message && /un compte existe déjà|classe|école|inscriptions/i.test(message)) {
        return badRequest(message);
      }
      return serverError();
    }
  } catch (e) {
    if (e instanceof ValidationError) return badRequest(e.message);
    if (e instanceof Error && /trop de tentatives/i.test(e.message)) return badRequest(e.message);
    return serverError();
  }
});
