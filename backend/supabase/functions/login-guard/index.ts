/**
 * Contrôle POST-connexion : vérification du statut du compte avec les mêmes
 * messages que le front (authService.login). Supabase Auth ouvre une session
 * même pour un compte EN_ATTENTE/DESACTIVE : c'est cette fonction qui décide
 * si la session est exploitable (les politiques RLS le rappellent, en dur).
 *
 * L'identité de l'appelant est résolue par JWT VÉRIFIÉ (getAuthenticatedUser,
 * validation par Supabase Auth) — l'ancien décodage base64 sans vérification
 * de signature n'est plus utilisé. Journaux d'audit écrits APRÈS verdict.
 * Débit limité par compte vérifié (plus par IP falsifiable).
 */

import { getAuthenticatedUser, audit, serviceClient } from "../_shared/auth.ts";
import { handleOptions, methodNotAllowed, ok, serverError, unauthorized } from "../_shared/http.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== "POST") return methodNotAllowed(origin);
  const svc = serviceClient();
  try {
    const user = await getAuthenticatedUser(svc, req);
    if (!user) return unauthorized(origin);

    await enforceRateLimit(svc, `login-guard:${user.id}`, 20, 300);

    const { data: profile, error } = await svc
      .from("profiles")
      .select("id, school_id, role, status, must_change_password")
      .eq("id", user.id)
      .maybeSingle();
    if (error || !profile) {
      return unauthorized(origin, "E-mail ou mot de passe incorrect.");
    }

    if (profile.status === "DESACTIVE") {
      await audit(svc, {
        schoolId: profile.school_id,
        actorId: profile.id,
        actorRole: profile.role,
        action: "login_blocked_desactive",
        entity: "profiles",
        entityId: profile.id,
      });
      return ok(origin, {
        status: "DESACTIVE",
        error: "Ce compte a été désactivé par la direction de votre école. Contactez votre école.",
      });
    }
    if (profile.status === "EN_ATTENTE") {
      await audit(svc, {
        schoolId: profile.school_id,
        actorId: profile.id,
        actorRole: profile.role,
        action: "login_blocked_en_attente",
        entity: "profiles",
        entityId: profile.id,
      });
      return ok(origin, {
        status: "EN_ATTENTE",
        error: "Votre demande d'inscription est en attente de validation par votre école.",
      });
    }

    await audit(svc, {
      schoolId: profile.school_id,
      actorId: profile.id,
      actorRole: profile.role,
      action: "login",
      entity: "profiles",
      entityId: profile.id,
    });

    return ok(origin, {
      status: "ACTIF",
      schoolId: profile.school_id,
      role: profile.role,
      mustChangePassword: profile.must_change_password,
    });
  } catch (e) {
    if (e instanceof Error && /trop de tentatives/i.test(e.message)) return ok(origin, { error: e.message }, 429);
    return serverError(origin);
  }
});