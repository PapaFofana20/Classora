/**
 * Démarrage d'un achat d'abonnement (direction).
 * Crée une transaction PENDING ; le montant vient de public.plans (jamais du
 * client) et l'école de la session. La confirmation arrive par payment-webhook.
 */

import { audit, requireDirecteur, serviceClient } from "../_shared/auth.ts";
import { badRequest, handleOptions, methodNotAllowed, ok, serverError, unauthorized } from "../_shared/http.ts";
import { enforceRateLimit, clientIp } from "../_shared/rateLimit.ts";
import { generateProviderRef, isPayMethod } from "../_shared/payments.ts";
import { expectObject, requireSnPhone, requireString, ValidationError } from "../_shared/validate.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== "POST") return methodNotAllowed();
  const svc = serviceClient();
  try {
    const authResult = await requireDirecteur(svc, req);
    if (authResult instanceof Response) return authResult;
    const { caller } = authResult;
    if (caller.status !== "ACTIF") {
      return unauthorized("Seule la direction peut acheter un abonnement.");
    }

    await enforceRateLimit(svc, `start-sub:${caller.id}`, 10, 300);

    const body = expectObject(await req.json());
    const planId = requireString(body, "planId", "La formule", { max: 32 });
    const cycle = requireString(body, "cycle", "Le cycle", { max: 16 });
    const method = body["method"];
    const phone = requireSnPhone(body, "phone", "Le numéro");

    if (cycle !== "monthly" && cycle !== "yearly") {
      return badRequest("Choisissez une facturation mensuelle ou annuelle.");
    }
    if (!isPayMethod(method)) {
      return badRequest("Choisissez Wave, Orange Money ou Free Money.");
    }

    // Aucun montant client : le prix vient du référentiel.
    const { data: plan, error: planError } = await svc
      .from("plans")
      .select("id, name, monthly_price, yearly_price, student_limit")
      .eq("id", planId)
      .maybeSingle();
    if (planError || !plan) {
      return badRequest("Formule d'abonnement introuvable.");
    }
    const amount = cycle === "yearly" ? plan.yearly_price : plan.monthly_price;
    const providerRef = generateProviderRef(method);

    const { data: tx, error: txError } = await svc
      .from("payment_transactions")
      .insert({
        tx_kind: "subscription",
        school_id: caller.schoolId,
        provider: method, // en sandbox le prestataire = méthode ; en prod : 'wave', etc.
        provider_ref: providerRef,
        amount,
        method,
        phone,
        status: "pending",
        payload: {
          plan_id: plan.id,
          cycle,
          student_limit: plan.student_limit,
          school_id: caller.schoolId,
        },
      })
      .select("id, provider_ref, amount, status")
      .single();
    if (txError || !tx) return serverError();

    await audit(svc, {
      schoolId: caller.schoolId,
      actorId: caller.id,
      actorRole: caller.role,
      action: "subscription_started",
      entity: "payment_transactions",
      entityId: tx.id,
      payload: { plan_id: plan.id, cycle, amount },
    });

    return ok({
      reference: tx.provider_ref,
      amount: tx.amount,
      method,
      phone,
      planId: plan.id,
      planName: plan.name,
      studentLimit: plan.student_limit,
      cycle,
      status: tx.status,
      message: "Confirmez le paiement sur votre téléphone, puis l'abonnement s'active automatiquement.",
    });
  } catch (e) {
    if (e instanceof ValidationError) return badRequest(e.message);
    return serverError();
  }
});
