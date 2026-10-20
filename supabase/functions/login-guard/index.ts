/**
 * Contrôle POST-connexion : vérification du statut du compte avec les mêmes
 * messages que le front (authService.login). Supabase Auth ouvre une session
 * même pour un compte EN_ATTENTE/DESACTIVE : c'est cette fonction qui décide
 * si la session est exploitable (les politiques RLS le rappellent, en dur).
 */

import { audit, serviceClient } from "../_shared/auth.ts";
import { CORS_HEADERS, ok, serverError, unauthorized } from "../_shared/http.ts";
import { clientIp, enforceRateLimit } from "../_shared/rateLimit.ts";

interface DecodedJwt {
  sub: string | null;
  role: string | null;
  schoolId: string | null;
}

function decodeJwt(token: string): DecodedJwt {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return { sub: null, role: null, schoolId: null };
    const claims = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    const meta = claims.app_metadata ?? {};
    return { sub: claims.sub ?? null, role: meta.role ?? null, schoolId: meta.school_id ?? null };
  } catch {
    return { sub: null, role: null, schoolId: null };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  const svc = serviceClient();
  try {
    await enforceRateLimit(svc, `login-guard:${clientIp(req)}`, 20, 300);

    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const claims = decodeJwt(jwt);
    if (!claims.sub) return unauthorized();

    const { data: profile, error } = await svc
      .from("profiles")
      .select("id, school_id, role, status, must_change_password")
      .eq("id", claims.sub)
      .maybeSingle();
    if (error || !profile) {
      return unauthorized("E-mail ou mot de passe incorrect.");
    }

    await audit(svc, {
      schoolId: profile.school_id,
      actorId: profile.id,
      actorRole: profile.role,
      action: "login",
      entity: "profiles",
      entityId: profile.id,
    });

    if (profile.status === "DESACTIVE") {
      return ok({
        status: "DESACTIVE",
        error: "Ce compte a été désactivé par la direction de votre école. Contactez votre école.",
      });
    }
    if (profile.status === "EN_ATTENTE") {
      return ok({
        status: "EN_ATTENTE",
        error: "Votre demande d'inscription est en attente de validation par votre école.",
      });
    }
    return ok({
      status: "ACTIF",
      schoolId: profile.school_id,
      role: profile.role,
      mustChangePassword: profile.must_change_password,
    });
  } catch (e) {
    if (e instanceof Error && /trop de tentatives/i.test(e.message)) return ok({ error: e.message }, 429);
    return serverError();
  }
});
