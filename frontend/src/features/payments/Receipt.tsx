import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Brand";
import type { PaymentRow } from "@/services/paymentRows";
import { formatCurrency, formatDateTime } from "@/utils/format";
import { PAY_METHOD_LABELS } from "@/utils/payments";

/** Reçu de paiement (imprimable). */
export function Receipt({ payments, schoolName }: { payments: PaymentRow[]; schoolName: string }) {
  if (payments.length === 0) return null;
  const first = payments[0];
  const total = payments.reduce((a, p) => a + p.paidAmount, 0);
  return (
    <article className="print-area rounded-2xl border border-dashed border-forest/30 bg-white p-6" aria-label="Reçu de paiement">
      <div className="flex items-start justify-between gap-4">
        <Logo to="/app" />
        <div className="text-right text-xs text-neutral-500">
          <p className="font-bold uppercase tracking-wider text-forest">Reçu de paiement</p>
          <p>N° {first.reference ?? "—"}</p>
          <p>{first.paidAt ? formatDateTime(first.paidAt) : ""}</p>
        </div>
      </div>
      <p className="mt-4 text-sm text-neutral-600">{schoolName}</p>
      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <div><dt className="inline text-neutral-500">Élève : </dt><dd className="inline font-bold">{first.studentName} ({first.className})</dd></div>
        <div><dt className="inline text-neutral-500">Payé par : </dt><dd className="inline font-bold">{first.parentName}</dd></div>
        <div><dt className="inline text-neutral-500">Moyen : </dt><dd className="inline font-bold">{first.method ? PAY_METHOD_LABELS[first.method] : "—"}</dd></div>
      </dl>
      <ul className="mt-4 divide-y divide-neutral-100 rounded-xl bg-mist text-sm print:bg-transparent">
        {payments.map((p) => (
          <li key={p.id} className="flex justify-between gap-3 px-4 py-2.5">
            <span>{p.label}</span>
            <strong>{formatCurrency(p.paidAmount)}</strong>
          </li>
        ))}
      </ul>
      <div className="@container mt-4 flex items-center justify-between gap-3 rounded-xl bg-forest px-4 py-3 text-white print:border print:bg-transparent print:text-black">
        <span className="flex items-center gap-2 text-sm font-semibold"><Icon name="verified" fill className="text-lime print:text-black" />Total payé</span>
        <span className="overflow-wrap-anywhere text-right text-[clamp(1rem,5cqi,1.25rem)] font-extrabold leading-tight tabular-nums">{formatCurrency(total)}</span>
      </div>
    </article>
  );
}
