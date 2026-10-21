/**
 * Paiement d'échéances scolaires par la famille (parent, élève).
 * Le corps du flux côté serveur :
 *   1. start_installment_payments → transactions PENDING (une par échéance).
 *   2. En sandbox (APP_ENV=sandbox) : confirmation immédiate via
 *      apply_paid_installment (idempotent). En production : la confirmation
 *      vient du webhook signé (payment-webhook) ; rejouer une même référence
 *      ne double jamais le montant.
 */

import { audit, getCallerProfile, serviceClient } from "../lib/auth.js";
import { badRequest, methodNotAllowed, ok, route, serverError, unauthorized, RATE_LIMIT_RE } from "../lib/http.js";
import { enforceRateLimit } from "../lib/rateLimit.js";
import { isPayMethod } from "../lib/payments.js";
import { expectObject, requireSnPhone, requireStringArray } from "../lib/validate.js";
import { APP_ENV } from "../config.js";

export default route(async (req, res) => {
  if (req.method !== "POST") return methodNotAllowed(res);
  const svc = serviceClient();
  try {
    const caller = await getCallerProfile(svc, req);
    if (!caller || caller.status !== "ACTIF" || caller.mustChangePassword) {
      return unauthorized(res, "Connectez-vous pour payer les échéances.");
    }
    if (caller.role !== "parent" && caller.role !== "eleve") {
      return badRequest(res, "Seuls les parents et les élèves initient un paiement d'échéances.");
    }

    await enforceRateLimit(svc, `pay-installment:${caller.id}`, 12, 300);

    const body = expectObject(req.body);
    const paymentIds = requireStringArray(body, "paymentIds", "Les échéances");
    const rawMethod = body["method"];
    if (!isPayMethod(rawMethod)) {
      return badRequest(res, "Moyen de paiement invalide.");
    }
    const method = rawMethod;
    const phone = requireSnPhone(body, "phone", "Le numéro");

    // 1. Transactions PENDING (la vérification de la famille est côté SQL).
    const { data: started, error: startError } = await svc.rpc("start_installment_payments", {
      p_payment_ids: paymentIds,
      p_method: method,
      p_phone: phone,
    });
    if (startError || started === null) {
      const msg = startError?.message ?? "";
      if (msg.includes("Ces échéances ne vous concernent pas.")) return badRequest(res, msg);
      if (msg.includes("Moyen de paiement invalide.")) return badRequest(res, msg);
      if (msg.includes("Numéro de téléphone invalide.")) return badRequest(res, msg);
      if (msg.includes("Mode lecture seule")) return badRequest(res, msg);
      console.error("[pay-installment] rpc", startError);
      return serverError(res);
    }

    const pending = started;
    const refs = pending.map((x) => x.reference);

    // 2. Confirmation : elle appartient au PRESTATAIRE (webhook signé).
    //    L'auto-confirmation n'existe qu'en bac à sable explicite : en
    //    production, solder une échéance sans transfert d'argent vole la
    //    recette de l'école.
    const sandbox = APP_ENV === "sandbox";
    if (sandbox) {
      for (const ref of refs) {
        const { error: confirmError } = await svc.rpc("apply_paid_installment", {
          p_provider: method,
          p_provider_ref: ref,
          p_status: "succeeded",
          p_payload: { confirmed_by: "sandbox" },
        });
        if (confirmError) {
          console.error("[pay-installment] confirm", confirmError);
          return serverError(res);
        }
      }
    }

    await audit(svc, {
      actorId: caller.id,
      actorRole: caller.role,
      action: "installments_paid_family",
      entity: "payment_transactions",
      payload: { method, count: refs.length, confirmedBy: sandbox ? "sandbox" : "provider_pending" },
    });

    const limit = pending.reduce((s, x) => s + (x.amount ?? 0), 0);
    if (!sandbox) {
      return ok(res, {
        references: refs,
        method,
        phone,
        amount: limit,
        status: refs.length ? "pending" : "rien_a_payer",
        message: refs.length
          ? "Paiement demandé. Confirmez la transaction sur votre téléphone : vos échéances seront réglées dès réception du paiement."
          : "Ces échéances sont déjà soldées.",
      });
    }
    return ok(res, {
      references: refs,
      method,
      phone,
      amount: limit,
      status: refs.length ? "succeeded" : "rien_a_payer",
      message: refs.length
        ? "Paiement confirmé. Vos échéances sont réglées."
        : "Ces échéances sont déjà soldées.",
    });
  } catch (e) {
    if (e?.name === "ValidationError") return badRequest(res, e.message);
    if (e instanceof Error && RATE_LIMIT_RE.test(e.message)) return ok(res, { error: e.message }, 429);
    console.error("[pay-installment]", e);
    return serverError(res);
  }
});
