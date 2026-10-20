/**
 * Vérification publique du matricule d'école (formulaire /inscription).
 * Contrôles et messages identiques à schoolService.verifyMatricule : format →
 * introuvable → blocage → expiration → inscriptions fermées → ok.
 */

import { serviceClient } from "../_shared/auth.ts";
import { badRequest, handleOptions, ok, serverError } from "../_shared/http.ts";
import { enforceRateLimit, clientIp } from "../_shared/rateLimit.ts";
import { ValidationError } from "../_shared/validate.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  const svc = serviceClient();
  try {
    await enforceRateLimit(svc, `verify-matricule:${clientIp(req)}`, 20, 600);

    let raw: unknown = null;
    if (req.method === "GET") {
      raw = new URL(req.url).searchParams.get("matricule") ?? new URL(req.url).searchParams.get("m");
    } else {
      raw = (await req.json())?.["matricule"] ?? null;
    }
    if (typeof raw !== "string" || raw.trim() === "") {
      return badRequest("Saisissez le matricule communiqué par votre école.");
    }

    const { data: result, error } = await svc.rpc("verify_matricule", { p_matricule: raw });
    if (error || !result) return serverError();

    const status = result.ok === true ? 200 : (result.reason === "format" ? 400 : 404);
    return ok(result, status);
  } catch (e) {
    if (e instanceof ValidationError) return badRequest(e.message);
    return serverError();
  }
});
