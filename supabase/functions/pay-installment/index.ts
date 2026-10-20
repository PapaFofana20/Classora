/**
 * Paiement d'échéances scolaires par la famille (parent, élève).
 * Le corps du flux côté serveur :
 *   1. start_installment_payments → transactions PENDING (une par échéance).
 *   2. En sandbox : confirmation immédiate via apply_paid_installment
 *      (idempotent). En production : retour au PSP, la confirmation vient
 *      alors de payment-webhook (HMAC) ; rejouer une même référence ne
 *      double jamais le montant.
 */

import { audit, getCallerProfile, serviceClient } from "../_shared/auth.ts";
import { badRequest, handleOptions, ok, serverError, unauthorized } from "../_shared/http.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { isPayMethod } from "../_shared/payments.ts";
import { expectObject, requireSnPhone, requireStringArray, ValidationError } from "../_shared/validate.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  const svc = serviceClient();
  try {
    const caller = await getCallerProfile(svc, req);
    if (!caller || caller.status !== "ACTIF" || caller.mustChangePassword) {
      return unauthorized("Connectez-vous pour payer les échéances.");
    }
    if (caller.role !== "parent" && caller.role !== "eleve") {
      return badRequest("Seuls les parents et les élèves initient un paiement d'échéances.");
    }

    await enforceRateLimit(svc, `pay-installment:${caller.id}`, 12, 300);

    const body = expectObject(await req.json());
    const paymentIds = requireStringArray(body, "paymentIds", "Les échéances");
    const rawMethod = body["method"];
    if (!isPayMethod(rawMethod)) {
      return badRequest("Moyen de paiement invalide.");
    }
    const method: string = rawMethod;
    const phone = requireSnPhone(body, "phone", "Le numéro");

    // 1. Transactions PENDING (la vérification de la famille est côté SQL).
    const { data: started, error: startError } = await svc.rpc("start_installment_payments", {
      p_payment_ids: paymentIds,
      p_method: method,
      p_phone: phone,
    });
    if (startError || started === null) {
      const msg = startError?.message ?? "";
      if (msg.includes("Ces échéances ne vous concernent pas.")) return badRequest(msg);
      if (msg.includes("Moyen de paiement invalide.")) return badRequest(msg);
      if (msg.includes("Numéro de téléphone invalide.")) return badRequest(msg);
      if (msg.includes("Mode lecture seule")) return badRequest(msg);
      return serverError();
    }

    const pending = started as { reference: string; amount: number }[];
    const refs = pending.map((x) => x.reference);

    // 2. Sandbox : confirmation immédiate et idempotente des références.
    for (const ref of refs) {
      const { error: confirmError } = await svc.rpc("apply_paid_installment", {
        p_provider: method,
        p_provider_ref: ref,
        p_status: "succeeded",
        p_payload: { confirmed_by: "sandbox" },
      });
      if (confirmError) return serverError();
    }

    await audit(svc, {
      actorId: caller.id,
      actorRole: caller.role,
      action: "installments_paid_family",
      entity: "payment_transactions",
      payload: { method, count: refs.length },
    });

    const limit = pending.reduce((s, x) => s + (x.amount ?? 0), 0);
    return ok({
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
    if (e instanceof ValidationError) return badRequest(e.message);
    return serverError();
  }
});
