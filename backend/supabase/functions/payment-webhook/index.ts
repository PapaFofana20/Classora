/**
 * Webhook des prestataires de paiement (Wave / Orange Money / Free Money).
 * Corps BRUT signé HMAC-SHA256 (en-tête x-scolia-signature), idempotent :
 * rejouer la confirmation ne modifie ni l'échéance, ni les événements.
 * Le type de transaction (tx_kind) détermine la suite : abonnement d'école
 * (apply_paid_subscription) ou échéance scolaire (apply_paid_installment).
 */

import { audit, serviceClient } from "../_shared/auth.ts";
import { badRequest, handleOptions, methodNotAllowed, notFound, ok, serverError } from "../_shared/http.ts";
import { verifyWebhookSignature } from "../_shared/payments.ts";
import { expectObject, requireString, ValidationError } from "../_shared/validate.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== "POST") return methodNotAllowed();
  const svc = serviceClient();
  try {
    const raw = await req.text();
    let body: Record<string, unknown>;
    try {
      body = expectObject(JSON.parse(raw));
    } catch {
      return badRequest("Corps du webhook invalide.");
    }

    const signature = req.headers.get("x-scolia-signature");
    // La signature HMAC est OBLIGATOIRE, quelle que soit l'origine de l'appel.
    // Sans elle, un simple jeton d'utilisateur (n'importe quel élève ou
    // parent inscrit) suffirait à confirmer un paiement jamais payé.
    if (!signature) {
      // Message identique à une signature invalide : l'absence d'en-tête ne
      // doit pas être distinguable d'un HMAC erroné (reconnaissance de la
      // configuration du serveur par un attaquant).
      return badRequest("Signature de webhook invalide.");
    }
    try {
      await verifyWebhookSignature(raw, signature);
    } catch (e) {
      // Message unique pour l'appelant (absente/invalide/secret non configuré
      // restent indiscernables) : le détail est journalisé côté serveur.
      console.error("Signature de webhook refusée.", e);
      return badRequest("Signature de webhook invalide.");
    }

    const provider = requireString(body, "provider", "Le prestataire", { max: 32 });
    const providerRef = requireString(body, "reference", "La référence", { max: 64 });
    const status = requireString(body, "status", "Le statut", { max: 16 });
    if (status !== "succeeded" && status !== "failed") {
      return badRequest("Statut de paiement invalide (succeeded ou failed attendu).");
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
      return notFound("Transaction inconnue. Aucun paiement n'a été initialisé pour cette référence.");
    }

    const payload = (body["payload"] ?? {}) as Record<string, unknown>;

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
          return notFound(applyError.message);
        }
        return serverError();
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
      const paymentStatus = (result as Record<string, unknown>).status ?? null;
      return ok({
        reference: providerRef,
        status: paymentStatus ?? "succeeded",
        idempotent: (result as Record<string, unknown>).idempotent ?? false,
        paymentId: (result as Record<string, unknown>).payment_id ?? null,
        message: status === "succeeded"
          ? "Paiement confirmé. Votre échéance est réglée."
          : "Paiement refusé par le prestataire. Réessayez ou choisissez un autre moyen.",
      });
    }

    const { data: result, error: applyError } = await svc
      .rpc("apply_paid_subscription", {
        p_provider: provider,
        p_provider_ref: providerRef,
        p_status: status,
        p_payload: payload,
      });
    if (applyError || !result) {
      if (typeof applyError?.message === "string" && applyError.message.startsWith("Transaction inconnue.")) {
        return notFound(applyError.message);
      }
      return serverError();
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

    return ok({
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
    if (e instanceof ValidationError) return badRequest(e.message);
    return serverError();
  }
});
