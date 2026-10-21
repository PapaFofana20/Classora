/**
 * Webhook de confirmation des paiements, appelé par le prestataire (ou le
 * script de sandbox). SIGNATURE HMAC OBLIGATOIRE (en-tête x-scolia-signature
 * = hex SHA-256 du corps brut ; secret SCOLIA_WEBHOOK_SECRET, côté serveur).
 * Sans elle, un simple jeton d'utilisateur suffirait à confirmer un paiement
 * jamais payé. La RPC sélectionnée dépend de tx_kind (installment /
 * subscription) ; les deux RPC sont idempotentes.
 */

import { audit, serviceClient } from "../lib/auth.js";
import { badRequest, notFound, ok, route, serverError } from "../lib/http.js";
import { verifyWebhookSignature } from "../lib/payments.js";
import { expectObject, requireString } from "../lib/validate.js";

export default route(async (req, res) => {
  if (req.method !== "POST") return ok(res, { error: "Méthode non autorisée." }, 405);
  const svc = serviceClient();
  try {
    const signature = req.get("x-scolia-signature");
    // La signature HMAC est OBLIGATOIRE, quelle que soit l'origine de l'appel.
    // Message unique pour l'appelant (absente/invalide/secret non configuré
    // restent indiscernables) : le détail est journalisé côté serveur.
    try {
      verifyWebhookSignature(req.rawBody, signature);
    } catch (e) {
      console.error("[payment-webhook] Signature de webhook refusée.", e);
      return badRequest(res, "Signature de webhook invalide.");
    }

    const body = expectObject(req.body);
    const provider = requireString(body, "provider", "Le prestataire", { max: 32 });
    const providerRef = requireString(body, "reference", "La référence", { max: 64 });
    const status = requireString(body, "status", "Le statut", { max: 16 });
    if (status !== "succeeded" && status !== "failed") {
      return badRequest(res, "Statut de paiement invalide (succeeded ou failed attendu).");
    }

    // La transaction doit exister (créée par start-subscription ou
    // start_installment_payments) ; le type détermine l'application.
    const { data: tx } = await svc
      .from("payment_transactions")
      .select("id, school_id, status, tx_kind")
      .eq("provider", provider)
      .eq("provider_ref", providerRef)
      .maybeSingle();
    if (!tx) {
      return notFound(res, "Transaction inconnue. Aucun paiement n'a été initialisé pour cette référence.");
    }

    const payload = body["payload"] ?? {};

    if (tx.tx_kind === "installment") {
      // Échéance scolaire : encaissement idempotent sur payments.
      const { data: result, error: applyError } = await svc.rpc("apply_paid_installment", {
        p_provider: provider,
        p_provider_ref: providerRef,
        p_status: status,
        p_payload: payload,
      });
      if (applyError || !result) {
        if (typeof applyError?.message === "string" && applyError.message.startsWith("Transaction inconnue.")) {
          return notFound(res, applyError.message);
        }
        console.error("[payment-webhook] apply installment", applyError);
        return serverError(res);
      }
      await audit(svc, {
        schoolId: tx.school_id,
        actorId: null,
        actorRole: "service_role",
        action: status === "succeeded" ? "installment_payment_confirmed" : "installment_payment_failed",
        entity: "payment_transactions",
        entityId: tx.id,
        payload: { provider, reference: providerRef, status },
      });
      return ok(res, {
        reference: providerRef,
        status: result.status ?? "succeeded",
        idempotent: result.idempotent ?? false,
        paymentId: result.payment_id ?? null,
        message: status === "succeeded"
          ? "Paiement confirmé. Votre échéance est réglée."
          : "Paiement refusé par le prestataire. Réessayez ou choisissez un autre moyen.",
      });
    }

    // Abonnement école : activation / renouvellement idempotent,
    // attribution du matricule à la première confirmation.
    const { data: result, error: applyError } = await svc.rpc("apply_paid_subscription", {
      p_provider: provider,
      p_provider_ref: providerRef,
      p_status: status,
      p_payload: payload,
    });
    if (applyError || !result) {
      if (typeof applyError?.message === "string" && applyError.message.startsWith("Transaction inconnue.")) {
        return notFound(res, applyError.message);
      }
      console.error("[payment-webhook] apply subscription", applyError);
      return serverError(res);
    }

    await audit(svc, {
      schoolId: tx.school_id,
      actorId: null,
      actorRole: "service_role",
      action: status === "succeeded" ? "subscription_payment_confirmed" : "subscription_payment_failed",
      entity: "payment_transactions",
      entityId: tx.id,
      payload: { provider, reference: providerRef, status },
    });

    return ok(res, {
      reference: providerRef,
      status: result.status ?? "succeeded",
      idempotent: result.idempotent ?? false,
      matricule: result.matricule ?? null,
      matriculeCreated: result.matriculeCreated ?? false,
      planId: result.plan_id ?? null,
      amount: result.amount ?? null,
      startsAt: result.starts_at ?? null,
      endsAt: result.ends_at ?? null,
      message: "Paiement confirmé. L'abonnement de votre école est activé.",
    });
  } catch (e) {
    if (e?.name === "ValidationError") return badRequest(res, e.message);
    console.error("[payment-webhook]", e);
    return serverError(res);
  }
});
