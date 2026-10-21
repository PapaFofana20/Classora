/**
 * Démarrage d'un achat d'abonnement (direction).
 * Crée une transaction PENDING ; le montant vient de public.plans (jamais du
 * client) et l'école du profil vérifié. La confirmation arrive par le webhook
 * signé payment-webhook.
 */

import { audit, requireDirecteur, serviceClient } from "../lib/auth.js";
import { badRequest, ok, route, serverError, unauthorized, RATE_LIMIT_RE } from "../lib/http.js";
import { enforceRateLimit } from "../lib/rateLimit.js";
import { generateProviderRef, isPayMethod } from "../lib/payments.js";
import { expectObject, requireSnPhone, requireString } from "../lib/validate.js";

export default route(async (req, res) => {
  if (req.method !== "POST") return ok(res, { error: "Méthode non autorisée." }, 405);
  const svc = serviceClient();
  try {
    const dir = await requireDirecteur(svc, req, res);
    if (!dir) return;
    const { caller } = dir;
    if (caller.status !== "ACTIF") {
      return unauthorized(res, "Seule la direction peut acheter un abonnement.");
    }

    await enforceRateLimit(svc, `start-sub:${caller.id}`, 10, 300);

    const body = expectObject(req.body);
    const planId = requireString(body, "planId", "La formule", { max: 32 });
    const cycle = requireString(body, "cycle", "Le cycle", { max: 16 });
    const method = body["method"];
    const phone = requireSnPhone(body, "phone", "Le numéro");

    if (cycle !== "monthly" && cycle !== "yearly") {
      return badRequest(res, "Choisissez une facturation mensuelle ou annuelle.");
    }
    if (!isPayMethod(method)) {
      return badRequest(res, "Choisissez Wave, Orange Money ou Free Money.");
    }

    // Aucun montant client : le prix vient du référentiel.
    const { data: plan, error: planError } = await svc
      .from("plans")
      .select("id, name, monthly_price, yearly_price, student_limit")
      .eq("id", planId)
      .maybeSingle();
    if (planError || !plan) {
      return badRequest(res, "Formule d'abonnement introuvable.");
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
    if (txError || !tx) {
      console.error("[start-subscription] insert", txError);
      return serverError(res);
    }

    await audit(svc, {
      schoolId: caller.schoolId,
      actorId: caller.id,
      actorRole: caller.role,
      action: "subscription_started",
      entity: "payment_transactions",
      entityId: tx.id,
      payload: { plan_id: plan.id, cycle, amount },
    });

    return ok(res, {
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
    if (e?.name === "ValidationError") return badRequest(res, e.message);
    if (e instanceof Error && RATE_LIMIT_RE.test(e.message)) return ok(res, { error: e.message }, 429);
    console.error("[start-subscription]", e);
    return serverError(res);
  }
});
