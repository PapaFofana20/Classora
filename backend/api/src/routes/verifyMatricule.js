/**
 * Vérification publique du matricule d'école (formulaire /inscription).
 * Contrôles et messages identiques à schoolService.verifyMatricule : format →
 * introuvable → blocage → expiration → inscriptions fermées → ok.
 */

import { serviceClient } from "../lib/auth.js";
import { methodNotAllowed, ok, route, serverError } from "../lib/http.js";
import { enforceRateLimit, clientIp } from "../lib/rateLimit.js";

export default route(async (req, res) => {
  if (req.method !== "GET" && req.method !== "POST") return methodNotAllowed(res);
  const svc = serviceClient();
  try {
    await enforceRateLimit(svc, `verify-matricule:${clientIp(req) ?? "sans-adresse"}`, 20, 600);

    let raw = null;
    if (req.method === "GET") {
      raw = req.query.matricule ?? req.query.m ?? null;
    } else {
      raw = req.body?.matricule ?? null;
    }
    if (typeof raw !== "string" || raw.trim() === "") {
      return ok(res, { error: "Saisissez le matricule communiqué par votre école." }, 400);
    }

    const { data: result, error } = await svc.rpc("verify_matricule", { p_matricule: raw });
    if (error || !result) {
      console.error("[verify-matricule] rpc", error);
      return serverError(res);
    }

    const status = result.ok === true ? 200 : (result.reason === "format" ? 400 : 404);
    return ok(res, result, status);
  } catch (e) {
    if (e?.name === "ValidationError") return ok(res, { error: e.message }, 400);
    console.error("[verify-matricule]", e);
    return serverError(res);
  }
});
