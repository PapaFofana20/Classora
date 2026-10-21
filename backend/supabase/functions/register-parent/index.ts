/**
 * Inscription publique d'un PARENT : le code élève (6 caractères) rattache le
 * compte à un élève de CETTE école ; sinon le message du front.
 */

import { serviceClient } from "../_shared/auth.ts";
import { badRequest, CORS_HEADERS, ok, serverError } from "../_shared/http.ts";
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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  const svc = serviceClient();
  try {
    await enforceRateLimit(svc, `register-parent:${clientIp(req) ?? "sans-adresse"}`, 10, 300);

    const body = expectObject(await req.json());
    const schoolId = optionalUuid(body, "schoolId", "L'école");
    const matricule = optionalString(body, "matricule", "Le matricule de l'école", 10)?.toUpperCase();
    const firstName = requireString(body, "firstName", "Le prénom", { min: 1, max: 60 });
    const lastName = requireString(body, "lastName", "Le nom", { min: 1, max: 60 });
    const email = requireEmail(body);
    const phone = requireSnPhone(body, "phone", "Le téléphone");
    const childCode = requireString(body, "childCode", "Le code élève", { min: 6, max: 8 }).toUpperCase();
    const password = requireString(body, "password", "Le mot de passe", { min: 8, max: 128, trim: false });

    let resolvedSchool: string | null = null;
    if (schoolId) {
      const { data } = await svc.from("schools").select("id").eq("id", schoolId).maybeSingle();
      resolvedSchool = data?.id ?? null;
    } else if (matricule) {
      // eq() : le matricule/code sont normalisés en majuscules côté client ;
      // ilike() laisserait % et _ agir comme jokers (balayage d'écoles/codes).
      const { data: sch } = await svc.from("schools").select("id").eq("matricule", matricule).maybeSingle();
      resolvedSchool = sch?.id ?? null;
      if (resolvedSchool) {
        // Pré-validation d'un code élève de l'école (message identique au front).
        const { data: child } = await svc
          .from("students")
          .select("id")
          .eq("school_id", resolvedSchool)
          .eq("child_code", childCode)
          .maybeSingle();
        if (!child) {
          return badRequest("Code élève introuvable dans cette école. Vérifiez le code reçu auprès de l'école.");
        }
      }
    }
    if (!resolvedSchool) return badRequest("École introuvable.");

    const { data: created, error: createError } = await svc.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role: "parent", school_id: resolvedSchool },
    });
    if (createError || !created?.user) {
      const duplicate = /already|duplicate|registered/i.test(createError?.message ?? "");
      return badRequest(
        duplicate ? "Un compte existe déjà avec cet e-mail." : "Impossible de créer le compte. Réessayez.",
      );
    }

    try {
      const { data, error } = await svc.rpc("finish_parent_registration", {
        p_user_id: created.user.id,
        p_school_id: resolvedSchool,
        p_first_name: firstName,
        p_last_name: lastName,
        p_phone: phone,
        p_email: email,
        p_child_code: childCode,
      });
      if (error || !data) throw new Error(error?.message ?? "Inscription incomplète.");
      const result = data as { request_id: string; approved: boolean; child_id: string; child_name: string };
      return ok({
        user: { id: created.user.id, email, firstName, lastName, role: "parent", status: result.approved ? "ACTIF" : "EN_ATTENTE" },
        requestId: result.request_id,
        approved: result.approved,
        childName: result.child_name,
      });
    } catch (sqlError) {
      await svc.auth.admin.deleteUser(created.user.id);
      const message = sqlError instanceof Error ? sqlError.message : undefined;
      if (message && /un compte existe déjà|code élève|école|inscriptions/i.test(message)) {
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
