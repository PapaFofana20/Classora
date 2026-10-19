import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useCurrentUser } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { payInstallments } from "@/services/paymentService";
import type { PaymentRow } from "@/services/paymentRows";
import type { PayMethod } from "@/types";
import { cn } from "@/utils/cn";
import { formatCurrency, isValidSnPhone } from "@/utils/format";
import { PAY_METHOD_LABELS, remaining } from "@/utils/payments";
import { Receipt } from "./Receipt";

const METHODS: { id: Exclude<PayMethod, "especes">; color: string; short: string; hint: string }[] = [
  { id: "wave", color: "bg-sky-500", short: "W", hint: "Paiement instantané avec l'application Wave" },
  { id: "orange_money", color: "bg-orange-500", short: "OM", hint: "Composez #144# ou utilisez l'app Orange Money" },
  { id: "free_money", color: "bg-red-600", short: "F", hint: "Validez avec votre code Free Money" },
];

type Step = "method" | "phone" | "waiting" | "done";

interface Props {
  open: boolean;
  items: PaymentRow[];
  schoolName: string;
  onClose: () => void;
  onPaid: () => void;
}

/** Parcours simulé de paiement Wave / Orange Money / Free Money. */
export function PayFlow({ open, items, schoolName, onClose, onPaid }: Props) {
  const user = useCurrentUser();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("method");
  const [method, setMethod] = useState<Exclude<PayMethod, "especes"> | null>(null);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<PaymentRow[]>([]);
  const total = items.reduce((a, p) => a + remaining(p), 0);
  const phoneErr = phone && !isValidSnPhone(phone) ? "Numéro invalide. Format attendu : 77 123 45 67." : null;

  const close = () => {
    if (step === "waiting") return;
    if (step === "done") onPaid();
    setStep("method");
    setMethod(null);
    setPhone("");
    setError(null);
    setReceipt([]);
    onClose();
  };

  const pay = async () => {
    if (!method) return;
    setStep("waiting");
    setError(null);
    try {
      const rows = await payInstallments(user, items.map((i) => i.id), method, phone.replace(/\s/g, ""));
      setReceipt(rows);
      setStep("done");
      toast(`Paiement de ${formatCurrency(total)} réussi.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Le paiement a échoué.");
      setStep("phone");
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={step === "done" ? "Paiement confirmé" : "Payer par mobile money"}
      footer={
        step === "method" ? (
          <><Button variant="outline" onClick={close}>Annuler</Button><Button variant="dark" disabled={!method} onClick={() => setStep("phone")}>Continuer</Button></>
        ) : step === "phone" ? (
          <><Button variant="outline" onClick={() => setStep("method")}>Retour</Button><Button variant="primary" disabled={!isValidSnPhone(phone)} onClick={() => void pay()}>Payer {formatCurrency(total)}</Button></>
        ) : step === "done" ? (
          <><Button variant="outline" icon="print" onClick={() => window.print()}>Imprimer le reçu</Button><Button variant="dark" onClick={close}>Terminer</Button></>
        ) : undefined
      }
    >
      <div className="mb-4 rounded-2xl bg-lime-soft p-4 text-sm">
        <p className="font-semibold text-forest">{items.length} échéance{items.length > 1 ? "s" : ""} · {items[0]?.studentName}</p>
        <p className="text-2xl font-extrabold text-forest">{formatCurrency(total)}</p>
      </div>
      {step === "method" && (
        <div className="grid gap-3" role="radiogroup" aria-label="Moyen de paiement">
          {METHODS.map((m) => (
            <button key={m.id} type="button" role="radio" aria-checked={method === m.id} onClick={() => setMethod(m.id)} className={cn("flex min-h-16 items-center gap-4 rounded-2xl border-2 p-4 text-left transition", method === m.id ? "border-forest bg-lime-pale" : "border-neutral-200 hover:border-forest/40")}>
              <span className={cn("grid size-12 shrink-0 place-items-center rounded-full text-sm font-extrabold text-white", m.color)}>{m.short}</span>
              <span><span className="block font-bold">{PAY_METHOD_LABELS[m.id]}</span><span className="block text-xs text-neutral-500">{m.hint}</span></span>
              {method === m.id && <Icon name="check_circle" fill className="ml-auto text-forest" />}
            </button>
          ))}
        </div>
      )}
      {step === "phone" && method && (
        <div className="space-y-3">
          {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-medium text-danger">{error}</p>}
          <Input label={`Numéro ${PAY_METHOD_LABELS[method]}`} type="tel" inputMode="tel" icon="smartphone" placeholder="77 123 45 67" value={phone} onChange={(e) => setPhone(e.target.value)} error={phoneErr} hint="Vous recevrez une demande de confirmation sur ce numéro." autoFocus />
        </div>
      )}
      {step === "waiting" && (
        <div role="status" className="py-8 text-center">
          <span className="mx-auto grid size-20 animate-pulse place-items-center rounded-full bg-lime text-forest"><Icon name="smartphone" fill className="text-[40px]" /></span>
          <p className="mt-5 font-bold">En attente de validation sur votre téléphone…</p>
          <p className="mt-1 text-sm text-neutral-500">Confirmez le paiement avec votre code secret {method ? PAY_METHOD_LABELS[method] : ""}.</p>
        </div>
      )}
      {step === "done" && <Receipt payments={receipt} schoolName={schoolName} />}
    </Modal>
  );
}
