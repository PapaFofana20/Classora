import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useEffect, useState } from "react";
import { useToast } from "@/context/ToastContext";
import { priceFor } from "@/data/plans";
import { purchase, type PurchaseResult } from "@/services/subscriptionService";
import type { PayMethod, Plan } from "@/types";
import { cn } from "@/utils/cn";
import { formatCurrency, isValidSnPhone } from "@/utils/format";

const METHODS: { id: Exclude<PayMethod, "especes">; color: string; short: string; hint: string }[] = [
  { id: "wave", color: "bg-sky-500", short: "W", hint: "Paiement instantané avec l'application Wave" },
  { id: "orange_money", color: "bg-orange-500", short: "OM", hint: "Composez #144# ou utilisez l'app Orange Money" },
  { id: "free_money", color: "bg-red-600", short: "F", hint: "Validez avec votre code Free Money" },
];

type Step = "method" | "phone" | "waiting" | "done";

interface Props {
  open: boolean;
  schoolId: string;
  schoolName: string;
  plan: Plan;
  cycle: "monthly" | "yearly";
  onClose: () => void;
  onPaid: (result: PurchaseResult) => void;
}

/** Tunnel de paiement simulé : moyen → numéro → validation → succès. */
export function CheckoutFlow({ open, schoolId, schoolName, plan, cycle, onClose, onPaid }: Props) {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("method");
  const [method, setMethod] = useState<Exclude<PayMethod, "especes"> | null>(null);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);

  const amount = priceFor(plan, cycle);
  const phoneErr = phone && !isValidSnPhone(phone) ? "Numéro invalide. Format attendu : 77 123 45 67." : null;

  useEffect(() => {
    if (open) {
      setStep("method");
      setMethod(null);
      setPhone("");
      setError(null);
    }
  }, [open, plan.id, cycle]);

  const pay = async () => {
    if (!method) return;
    setStep("waiting");
    setError(null);
    try {
      const result = await purchase(schoolId, { schoolId, planId: plan.id, cycle, method, phone: phone.replace(/\s/g, "") });
      setStep("done");
      toast("Paiement confirmé.");
      onPaid(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Le paiement a échoué. Réessayez dans quelques instants.");
      setStep("phone");
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => (step === "waiting" ? undefined : onClose())}
      title={step === "done" ? "Paiement confirmé" : "Souscrire à votre formule"}
      footer={
        step === "method" ? (
          <>
            <Button variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button variant="dark" disabled={!method} onClick={() => setStep("phone")}>
              Continuer
            </Button>
          </>
        ) : step === "phone" ? (
          <>
            <Button variant="outline" onClick={() => setStep("method")}>
              Retour
            </Button>
            <Button variant="primary" disabled={!isValidSnPhone(phone)} onClick={() => void pay()}>
              Payer {formatCurrency(amount)}
            </Button>
          </>
        ) : (
          <Button variant="dark" onClick={onClose}>
            Fermer
          </Button>
        )
      }
    >
      <div className="mb-4 rounded-2xl bg-lime-soft p-4">
        <p className="font-semibold text-forest">
          {schoolName} · formule {plan.name}
        </p>
        <p className="text-2xl font-extrabold text-forest">{formatCurrency(amount)}</p>
        <p className="text-xs text-forest-600">
          {cycle === "yearly" ? "Facture annuelle" : "Facture mensuelle"} · {plan.studentLimit === null ? "élèves illimités" : `jusqu'à ${plan.studentLimit} élèves`}
        </p>
      </div>
      {step === "method" && (
        <div className="grid gap-3" role="radiogroup" aria-label="Moyen de paiement">
          {METHODS.map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={method === m.id}
              onClick={() => setMethod(m.id)}
              className={cn("flex min-h-16 items-center gap-4 rounded-2xl border-2 p-4 text-left transition", method === m.id ? "border-forest bg-lime-pale" : "border-neutral-200 hover:border-forest/40")}
            >
              <span className={cn("grid size-12 shrink-0 place-items-center rounded-full text-sm font-extrabold text-white", m.color)}>{m.short}</span>
              <span>
                <span className="block font-bold">{m.id === "wave" ? "Wave" : m.id === "orange_money" ? "Orange Money" : "Free Money"}</span>
                <span className="block text-xs text-neutral-500">{m.hint}</span>
              </span>
              {method === m.id && <Icon name="check_circle" fill className="ml-auto text-forest" />}
            </button>
          ))}
        </div>
      )}
      {step === "phone" && method && (
        <div className="space-y-3">
          {error && (
            <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-medium text-danger">
              {error}
            </p>
          )}
          <Input label="Numéro de téléphone" type="tel" inputMode="tel" icon="smartphone" placeholder="77 123 45 67" value={phone} onChange={(e) => setPhone(e.target.value)} error={phoneErr} hint="Vous recevrez une demande de confirmation sur ce numéro." autoFocus />
        </div>
      )}
      {step === "waiting" && (
        <div role="status" className="py-8 text-center">
          <span className="mx-auto grid size-20 animate-pulse place-items-center rounded-full bg-lime text-forest">
            <Icon name="smartphone" fill className="text-[40px]" />
          </span>
          <p className="mt-5 font-bold">Validation du paiement en cours…</p>
          <p className="mt-1 text-sm text-neutral-500">Confirmez le paiement sur votre téléphone.</p>
        </div>
      )}
      {step === "done" && (
        <Card className="!bg-lime-pale text-center">
          <span className="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-leaf text-white">
            <Icon name="check_circle" fill className="text-[36px]" />
          </span>
          <p className="text-lg font-extrabold text-forest">Votre abonnement est actif.</p>
          <p className="mt-1 text-sm text-forest-600">Votre matricule d'école est disponible sur l'écran suivant.</p>
        </Card>
      )}
    </Modal>
  );
}