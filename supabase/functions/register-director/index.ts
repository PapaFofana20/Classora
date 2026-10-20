/**
 * Inscription publique d'un DIRECTEUR (3 étapes atomiques) :
 *  1. création du compte Auth (échec rapide si l'e-mail est déjà pris) ;
 *  2. une seule RPC security definer transactionnelle : école, paramètres,
 *     frais par niveau, matières par défaut, profil ACTIF ;
 *  3. nettoyage du compte Auth si l'étape 2 échoue (pas d'état fantôme).
 * Pas d'abonnement, pas de matricule : l'écran suivant est /app/abonnement.
 */

import { passwordError, serviceClient } from "../_shared/auth.ts";
import { badRequest, CORS_HEADERS, ok, serverError } from "../_shared/http.ts";
import { clientIp, enforceRateLimit } from "../_shared/rateLimit.ts";
import {
  expectObject,
  requireCycles,
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
    await enforceRateLimit(svc, `register-director:${clientIp(req)}`, 5, 300);

    const body = expectObject(await req.json());
    const firstName = requireString(body, "firstName", "Le prénom", { min: 1, max: 60 });
    const lastName = requireString(body, "lastName", "Le nom", { min: 1, max: 60 });
    const email = requireEmail(body);
    const phone = requireSnPhone(body, "phone", "Le téléphone");
    const password = requireString(body, "password", "Le mot de passe", { min: 8, max: 128, trim: false });
    const schoolName = requireString(body, "schoolName", "Le nom de l'école", { min: 2, max: 120 });
    const city = requireString(body, "city", "La ville", { min: 1, max: 80 });
    const cycles = requireCycles(body);

    const pwError = passwordError(password);
    if (pwError) return badRequest(pwError);

    // 1. Compte Auth (l'e-mail en double est renvoyé avec le message du front).
    const { data: created, error: createError } = await svc.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role: "directeur", school_id: null },
    });
    if (createError || !created?.user) {
      const duplicate = /already|duplicate|registered/i.test(createError?.message ?? "");
      return badRequest(
        duplicate ? "Un compte existe déjà avec cet e-mail." : "Impossible de créer le compte. Réessayez.",
      );
    }

    // 2. Écritures transactionnelles côté SQL.
    try {
      const { data, error } = await svc.rpc("finish_director_registration", {
        p_user_id: created.user.id,
        p_first_name: firstName,
        p_last_name: lastName,
        p_phone: phone,
        p_email: email,
        p_school_name: schoolName,
        p_city: city,
        p_cycles: cycles,
      });
      if (error || !data) {
        throw new Error(error?.message ?? "Inscription incomplète.");
      }
      return ok({
        schoolId: data,
        email,
        message: "Compte créé. Connectez-vous pour ouvrir votre session.",
      });
    } catch (sqlError) {
      // 3. Nettoyage : le compte Auth ne doit pas survivre sans école/profil.
      await svc.auth.admin.deleteUser(created.user.id);
      const message = sqlError instanceof Error ? sqlError.message : undefined;
      if (message && /un compte existe déjà/i.test(message)) return badRequest(message);
      return serverError();
    }
  } catch (e) {
    if (e instanceof ValidationError) return badRequest(e.message);
    if (e instanceof Error && /trop de tentatives/i.test(e.message)) return badRequest(e.message);
    return serverError();
  }
});
