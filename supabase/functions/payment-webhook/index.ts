/**
 * Webhook des prestataires de paiement (Wave / Orange Money / free Money).
 * Corrps BRUT signé HMAC-SHA256 (en-tête x-scolia-signature), idempotent :
 * rejouer la confirmation ne modifie ni l'échéance, ni les événements.
 */

import { audit, getAuthenticatedUser, serviceClient } from "../_shared/auth.ts";
import { badRequest, handleOptions, notFound, ok, serverError } from "../_shared/http.ts";
import { verifyWebhookSignature } from "../_shared/payments.ts";
import { expectObject, requireString, ValidationError } from "../_shared/validate.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  const svc = serviceClient();
  try {
    const raw = await req.text();
    let body: Record<string, unknown>;
    try {
      body = expectObject(JSON.parse(raw));
    } catch {
      return badRequest("Corps du webhook invalide.");
    }

    const isService = await getAuthenticatedUser(svc, req);
    const signature = req.headers.get("x-scolia-signature");
    if (signature) {
      try {
        await verifyWebhookSignature(raw, signature);
      } catch (e) {
        return badRequest(e instanceof Error ? e.message : "Signature de webhook invalide.");
      }
    } else if (isService === null) {
      // En local / sandbox, le secret partagé peut être envoyé en clair.
      const shared = body["secret"];
      if (typeof shared !== "string" || shared !== (Deno.env.get("SCOLIA_WEBHOOK_SECRET") ?? "scolia-dev-secret")) {
        return badRequest("Signature de webhook absente.");
      }
    }

    const provider = requireString(body, "provider", "Le prestataire", { max: 32 });
    const providerRef = requireString(body, "reference", "La référence", { max: 64 });
    const status = requireString(body, "status", "Le statut", { max: 16 });
    if (status !== "succeeded" && status !== "failed") {
      return badRequest("Statut de paiement invalide (succeeded ou failed attendu).");
    }

    // La transaction doit exister (créée par start-subscription).
    const { data: tx } = await svc
      .from("payment_transactions")
      .select("id, school_id, status")
      .eq("provider", provider)
      .eq("provider_ref", providerRef)
      .maybeSingle();
    if (!tx) {
      return notFound("Transaction inconnue. Aucun paiement n'a été initialisé pour cette référence.");
    }

    const { data: result, error: applyError } = await svc
      .rpc("apply_paid_subscription", {
        p_provider: provider,
        p_provider_ref: providerRef,
        p_status: status,
        p_payload: (body["payload"] ?? {}) as Record<string, unknown>,
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
