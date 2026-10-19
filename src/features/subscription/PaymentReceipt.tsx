import { Logo } from "@/components/ui/Brand";
import { Icon } from "@/components/ui/Icon";
import { formatCurrency, formatDateTime } from "@/utils/format";
import { PAY_METHOD_LABELS } from "@/utils/payments";
import type { PurchaseResult } from "@/services/subscriptionService";

/** Reçu d'abonnement téléchargeable / imprimable après un paiement réussi. */
export function PaymentReceipt({ result }: { result: PurchaseResult }) {
  const method = result.subscription.method;
  return (
    <article className="print-area rounded-2xl border border-dashed border-forest/30 bg-white p-6" aria-label="Reçu d'abonnement">
      <div className="flex items-start justify-between gap-4">
        <Logo to="/app" />
        <div className="text-right text-xs text-neutral-500">
          <p className="font-bold uppercase tracking-wider text-forest">Reçu d'abonnement</p>
          <p>N° {result.subscription.paymentRef}</p>
          <p>{formatDateTime(result.paidAt)}</p>
        </div>
      </div>
      <p className="mt-4 text-sm text-neutral-600">{result.schoolName}</p>
      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="inline text-neutral-500">Formule : </dt>
          <dd className="inline font-bold">{result.plan.name}</dd>
        </div>
        <div>
          <dt className="inline text-neutral-500">Limite : </dt>
          <dd className="inline font-bold">{result.plan.studentLimit === null ? "Élèves illimités" : `${result.plan.studentLimit} élèves`}</dd>
        </div>
        <div>
          <dt className="inline text-neutral-500">Moyen : </dt>
          <dd className="inline font-bold">{method ? PAY_METHOD_LABELS[method] : "—"}</dd>
        </div>
        <div>
          <dt className="inline text-neutral-500">Valable jusqu'au : </dt>
          <dd className="inline font-bold">{formatDateTime(result.subscription.endsAt)}</dd>
        </div>
      </dl>
      <div className="mt-4 flex items-center justify-between rounded-xl bg-forest px-4 py-3 text-white print:border print:bg-transparent print:text-black">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Icon name="verified" fill className="text-lime print:text-black" />
          Montant payé
        </span>
        <span className="text-xl font-extrabold">{formatCurrency(result.amount)}</span>
      </div>
      <p className="mt-3 text-center text-xs text-neutral-500">Matricule d'école : <strong className="tracking-[0.3em] text-forest">{result.matricule}</strong></p>
    </article>
  );
}